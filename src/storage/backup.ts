import type { UsageLog, Exposure } from '../types/usage';

export interface UsageBackup {
  schemaVersion: 1;
  app: 'aircon-cost-tracker-ph';
  exportedAt: string;
  usageLogs: UsageLog[];
}
export interface ImportPreview { logs: UsageLog[]; duplicates: number; invalid: number; total: number; }
const exposures: Exposure[] = ['none','very-slight','moderate','exposed','very-exposed'];
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
function validDateTime(value: unknown): value is string {
  if (typeof value !== 'string' || !localDateTime.test(value)) return false;
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const d = new Date(year, month - 1, day, hour, minute);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day && d.getHours() === hour && d.getMinutes() === minute;
}
const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
function parseLog(value: unknown): UsageLog | null {
  if (!isObject(value)) return null;
  const {id,start,end,temperature,modelId,modelName,ratedWatts,rate,factor,roomAreaM2,exposure,notes,createdAt} = value;
  if (typeof id !== 'string' || id.length < 1 || id.length > 150 || !validDateTime(start) || !validDateTime(end)) return null;
  const minutes = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (!(minutes > 0 && minutes <= 1440)) return null;
  if (!finite(temperature,16,30) || !finite(ratedWatts,1,100000) || !finite(rate,0,10000) || !finite(factor,0,1) || !finite(roomAreaM2,0.01,100000)) return null;
  if (modelId !== null && (typeof modelId !== 'string' || modelId.length > 200)) return null;
  if (typeof modelName !== 'string' || !modelName.trim() || modelName.length > 300 || !exposures.includes(exposure as Exposure)) return null;
  if (typeof notes !== 'string' || notes.length > 5000 || typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) return null;
  return {id,start,end,temperature,modelId,modelName,ratedWatts,rate,factor,roomAreaM2,exposure:exposure as Exposure,notes,createdAt};
}
export function createBackup(logs: UsageLog[]): UsageBackup {
  return {schemaVersion:1,app:'aircon-cost-tracker-ph',exportedAt:new Date().toISOString(),usageLogs:logs};
}
export function inspectBackup(raw: unknown, existing: UsageLog[]): ImportPreview {
  let records: unknown;
  if (Array.isArray(raw)) records = raw; // Compatibility with original tracker JSON exports
  else if (isObject(raw) && raw.schemaVersion === 1 && raw.app === 'aircon-cost-tracker-ph' && Array.isArray(raw.usageLogs)) records = raw.usageLogs;
  else throw new Error('Unsupported JSON format. Select an app backup or an array of usage logs.');
  if ((records as unknown[]).length > 100000) throw new Error('Backup contains too many records.');
  const existingIds = new Set(existing.map(l => l.id));
  const seen = new Set<string>();
  const logs: UsageLog[] = [];
  let duplicates = 0;
  let invalid = 0;
  for (const item of records as unknown[]) {
    const log = parseLog(item);
    if (!log) { invalid++; continue; }
    if (seen.has(log.id) || existingIds.has(log.id)) { duplicates++; if (seen.has(log.id)) continue; }
    seen.add(log.id);
    logs.push(log);
  }
  return {logs,duplicates,invalid,total:(records as unknown[]).length};
}
