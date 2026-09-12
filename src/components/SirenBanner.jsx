import React from 'react';
import { Siren } from 'lucide-react';

export default function SirenBanner({ siren, onDismiss }) {
  if (!siren) return null;
  const fire = siren.bullish ? 'BULLISH' : siren.bearish ? 'BEARISH' : siren.direction || 'FLIP';
  const color = String(fire).includes('BULL') ? 'border-emerald-500/50 from-emerald-950/70' : 'border-rose-500/50 from-rose-950/70';

  return (
    <div className={`relative border rounded-md bg-gradient-to-r ${color} to-transparent px-3 py-2.5 overflow-hidden`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Siren className={`w-4 h-4 shrink-0 ${String(fire).includes('BULL') ? 'text-emerald-400' : 'text-rose-400'} animate-pulse`} />
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold tracking-widest uppercase text-slate-200">
              HIGH-CONVICTION REVERSAL SIREN · {fire}
            </p>
            <p className="font-mono text-[10px] text-slate-300 truncate">
              {siren.factorCount} aligned factors near ${siren.price} — {String(siren.foundAt).slice(0, 24)} · {siren.hint}
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 text-[10px] font-mono px-2 py-1 rounded border border-white/10 text-slate-400 hover:text-white hover:border-white/30 transition-colors"
        >
          ACK
        </button>
      </div>
    </div>
  );
}