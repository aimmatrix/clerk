import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_COMMUNITY_ID } from '@clerk/core';

const here = dirname(fileURLToPath(import.meta.url));

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const cut = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!cut) continue;
    let value = cut[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[cut[1]] = value;
  }
  return out;
}

function loadEnvFiles(): void {
  const cwd = process.cwd();
  const candidates = [
    resolve(cwd, '.env'),
    resolve(cwd, '.env.local'),
    resolve(cwd, '../../.env'),
    resolve(cwd, '../../.env.local'),
    resolve(here, '../.env'),
    resolve(here, '../.env.local'),
    resolve(here, '../../../.env'),
    resolve(here, '../../../.env.local'),
  ];
  for (const file of candidates) {
    const parsed = parseEnvFile(file);
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] == null || process.env[key] === '') process.env[key] = value;
    }
  }
}

loadEnvFiles();

function flag(value: string | undefined): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

function read(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim();
}

export const env = {
  discordBotToken: read('DISCORD_BOT_TOKEN'),
  discordAppId: read('DISCORD_APP_ID'),
  discordGuildId: read('DISCORD_GUILD_ID'),
  clerkApiUrl: read('CLERK_API_URL', 'http://localhost:3000').replace(/\/$/, ''),
  ingestSecret: read('INGEST_SECRET'),
  communityId: read('COMMUNITY_ID') || read('DEMO_COMMUNITY_ID', DEMO_COMMUNITY_ID),
  reactOnIngest: flag(process.env.CLERK_REACT),
  forceMockApi: flag(process.env.CLERK_MOCK_API),
};

export function assertBotToken(): void {
  if (!env.discordBotToken) {
    throw new Error(
      'DISCORD_BOT_TOKEN is missing. Copy .env.example to .env.local and fill in the Discord vars.',
    );
  }
}

export function boardUrl(communityId = env.communityId): string {
  return `${env.clerkApiUrl}/board?communityId=${encodeURIComponent(communityId)}`;
}

export function log(message: string, extra?: unknown): void {
  if (extra === undefined) {
    console.log(`[clerk-bot] ${message}`);
    return;
  }
  console.log(`[clerk-bot] ${message}`, extra);
}

export function warn(message: string, extra?: unknown): void {
  if (extra === undefined) {
    console.warn(`[clerk-bot] ${message}`);
    return;
  }
  console.warn(`[clerk-bot] ${message}`, extra);
}
