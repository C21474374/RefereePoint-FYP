import { useEffect, useState } from "react";
import {
  approveCoverRequest,
  cancelCoverRequest,
  claimCoverRequest,
  getCoverRequests,
  getMyCoverRequests,
  getPendingCoverRequests,
  withdrawCoverClaim,
  type CoverRequest,
} from "../services/coverRequests";
import {
  fetchCurrentUser,
  getAccessToken,
  type CurrentUser,
} from "../services/auth";
import AppIcon from "../components/AppIcon";
import UploadCoverRequestPanel from "../components/UploadCoverRequestPanel";
import CoverRequestCard from "../components/coverRequests/CoverRequestCard";
import { useToast } from "../context/ToastContext";
import "./CoverRequests.css";

type CoverSectionKey =
  | "manageCoverRequests"
  | "availableCoverRequests"
  | "approvalQueue"
  | "processedCoverRequests";

// Persisted expanded/collapsed section preferences per user.
const COVER_REQUESTS_PREFS_KEY_PREFIX = "refereepoint.cover-requests.prefs";

export default function CoverRequestsPage() {
  const { showToast } = useToast();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [myCoverRequests, setMyCoverRequests] = useState<CoverRequest[]>([]);
  const [availableCoverRequests, setAvailableCoverRequests] = useState<CoverRequest[]>([]);
  const [adminApprovalQueue, setAdminApprovalQueue] = useState<CoverRequest[]>([]);
  const [adminProcessedCoverRequests, setAdminProcessedCoverRequests] = useState<CoverRequest[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<CoverSectionKey, boolean>>({
    manageCoverRequests: false,
    availableCoverRequests: false,
    approvalQueue: false,
    processedCoverRequests: false,
  });

  const isAdminApprover =
    Boolean(currentUser?.can_approve_accounts) ||
    (Boolean(currentUser?.doa_approved) &&
      (currentUser?.account_type === "DOA" || currentUser?.account_type === "NL"));
  const isRefereeView = Boolean(currentUser?.referee_profile) && !isAdminApprover;

  useEffect(() => {
    if (!currentUser?.id || typeof window === "undefined") {
      return;
    }

    const storageKey = `${COVER_REQUESTS_PREFS_KEY_PREFIX}.${currentUser.id}`;
    try {
      const rawValue = window.localStorage.getItem(storageKey);
      if (!rawValue) {
        return;
      }
      const parsed = JSON.parse(rawValue) as {
        expandedSections?: Partial<Record<CoverSectionKey, boolean>>;
      };
      if (parsed.expandedSections) {
        setExpandedSections((prev) => ({
          ...prev,
          ...parsed.expandedSections,
        }));
      }
    } catch {
      // Ignore invalid persisted preferences.
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id || typeof window === "undefined") {
      return;
    }

    const storageKey = `${COVER_REQUESTS_PREFS_KEY_PREFIX}.${currentUser.id}`;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          expandedSections,
        })
      );
    } catch {
      // Ignore local storage failures.
    }
  }, [currentUser?.id, expandedSections]);

  const toggleSection = (key: CoverSectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const fetchData = async (userOverride?: CurrentUser | null) => {
    try {
      setLoading(true);
      setError("");
      const activeUser = userOverride ?? currentUser;
      const fetchAsAdmin =
        Boolean(activeUser?.can_approve_accounts) ||
        (Boolean(activeUser?.doa_approved) &&
          (activeUser?.account_type === "DOA" || activeUser?.account_type === "NL"));

      if (fetchAsAdmin) {
        const [claimedRequests, approvedRequests, rejectedRequests] = await Promise.all([
          getCoverRequests("CLAIMED"),
          getCoverRequests("APPROVED"),
          getCoverRequests("REJECTED"),
        ]);

        const processed = [...approvedRequests, ...rejectedRequests].sort((a, b) => {
          const left = Date.parse(b.updated_at || b.created_at || "");
          const right = Date.parse(a.updated_at || a.created_at || "");
          return left - right;
        });

        setAdminApprovalQueue(claimedRequests);
        setAdminProcessedCoverRequests(processed);
        setMyCoverRequests([]);
        setAvailableCoverRequests([]);
      } else {
        const [myCoverRequestsData, availableCoverRequestsData] = await Promise.all([
          getMyCoverRequests(),
          getPendingCoverRequests(),
        ]);

        setMyCoverRequests(myCoverRequestsData);
        setAvailableCoverRequests(availableCoverRequestsData);
        setAdminApprovalQueue([]);
        setAdminProcessedCoverRequests([]);
      }
    } catch (err) {
      setError("Failed to load cover requests.");
      showToast("Failed to load cover requests.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initPage = async () => {
      try {
        const token = getAccessToken();

        if (token) {
          const user = await fetchCurrentUser(token);
          setCurrentUser(user);
          await fetchData(user);
        } else {
          await fetchData();
        }
      } catch (err) {
        setError("Failed to load cover requests.");
        showToast("Failed to load cover requests.", "error");
        setLoading(false);
      }
    };

    initPage();
  }, []);

  const handleClaim = async (id: number) => {
    try {
      setActionLoadingId(id);
      setError("");
      await claimCoverRequest(id);
      await fetchData();
    } catch (err) {
      setError("Failed to claim cover request.");
      showToast("Failed to claim cover request.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (id: number) => {
    try {
      setActionLoadingId(id);
      setError("");
      await cancelCoverRequest(id);
      await fetchData();
    } catch (err) {
      setError("Failed to cancel cover request.");
      showToast("Failed to cancel cover request.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleWithdrawClaim = async (id: number) => {
    try {
      setActionLoadingId(id);
      setError("");
      await withdrawCoverClaim(id);
      await fetchData();
    } catch (err) {
      setError("Failed to cancel cover claim.");
      showToast("Failed to cancel cover claim.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      setActionLoadingId(id);
      setError("");
      await approveCoverRequest(id);
      showToast("Cover request approved.", "success");
      await fetchData();
      window.dispatchEvent(new Event("refereepoint:data-refresh"));
    } catch (err) {
      setError("Failed to approve cover request.");
      showToast("Failed to approve cover request.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="cover-requests-page">
      <div className="cover-requests-page-header">
        <div>
          <h1 className="page-title-with-icon">
            <AppIcon name="whistle" className="page-title-icon" />
            <span>Cover Requests</span>
          </h1>
          <p>
            {isAdminApprover
              ? "Review claimed cover requests and approve replacement referees."
              : "Request cover for your games or claim open cover requests from other referees."}
          </p>
        </div>
      </div>

      {loading && (
        <p className="cover-requests-page-message">Loading cover requests...</p>
      )}

      {error && <p className="cover-requests-page-error">{error}</p>}

      {isRefereeView && !loading && (
        <div className="cover-requests-primary-action-row">
          <button
            type="button"
            className="cover-request-create-btn"
            onClick={() => {
              setError("");
              setShowRequestModal(true);
            }}
          >
            <span className="button-with-icon">
              <AppIcon name="plus" />
              <span>Request Cover</span>
            </span>
          </button>
        </div>
      )}

      {!loading && (
        <>
          {isAdminApprover ? (
            <>
              <section
                className={`cover-requests-section ${
                  expandedSections.approvalQueue ? "expanded" : "collapsed"
                }`}
              >
                <div className="cover-requests-section-header">
                  <h2 className="section-title-with-icon">
                    <AppIcon name="approvals" className="section-title-icon" />
                    <span>Approval Queue</span>
                  </h2>
                  <p>Claimed cover requests waiting for DOA/NL approval.</p>
                </div>

                {expandedSections.approvalQueue && (
                  <div className="cover-requests-section-content">
                    {adminApprovalQueue.length === 0 ? (
                      <div className="cover-requests-empty">
                        <p>No claimed cover requests waiting for approval.</p>
                      </div>
                    ) : (
                      <div className="cover-requests-grid">
                        {adminApprovalQueue.map((coverRequest) => (
                          <CoverRequestCard
                            key={coverRequest.id}
                            coverRequest={coverRequest}
                            canApprove
                            onApprove={handleApprove}
                            loadingActionId={actionLoadingId}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="cover-requests-section-toggle"
                  onClick={() => toggleSection("approvalQueue")}
                  aria-expanded={expandedSections.approvalQueue}
                  aria-label={expandedSections.approvalQueue ? "Collapse section" : "Expand section"}
                  title={expandedSections.approvalQueue ? "Collapse section" : "Expand section"}
                >
                  <span className="inline-icon-label">
                    <AppIcon
                      name={expandedSections.approvalQueue ? "filter" : "plus"}
                      className="cover-requests-section-toggle-icon"
                    />
                    <span>{expandedSections.approvalQueue ? "Collapse" : "Expand"}</span>
                  </span>
                </button>
              </section>

              <section
                className={`cover-requests-section ${
                  expandedSections.processedCoverRequests ? "expanded" : "collapsed"
                }`}
              >
                <div className="cover-requests-section-header">
                  <h2 className="section-title-with-icon">
                    <AppIcon name="whistle" className="section-title-icon" />
                    <span>Processed Cover Requests</span>
                  </h2>
                  <p>Recently approved or closed cover requests.</p>
                </div>

                {expandedSections.processedCoverRequests && (
                  <div className="cover-requests-section-content">
                    {adminProcessedCoverRequests.length === 0 ? (
                      <div className="cover-requests-empty">
                        <p>No processed cover requests yet.</p>
                      </div>
                    ) : (
                      <div className="cover-requests-grid">
                        {adminProcessedCoverRequests.map((coverRequest) => (
                          <CoverRequestCard
                            key={coverRequest.id}
                            coverRequest={coverRequest}
                            loadingActionId={actionLoadingId}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="cover-requests-section-toggle"
                  onClick={() => toggleSection("processedCoverRequests")}
                  aria-expanded={expandedSections.processedCoverRequests}
                  aria-label={
                    expandedSections.processedCoverRequests ? "Collapse section" : "Expand section"
                  }
                  title={
                    expandedSections.processedCoverRequests ? "Collapse section" : "Expand section"
                  }
                >
                  <span className="inline-icon-label">
                    <AppIcon
                      name={expandedSections.processedCoverRequests ? "filter" : "plus"}
                      className="cover-requests-section-toggle-icon"
                    />
                    <span>{expandedSections.processedCoverRequests ? "Collapse" : "Expand"}</span>
                  </span>
                </button>
              </section>
            </>
          ) : (
            <>
              <section
                className={`cover-requests-section ${
                  expandedSections.manageCoverRequests ? "expanded" : "collapsed"
                }`}
              >
                <div className="cover-requests-section-header">
                  <h2 className="section-title-with-icon">
                    <AppIcon name="whistle" className="section-title-icon" />
                    <span>Manage Cover Requests</span>
                  </h2>
                  <p>Requests you created and requests you have claimed.</p>
                </div>

                {expandedSections.manageCoverRequests && (
                  <div className="cover-requests-section-content">
                    {myCoverRequests.length === 0 ? (
                      <div className="cover-requests-empty">
                        <p>You have no cover requests yet.</p>
                      </div>
                    ) : (
                      <div className="cover-requests-grid">
                        {myCoverRequests.map((coverRequest) => {
                          const isRequestedByMe = currentUser
                            ? coverRequest.requested_by === currentUser.id
                            : false;

                          const isClaimedByMe = currentUser?.referee_profile
                            ? coverRequest.replaced_by === currentUser.referee_profile.id
                            : false;

                          return (
                            <CoverRequestCard
                              key={coverRequest.id}
                              coverRequest={coverRequest}
                              loadingActionId={actionLoadingId}
                              isRequestedByMe={isRequestedByMe}
                              isClaimedByMe={isClaimedByMe}
                              canCancel={isRequestedByMe && coverRequest.status === "PENDING"}
                              canWithdrawClaim={isClaimedByMe && coverRequest.status === "CLAIMED"}
                              onCancel={handleCancel}
                              onWithdrawClaim={handleWithdrawClaim}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="cover-requests-section-toggle"
                  onClick={() => toggleSection("manageCoverRequests")}
                  aria-expanded={expandedSections.manageCoverRequests}
                  aria-label={
                    expandedSections.manageCoverRequests ? "Collapse section" : "Expand section"
                  }
                  title={
                    expandedSections.manageCoverRequests ? "Collapse section" : "Expand section"
                  }
                >
                  <span className="inline-icon-label">
                    <AppIcon
                      name={expandedSections.manageCoverRequests ? "filter" : "plus"}
                      className="cover-requests-section-toggle-icon"
                    />
                    <span>{expandedSections.manageCoverRequests ? "Collapse" : "Expand"}</span>
                  </span>
                </button>
              </section>

              <section
                className={`cover-requests-section ${
                  expandedSections.availableCoverRequests ? "expanded" : "collapsed"
                }`}
              >
                <div className="cover-requests-section-header">
                  <h2 className="section-title-with-icon">
                    <AppIcon name="basketball" className="section-title-icon" />
                    <span>Find Games to Cover</span>
                  </h2>
                  <p>Open requests from other referees that you can claim.</p>
                </div>

                {expandedSections.availableCoverRequests && (
                  <div className="cover-requests-section-content">
                    {availableCoverRequests.length === 0 ? (
                      <div className="cover-requests-empty">
                        <p>No cover requests available right now.</p>
                      </div>
                    ) : (
                      <div className="cover-requests-grid">
                        {availableCoverRequests.map((coverRequest) => (
                          <CoverRequestCard
                            key={coverRequest.id}
                            coverRequest={coverRequest}
                            canClaim
                            onClaim={handleClaim}
                            loadingActionId={actionLoadingId}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="cover-requests-section-toggle"
                  onClick={() => toggleSection("availableCoverRequests")}
                  aria-expanded={expandedSections.availableCoverRequests}
                  aria-label={
                    expandedSections.availableCoverRequests ? "Collapse section" : "Expand section"
                  }
                  title={
                    expandedSections.availableCoverRequests ? "Collapse section" : "Expand section"
                  }
                >
                  <span className="inline-icon-label">
                    <AppIcon
                      name={expandedSections.availableCoverRequests ? "filter" : "plus"}
                      className="cover-requests-section-toggle-icon"
                    />
                    <span>{expandedSections.availableCoverRequests ? "Collapse" : "Expand"}</span>
                  </span>
                </button>
              </section>
            </>
          )}
        </>
      )}

      {isRefereeView && showRequestModal && (
        <div
          className="upload-modal-overlay"
          onClick={() => setShowRequestModal(false)}
        >
          <div className="upload-modal" onClick={(event) => event.stopPropagation()}>
            <div className="upload-modal-header">
              <h2 className="section-title-with-icon">
                <AppIcon name="whistle" className="section-title-icon" />
                <span>Request Cover</span>
              </h2>
              <button
                type="button"
                className="upload-modal-close"
                onClick={() => setShowRequestModal(false)}
              >
                Close
              </button>
            </div>
            <div className="upload-modal-body">
              <UploadCoverRequestPanel
                onUploaded={async () => {
                  setShowRequestModal(false);
                  await fetchData();
                  window.dispatchEvent(new Event("refereepoint:data-refresh"));
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
