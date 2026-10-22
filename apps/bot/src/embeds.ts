import type { Digest, Item } from '@clerk/core';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import type { ApiMode } from './api';
import { boardUrl } from './env';
import { DIGEST_POST_BUTTON } from './slash';

const VIOLET = 0x7c5cff;
const URGENT = 0xf43f5e;
const CYAN = 0x22d3ee;
const FIELD_MAX = 1024;

function line(item: Item): string {
  const owner = item.ownerName ? item.ownerName : 'unowned';
  const due = item.dueAt
    ? ` · due ${new Date(item.dueAt).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' })}`
    : '';
  return `• **${item.title}** — ${owner} · ${item.priority}${due}`;
}

function fieldValue(items: Item[], empty = 'None.'): string {
  if (items.length === 0) return empty;
  let text = items.slice(0, 8).map(line).join('\n');
  if (items.length > 8) text += `\n… +${items.length - 8} more`;
  return text.length <= FIELD_MAX ? text : `${text.slice(0, FIELD_MAX - 1)}…`;
}

export function digestEmbed(digest: Digest, mode: ApiMode): EmbedBuilder {
  const colour = digest.overdue.length > 0 ? URGENT : VIOLET;
  const footer =
    mode === 'mock' ? 'Mock API — web app not connected' : 'Clerk digest · nothing is posted without a person';
  return new EmbedBuilder()
    .setColor(colour)
    .setTitle('Clerk digest')
    .setDescription(
      `Captured **${digest.stats.captured}** · awaiting review **${digest.stats.pending}** · hours saved **${digest.stats.hoursSaved}** · couldn't handle **${digest.stats.failures}**.`,
    )
    .addFields(
      { name: 'Open', value: fieldValue(digest.open), inline: false },
      { name: 'Overdue', value: fieldValue(digest.overdue), inline: false },
      { name: 'Unanswered questions', value: fieldValue(digest.unansweredQuestions), inline: false },
      { name: 'Decisions this week', value: fieldValue(digest.decisions), inline: false },
    )
    .setTimestamp(new Date(digest.generatedAt))
    .setFooter({ text: footer });
}

export function digestControls(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(DIGEST_POST_BUTTON)
      .setLabel('Post publicly')
      .setStyle(ButtonStyle.Primary),
  );
}

export function statusEmbed(args: {
  mode: ApiMode;
  health: { ok: boolean; llm: boolean; db: boolean };
  error?: string;
  guildName?: string | null;
  communityId: string;
}): EmbedBuilder {
  const pill = (ok: boolean) => (ok ? 'yes' : 'no');
  const embed = new EmbedBuilder()
    .setColor(CYAN)
    .setTitle('Clerk status')
    .addFields(
      { name: 'API', value: args.mode === 'live' ? 'live' : 'mock (web not ready)', inline: true },
      { name: 'Health ok', value: pill(args.health.ok), inline: true },
      { name: 'LLM', value: pill(args.health.llm), inline: true },
      { name: 'Database', value: pill(args.health.db), inline: true },
      { name: 'Community', value: `\`${args.communityId}\``, inline: false },
    )
    .setFooter({ text: 'Clerk never posts publicly unless a person approves it.' });

  if (args.guildName) embed.addFields({ name: 'Guild', value: args.guildName, inline: true });
  if (args.error) embed.addFields({ name: 'Last error', value: args.error.slice(0, 500), inline: false });
  return embed;
}

export function linkEmbed(communityId: string): {
  embed: EmbedBuilder;
  row?: ActionRowBuilder<ButtonBuilder>;
} {
  const url = boardUrl(communityId);
  const embed = new EmbedBuilder()
    .setColor(VIOLET)
    .setTitle('Open the Clerk board')
    .setDescription(`Review queue for this community:\n${url}`)
    .setFooter({ text: 'Approve in the board before anything is posted back here.' });

  if (/^https:\/\//i.test(url)) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open board').setURL(url),
    );
    return { embed, row };
  }
  return { embed };
}
