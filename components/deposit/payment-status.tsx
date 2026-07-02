import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface PaymentStatusProps {
  status: "pending" | "completed" | "failed";
}

export default function PaymentStatus({ status }: PaymentStatusProps) {
  const config = {
    pending: {
      text: "Waiting for payment…",
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.1)",
      border: "rgba(245, 158, 11, 0.3)",
      icon: <Loader2 size={16} className="animate-spin" />,
    },
    completed: {
      text: "Payment completed — funds added to your wallet",
      color: "var(--lj-success)",
      bg: "rgba(0, 214, 143, 0.1)",
      border: "rgba(0, 214, 143, 0.3)",
      icon: <CheckCircle2 size={16} />,
    },
    failed: {
      text: "Payment failed or was cancelled",
      color: "var(--lj-danger)",
      bg: "rgba(255, 61, 90, 0.1)",
      border: "rgba(255, 61, 90, 0.3)",
      icon: <XCircle size={16} />,
    },
  }[status];

  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium"
      style={{ color: config.color, background: config.bg, borderColor: config.border }}
    >
      {config.icon}
      <p>{config.text}</p>
    </div>
  );
}
