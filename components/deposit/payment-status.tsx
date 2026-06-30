interface PaymentStatusProps {
  status: "pending" | "completed" | "failed";
}

export default function PaymentStatus({ status }: PaymentStatusProps) {
  const text =
    status === "completed"
      ? "Payment Completed"
      : status === "failed"
        ? "Payment Failed"
        : "Waiting For Payment";

  return (
    <div className="rounded-lg border p-4">
      <p className="font-medium">{text}</p>
    </div>
  );
}
