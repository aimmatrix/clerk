/**
 * Discord REST post-back. The web app sends the approved line itself;
 * there is no bot HTTP server. Mentions are never parsed.
 */

const DISCORD_API = 'https://discord.com/api/v10';

export class DiscordRestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DiscordRestError';
    this.status = status;
  }
}

export interface DiscordPostInput {
  channelId: string;
  content: string;
  /** Source message snowflake. Posted as a reply in `channelId`. */
  replyToMessageId?: string;
  token: string;
  fetchImpl?: typeof fetch;
  apiBase?: string;
}

export interface DiscordPostResult {
  id: string;
}

/**
 * POST /channels/{id}/messages. `allowed_mentions.parse` is always empty so a
 * model-written line cannot ping @everyone, @here, or a role.
 */
export async function postDiscordMessage(input: DiscordPostInput): Promise<DiscordPostResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = (input.apiBase ?? DISCORD_API).replace(/\/$/, '');
  const body: Record<string, unknown> = {
    content: input.content,
    allowed_mentions: { parse: [] },
  };

  if (input.replyToMessageId) {
    body.message_reference = {
      message_id: input.replyToMessageId,
      channel_id: input.channelId,
      fail_if_not_exists: false,
    };
  }

  let response: Response;
  try {
    response = await fetchImpl(`${base}/channels/${encodeURIComponent(input.channelId)}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bot ${input.token}`,
        'content-type': 'application/json',
        'user-agent': 'Clerk (community inbox)',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new DiscordRestError('Could not reach Discord', 502);
  }

  const payload = await readJson(response);
  if (!response.ok) {
    throw new DiscordRestError(discordErrorMessage(payload, response.status), response.status);
  }

  const id = payload && typeof payload === 'object' && 'id' in payload ? String(payload.id ?? '') : '';
  if (!id) throw new DiscordRestError('Discord returned no message id', 502);
  return { id };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function discordErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.slice(0, 200);
  }
  return `Discord rejected the post (${status})`;
}
