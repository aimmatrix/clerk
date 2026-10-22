import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { handleInteraction, reportInteractionError } from './commands';
import { assertBotToken, env, log, warn } from './env';
import { ingestDiscordMessage } from './ingest-message';

assertBotToken();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.once(Events.ClientReady, (ready) => {
  log(`ready as ${ready.user.tag}`);
  log(`community ${env.communityId} → ${env.clerkApiUrl}`);
  log(
    `👀 reactions ${env.reactOnIngest ? 'on' : 'off'}; mock API ${env.forceMockApi ? 'forced' : 'fallback if web is down'}`,
  );
});

client.on(Events.MessageCreate, (message) => {
  void ingestDiscordMessage(message).catch((err: unknown) => {
    warn('ingest failed', err instanceof Error ? err.message : err);
  });
});

client.on(Events.InteractionCreate, (interaction) => {
  void handleInteraction(interaction).catch((err: unknown) => {
    warn('interaction failed', err instanceof Error ? err.message : err);
    void reportInteractionError(interaction, err);
  });
});

client.on(Events.Error, (err) => {
  warn('discord client error', err.message);
});

void client.login(env.discordBotToken);
