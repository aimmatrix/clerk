import { REASON_META } from './reason-meta';
import type { FailureReason } from './types';

export function ReasonBadge({ reason }: { reason: FailureReason }) {
  const { label, hint, colour } = REASON_META[reason];
  return (
    <span title={hint} className="whitespace-nowrap text-[13px]" style={{ color: colour }}>
      {label}
    </span>
  );
}
