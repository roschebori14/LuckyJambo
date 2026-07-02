import { Check, ExternalLink } from "lucide-react";

interface PaymentLinkCardProps {
  paymentLink: string;
  amount: number;
}

export default function PaymentLinkCard({ paymentLink, amount }: PaymentLinkCardProps) {
  return (
    <div
      className="rounded-2xl p-5 space-y-3"
      style={{ border: "1px solid var(--lj-border)", background: "rgba(26, 86, 255, 0.08)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-white"
          style={{ background: "var(--lj-blue)" }}
        >
          <Check size={16} />
        </span>
        <div>
          <p className="text-sm font-bold text-white">Payment link ready</p>
          <p className="text-xs text-[var(--lj-muted)]">Pay {amount.toLocaleString()} XAF to complete your deposit</p>
        </div>
      </div>

      <a
        href={paymentLink}
        target="_blank"
        rel="noreferrer"
        className="lj-btn-primary flex w-full items-center justify-center gap-2"
      >
        Open Fapshi Payment Page <ExternalLink size={14} />
      </a>

      <p className="text-center text-xs text-[var(--lj-muted)]">
        We&apos;ll detect your payment automatically once it&apos;s confirmed.
      </p>
    </div>
  );
}
