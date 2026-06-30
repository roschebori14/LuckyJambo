interface PaymentLinkCardProps {
  paymentLink: string;
}

export default function PaymentLinkCard({ paymentLink }: PaymentLinkCardProps) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">Complete Payment</h2>

      <a
        href={paymentLink}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-lg bg-green-600 px-4 py-3 text-white"
      >
        Open Payment Page
      </a>
    </div>
  );
}
