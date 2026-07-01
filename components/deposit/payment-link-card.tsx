interface PaymentLinkCardProps {
  paymentLink: string;
  amount: number;
}

export default function PaymentLinkCard({ paymentLink, amount }: PaymentLinkCardProps) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm text-white">✓</span>
        <div>
          <p className="text-sm font-bold text-gray-900">Payment link ready</p>
          <p className="text-xs text-gray-500">Pay {amount.toLocaleString()} XAF to complete your deposit</p>
        </div>
      </div>

      <a
        href={paymentLink}
        target="_blank"
        rel="noreferrer"
        className="flex w-full items-center justify-center rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
      >
        Open Fapshi Payment Page →
      </a>

      <p className="text-center text-xs text-gray-400">
        We&apos;ll detect your payment automatically once it&apos;s confirmed.
      </p>
    </div>
  );
}
