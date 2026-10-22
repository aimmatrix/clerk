import type { Metadata } from 'next';
import { DigestView } from '@/components/clerk/digest';

export const metadata: Metadata = {
  title: 'Digest — Clerk',
  description: 'Open tasks by owner, overdue items, unanswered questions and decisions this week.',
};

export default function DigestPage({ searchParams }: { searchParams?: { communityId?: string } }) {
  return (
    <div>
      <DigestView communityId={searchParams?.communityId} />
    </div>
  );
}
