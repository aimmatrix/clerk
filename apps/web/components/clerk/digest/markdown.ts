import type { Digest, Item } from '@clerk/core';
import { UNASSIGNED_LABEL, formatDue, formatGenerated, groupByOwner, hoursLabel, sortByUrgency } from './format';

/** Discord rejects messages over 2000 characters; leave headroom. */
export const DISCORD_LIMIT = 1900;

/**
 * Item text originates from community chat, so it is untrusted. Neutralise
 * mentions (@everyone, @here, <@id>) so a digest can never ping anyone, and
 * flatten newlines so a title cannot inject extra markdown blocks.
 */
export function sanitiseForDiscord(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/@/g, '@​')
    .replace(/<(#|@|:|a:)/g, '<​$1')
    .trim();
}

interface RenderOptions {
  /** Max lines shown per section before "…and N more". */
  perSection: number;
  links: boolean;
}

function line(item: Item, now: Date, opts: RenderOptions, extras: { owner?: boolean } = {}): string {
  const parts = [`• ${item.priority} ${sanitiseForDiscord(item.title)}`];
  if (extras.owner) parts.push(`— ${sanitiseForDiscord(item.ownerName ?? UNASSIGNED_LABEL)}`);
  const due = formatDue(item.dueAt, now);
  if (due) parts.push(`· ${due.label}`);
  let text = parts.join(' ');
  if (opts.links && item.sourceLink) text += ` · [source](<${item.sourceLink}>)`;
  return text;
}

function capped(lines: string[], limit: number): string[] {
  if (lines.length <= limit) return lines;
  return [...lines.slice(0, limit), `…and ${lines.length - limit} more`];
}

function render(digest: Digest, opts: RenderOptions): string {
  const now = new Date(digest.generatedAt);
  const { stats } = digest;
  const out: string[] = [];

  out.push(`**📋 Clerk digest — ${formatGenerated(digest.generatedAt)}**`);
  out.push(
    `Captured ${stats.captured} · Awaiting review ${stats.pending} · Approved ${stats.approved} · Couldn't handle ${stats.failures} · ~${hoursLabel(stats.hoursSaved)} h saved`,
  );

  if (digest.overdue.length > 0) {
    out.push('', `**🔴 Overdue (${digest.overdue.length})**`);
    out.push(...capped(sortByUrgency(digest.overdue).map((i) => line(i, now, opts, { owner: true })), opts.perSection));
  }

  if (digest.open.length > 0) {
    out.push('', `**📌 Open by owner (${digest.open.length})**`);
    for (const group of groupByOwner(digest.open)) {
      out.push(`__${sanitiseForDiscord(group.owner)}__ (${group.items.length})`);
      out.push(...capped(group.items.map((i) => line(i, now, opts)), opts.perSection));
    }
  }

  if (digest.unansweredQuestions.length > 0) {
    out.push('', `**❓ Unanswered questions (${digest.unansweredQuestions.length})**`);
    out.push(...capped(sortByUrgency(digest.unansweredQuestions).map((i) => line(i, now, opts)), opts.perSection));
  }

  if (digest.decisions.length > 0) {
    out.push('', `**✅ Decisions this week (${digest.decisions.length})**`);
    out.push(...capped(digest.decisions.map((i) => line(i, now, opts)), opts.perSection));
  }

  if (
    digest.overdue.length + digest.open.length + digest.unansweredQuestions.length + digest.decisions.length ===
    0
  ) {
    out.push('', 'Nothing open — all clear. 🎉');
  }

  return out.join('\n');
}

/**
 * Discord-flavoured markdown for the digest. Progressively tightens (fewer
 * lines per section, then no source links) until it fits one message.
 */
export function digestToDiscordMarkdown(digest: Digest): string {
  const attempts: RenderOptions[] = [
    { perSection: 50, links: true },
    { perSection: 50, links: false },
    { perSection: 8, links: false },
    { perSection: 4, links: false },
    { perSection: 2, links: false },
  ];
  let text = '';
  for (const opts of attempts) {
    text = render(digest, opts);
    if (text.length <= DISCORD_LIMIT) return text;
  }
  return `${text.slice(0, DISCORD_LIMIT - 1)}…`;
}
