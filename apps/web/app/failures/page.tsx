import type { Metadata } from 'next';
import { FailuresLog } from '@/components/clerk/failures';

export const metadata: Metadata = {
  title: 'Couldn’t handle',
  description: 'Every message Clerk wasn’t sure about, with the reason, so a human can pick it up.',
};

// Read on the server so the community id never depends on a NEXT_PUBLIC_ variable.
const COMMUNITY_ID = process.env.COMMUNITY_ID ?? process.env.DEMO_COMMUNITY_ID ?? '00000000-0000-0000-0000-000000000001';

export default function FailuresPage({ searchParams }: { searchParams?: { communityId?: string } }) {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-8">
      <header className="mb-8 max-w-2xl">
        <h1 className="page-heading">Couldn’t handle</h1>
        <p className="mt-1 text-muted-foreground">
          Messages Clerk set aside instead of guessing. Claim one to turn it into a card yourself.
        </p>
      </header>
      <FailuresLog communityId={searchParams?.communityId ?? COMMUNITY_ID} />
    </div>
  );
}
