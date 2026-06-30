import Link from "next/link";

interface DepositButtonProps {
  href?: string;
}

export default function DepositButton({
  href = "/wallet/deposit",
}: DepositButtonProps) {
  return (
    <Link
      href={href}
      className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
    >
      Deposit
    </Link>
  );
}
