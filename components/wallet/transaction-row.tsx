import { TransactionRowProps } from "@/types/wallet-ui";

export default function TransactionRow({
  id,
  type,
  amount,
  createdAt,
}: TransactionRowProps) {
  return (
    <tr className="border-b">
      <td className="p-3">{id.slice(0, 8)}</td>
      <td className="p-3 capitalize">{type}</td>
      <td className="p-3">{amount} XAF</td>
      <td className="p-3">{new Date(createdAt).toLocaleDateString()}</td>
    </tr>
  );
}
