import { useEffect, useState } from "react";
import {
  cancelCoverRequest,
  claimCoverRequest,
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
  | "availableCoverRequests";

// Persisted expanded/collapsed section preferences per user.
const COVER_REQUESTS_PREFS_KEY_PREFIX = "refereepoint.cover-requests.prefs";

export default function CoverRequestsPage() {
  const { showToast } = useToast();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [myCoverRequests, setMyCoverRequests] = useState<CoverRequest[]>([]);
  const [availableCoverRequests, setAvailableCoverRequests] = useState<CoverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<CoverSectionKey, boolean>>({
    manageCoverRequests: false,
    availableCoverRequests: false,
  });

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

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [myCoverRequestsData, availableCoverRequestsData] = await Promise.all([
        getMyCoverRequests(),
        getPendingCoverRequests(),
      ]);

      setMyCoverRequests(myCoverRequestsData);
      setAvailableCoverRequests(availableCoverRequestsData);
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
        }

        await fetchData();
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

  return (
    <div className="cover-requests-page">
      <div className="cover-requests-page-header">
        <div>
          <h1 className="page-title-with-icon">
            <AppIcon name="cover" className="page-title-icon" />
            <span>Cover Requests</span>
          </h1>
          <p>
            Request cover for your games or claim open cover requests from other
            referees.
          </p>
        </div>
        {currentUser?.referee_profile && (
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
        )}
      </div>

      {loading && (
        <p className="cover-requests-page-message">Loading cover requests...</p>
      )}

      {error && <p className="cover-requests-page-error">{error}</p>}

      {!loading && (
        <>
          <section
            className={`cover-requests-section ${
              expandedSections.manageCoverRequests ? "expanded" : "collapsed"
            }`}
          >
            <div className="cover-requests-section-header">
              <h2 className="section-title-with-icon">
                <AppIcon name="settings" className="section-title-icon" />
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
            >
              <span className="inline-icon-label">
                <AppIcon name={expandedSections.manageCoverRequests ? "filter" : "plus"} />
                <span>{expandedSections.manageCoverRequests ? "Collapse" : "Expand"}</span>
              </span>
              <span className="cover-requests-section-toggle-icon" aria-hidden="true">
                {expandedSections.manageCoverRequests ? "^" : "v"}
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
                <AppIcon name="games" className="section-title-icon" />
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
            >
              <span className="inline-icon-label">
                <AppIcon name={expandedSections.availableCoverRequests ? "filter" : "plus"} />
                <span>{expandedSections.availableCoverRequests ? "Collapse" : "Expand"}</span>
              </span>
              <span className="cover-requests-section-toggle-icon" aria-hidden="true">
                {expandedSections.availableCoverRequests ? "^" : "v"}
              </span>
            </button>
          </section>
        </>
      )}

      {showRequestModal && (
        <div
          className="upload-modal-overlay"
          onClick={() => setShowRequestModal(false)}
        >
          <div className="upload-modal" onClick={(event) => event.stopPropagation()}>
            <div className="upload-modal-header">
              <h2 className="section-title-with-icon">
                <AppIcon name="cover" className="section-title-icon" />
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
