import DepositForm from "@/components/deposit/deposit-form";
import DepositHistory from "@/components/deposit/deposit-history";

export default function DepositPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Deposit Funds</h1>

      <DepositForm />

      <DepositHistory deposits={[]} />
    </div>
  );
}
