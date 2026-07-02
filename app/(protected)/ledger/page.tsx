import LedgerTable from "@/components/ledger/ledger-table";

export default function LedgerPage() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Transaction Ledger</h1>

      <LedgerTable entries={[]} />
    </div>
  );
}
