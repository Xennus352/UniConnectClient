/**
 * Timetable wall-clock helpers.
 * Timetable times are stored as local wall-clock "HH:mm[:ss]" strings in
 * time_slots — NEVER parse them through Date (timezone-safe by design).
 */

/** "13:00" | "13:00:00" -> "1:00 PM" */
export function fmt12h(hhmm: string): string {
  const parts = hhmm.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** "09:00"-"11:00" -> "9:00 AM - 11:00 AM" */
export function fmtRange12(startHhmm: string, endHhmm: string): string {
  return `${fmt12h(startHhmm)} - ${fmt12h(endHhmm)}`;
}
