'use client';

import { FILTERABLE_TYPES, type TypeFilter } from './columns';
import { cx } from './format';
import { TYPE_COLOURS, TYPE_LABELS } from '@/components/clerk/card';

export interface FilterChipsProps {
  value: TypeFilter;
  counts: Record<TypeFilter, number>;
  onChange: (next: TypeFilter) => void;
}

const BASE =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#7C5CFF]';

export function FilterChips({ value, counts, onChange }: FilterChipsProps) {
  return (
    <div role="group" aria-label="Filter cards by type" className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={value === 'all'}
        onClick={() => onChange('all')}
        className={cx(
          BASE,
          value === 'all'
            ? 'border-[#7C5CFF]/60 bg-[#7C5CFF]/20 text-[#E8EAF2]'
            : 'border-white/[0.1] text-[#8A90A6] hover:text-[#E8EAF2]',
        )}
      >
        All
        <span className="font-mono text-[11px] tabular-nums opacity-80">{counts.all}</span>
      </button>
      {FILTERABLE_TYPES.map((type) => {
        const active = value === type;
        const colour = TYPE_COLOURS[type];
        return (
          <button
            key={type}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? 'all' : type)}
            className={cx(BASE, active ? 'text-[#E8EAF2]' : 'border-white/[0.1] text-[#8A90A6] hover:text-[#E8EAF2]')}
            style={active ? { borderColor: `${colour}99`, background: `${colour}26` } : undefined}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: colour }} aria-hidden />
            {TYPE_LABELS[type]}
            <span className="font-mono text-[11px] tabular-nums opacity-80">{counts[type]}</span>
          </button>
        );
      })}
    </div>
  );
}
