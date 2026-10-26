import type { UsageLog } from '../types/usage';
const MINUTE = 60000;
export function parseLocal(value: string): Date {
  const [day, time] = value.split('T');
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, date, hour, minute);
}
export function sessionMinutes(start: string, end: string): number {
  return (parseLocal(end).getTime() - parseLocal(start).getTime()) / MINUTE;
}
export function sessionKwh(log: UsageLog): number {
  return log.ratedWatts * log.factor * sessionMinutes(log.start, log.end) / 60000;
}
export function sessionCost(log: UsageLog): number { return sessionKwh(log) * log.rate; }
export interface DailyUsage { date: string; minutes: number; kwh: number; cost: number; }
function localDate(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
// Split overnight sessions at each local midnight, so day/week/month totals are correct.
export function aggregateDaily(logs: UsageLog[]): DailyUsage[] {
  const map = new Map<string, DailyUsage>();
  for (const log of logs) {
    let cursor = parseLocal(log.start).getTime();
    const end = parseLocal(log.end).getTime();
    while (cursor < end) {
      const date = new Date(cursor);
      const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()+1).getTime();
      const stop = Math.min(midnight, end);
      const minutes = (stop-cursor)/MINUTE;
      const key = localDate(date);
      const prev = map.get(key) ?? { date:key, minutes:0, kwh:0, cost:0 };
      const kwh = log.ratedWatts * log.factor * minutes / 60000;
      prev.minutes += minutes; prev.kwh += kwh; prev.cost += kwh * log.rate;
      map.set(key, prev);
      cursor = stop;
    }
  }
  return [...map.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
export function localDateString(date: Date) { return localDate(date); }
