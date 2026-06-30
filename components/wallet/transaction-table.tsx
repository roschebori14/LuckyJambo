import TransactionRow from "./transaction-row";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  createdAt: string;
}

interface Props {
  transactions: Transaction[];
}

export default function TransactionTable({ transactions }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="p-3 text-left">Reference</th>

            <th className="p-3 text-left">Type</th>

            <th className="p-3 text-left">Amount</th>

            <th className="p-3 text-left">Date</th>
          </tr>
        </thead>

        <tbody>
          {transactions.map((transaction) => (
            <TransactionRow key={transaction.id} {...transaction} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
