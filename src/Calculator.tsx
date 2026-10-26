import { useMemo, useState } from 'react';
import catalog from './data/aircon-models.json';
import type { AirconModel } from './types/aircon';
import { calculateConsumption } from './calculations/consumption';

const models = catalog as AirconModel[];
const exposures = [
  { value: 'none', label: 'No direct sunlight' },
  { value: 'very-slight', label: 'Very slightly exposed' },
  { value: 'moderate', label: 'Moderately exposed' },
  { value: 'exposed', label: 'Exposed' },
  { value: 'very-exposed', label: 'Very exposed' },
];
const roomSizes = [
  { value: 'small', label: 'Small (up to 10 m²)', area: 9 },
  { value: 'medium', label: 'Medium (11–20 m²)', area: 15 },
  { value: 'large', label: 'Large (21–30 m²)', area: 25 },
  { value: 'very-large', label: 'Very large (over 30 m²)', area: 35 },
  { value: 'custom', label: 'Enter exact room area', area: 0 },
];
const peso = (n: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm';
const label = 'mb-1.5 block text-sm font-medium text-slate-700';

export default function Calculator() {
  const [brand, setBrand] = useState('Samsung');
  const [modelId, setModelId] = useState(models[0].id);
  const [manual, setManual] = useState(false);
  const [watts, setWatts] = useState(1050);
  const [hours, setHours] = useState(8);
  const [days, setDays] = useState(30);
  const [rate, setRate] = useState(15.06);
  const [temperature, setTemperature] = useState(25);
  const [period, setPeriod] = useState('night');
  const [exposure, setExposure] = useState('moderate');
  const [roomSize, setRoomSize] = useState('medium');
  const [customArea, setCustomArea] = useState(15);
  const [method, setMethod] = useState<'rated' | 'assumption'>('rated');
  const [factor, setFactor] = useState(0.7);
  const selected = models.find(m => m.id === modelId) ?? models[0];
  const actualWatts = manual ? watts : selected.ratedPowerWatts;
  const brands = [...new Set(models.map(m => m.brand))].sort();
  const area = roomSize === 'custom' ? customArea : roomSizes.find(r => r.value === roomSize)!.area;
  const result = useMemo(() => {
    try { return calculateConsumption({ ratedWatts: actualWatts, hoursPerDay: hours, daysPerMonth: days, electricityRate: rate, factor: method === 'rated' ? 1 : factor }); }
    catch { return null; }
  }, [actualWatts, hours, days, rate, method, factor]);
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8"><div className="mb-2 text-sm font-semibold uppercase tracking-widest text-sky-700">Philippines • Electricity estimator</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Aircon Cost Calculator PH</h1><p className="mt-2 text-slate-600">Estimate energy and cost using verified aircon specifications. Environmental inputs are ready for a future validated model.</p></header>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Your aircon</h2><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)} /> Enter watts manually</label></div>
            {!manual ? <div className="grid gap-4 sm:grid-cols-2"><div><label className={label}>Brand</label><select className={field} value={brand} onChange={e => { setBrand(e.target.value); setModelId(models.find(m => m.brand === e.target.value)!.id); }}>{brands.map(b => <option key={b}>{b}</option>)}</select></div><div><label className={label}>Exact model</label><select className={field} value={modelId} onChange={e => setModelId(e.target.value)}>{models.filter(m => m.brand === brand).map(m => <option key={m.id} value={m.id}>{m.model}</option>)}</select></div></div> : <div><label className={label}>Rated electrical input (watts)</label><input className={field} type="number" min="1" value={watts} onChange={e => setWatts(Number(e.target.value))} /><p className="mt-1 text-xs text-slate-500">Use electrical input in watts, not cooling capacity or HP.</p></div>}
            {!manual && <div className="rounded-xl bg-sky-50 p-4 text-sm"><p><strong>{selected.ratedPowerWatts} W</strong> rated input · {selected.coolingCapacityKw} kW cooling capacity · Compressor: {selected.compressor}</p><p className="mt-1 text-slate-600">{selected.notes}</p><a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-sky-700 underline">View DOE source</a></div>}
            <hr className="border-slate-100"/><h2 className="text-xl font-semibold">Room & usage</h2>
            <div className="grid gap-4 sm:grid-cols-2"><div><label className={label}>Room size</label><select className={field} value={roomSize} onChange={e => setRoomSize(e.target.value)}>{roomSizes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>{roomSize === 'custom' && <div><label className={label}>Exact area (m²)</label><input className={field} type="number" min="1" value={customArea} onChange={e => setCustomArea(Number(e.target.value))}/></div>}<div><label className={label}>Hours per day</label><input className={field} type="number" min="0" max="24" step="0.5" value={hours} onChange={e => setHours(Number(e.target.value))}/></div><div><label className={label}>Days per month</label><input className={field} type="number" min="1" max="31" value={days} onChange={e => setDays(Number(e.target.value))}/></div><div><label className={label}>Electricity rate (₱/kWh)</label><input className={field} type="number" min="0" step="0.01" value={rate} onChange={e => setRate(Number(e.target.value))}/></div></div>
            <div><label className={label}>Temperature: {temperature}°C</label><input className="w-full accent-sky-700" type="range" min="16" max="30" value={temperature} onChange={e => setTemperature(Number(e.target.value))}/></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label className={label}>Usage period</label><select className={field} value={period} onChange={e => setPeriod(e.target.value)}><option value="day">Day</option><option value="night">Night</option><option value="both">Both</option></select></div><div><label className={label}>Sun exposure</label><select className={field} value={exposure} onChange={e => setExposure(e.target.value)}>{exposures.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}</select></div></div>
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Room area ({area > 0 ? `${area} m²` : 'invalid'}), temperature, usage period and sun exposure are recorded but do not change the numeric result yet. We will only enable those adjustments after establishing a validated estimation model.</p>
          </section>
          <aside className="h-fit space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold">Estimated consumption</h2><div className="rounded-xl bg-slate-900 p-5 text-white"><p className="text-sm text-slate-300">Rated electrical input</p><p className="mt-1 text-3xl font-bold">{Number.isFinite(actualWatts) ? actualWatts.toLocaleString() : '—'} W</p></div><div><label className={label}>Calculation method</label><select className={field} value={method} onChange={e => setMethod(e.target.value as 'rated' | 'assumption')}><option value="rated">Continuous rated-power reference</option><option value="assumption">Custom average-power assumption</option></select></div>{method === 'assumption' && <div><label className={label}>Assumed average power: {Math.round(factor * 100)}% of rated</label><input type="range" className="w-full accent-sky-700" min="0" max="1" step="0.05" value={factor} onChange={e => setFactor(Number(e.target.value))}/><p className="text-xs text-slate-500">User-defined assumption only; not a DOE factor or validated prediction.</p></div>}
          {result ? <div className="space-y-3">{([['Daily', result.daily],['Weekly (7 days)', result.weekly],[`Monthly (${days} days)`,result.monthly]] as const).map(([name,data]) => <div key={name} className="rounded-xl bg-slate-50 p-4"><div className="text-sm font-medium text-slate-600">{name}</div><div className="mt-1 flex items-end justify-between gap-2"><div className="text-xl font-semibold">{data.kwh.toFixed(2)} <span className="text-sm font-normal text-slate-500">kWh</span></div><div className="text-lg font-semibold text-sky-800">{peso(data.cost)}</div></div></div>)}</div> : <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Please enter valid wattage, usage hours, days, and rate.</div>}
          <p className="text-xs leading-5 text-slate-500">Results are calculations based on continuous rated power or your chosen assumption—not a measured electricity bill. Actual compressor power and runtime vary.</p></aside>
        </div><footer className="mt-6 text-center text-xs text-slate-500">Model specifications: Philippine Department of Energy energy-label issuance lists. Catalog is an initial verified subset, not a complete market directory.</footer>
      </div>
    </main>
  );
}
