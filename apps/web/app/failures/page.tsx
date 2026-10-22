import type { Metadata } from 'next';
import { FailuresLog } from '@/components/clerk/failures';

export const metadata: Metadata = {
  title: 'Couldn’t handle · Clerk',
  description: 'Every message Clerk wasn’t sure about, with the reason, so a human can pick it up.',
};

// Read on the server so the community id never depends on a NEXT_PUBLIC_ variable.
const COMMUNITY_ID = process.env.DEMO_COMMUNITY_ID ?? '00000000-0000-0000-0000-000000000001';

export default function FailuresPage({ searchParams }: { searchParams?: { communityId?: string } }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 max-w-2xl">
        <h1
          className="text-3xl font-semibold tracking-[-0.02em] text-[#E8EAF2] sm:text-4xl"
          style={{ fontFamily: 'var(--font-space-grotesk), var(--font-heading), system-ui, sans-serif' }}
        >
          What Clerk couldn’t handle — honestly.
        </h1>
        <p className="mt-3 text-[#8A90A6]">
          When Clerk isn’t sure, it doesn’t guess. These are the messages it set aside, why, and who has picked each
          one up.
        </p>
      </header>
      <FailuresLog communityId={searchParams?.communityId ?? COMMUNITY_ID} />
    </main>
  );
}
