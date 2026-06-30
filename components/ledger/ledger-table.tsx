import LedgerRow from "./ledger-row";

interface Ledger {
  id: string;
  transaction_type: string;
  amount: number;
  reference: string;
  created_at: string;
}

interface LedgerTableProps {
  entries: Ledger[];
}

export default function LedgerTable({ entries }: LedgerTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="p-3 text-left">Type</th>

            <th className="p-3 text-left">Amount</th>

            <th className="p-3 text-left">Reference</th>

            <th className="p-3 text-left">Date</th>
          </tr>
        </thead>

        <tbody>
          {entries.map((entry) => (
            <LedgerRow
              key={entry.id}
              type={entry.transaction_type}
              amount={entry.amount}
              reference={entry.reference}
              createdAt={entry.created_at}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
