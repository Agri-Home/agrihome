export const cn = (...tokens: Array<string | false | null | undefined>) =>
  tokens.filter(Boolean).join(" ");

export const formatRelativeTimestamp = (value: string) => {
  const date = new Date(value);
  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60]
  ];

  for (const [unit, secondsPerUnit] of units) {
    if (Math.abs(deltaSeconds) >= secondsPerUnit || unit === "minute") {
      return formatter.format(
        Math.round(deltaSeconds / secondsPerUnit),
        unit
      );
    }
  }

  return "just now";
};

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

export const clampPercent = (value: number) =>
  `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;
