import type { Recurrence } from "./models";
export const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
export const frequencyLabels = {
  MONTHLY: "Cada mes",
  WEEKLY: "Cada semana",
  QUARTERLY: "Cada tres meses",
  YEARLY: "Una vez al año",
  ONE_OFF: "Una sola vez",
  CUSTOM_MONTHS: "Solo algunos meses",
};
export function today() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export const monthLabel = (period: string) =>
  `${monthNames[Number(period.slice(5)) - 1]} ${period.slice(0, 4)}`;
export function shiftMonth(period: string, delta: number) {
  const d = new Date(`${period}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}
export function daysInMonth(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function occurrences(rule: Recurrence, period: string): string[] {
  if (
    rule.archivedAt ||
    (rule.endDate && rule.endDate < `${period}-01`) ||
    rule.startDate.slice(0, 7) > period
  )
    return [];
  const month = Number(period.slice(5));
  if (rule.activeMonths.length && !rule.activeMonths.includes(month)) return [];
  const end = `${period}-${daysInMonth(period)}`;
  const eligible = (date: string) =>
    date >= rule.startDate && (!rule.endDate || date <= rule.endDate);
  if (rule.frequency === "ONE_OFF")
    return rule.startDate.startsWith(period) && eligible(rule.startDate)
      ? [rule.startDate]
      : [];
  if (rule.frequency === "WEEKLY") {
    const first = new Date(`${period}-01T12:00:00Z`).valueOf();
    const start = new Date(`${rule.startDate}T12:00:00Z`).valueOf();
    const offset = Math.max(0, Math.ceil((first - start) / 604800000));
    const dates: string[] = [];
    for (
      let t = start + offset * 604800000;
      t <= new Date(`${end}T12:00:00Z`).valueOf();
      t += 604800000
    ) {
      const date = new Date(t).toISOString().slice(0, 10);
      if (eligible(date)) dates.push(date);
    }
    return dates;
  }
  const delta =
    (Number(period.slice(0, 4)) - Number(rule.startDate.slice(0, 4))) * 12 +
    month -
    Number(rule.startDate.slice(5, 7));
  if (rule.frequency === "QUARTERLY" && delta % 3 !== 0) return [];
  if (rule.frequency === "YEARLY" && delta % 12 !== 0) return [];
  const date = `${period}-${String(Math.min(rule.dueDay, daysInMonth(period))).padStart(2, "0")}`;
  return eligible(date) ? [date] : [];
}
