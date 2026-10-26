import { useState } from 'react';
import Calculator from './Calculator';
import Tracker from './Tracker';

export default function App() {
  const [tab, setTab] = useState<'calculator' | 'tracker'>('tracker');
  return <div>
    <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl gap-2 px-4 py-3">
        <button className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${tab === 'calculator' ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700'}`} onClick={() => setTab('calculator')}>Calculator</button>
        <button className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${tab === 'tracker' ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700'}`} onClick={() => setTab('tracker')}>Usage tracker</button>
      </div>
    </nav>
    {tab === 'calculator' ? <Calculator /> : <Tracker />}
  </div>;
}
