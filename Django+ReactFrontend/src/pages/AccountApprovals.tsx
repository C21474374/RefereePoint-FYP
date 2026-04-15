import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import AppIcon from "../components/AppIcon";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  approvePendingAccount,
  disapprovePendingAccount,
  fetchPendingApprovalAccounts,
  type PendingApprovalAccount,
} from "../services/approvals";
import { useToast } from "../context/ToastContext";
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
  const { showToast } = useToast();
  const { user } = useAuth();
  const canApproveAccounts = Boolean(user?.can_approve_accounts);

  const [pendingAccounts, setPendingAccounts] = useState<PendingApprovalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionUserId, setActionUserId] = useState<number | null>(null);
  const [pendingSectionExpanded, setPendingSectionExpanded] = useState(false);
  const [pendingDisapproveAccount, setPendingDisapproveAccount] =
    useState<PendingApprovalAccount | null>(null);

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
      const message = getErrorMessage(err, "Failed to load pending approvals.");
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [canApproveAccounts, showToast]);

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
      showToast(`Approved ${getAccountName(account)}.`, "success");
    } catch (err) {
      const message = getErrorMessage(err, "Failed to approve account.");
      setError(message);
      showToast(message, "error");
    } finally {
      setActionUserId(null);
    }
  };

  const handleDisapprove = async (account: PendingApprovalAccount) => {
    setPendingDisapproveAccount(account);
  };

  const confirmDisapprove = async () => {
    if (!pendingDisapproveAccount) {
      return;
    }
    const account = pendingDisapproveAccount;
    try {
      setActionUserId(account.id);
      setError("");
      setSuccess("");
      await disapprovePendingAccount(account.id);
      setPendingAccounts((prev) => prev.filter((item) => item.id !== account.id));
      setSuccess(`Disapproved ${getAccountName(account)} and removed the request.`);
      showToast(`Disapproved ${getAccountName(account)}.`, "success");
      setPendingDisapproveAccount(null);
    } catch (err) {
      const message = getErrorMessage(err, "Failed to disapprove account.");
      setError(message);
      showToast(message, "error");
    } finally {
      setActionUserId(null);
    }
  };

  if (!canApproveAccounts) {
    return (
      <div className="account-approvals-page">
        <div className="account-approvals-header">
          <h1 className="page-title-with-icon">
            <AppIcon name="approvals" className="page-title-icon" />
            <span>Account Approvals</span>
          </h1>
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
        <h1 className="page-title-with-icon">
          <AppIcon name="approvals" className="page-title-icon" />
          <span>Account Approvals</span>
        </h1>
        <p>Approve pending user accounts submitted for manual review.</p>
      </div>

      {error && <p className="account-approvals-error">{error}</p>}
      {success && <p className="account-approvals-success">{success}</p>}

      <section
        className={`account-approvals-card ${
          pendingSectionExpanded ? "expanded" : "collapsed"
        }`}
      >
        <div className="account-approvals-top">
          <h2 className="section-title-with-icon">
            <AppIcon name="user" className="section-title-icon" />
            <span>Pending Accounts</span>
          </h2>
          <span className="account-approvals-count">{pendingAccounts.length}</span>
        </div>
        <p className="account-approvals-section-copy">
          Expand this section to review and process pending registrations.
        </p>

        {pendingSectionExpanded && (
          <div className="account-approvals-section-content">
            {loading ? (
              <p className="account-approvals-empty">Loading pending accounts...</p>
            ) : pendingAccounts.length === 0 ? (
              <p className="account-approvals-empty">No pending accounts right now.</p>
            ) : (
              <div className="account-approvals-list">
                {pendingAccounts.map((account) => {
                  const requiresPhotoId =
                    account.account_type === "SCHOOL" || account.account_type === "COLLEGE";
                  const usesBipin = ["REFEREE", "CLUB", "DOA", "NL"].includes(
                    account.account_type
                  );
                  const showOrganisation = Boolean(account.organization_name);

                  return (
                    <article key={account.id} className="account-approvals-item">
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

                      <div className="account-approvals-actions">
                        <button
                          type="button"
                          className="account-approvals-disapprove"
                          onClick={() => handleDisapprove(account)}
                          disabled={actionUserId === account.id}
                        >
                          <span className="button-with-icon">
                            <AppIcon name="logout" />
                            <span>
                              {actionUserId === account.id ? "Processing..." : "Disapprove Request"}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(account)}
                          disabled={actionUserId === account.id}
                        >
                          <span className="button-with-icon">
                            <AppIcon name="approvals" />
                            <span>{actionUserId === account.id ? "Approving..." : "Approve Account"}</span>
                          </span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="account-approvals-section-toggle"
          onClick={() => setPendingSectionExpanded((prev) => !prev)}
          aria-expanded={pendingSectionExpanded}
        >
          <span className="inline-icon-label">
            <AppIcon name={pendingSectionExpanded ? "filter" : "plus"} />
            <span>{pendingSectionExpanded ? "Collapse" : "Expand"}</span>
          </span>
          <span className="account-approvals-section-toggle-icon" aria-hidden="true">
            {pendingSectionExpanded ? "^" : "v"}
          </span>
        </button>
      </section>

      <ConfirmDialog
        open={Boolean(pendingDisapproveAccount)}
        title="Disapprove Account"
        message={
          pendingDisapproveAccount
            ? `Disapprove ${getAccountName(
                pendingDisapproveAccount
              )}? This will delete their registration details.`
            : ""
        }
        confirmLabel="Disapprove Request"
        cancelLabel="Keep Request"
        confirmTone="danger"
        busy={
          Boolean(pendingDisapproveAccount) &&
          actionUserId === pendingDisapproveAccount?.id
        }
        onCancel={() => setPendingDisapproveAccount(null)}
        onConfirm={() => {
          void confirmDisapprove();
        }}
      />
    </div>
  );
}
