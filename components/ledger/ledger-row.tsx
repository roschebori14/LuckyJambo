interface LedgerRowProps {
  type: string;
  amount: number;
  reference: string;
  createdAt: string;
}

export default function LedgerRow({
  type,
  amount,
  reference,
  createdAt,
}: LedgerRowProps) {
  return (
    <tr className="border-b">
      <td className="p-3">{type}</td>
      <td className="p-3">{amount} XAF</td>
      <td className="p-3">{reference}</td>
      <td className="p-3">{new Date(createdAt).toLocaleString()}</td>
    </tr>
  );
}
