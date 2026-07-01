interface PaymentStatusProps {
  status: "pending" | "completed" | "failed";
}

export default function PaymentStatus({ status }: PaymentStatusProps) {
  const config = {
    pending: {
      text: "Waiting for payment…",
      classes: "bg-amber-50 text-amber-700 border-amber-200",
      icon: (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      ),
    },
    completed: {
      text: "Payment completed — funds added to your wallet",
      classes: "bg-green-50 text-green-700 border-green-200",
      icon: <span>✅</span>,
    },
    failed: {
      text: "Payment failed or was cancelled",
      classes: "bg-red-50 text-red-700 border-red-200",
      icon: <span>❌</span>,
    },
  }[status];

  return (
    <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${config.classes}`}>
      {config.icon}
      <p>{config.text}</p>
    </div>
  );
}
