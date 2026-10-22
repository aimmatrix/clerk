import type { Metadata } from 'next';
import { Board } from '@/components/clerk/board';

export const metadata: Metadata = {
  title: 'Live board',
  description: 'Every message, owned: tasks, requests and questions ranked by urgency.',
};

/** Mirrors DEMO_COMMUNITY_ID in the shared brief; inlined so this page needs no runtime import from core. */
const DEMO_COMMUNITY_ID = '00000000-0000-0000-0000-000000000001';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BoardPageProps {
  searchParams: { communityId?: string; community?: string; autoplay?: string };
}

export default function BoardPage({ searchParams }: BoardPageProps) {
  const requested = searchParams.communityId ?? searchParams.community;
  const communityId =
    requested && UUID.test(requested) ? requested : (process.env.DEMO_COMMUNITY_ID ?? DEMO_COMMUNITY_ID);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <Board communityId={communityId} autoplay={searchParams.autoplay === '1'} />
    </main>
  );
}
