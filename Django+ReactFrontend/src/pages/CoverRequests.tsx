import { useEffect, useState } from "react";
import {
  cancelCoverRequest,
  claimCoverRequest,
  createCoverRequest,
  getMyCoverRequests,
  getMyUpcomingAssignments,
  getPendingCoverRequests,
  withdrawCoverClaim,
  type CoverRequest,
  type UpcomingAssignment,
} from "../services/coverRequests";
import {
  fetchCurrentUser,
  getAccessToken,
  type CurrentUser,
} from "../services/auth";
import CoverRequestCard from "../components/coverRequests/CoverRequestCard";
import MyAssignmentCard from "../components/coverRequests/MyAssignmentCard";
import "../pages_css/CoverRequests.css";

export default function CoverRequestsPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [myCoverRequests, setMyCoverRequests] = useState<CoverRequest[]>([]);
  const [myAssignments, setMyAssignments] = useState<UpcomingAssignment[]>([]);
  const [availableCoverRequests, setAvailableCoverRequests] = useState<CoverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [requestingAssignmentId, setRequestingAssignmentId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [myCoverRequestsData, assignmentsData, availableCoverRequestsData] =
        await Promise.all([
          getMyCoverRequests(),
          getMyUpcomingAssignments(),
          getPendingCoverRequests(),
        ]);

      setMyCoverRequests(myCoverRequestsData);
      setMyAssignments(assignmentsData);
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

  const handleRequestCover = async (assignment: UpcomingAssignment) => {
    try {
      setRequestingAssignmentId(assignment.assignment_id);
      setError("");

      await createCoverRequest({
        game: assignment.game_id,
        referee_slot: assignment.assignment_id,
        reason: "",
      });

      await fetchData();
    } catch (err) {
      console.error(err);
      setError("Failed to create cover request.");
    } finally {
      setRequestingAssignmentId(null);
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
          <section className="cover-requests-section">
            <div className="cover-requests-section-header">
              <h2>My Cover Requests</h2>
              <p>Requests you created and requests you have claimed.</p>
            </div>

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
          </section>

          <section className="cover-requests-section">
            <div className="cover-requests-section-header">
              <h2>My Upcoming Appointed Games</h2>
              <p>Request cover for games already assigned to you.</p>
            </div>

            {myAssignments.length === 0 ? (
              <div className="cover-requests-empty">
                <p>You have no upcoming appointed games.</p>
              </div>
            ) : (
              <div className="cover-requests-grid">
                {myAssignments.map((assignment) => (
                  <MyAssignmentCard
                    key={assignment.assignment_id}
                    assignment={assignment}
                    onRequestCover={handleRequestCover}
                    loading={requestingAssignmentId === assignment.assignment_id}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="cover-requests-section">
            <div className="cover-requests-section-header">
              <h2>Cover Requests I Can Take</h2>
              <p>Open requests from other referees that you can claim.</p>
            </div>

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
          </section>
        </>
      )}
    </div>
  );
}
