import React from 'react';
import { Activity, Globe, Compass, Database, LayoutGrid } from 'lucide-react';

// Mobile-only section switch. Desktop ignores it (all sections always visible).
const SECTIONS = [
  { id: 'live', label: 'Live', icon: Activity },
  { id: 'macro', label: 'Macro', icon: Globe },
  { id: 'flow', label: 'Flow', icon: Compass },
  { id: 'news', label: 'News', icon: LayoutGrid },
  { id: 'data', label: 'Data', icon: Database }
];

export default function MobileNav({ active, onSelect }) {
  return (
    <nav className="mobnav lg:hidden">
      <div className="max-w-[1920px] mx-auto flex">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={active === id ? 'active' : ''}
            onClick={() => onSelect(id)}
            aria-current={active === id ? 'page' : undefined}
          >
            <Icon style={{ width: 18, height: 18 }} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}