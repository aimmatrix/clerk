# Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Bot is online but messages have empty content | **Message Content Intent** is off | Developer Portal → Bot → Privileged Gateway Intents → enable it, then restart the bot |
| Slash commands don't appear | Commands not registered, or invited without `applications.commands` | Run `pnpm --filter bot register-commands`; re-invite with both `bot` and `applications.commands` scopes |
| `/api/ingest` returns 401 | `INGEST_SECRET` differs between bot and web | Make both values identical and restart both |
| `/api/health` shows `"llm": false` | Missing or wrong `LLM_API_KEY`, `LLM_BASE_URL` or `LLM_MODEL` | Check the three variables; the base URL should end in `/v1` |
| `/api/health` shows `"db": false` | Wrong Supabase URL or service-role key, or migrations not applied | Re-copy the keys from Project Settings → API; apply `supabase/migrations` |
| Cards never appear on the board | Realtime not enabled, or RLS blocking the viewer | Check Database → Replication for `items`; confirm the community row and the demo/owner policy |
| Everything lands in the couldn't-handle log | Threshold too high, or model returning invalid JSON | Lower `CONFIDENCE_THRESHOLD` a little; try a model with structured-output support; run the eval |
| Approve succeeds but nothing is posted in Discord | Bot lacks Send Messages in the channel, or `post_channel_id` is wrong | Check channel permissions and the `communities` row |
| Simulator is slow or errors | LLM unreachable | Set `NEXT_PUBLIC_SIMULATOR_OFFLINE=1` to use cached extractions |

Still stuck? Open a bug report with your logs (redact tokens and keys).
