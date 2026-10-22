export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      LLM_BASE_URL?: string;
      LLM_API_KEY?: string;
      LLM_MODEL?: string;
      NEXT_PUBLIC_SUPABASE_URL?: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
      SUPABASE_URL?: string;
      SUPABASE_SERVICE_ROLE_KEY?: string;
      DISCORD_BOT_TOKEN?: string;
      DISCORD_APP_ID?: string;
      DISCORD_GUILD_ID?: string;
      CLERK_API_URL?: string;
      INGEST_SECRET?: string;
      DEMO_COMMUNITY_ID?: string;
      CONFIDENCE_THRESHOLD?: string;
      NEXT_PUBLIC_DEMO_COMMUNITY_ID?: string;
      NEXT_PUBLIC_CONFIDENCE_THRESHOLD?: string;
      NEXT_PUBLIC_SIMULATOR_OFFLINE?: string;
      NEXT_PUBLIC_SIMULATOR_INGEST_SECRET?: string;
      NEXT_PUBLIC_GITHUB_URL?: string;
      NEXT_PUBLIC_DISCORD_INVITE_URL?: string;
      NEXT_PUBLIC_REVIEW_MOCK?: string;
      BOT_POST_URL?: string;
    }
  }
}
