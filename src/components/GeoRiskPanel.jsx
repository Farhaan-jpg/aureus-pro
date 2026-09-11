import React from 'react';
import { Globe } from 'lucide-react';

export default function GeoRiskPanel({ geo }) {
  const headlines = geo?.headlines || [];
  return (
    <div className="hud-panel p-3.5 h-full">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-400" />
          <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">Geopolitical gold heat</h2>
        </div>
        <span className={`text-[10px] font-mono ${geo?.score >= 50 ? 'text-amber-400' : 'text-slate-400'}`}>
          {geo?.live ? `${geo.score} / ${geo.level}` : '—'}
        </span>
      </div>
      <p className="text-[11px] font-mono text-slate-400 mb-2">{geo?.goldImplication || 'GDELT 24h gold-relevant document volume.'}</p>
      <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar">
        {headlines.length === 0 ? (
          <p className="text-xs font-mono text-slate-500">No GDELT articles loaded yet.</p>
        ) : headlines.map((h, i) => (
          <a key={`${h.url}-${i}`} href={h.url} target="_blank" rel="noreferrer" className="block text-[11px] font-mono hover:text-gold-400">
            <span className="text-slate-300 line-clamp-2">{h.title}</span>
            <span className="text-[9px] text-slate-500">{h.source} {h.tone != null ? `· tone ${h.tone}` : ''}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
