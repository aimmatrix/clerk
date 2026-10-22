import {
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
} from 'discord.js';
import { fetchDigest, fetchHealth } from './api';
import { digestControls, digestEmbed, linkEmbed, statusEmbed } from './embeds';
import { env } from './env';
import { DIGEST_POST_BUTTON } from './slash';

async function handleDigest(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const { digest, mode } = await fetchDigest(env.communityId);
  await interaction.editReply({
    embeds: [digestEmbed(digest, mode)],
    components: [digestControls()],
  });
}

async function handleDigestPost(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();
  const channel = interaction.channel;
  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    await interaction.followUp({
      ephemeral: true,
      content: 'This channel cannot receive a public digest.',
    });
    return;
  }

  const { digest, mode } = await fetchDigest(env.communityId);
  const embed = digestEmbed(digest, mode).setFooter({
    text: `Posted by ${interaction.user.username} after review. Clerk never posts without approval.`,
  });

  await channel.send({
    embeds: [embed],
    allowedMentions: { parse: [] },
  });

  await interaction.editReply({
    content: 'Posted publicly in this channel. Members can see the digest now.',
    embeds: [digestEmbed(digest, mode)],
    components: [],
  });
}

async function handleClerk(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();
  if (sub === 'status') {
    await interaction.deferReply({ ephemeral: true });
    const { health, mode, error } = await fetchHealth();
    await interaction.editReply({
      embeds: [
        statusEmbed({
          mode,
          health,
          error,
          guildName: interaction.guild?.name,
          communityId: env.communityId,
        }),
      ],
    });
    return;
  }

  if (sub === 'link') {
    const { embed, row } = linkEmbed(env.communityId);
    await interaction.reply({
      ephemeral: true,
      embeds: [embed],
      components: row ? [row] : [],
    });
  }
}

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isButton() && interaction.customId === DIGEST_POST_BUTTON) {
    await handleDigestPost(interaction);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'digest') {
    await handleDigest(interaction);
    return;
  }
  if (interaction.commandName === 'clerk') {
    await handleClerk(interaction);
  }
}

export async function reportInteractionError(interaction: Interaction, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : 'Something went wrong talking to Clerk.';
  const payload = {
    ephemeral: true,
    content: `Clerk couldn't complete that: ${message.slice(0, 400)}`,
  };
  try {
    if (!interaction.isRepliable()) return;
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch {
    // Discord may have already closed the interaction.
  }
}
