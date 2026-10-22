import { confidenceColour } from './reason-meta';

export function ConfidenceMeter({ confidence }: { confidence: number | null }) {
  if (confidence === null) {
    return (
      <span className="font-mono text-xs text-subtle" title="Clerk never got far enough to score this">
        n/a
      </span>
    );
  }
  const colour = confidenceColour(confidence);
  const pct = Math.round(confidence * 100);
  return (
    <span className="inline-flex items-center gap-2" title={`${pct}% confidence`}>
      <span aria-hidden className="h-1.5 w-12 overflow-hidden rounded-full bg-sunken">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colour }} />
      </span>
      <span className="font-mono text-xs tabular-nums" style={{ color: colour }}>
        {confidence.toFixed(2)}
      </span>
    </span>
  );
}
