import { useEffect, useState } from "react";
import {
  approveCoverRequest,
  claimCoverRequest,
  getCoverRequests,
  type CoverRequest,
} from "../services/coverRequests";
import CoverRequestCard from "../components/coverRequests/CoverRequestCard";
import "../pages_css/CoverRequests.css";

export default function CoverRequestsPage() {
  const [coverRequests, setCoverRequests] = useState<CoverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const fetchCoverRequests = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getCoverRequests();
      setCoverRequests(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load cover requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoverRequests();
  }, []);

  const handleClaim = async (id: number) => {
    try {
      setActionLoadingId(id);
      await claimCoverRequest(id);
      await fetchCoverRequests();
    } catch (err) {
      console.error(err);
      setError("Failed to claim cover request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      setActionLoadingId(id);
      await approveCoverRequest(id);
      await fetchCoverRequests();
    } catch (err) {
      console.error(err);
      setError("Failed to approve cover request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="cover-requests-page">
      <div className="cover-requests-page-header">
        <h1>Cover Requests</h1>
        <p>View, claim, and manage referee cover requests.</p>
      </div>

      {loading && <p className="cover-requests-page-message">Loading cover requests...</p>}
      {error && <p className="cover-requests-page-error">{error}</p>}

      {!loading && !error && coverRequests.length === 0 && (
        <div className="cover-requests-empty">
          <p>No cover requests available right now.</p>
        </div>
      )}

      <div className="cover-requests-grid">
        {coverRequests.map((coverRequest) => (
          <CoverRequestCard
            key={coverRequest.id}
            coverRequest={coverRequest}
            canClaim
            canApprove
            onClaim={handleClaim}
            onApprove={handleApprove}
            loadingActionId={actionLoadingId}
          />
        ))}
      </div>
    </div>
  );
}