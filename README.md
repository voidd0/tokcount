# tokcount

> **Count LLM tokens and estimate cost across 50+ models. Locally. Free forever.**
> A gift to the terminal from [**vøiddo**](https://voiddo.com).

[![npm](https://img.shields.io/npm/v/@v0idd0/tokcount?color=%2322c55e&label=%40v0idd0%2Ftokcount)](https://www.npmjs.com/package/@v0idd0/tokcount)
[![downloads](https://img.shields.io/npm/dm/@v0idd0/tokcount?color=%2322c55e)](https://www.npmjs.com/package/@v0idd0/tokcount)
[![license](https://img.shields.io/npm/l/@v0idd0/tokcount?color=%2322c55e)](./LICENSE)
[![node](https://img.shields.io/node/v/@v0idd0/tokcount?color=%2322c55e)](./package.json)

**[Homepage](https://voiddo.com/tools/tokcount/)** · **[GitHub](https://github.com/voidd0/tokcount)** · **[npm](https://www.npmjs.com/package/@v0idd0/tokcount)** · **[All tools](https://voiddo.com/tools/)** · **[Contact](mailto:support@voiddo.com)**

---

## Browser extension

tokcount ships as a **free browser extension** for Chrome, Firefox, and Edge. It overlays a live token counter directly on the ChatGPT, Claude, and Gemini chat UIs — no copy-paste, no tab-switch.

| Browser | Install |
|---------|---------|
| Chrome / Brave / Opera | [Chrome Web Store →](https://chromewebstore.google.com/detail/tokcount-%E2%80%94-live-token-cos/pkpdcbmcopflnbealamhephpoeimnogd) |
| Firefox / LibreWolf | [Firefox Add-ons →](https://addons.mozilla.org/en-US/firefox/addon/tokcount-live-token-cost-4-ai/) |
| Microsoft Edge | [Edge Add-ons →](https://microsoftedge.microsoft.com/addons/detail/pnbfdjaampealnhgocojhnbjenbfklpo) |

> No account. No API key. Installs in 10 seconds. Free forever.
> Full landing page: **[extensions.voiddo.com/tokcount/](https://extensions.voiddo.com/tokcount/)**

## Why tokcount

Before you paste a prompt into an API, you want to know two things: **will it fit in the context window**, and **how much will it cost me**. Every online tokenizer asks for your prompt so it can log it. Every provider's pricing page is a different chart. Every CLI tokenizer knows about three models from 2023.

**tokcount is one binary, 50+ current models, and no network calls.** No API keys. No telemetry. No prompt upload. No PRO tier. You point it at a file or pipe text into it, and it tells you how many tokens the prompt is and how many dollars it will cost across any model you care about.

Built because we got tired of opening three tabs to answer "does this fit in Claude Sonnet and is it cheaper on Gemini Flash."

## Install

```bash
# npm
npm install -g @v0idd0/tokcount

# or pnpm / yarn / bun
pnpm add -g @v0idd0/tokcount
yarn global add @v0idd0/tokcount
bun add -g @v0idd0/tokcount

# one-shot via npx (no install)
npx @v0idd0/tokcount prompt.md --model claude
```

Requires Node.js **≥ 14**.

## Usage

```bash
# count tokens in a file for the default model (gpt-4o)
tokcount prompt.md

# switch model with short alias or canonical key
tokcount prompt.md --model claude                # → claude-sonnet-4-6
tokcount prompt.md --model claude-opus-4-7
tokcount prompt.md --model gemini-2.5-flash
tokcount prompt.md --model gpt-5

# cost estimate (input only)
tokcount prompt.md --model claude-sonnet-4-6 --cost

# cost estimate with expected output size
tokcount prompt.md --model gpt-4o --cost --output-tokens 2000

# compare the same prompt across every model, sorted by cost
tokcount prompt.md --compare --cost

# per-file breakdown across a whole directory
tokcount src/ --breakdown

# pipe from stdin
cat README.md | tokcount --model claude --cost
curl -s https://example.com/article | tokcount --model gpt-4.1 --cost --output-tokens 500

# JSON output, perfect for pipelines
tokcount prompt.md --json
tokcount prompt.md --json --cost --output-tokens 1000 | jq '.cost'

# CSV for spreadsheets
tokcount . --breakdown --csv > tokens.csv

# check against a custom context cap
tokcount huge.txt --model claude-opus-4-7 --limit 500000

# discover every supported model + live pricing
tokcount --list-models
```

## What's covered (60+ models, pricing snapshot 2026-04-22)

| Provider | Models |
|---|---|
| **OpenAI** | `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.2`, `gpt-5.1`, `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-4`, `gpt-3.5-turbo`, `o3`, `o3-mini`, `o4-mini` |
| **Anthropic** | `claude-opus-4-7` (1M ctx, 2026-04-16), `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-3.5-sonnet`, `claude-3.5-haiku` |
| **Google** | `gemini-3.1-pro` (2M ctx), `gemini-3-pro`, `gemini-3-flash`, `gemini-3.1-flash-lite`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite` |
| **Meta** | `llama-4-scout` (**10M ctx**), `llama-4-maverick` (1M ctx), `llama-3.3-70b`, `llama-3.1-70b`, `llama-3.1-405b` |
| **Mistral** | `mistral-large-3`, `mistral-medium-3`, `mistral-small-4` (unified: reasoning + multimodal + coding), `mistral-small-3.1`, `magistral-medium`, `magistral-small-1.2`, `codestral`, `mistral-nemo` |
| **xAI** | `grok-4`, `grok-4.1-fast` (2M ctx), `grok-4.2` (beta), `grok-3` |
| **DeepSeek** | `deepseek-v3.2`, `deepseek-r1`, `deepseek-r2` |
| **Alibaba** | `qwen3-max` (262K ctx), `qwen3.5-plus` (1M ctx), `qwen3` |
| **Cohere** | `command-a`, `command-r-plus`, `command-r`, `command-r7b` (cheapest premium at **$0.0375/MTok**) |
| **AWS** | `nova-pro`, `nova-lite`, `nova-micro` |

**Short aliases**: `gpt`→gpt-5.4, `claude`→claude-sonnet-4-6, `opus`→claude-opus-4-7, `gemini`→gemini-3-flash, `gemini-pro`→gemini-3.1-pro, `llama`→llama-4-maverick, `mistral`→mistral-large-3, `grok`→grok-4, `deepseek`→deepseek-v3.2, `reasoning`→o3. See `tokcount --list-models` for the full table, or filter with `--tag reasoning` / `--provider anthropic`.

### What changed in this release (2.1.0)

- Pricing refreshed against every provider's April 2026 pricing page.
- **Added** GPT-5.4 family (flagship $2.50/$15), Claude Opus 4.7 with 1M context (2026-04-16 release), Gemini 3.1 Pro with 2M context, Llama 4 Scout with 10M context, Grok 4.1 Fast with 2M context at $0.20/$0.50, Mistral Small 4 (unified reasoning/multimodal/coding), Magistral Medium/Small reasoning tier, DeepSeek V3.2 + R2, Cohere R7B at $0.0375/MTok, Qwen3 Max.
- **Retired** `o1`, `o1-mini` (replaced by `o3` at 87% price cut), `claude-3-opus/sonnet/haiku` (deprecated by 4.x line), `gemini-1.5-*` and `gemini-2.0-flash` (legacy/paid-only April 1st 2026).
- **New flags**: `--tag <tag>` and `--provider <p>` for both `--list-models` and `--compare`, so `tokcount --compare --tag reasoning --cost` shows just the reasoning tier, sorted by price.
- **New tags** on every model entry: `flagship`, `reasoning`, `coding`, `multimodal`, `long-context`, `cheap`, `legacy`, `beta`.

## Accuracy

tokcount uses a **blended approximation**: it mixes word-count and char-count signals, weighted by per-model character-to-token ratios. It does **not** ship a native tokenizer blob, so the binary stays ~25 KB and installs in a second.

For most real-world prompts, this lands within **±5-10%** of the provider's own tokenizer. That's more than good enough for:
- deciding if your prompt fits the context window,
- comparing cost across providers before you commit,
- budgeting spend on a directory of source code.

If you need cryptographically-exact counts for billing reconciliation, use the provider's official tokenizer for that step. tokcount is for the upstream question: *"is this going to cost me a nickel or a hundred dollars?"*

## Pricing note

Prices in tokcount are a snapshot taken **2026-04**. Providers change pricing monthly. Run `tokcount --list-models` to see what the installed binary knows, and bump the package when you want fresh numbers. All prices are input/output **USD per 1,000,000 tokens**.

## JSON / CSV — pipeline-friendly

```bash
# what fits, what doesn't, in machine-readable form
tokcount src/ --json | jq '{tokens: .totalTokens, cost: .cost}'

# export a tokens-per-file report for your team
tokcount . --breakdown --csv > report.csv
```

Every user-visible output (`--json`, `--csv`) includes the canonical model name, so downstream tools do not have to re-resolve aliases.

## Library use

```js
const { countTokens, estimateCost, compareModels } = require('@v0idd0/tokcount');

countTokens('hello world', 'claude-sonnet-4-6');
// → 3

estimateCost(50_000, 2_000, 'gpt-4o');
// → { totalCost: 0.145, inputCost: 0.125, outputCost: 0.02, ... }

compareModels('some prompt', 500);
// → { 'gpt-4o': {...}, 'claude-sonnet-4-6': {...}, ... }
```

## Why free forever

We are [**vøiddo**](https://voiddo.com) — a studio building small, sharp tools and a few serious products ([scrb](https://scrb.voiddo.com), [rankd](https://rankd.voiddo.com), [gridlock](https://gl.voiddo.com), and more). The serious products pay for themselves. The tools are gifts.

We write tokcount because _we_ are on the other side of an LLM API all day, and we needed a fast, local answer to "how much."

## From the same studio

- **[@v0idd0/jsonyo](https://www.npmjs.com/package/@v0idd0/jsonyo)** — JSON swiss army knife, 18 commands, zero limits
- **[@v0idd0/envguard](https://www.npmjs.com/package/@v0idd0/envguard)** — stop shipping `.env` drift to staging
- **[@v0idd0/depcheck](https://www.npmjs.com/package/@v0idd0/depcheck)** — find unused dependencies
- **[@v0idd0/gitstats](https://www.npmjs.com/package/@v0idd0/gitstats)** — git repo analytics, one command
- **[View all tools →](https://voiddo.com/tools/)**

## Contributing

Model gone? Price stale? New provider? Open an issue at [github.com/voidd0/tokcount/issues](https://github.com/voidd0/tokcount/issues) or drop a line to [support@voiddo.com](mailto:support@voiddo.com). The model table in `src/counter.js` is a plain JS object — PRs welcome.

## License

MIT — see [LICENSE](./LICENSE).

---

Built by [vøiddo](https://voiddo.com/) — a small studio shipping AI-flavoured products, free dev tools, Chrome extensions and weird browser games.
