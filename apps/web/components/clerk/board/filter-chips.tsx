'use client';

import { FILTERABLE_TYPES, type TypeFilter } from './columns';
import { cx } from './format';
import { TYPE_LABELS } from '@/components/clerk/card';

export interface FilterChipsProps {
  value: TypeFilter;
  counts: Record<TypeFilter, number>;
  onChange: (next: TypeFilter) => void;
}

const BASE =
  'inline-flex min-h-[34px] items-center gap-1.5 rounded-full border px-3 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary';

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
            ? 'border-foreground bg-foreground text-background'
            : 'border-border bg-surface text-muted-foreground hover:text-foreground',
        )}
      >
        All
        <span className="font-mono text-[11px] tabular-nums opacity-70">{counts.all}</span>
      </button>
      {FILTERABLE_TYPES.map((type) => {
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? 'all' : type)}
            className={cx(
              BASE,
              active
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            {TYPE_LABELS[type]}
            <span className="font-mono text-[11px] tabular-nums opacity-70">{counts[type]}</span>
          </button>
        );
      })}
    </div>
  );
}
