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
import CoverRequestCard from "../components/coverRequests/CoverRequestCard";
import "../pages_css/CoverRequests.css";

type CoverSectionKey =
  | "manageCoverRequests"
  | "availableCoverRequests";

export default function CoverRequestsPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [myCoverRequests, setMyCoverRequests] = useState<CoverRequest[]>([]);
  const [availableCoverRequests, setAvailableCoverRequests] = useState<CoverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<CoverSectionKey, boolean>>({
    manageCoverRequests: false,
    availableCoverRequests: false,
  });

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
      console.error(err);
      setError("Failed to load cover requests.");
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
        console.error(err);
        setError("Failed to load cover requests.");
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
      console.error(err);
      setError("Failed to claim cover request.");
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
      console.error(err);
      setError("Failed to cancel cover request.");
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
      console.error(err);
      setError("Failed to cancel cover claim.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="cover-requests-page">
      <div className="cover-requests-page-header">
        <h1>Cover Requests</h1>
        <p>
          Request cover for your games or claim open cover requests from other
          referees.
        </p>
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
              <h2>Manage Cover Requests</h2>
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
              <span>{expandedSections.manageCoverRequests ? "Collapse" : "Expand"}</span>
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
              <h2>Find Games to Cover</h2>
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
              <span>{expandedSections.availableCoverRequests ? "Collapse" : "Expand"}</span>
              <span className="cover-requests-section-toggle-icon" aria-hidden="true">
                {expandedSections.availableCoverRequests ? "^" : "v"}
              </span>
            </button>
          </section>
        </>
      )}
    </div>
  );
}
