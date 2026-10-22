'use client';

export function BoardEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/[0.12] bg-[#141826]/40 px-6 py-14 text-center backdrop-blur-xl">
      <h2 className="text-lg font-semibold tracking-tight text-[#E8EAF2]">Nothing captured yet</h2>
      <p className="max-w-md text-sm leading-6 text-[#8A90A6]">
        Say something in your community chat and Clerk will turn it into a card with an owner, a priority and a
        deadline. Or watch it work on a simulated London meetup.
      </p>
      <a
        href="/simulator"
        className="mt-1 rounded-lg bg-[#7C5CFF] px-4 py-2 text-sm font-medium text-white outline-none hover:bg-[#8D70FF] focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0D14]"
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
        <div key={i} className="min-h-[12rem] animate-pulse rounded-2xl border border-white/[0.06] bg-[#141826]/40" />
      ))}
    </div>
  );
}
