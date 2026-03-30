import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  approvePendingAccount,
  fetchPendingApprovalAccounts,
  type PendingApprovalAccount,
} from "../services/approvals";
import "../pages_css/AccountApprovals.css";

const API_HOST = "http://localhost:8000";

function getErrorMessage(error: unknown, fallback: string) {
  const maybe = error as {
    response?: { data?: { detail?: string } };
    message?: string;
  };
  const apiMessage = maybe?.response?.data?.detail;
  if (apiMessage) {
    return apiMessage;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function getAccountName(account: PendingApprovalAccount) {
  const fullName = `${account.first_name || ""} ${account.last_name || ""}`.trim();
  return fullName || account.email;
}

function normalizeFileUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${API_HOST}${url}`;
  }
  return `${API_HOST}/${url}`;
}

export default function AccountApprovals() {
  const { user } = useAuth();
  const canApproveAccounts = Boolean(user?.can_approve_accounts);

  const [pendingAccounts, setPendingAccounts] = useState<PendingApprovalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionUserId, setActionUserId] = useState<number | null>(null);

  const loadPendingAccounts = useCallback(async () => {
    if (!canApproveAccounts) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const accounts = await fetchPendingApprovalAccounts();
      setPendingAccounts(accounts);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load pending approvals."));
    } finally {
      setLoading(false);
    }
  }, [canApproveAccounts]);

  useEffect(() => {
    loadPendingAccounts();
  }, [loadPendingAccounts]);

  const handleApprove = async (account: PendingApprovalAccount) => {
    try {
      setActionUserId(account.id);
      setError("");
      setSuccess("");
      await approvePendingAccount(account.id);
      setPendingAccounts((prev) => prev.filter((item) => item.id !== account.id));
      setSuccess(`Approved ${getAccountName(account)} successfully.`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to approve account."));
    } finally {
      setActionUserId(null);
    }
  };

  if (!canApproveAccounts) {
    return (
      <div className="account-approvals-page">
        <div className="account-approvals-header">
          <h1>Account Approvals</h1>
          <p>Review and approve pending registrations.</p>
        </div>

        <section className="account-approvals-card">
          <p className="account-approvals-empty">
            You do not have permission to approve accounts.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="account-approvals-page">
      <div className="account-approvals-header">
        <h1>Account Approvals</h1>
        <p>Approve pending user accounts submitted for manual review.</p>
      </div>

      {error && <p className="account-approvals-error">{error}</p>}
      {success && <p className="account-approvals-success">{success}</p>}

      <section className="account-approvals-card">
        <div className="account-approvals-top">
          <h2>Pending Accounts</h2>
          <span>{pendingAccounts.length}</span>
        </div>

        {loading ? (
          <p className="account-approvals-empty">Loading pending accounts...</p>
        ) : pendingAccounts.length === 0 ? (
          <p className="account-approvals-empty">No pending accounts right now.</p>
        ) : (
          <div className="account-approvals-list">
            {pendingAccounts.map((account) => (
              <article key={account.id} className="account-approvals-item">
                {/*
                  Verification requirements are role-based:
                  - School/College: photo ID + institution head phone
                  - Referee/Club/DOA/NL: BIPIN
                  There is no generic verification ID field for non-ref roles.
                */}
                {(() => {
                  const requiresPhotoId =
                    account.account_type === "SCHOOL" || account.account_type === "COLLEGE";
                  const usesBipin = ["REFEREE", "CLUB", "DOA", "NL"].includes(
                    account.account_type
                  );
                  const showOrganisation = Boolean(account.organization_name);

                  return (
                    <>
                      <div className="account-approvals-item-header">
                        <div>
                          <h3>{getAccountName(account)}</h3>
                          <p>{account.email}</p>
                        </div>
                        <span className="account-approvals-role">{account.account_type_display}</span>
                      </div>

                      <div className="account-approvals-grid">
                        <div>
                          <span>Phone</span>
                          <p>{account.phone_number || "Not provided"}</p>
                        </div>

                        {usesBipin && (
                          <div>
                            <span>BIPIN</span>
                            <p>{account.bipin_number || "Not provided"}</p>
                          </div>
                        )}

                        {showOrganisation && (
                          <div>
                            <span>Organisation</span>
                            <p>{account.organization_name || "Not provided"}</p>
                          </div>
                        )}

                        {requiresPhotoId && (
                          <div>
                            <span>Institution Head Phone</span>
                            <p>{account.institution_head_phone || "Not provided"}</p>
                          </div>
                        )}

                        {requiresPhotoId && (
                          <div>
                            <span>Photo ID</span>
                            {account.verification_id_photo ? (
                              <a
                                href={normalizeFileUrl(account.verification_id_photo)}
                                target="_blank"
                                rel="noreferrer"
                                className="account-approvals-link"
                              >
                                Open File
                              </a>
                            ) : (
                              <p>Not provided</p>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

                <div className="account-approvals-actions">
                  <button
                    type="button"
                    onClick={() => handleApprove(account)}
                    disabled={actionUserId === account.id}
                  >
                    {actionUserId === account.id ? "Approving..." : "Approve Account"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
