import { FraudAlert } from "@/types/admin";

interface Props {
  alerts: FraudAlert[];
}

export default function FraudAlerts({ alerts }: Props) {
  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div key={alert.id} className="rounded-lg border border-red-300 p-3">
          <p>{alert.reason}</p>
          <span>{alert.severity}</span>
        </div>
      ))}
    </div>
  );
}
