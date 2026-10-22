import { REASON_META } from './reason-meta';
import type { FailureReason } from './types';

export function ReasonBadge({ reason }: { reason: FailureReason }) {
  const { label, hint, colour } = REASON_META[reason];
  return (
    <span
      title={hint}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ color: colour, backgroundColor: `${colour}1F`, borderColor: `${colour}40` }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colour }} />
      {label}
    </span>
  );
}
