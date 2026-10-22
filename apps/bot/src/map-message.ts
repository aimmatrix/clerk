import type { IncomingMessage } from '@clerk/core';
import type { Message } from 'discord.js';

/** Discord message → contract IncomingMessage. Threads keep the parent as channelId. */
export function toIncoming(message: Message): IncomingMessage {
  const inThread = message.channel.isThread();
  const threadId = inThread ? message.channel.id : undefined;
  const channelId = inThread ? (message.channel.parentId ?? message.channelId) : message.channelId;

  return {
    externalId: message.id,
    channelId,
    threadId,
    replyToExternalId: message.reference?.messageId ?? undefined,
    authorName: message.member?.displayName ?? message.author.displayName ?? message.author.username,
    authorExternalId: message.author.id,
    content: message.content ?? '',
    permalink: message.url,
    sentAt: message.createdAt.toISOString(),
    source: 'discord',
  };
}

export async function recentHistory(message: Message, limit = 10): Promise<IncomingMessage[]> {
  const channel = message.channel;
  if (!channel.isTextBased() || channel.isDMBased()) return [];
  const fetched = await channel.messages.fetch({ limit });
  return [...fetched.values()]
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map(toIncoming);
}
