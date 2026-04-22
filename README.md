# tokcount

> **Count LLM tokens and estimate cost across 50+ models. Locally. Free forever.**
> A gift to the terminal from [**vøiddo**](https://voiddo.com).

[![npm](https://img.shields.io/npm/v/@v0idd0/tokcount?color=%2322c55e&label=%40v0idd0%2Ftokcount)](https://www.npmjs.com/package/@v0idd0/tokcount)
[![downloads](https://img.shields.io/npm/dm/@v0idd0/tokcount?color=%2322c55e)](https://www.npmjs.com/package/@v0idd0/tokcount)
[![license](https://img.shields.io/npm/l/@v0idd0/tokcount?color=%2322c55e)](./LICENSE)
[![node](https://img.shields.io/node/v/@v0idd0/tokcount?color=%2322c55e)](./package.json)

**[Homepage](https://voiddo.com/tools/tokcount/)** · **[GitHub](https://github.com/voidd0/tokcount)** · **[npm](https://www.npmjs.com/package/@v0idd0/tokcount)** · **[All tools](https://voiddo.com/tools/)** · **[Contact](mailto:support@voiddo.com)**

---

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

## What's covered (50+ models, pricing snapshot 2026-04)

| Provider | Models |
|---|---|
| **OpenAI** | `gpt-3.5-turbo`, `gpt-4`, `gpt-4-turbo`, `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `o1`, `o1-mini`, `o3`, `o3-mini`, `o4-mini` |
| **Anthropic** | `claude-3-haiku`, `claude-3-sonnet`, `claude-3-opus`, `claude-3.5-haiku`, `claude-3.5-sonnet`, `claude-3.7-sonnet`, `claude-haiku-4-5`, `claude-sonnet-4`, `claude-sonnet-4-6`, `claude-opus-4`, `claude-opus-4-7` |
| **Google** | `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro` |
| **Meta** | `llama-3-8b`, `llama-3-70b`, `llama-3.1-8b`, `llama-3.1-70b`, `llama-3.1-405b`, `llama-3.3-70b` |
| **Mistral** | `mistral-small`, `mistral-medium`, `mistral-large`, `mistral-nemo`, `codestral` |
| **xAI** | `grok-2`, `grok-3`, `grok-4` |
| **DeepSeek** | `deepseek-v3`, `deepseek-r1` |
| **Alibaba** | `qwen-2.5`, `qwen-3` |
| **Cohere** | `command-r`, `command-r-plus` |
| **AWS** | `nova-micro`, `nova-lite`, `nova-pro` |

Short aliases (`gpt`, `claude`, `gemini`, `llama`, `mistral`, `grok`, `deepseek`, `qwen`, `command`, `nova`) resolve to sensible defaults — see `tokcount --list-models` for the full table.

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

**Built by [vøiddo](https://voiddo.com).** We write tools so you do not have to. Enjoy.

[voiddo.com](https://voiddo.com) · [github.com/voidd0](https://github.com/voidd0) · [npmjs.com/org/v0idd0](https://www.npmjs.com/org/v0idd0) · [support@voiddo.com](mailto:support@voiddo.com)
