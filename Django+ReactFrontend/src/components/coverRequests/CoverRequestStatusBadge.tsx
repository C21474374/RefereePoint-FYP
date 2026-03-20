import "./CoverRequestStatusBadge.css";

type Props = {
  status: "PENDING" | "CLAIMED" | "APPROVED" | "REJECTED";
};

export default function CoverRequestStatusBadge({ status }: Props) {
  return (
    <span className={`cover-status-badge cover-status-${status.toLowerCase()}`}>
      {status}
    </span>
  );
}