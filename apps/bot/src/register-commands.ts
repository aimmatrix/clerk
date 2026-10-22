import { REST, Routes } from 'discord.js';
import { assertBotToken, env, log } from './env';
import { slashCommands } from './slash';

async function main(): Promise<void> {
  assertBotToken();
  if (!env.discordAppId) {
    throw new Error('DISCORD_APP_ID is required to register slash commands.');
  }

  const rest = new REST({ version: '10' }).setToken(env.discordBotToken);
  const body = slashCommands.map((c) => c.toJSON());

  if (env.discordGuildId) {
    const data = (await rest.put(Routes.applicationGuildCommands(env.discordAppId, env.discordGuildId), {
      body,
    })) as unknown[];
    log(`registered ${data.length} guild command(s) on ${env.discordGuildId}`);
    return;
  }

  const data = (await rest.put(Routes.applicationCommands(env.discordAppId), { body })) as unknown[];
  log(`registered ${data.length} global command(s) (can take up to an hour to appear)`);
}

main().catch((err: unknown) => {
  console.error('[clerk-bot] register-commands failed', err);
  process.exit(1);
});
