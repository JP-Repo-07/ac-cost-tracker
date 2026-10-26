import { useEffect, useMemo, useState } from 'react';
import catalog from './data/aircon-models.json';
import type { AirconModel } from './types/aircon';
import type { Exposure, UsageLog } from './types/usage';
import { getLogs, putLog, removeLog, importLogsAtomic } from './storage/usageStorage';
import { createBackup, inspectBackup, type ImportPreview } from './storage/backup';
import { aggregateDaily, localDateString, parseLocal, sessionCost, sessionKwh, sessionMinutes } from './calculations/usage';

const models = catalog as AirconModel[];
const brands = [...new Set(models.map(m => m.brand))].sort();
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm';
const label = 'mb-1.5 block text-sm font-medium text-slate-700';
const peso = (value: number) => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(value);
const isoLocal = (date: Date) => `${localDateString(date)}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
const exposureLabels: {value:Exposure;label:string}[] = [
  {value:'none',label:'No direct sunlight'}, {value:'very-slight',label:'Very slightly exposed'},
  {value:'moderate',label:'Moderately exposed'}, {value:'exposed',label:'Exposed'}, {value:'very-exposed',label:'Very exposed'}
];
const roomOptions = [{value:'small',label:'Small (up to 10 m²)',area:9},{value:'medium',label:'Medium (11–20 m²)',area:15},{value:'large',label:'Large (21–30 m²)',area:25},{value:'very-large',label:'Very large (over 30 m²)',area:35},{value:'custom',label:'Enter exact m²',area:0}];
function durationText(minutes: number) { return `${Math.floor(minutes/60)}h ${Math.round(minutes%60)}m`; }

export default function Tracker() {
  const [logs,setLogs] = useState<UsageLog[]>([]);
  const [loaded,setLoaded] = useState(false);
  const [importPreview,setImportPreview] = useState<ImportPreview | null>(null);
  const [importMode,setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importMessage,setImportMessage] = useState('');
  const [importBusy,setImportBusy] = useState(false);
  const [error,setError] = useState('');
  const [editingId,setEditingId] = useState<string | null>(null);
  const [brand,setBrand] = useState(brands.includes('American Home') ? 'American Home' : brands[0]);
  const [modelId,setModelId] = useState(models.find(m=>m.brand === (brands.includes('American Home') ? 'American Home' : brands[0]))?.id ?? models[0].id);
  const [manual,setManual] = useState(false);
  const [manualWatts,setManualWatts] = useState(1050);
  const [start,setStart] = useState(() => {const d=new Date();d.setHours(21,0,0,0);return isoLocal(d);});
  const [end,setEnd] = useState(() => {const d=new Date();d.setDate(d.getDate()+1);d.setHours(5,0,0,0);return isoLocal(d);});
  const [temperature,setTemperature] = useState(25);
  const [rate,setRate] = useState(15.06);
  const [factor,setFactor] = useState(1);
  const [roomSize,setRoomSize] = useState('medium');
  const [customArea,setCustomArea] = useState(15);
  const [exposure,setExposure] = useState<Exposure>('moderate');
  const [notes,setNotes] = useState('');
  const [filter,setFilter] = useState<'all'|'week'|'month'>('month');
  const selected = models.find(m=>m.id===modelId) ?? models[0];
  const watts = manual ? manualWatts : selected.ratedPowerWatts;
  const area = roomSize==='custom' ? customArea : roomOptions.find(r=>r.value===roomSize)?.area ?? 0;
  const minutes = start && end ? sessionMinutes(start,end) : NaN;
  const valid = Number.isFinite(minutes) && minutes>0 && minutes<=24*60 && watts>0 && rate>=0 && factor>=0 && factor<=1 && area>0 && temperature>=16 && temperature<=30;
  useEffect(()=>{getLogs().then(items=>{setLogs(items);setLoaded(true);}).catch(()=>{setError('Unable to open browser storage. Check browser privacy settings.');setLoaded(true);});},[]);
  const daily = useMemo(()=>aggregateDaily(logs),[logs]);
  const current = useMemo(()=>{
    const now=new Date();const todayKey=localDateString(now);
    const weekStart=new Date(now.getFullYear(),now.getMonth(),now.getDate());weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
    const weekKey=localDateString(weekStart);const monthKey=todayKey.slice(0,7);
    return {
      today:daily.filter(d=>d.date===todayKey),
      week:daily.filter(d=>d.date>=weekKey && d.date<=todayKey),
      month:daily.filter(d=>d.date.startsWith(monthKey)),
      visible:daily.filter(d=>filter==='all'||(filter==='week'&&d.date>=weekKey&&d.date<=todayKey)||(filter==='month'&&d.date.startsWith(monthKey)))
    };
  },[daily,filter]);
  const sum=(days:typeof daily)=>days.reduce((acc,d)=>({minutes:acc.minutes+d.minutes,kwh:acc.kwh+d.kwh,cost:acc.cost+d.cost}),{minutes:0,kwh:0,cost:0});
  async function save() {
    setError('');
    if(!valid){setError('Enter a valid session (more than 0 and no more than 24 hours), watts, room size, and rate.');return;}
    const overlapping = logs.some(l=>l.id!==editingId && parseLocal(start)<parseLocal(l.end) && parseLocal(end)>parseLocal(l.start));
    if(overlapping){setError('This session overlaps an existing log. Edit the existing entry or adjust the times.');return;}
    const previous=logs.find(l=>l.id===editingId);
    const log:UsageLog = {id:editingId ?? crypto.randomUUID(),start,end,temperature,modelId:manual?null:modelId,modelName:manual?'Manual wattage':`${selected.brand} ${selected.model}`,ratedWatts:watts,rate,factor,roomAreaM2:area,exposure,notes,createdAt:previous?.createdAt??new Date().toISOString()};
    try {await putLog(log);setLogs(v=>[...v.filter(l=>l.id!==log.id),log]);setEditingId(null);setNotes('');}
    catch {setError('Could not save this log in browser storage.');}
  }
  function edit(log:UsageLog) {
    setEditingId(log.id);setStart(log.start);setEnd(log.end);setTemperature(log.temperature);setRate(log.rate);setFactor(log.factor);setNotes(log.notes);setExposure(log.exposure);
    const match=models.find(m=>m.id===log.modelId);
    if(match){setManual(false);setBrand(match.brand);setModelId(match.id);}else{setManual(true);setManualWatts(log.ratedWatts);}
    setRoomSize('custom');setCustomArea(log.roomAreaM2);setError('');window.scrollTo({top:0,behavior:'smooth'});
  }
  async function del(id:string) {
    if(!window.confirm('Delete this usage log?'))return;
    try{await removeLog(id);setLogs(v=>v.filter(l=>l.id!==id));if(editingId===id)setEditingId(null);}catch{setError('Could not delete this log.');}
  }
  function exportLogs(){const blob=new Blob([JSON.stringify(createBackup(logs),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`aircon-usage-backup-${localDateString(new Date())}.json`;a.click();URL.revokeObjectURL(url);}
  async function selectImportFile(file?: File) {
    setImportPreview(null);setImportMessage('');
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setImportMessage('File is too large (15 MB limit).'); return; }
    try {
      const data: unknown = JSON.parse(await file.text());
      const preview = inspectBackup(data, logs);
      setImportPreview(preview);
      if (preview.invalid) setImportMessage(`${preview.invalid} invalid record(s) will be skipped.`);
    } catch (err) { setImportMessage(err instanceof Error ? err.message : 'Could not read JSON file.'); }
  }
  async function confirmImport() {
    if (!importPreview || importBusy) return;
    const {logs: incoming, invalid} = importPreview;
    if (invalid > 0 && !window.confirm(`${invalid} invalid record(s) will be skipped. Continue?`)) return;
    if (importMode === 'replace' && !window.confirm('Replace ALL saved usage logs with the valid records from this file? This cannot be undone. Export a backup first.')) return;
    const existingIds = new Set(logs.map(l => l.id));
    const incomingFiltered = importMode === 'merge' ? incoming.filter(l => !existingIds.has(l.id)) : incoming;
    setImportBusy(true);setImportMessage('');
    try {
      await importLogsAtomic(incomingFiltered,importMode);
      setLogs(await getLogs());
      setImportMessage(`Import complete: ${incomingFiltered.length} record(s) ${importMode === 'merge' ? 'added' : 'restored'}.`);
      setImportPreview(null);
    } catch {setImportMessage('Import failed. Your existing records were not changed.');}
    finally {setImportBusy(false);}
  }
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-5xl space-y-6">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-sky-700">Philippines · Session-based electricity estimate</p><h1 className="mt-1 text-3xl font-bold">Aircon Usage Tracker</h1><p className="mt-2 text-sm text-slate-600">Log each start and end time. Session estimates accumulate automatically; overnight usage is split across calendar days.</p></header>
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold">{editingId?'Edit usage log':'Add usage log'}</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={manual} onChange={e=>setManual(e.target.checked)}/> Enter rated watts manually</label>
        {!manual?<div className="grid gap-3 sm:grid-cols-2"><div><label className={label}>Brand</label><select className={field} value={brand} onChange={e=>{setBrand(e.target.value);setModelId(models.find(m=>m.brand===e.target.value)!.id);}}>{brands.map(b=><option key={b}>{b}</option>)}</select></div><div><label className={label}>Exact model</label><select className={field} value={modelId} onChange={e=>setModelId(e.target.value)}>{models.filter(m=>m.brand===brand).map(m=><option key={m.id} value={m.id}>{m.model}</option>)}</select></div></div>:<div><label className={label}>Rated electrical input (W)</label><input className={field} type="number" min="1" value={manualWatts} onChange={e=>setManualWatts(Number(e.target.value))}/></div>}
        <div className="rounded-xl bg-sky-50 p-3 text-sm"><strong>{watts.toLocaleString()} W</strong> rated input{!manual&&<> · {selected.compressor} · <a className="text-sky-700 underline" href={selected.sourceUrl} target="_blank" rel="noreferrer">Source</a></>}</div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className={label}>Start date & time</label><input className={field} type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></div><div><label className={label}>End date & time</label><input className={field} type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></div></div>
        <div className="rounded-xl bg-slate-100 p-3 text-sm">Duration: <strong>{Number.isFinite(minutes)&&minutes>0?durationText(minutes):'Invalid time range'}</strong> · Estimated energy: <strong>{valid?(watts*factor*minutes/60000).toFixed(2):'—'} kWh</strong></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className={label}>Temperature ({temperature}°C)</label><input className="w-full accent-sky-700" type="range" min="16" max="30" value={temperature} onChange={e=>setTemperature(Number(e.target.value))}/></div><div><label className={label}>Electricity rate (₱/kWh)</label><input className={field} type="number" min="0" step="0.01" value={rate} onChange={e=>setRate(Number(e.target.value))}/></div><div><label className={label}>Room size</label><select className={field} value={roomSize} onChange={e=>setRoomSize(e.target.value)}>{roomOptions.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></div>{roomSize==='custom'&&<div><label className={label}>Exact area (m²)</label><input className={field} type="number" min="1" value={customArea} onChange={e=>setCustomArea(Number(e.target.value))}/></div>}<div><label className={label}>Sun exposure</label><select className={field} value={exposure} onChange={e=>setExposure(e.target.value as Exposure)}>{exposureLabels.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></div><div><label className={label}>Average-power assumption</label><select className={field} value={factor} onChange={e=>setFactor(Number(e.target.value))}><option value={1}>100% — continuous rated power</option><option value={0.8}>80% — example assumption</option><option value={0.7}>70% — example assumption</option><option value={0.6}>60% — example assumption</option><option value={0.5}>50% — example assumption</option></select></div></div>
        <div><label className={label}>Notes (optional)</label><input className={field} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Slept with aircon on"/></div>
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Temperature, room size, and sunlight are saved with each log, but do not change kWh yet. The selected power factor is a scenario assumption, not a verified compressor duty cycle or actual meter reading.</p>
        {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="flex gap-2"><button disabled={!loaded||!valid} className="rounded-xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" onClick={save}>{editingId?'Save changes':'Add usage log'}</button>{editingId&&<button className="rounded-xl border px-4 py-3 text-sm" onClick={()=>{setEditingId(null);setError('');}}>Cancel edit</button>}</div>
      </section>
      <aside className="space-y-4"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold">Consumption summary</h2><p className="mt-1 text-xs text-slate-500">Based on saved sessions, not a fixed daily schedule.</p><div className="mt-4 space-y-3">{([{name:'Today',data:current.today},{name:'This week (Mon–Sun)',data:current.week},{name:'This month',data:current.month}] as const).map(x=>{const s=sum(x.data);return <div key={x.name} className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-medium text-slate-600">{x.name}</p><div className="mt-1 flex justify-between gap-2"><strong>{s.kwh.toFixed(2)} kWh</strong><strong className="text-sky-800">{peso(s.cost)}</strong></div><p className="mt-1 text-xs text-slate-500">{durationText(s.minutes)} logged</p></div>;})}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm"><h3 className="font-semibold">Your data stays in this browser</h3><p className="mt-2 text-slate-600">Logs are saved to IndexedDB on this device. Clearing browser data may erase them; export backups regularly.</p><button className="mt-3 rounded-xl border border-slate-200 px-4 py-2 font-semibold disabled:opacity-50" onClick={exportLogs} disabled={!logs.length}>Export backup JSON</button>
      <div className="mt-4 border-t border-slate-200 pt-4">
        <h3 className="font-semibold">Import usage history</h3>
        <p className="mt-1 text-xs text-slate-500">Accepts backups from this app, including older exports that contain a JSON array of usage logs. Files are processed locally.</p>
        <input aria-label="Select usage backup JSON" type="file" accept=".json,application/json" className="mt-3 block w-full text-xs" onChange={e=>{void selectImportFile(e.target.files?.[0]);e.target.value='';}} />
        {importPreview&&<div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="font-semibold">Import preview</p>
          <p>{importPreview.total} records · {importPreview.logs.length} valid · {importPreview.invalid} invalid · {importPreview.duplicates} duplicate IDs</p>
          <label className="block text-xs font-semibold" htmlFor="import-mode">Import method</label>
          <select id="import-mode" className={field} value={importMode} onChange={e=>setImportMode(e.target.value as 'merge'|'replace')}>
            <option value="merge">Merge — skip existing IDs</option><option value="replace">Replace — overwrite all saved logs</option>
          </select>
          <button disabled={importBusy || (importMode==='merge' && importPreview.logs.every(l=>logs.some(e=>e.id===l.id)))} onClick={()=>void confirmImport()} className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{importBusy?'Importing…':'Confirm import'}</button>
        </div>}
        {importMessage&&<p role="status" className="mt-2 text-xs text-slate-700">{importMessage}</p>}
      </div></section></aside>
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Usage history</h2><p className="text-xs text-slate-500">{logs.length} saved session(s)</p></div><select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="month">This month</option><option value="week">This week</option><option value="all">All dates</option></select></div>
      {!loaded?<p className="mt-4 text-sm">Loading saved logs…</p>:<div className="mt-4 space-y-3">{logs.filter(l=>current.visible.some(d=>parseLocal(l.start)<new Date(parseLocal(d.date+'T00:00').getTime()+86400000)&&parseLocal(l.end)>parseLocal(d.date+'T00:00'))).sort((a,b)=>b.start.localeCompare(a.start)).map(log=><article key={log.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{log.modelName}</p><p className="mt-1 text-sm text-slate-600">{log.start.replace('T',' ')} → {log.end.replace('T',' ')}</p><p className="mt-1 text-xs text-slate-500">{durationText(sessionMinutes(log.start,log.end))} · {log.temperature}°C · {log.ratedWatts} W · {Math.round(log.factor*100)}% assumed power</p>{log.notes&&<p className="mt-1 text-xs text-slate-500">{log.notes}</p>}</div><div className="text-right"><p className="font-semibold">{sessionKwh(log).toFixed(2)} kWh</p><p className="text-sm font-semibold text-sky-800">{peso(sessionCost(log))}</p><div className="mt-2 flex gap-2"><button className="rounded-lg border px-3 py-1 text-xs" onClick={()=>edit(log)}>Edit</button><button className="rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-700" onClick={()=>del(log.id)}>Delete</button></div></div></div></article>)}{current.visible.length===0&&<p className="text-sm text-slate-500">No usage recorded for this period.</p>}</div>}
      {daily.length>0&&<div className="mt-6"><h3 className="mb-2 font-semibold">Daily breakdown</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-2">Date</th><th>Duration</th><th>kWh</th><th>Cost</th></tr></thead><tbody>{current.visible.map(d=><tr className="border-b border-slate-100" key={d.date}><td className="py-2">{d.date}</td><td>{durationText(d.minutes)}</td><td>{d.kwh.toFixed(2)}</td><td>{peso(d.cost)}</td></tr>)}</tbody></table></div></div>}
    </section><p className="text-center text-xs text-slate-500">Electricity consumption is estimated, not measured. Model catalog contains historical DOE-listed entries and may not represent currently sold units.</p>
  </div></main>;
}
