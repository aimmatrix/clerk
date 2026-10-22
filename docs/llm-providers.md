# LLM providers

Clerk calls `${LLM_BASE_URL}/chat/completions` directly with `fetch`. Any provider that implements the OpenAI chat-completions format works.

```bash
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini
```

## How the extractor talks to the model

1. It first requests structured output with `response_format: { type: "json_schema", ... }` using the strict schema in `packages/core/src/schema.ts`.
2. If the provider rejects that, it falls back to `response_format: { type: "json_object" }`.
3. The response is validated. Invalid JSON is retried once, then recorded as an `invalid_json` failure.
4. Network or provider errors are recorded as `llm_error` failures.
5. Items with confidence below `CONFIDENCE_THRESHOLD` (default 0.6) go to the couldn't-handle log.

## Examples

| Provider | `LLM_BASE_URL` | Notes |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | |
| xAI (Grok) | `https://api.x.ai/v1` | Pick a model from the provider's current list |
| Ollama (local) | `http://localhost:11434/v1` | `LLM_API_KEY` can be any non-empty string; keeps all data on your machine |
| Other gateways | the gateway's `/v1` URL | Must support chat completions |

Model names and endpoints change. Check your provider's documentation.

## Choosing a model

- Use a model that supports JSON-schema structured output where possible; it makes `invalid_json` failures rare.
- Run the evaluation before committing to a model: `pnpm tsx demo/seed/eval/score.ts`. Type accuracy must be at least 85%.
- Smaller local models are fine for privacy but may produce more low-confidence results.

## Offline mode

Set `NEXT_PUBLIC_SIMULATOR_OFFLINE=1` to run the simulator with cached extractions. No LLM key or network access beyond localhost is needed.
