import { DEMO_COMMUNITY_ID } from "@clerk/core";
import type { Metadata } from "next";
import { ReviewWorkspace } from "@/components/clerk/review";

export const metadata: Metadata = {
  title: "Review queue",
  description: "Approve, edit, reassign or reject what Clerk captured from your community chat.",
};

export default function ReviewPage({ searchParams }: { searchParams?: { communityId?: string } }) {
  const communityId = searchParams?.communityId ?? process.env.COMMUNITY_ID ?? DEMO_COMMUNITY_ID;
  return <ReviewWorkspace communityId={communityId} />;
}
