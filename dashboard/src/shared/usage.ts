export const metrics = {
  mobile_data_bytes: "Mobile data",
  wifi_data_bytes: "Wi-Fi data",
  screen_time_seconds: "Screen time",
  application_foreground_seconds: "Application foreground time",
};
export function localDate(timezone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function offsetDate(date: string, days: number) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
// Keep the exact API decimal in the UI. Never round large values through Number.
export function exactValue(value: string | null, metric: string) {
  if (value === null) return "No observations";
  const [whole, fraction = ""] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = fraction.replace(/0+$/, "");
  return `${grouped}${decimals ? "." + decimals : ""} ${metric.endsWith("_bytes") ? "bytes" : "seconds"}`;
}
export function duration(milliseconds: number) {
  return `${(milliseconds / 3600000).toFixed(2)} h`;
}
