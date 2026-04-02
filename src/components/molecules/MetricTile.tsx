import { Card } from "@/components/atoms/Card";

export function MetricTile({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="rounded-[1.5rem] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-moss/65">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink/65">{detail}</p>
    </Card>
  );
}
