import { buildContext, type IncomingMessage, type IngestRequest } from '@clerk/core';
import type { Message } from 'discord.js';
import { ingest } from './api';
import { env, log, warn } from './env';
import { recentHistory, toIncoming } from './map-message';

const EYES = '👀';

function shouldSkip(message: Message): boolean {
  if (message.author.bot) return true;
  if (!message.inGuild()) return true;
  if (message.system) return true;
  return false;
}

export async function ingestDiscordMessage(message: Message): Promise<void> {
  if (shouldSkip(message)) return;
  if (message.partial) {
    try {
      message = await message.fetch();
    } catch (err) {
      warn('could not fetch partial message', err instanceof Error ? err.message : err);
      return;
    }
  }
  if (shouldSkip(message)) return;

  const incoming: IncomingMessage = toIncoming(message);
  let history: IncomingMessage[] = [];
  try {
    history = await recentHistory(message, 10);
  } catch (err) {
    warn('could not fetch recent messages; ingesting without context', err instanceof Error ? err.message : err);
  }

  const body: IngestRequest = {
    communityId: env.communityId,
    message: incoming,
    context: buildContext(incoming, history, 5),
  };

  const { response, mode } = await ingest(body);
  const captured = response.items.filter((i) => i.type !== 'noise').length;
  log(`ingest ${incoming.externalId} via ${mode}: ${captured} item(s), ${response.failures.length} failure(s)`);

  if (env.reactOnIngest) {
    try {
      await message.react(EYES);
    } catch (err) {
      warn('could not add 👀 reaction', err instanceof Error ? err.message : err);
    }
  }
}
