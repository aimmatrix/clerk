import { DEMO_COMMUNITY_ID } from "@clerk/core";
import type { Metadata } from "next";
import { ReviewWorkspace } from "@/components/clerk/review";

export const metadata: Metadata = {
  title: "Review queue · Clerk",
  description: "Approve, edit, reassign or reject what Clerk captured from your community chat.",
};

export default function ReviewPage({ searchParams }: { searchParams?: { communityId?: string } }) {
  const communityId = searchParams?.communityId ?? DEMO_COMMUNITY_ID;
  return <ReviewWorkspace communityId={communityId} />;
}
