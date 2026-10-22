'use client';

export function BoardEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-input px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-foreground">Nothing captured yet</h2>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        Say something in your community chat and Clerk will turn it into a card with an owner, a priority and a
        deadline. Or watch it work on a simulated London meetup.
      </p>
      <a
        href="/simulator"
        className="mt-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white outline-none hover:bg-primary-600 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Watch the demo
      </a>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading the board">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="min-h-[12rem] animate-pulse rounded-xl bg-sunken" />
      ))}
    </div>
  );
}
