import { SlashCommandBuilder } from 'discord.js';

export const DIGEST_POST_BUTTON = 'clerk:digest:public';

export const digestCommand = new SlashCommandBuilder()
  .setName('digest')
  .setDescription('Show open work, overdue items, unanswered questions and recent decisions.')
  .setDMPermission(false);

export const clerkCommand = new SlashCommandBuilder()
  .setName('clerk')
  .setDescription('Clerk status and board link.')
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub.setName('status').setDescription('Show whether Clerk is connected to the API, LLM and database.'),
  )
  .addSubcommand((sub) =>
    sub.setName('link').setDescription('Open the Clerk board for this community.'),
  );

export const slashCommands = [digestCommand, clerkCommand];
