import axiosInstance from "./axiosInstance";
import type { CurrentUser } from "./auth";

export type PendingApprovalAccount = CurrentUser;

export async function fetchPendingApprovalAccounts() {
  const response = await axiosInstance.get<PendingApprovalAccount[]>(
    "/users/approvals/pending/"
  );
  return response.data;
}

export async function approvePendingAccount(userId: number) {
  const response = await axiosInstance.patch<PendingApprovalAccount>(
    `/users/approvals/${userId}/`,
    {
      doa_approved: true,
    }
  );
  return response.data;
}

export async function disapprovePendingAccount(userId: number) {
  await axiosInstance.delete(`/users/approvals/${userId}/`);
}
