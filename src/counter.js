// tokcount — token counter + cost estimator. Free forever from vøiddo.
// https://voiddo.com/tools/tokcount/

const fs = require('fs');
const path = require('path');

// Pricing snapshot 2026-04-22. Verified against provider docs and public
// pricing pages the day tokcount 2.1 shipped. Prices drift monthly — check
// the provider's pricing page for the latest if you need exact billing.
//
// `input` / `output` are USD per 1,000,000 tokens.
// `ratio` is chars-per-token used by the approximate counter.
// `limit` is the model's context window in tokens.
// `tags`  lightweight classification (`chat`, `reasoning`, `coding`,
//         `multimodal`, `cheap`, `flagship`, `legacy`).
//
// Short aliases (e.g. "claude", "gpt", "gemini") resolve through the
// ALIASES table below so users do not need to memorize exact names.
const MODELS = {
  // ─── OpenAI ──────────────────────────────────────────────────────────────
  // GPT-5.4 — current flagship family (2026-03 release)
  'gpt-5.4':            { ratio: 4.0, limit:  400000, input:  2.50, output: 15.00, provider: 'openai', tags: ['chat', 'flagship'] },
  'gpt-5.4-mini':       { ratio: 4.0, limit:  400000, input:  0.75, output:  4.50, provider: 'openai', tags: ['chat'] },
  'gpt-5.4-nano':       { ratio: 4.0, limit:  400000, input:  0.20, output:  1.25, provider: 'openai', tags: ['chat', 'cheap'] },
  // GPT-5 family (2025, still supported; GPT-5.2 Instant used by ChatGPT Go)
  'gpt-5.2':            { ratio: 4.0, limit:  400000, input:  1.25, output: 10.00, provider: 'openai', tags: ['chat'] },
  'gpt-5.1':            { ratio: 4.0, limit:  400000, input:  1.25, output: 10.00, provider: 'openai', tags: ['chat'] },
  'gpt-5':              { ratio: 4.0, limit:  400000, input:  1.25, output: 10.00, provider: 'openai', tags: ['chat'] },
  'gpt-5-mini':         { ratio: 4.0, limit:  400000, input:  0.25, output:  2.00, provider: 'openai', tags: ['chat'] },
  'gpt-5-nano':         { ratio: 4.0, limit:  400000, input:  0.05, output:  0.40, provider: 'openai', tags: ['chat', 'cheap'] },
  // GPT-4.1 family — 1M-token long-context
  'gpt-4.1':            { ratio: 4.0, limit: 1000000, input:  2.00, output:  8.00, provider: 'openai', tags: ['chat', 'long-context'] },
  'gpt-4.1-mini':       { ratio: 4.0, limit: 1000000, input:  0.40, output:  1.60, provider: 'openai', tags: ['chat', 'long-context'] },
  'gpt-4.1-nano':       { ratio: 4.0, limit: 1000000, input:  0.10, output:  0.40, provider: 'openai', tags: ['chat', 'cheap', 'long-context'] },
  // GPT-4 / 4o legacy
  'gpt-4o':             { ratio: 4.0, limit:  128000, input:  2.50, output: 10.00, provider: 'openai', tags: ['chat', 'multimodal', 'legacy'] },
  'gpt-4o-mini':        { ratio: 4.0, limit:  128000, input:  0.15, output:  0.60, provider: 'openai', tags: ['chat', 'cheap', 'legacy'] },
  'gpt-4-turbo':        { ratio: 4.0, limit:  128000, input: 10.00, output: 30.00, provider: 'openai', tags: ['chat', 'legacy'] },
  'gpt-4':              { ratio: 4.0, limit:    8192, input: 30.00, output: 60.00, provider: 'openai', tags: ['chat', 'legacy'] },
  'gpt-3.5-turbo':      { ratio: 4.0, limit:   16385, input:  0.50, output:  1.50, provider: 'openai', tags: ['chat', 'cheap', 'legacy'] },
  // o-series reasoning (o1 retired; o3 at 87% price cut replaced it)
  'o3':                 { ratio: 4.0, limit:  200000, input:  2.00, output:  8.00, provider: 'openai', tags: ['reasoning', 'flagship'] },
  'o3-mini':            { ratio: 4.0, limit:  200000, input:  1.10, output:  4.40, provider: 'openai', tags: ['reasoning'] },
  'o4-mini':            { ratio: 4.0, limit:  200000, input:  1.10, output:  4.40, provider: 'openai', tags: ['reasoning'] },

  // ─── Anthropic ───────────────────────────────────────────────────────────
  // Claude 4.7 (Opus only so far, 2026-04-16); 4.6 Opus/Sonnet/Haiku current tier
  'claude-opus-4-7':    { ratio: 3.5, limit: 1000000, input:  5.00, output: 25.00, provider: 'anthropic', tags: ['chat', 'flagship', 'long-context'] },
  'claude-opus-4-6':    { ratio: 3.5, limit:  200000, input:  5.00, output: 25.00, provider: 'anthropic', tags: ['chat', 'flagship'] },
  'claude-sonnet-4-6':  { ratio: 3.5, limit:  200000, input:  3.00, output: 15.00, provider: 'anthropic', tags: ['chat'] },
  'claude-haiku-4-5':   { ratio: 3.5, limit:  200000, input:  1.00, output:  5.00, provider: 'anthropic', tags: ['chat', 'cheap'] },
  // Earlier 4.x still callable
  'claude-sonnet-4-5':  { ratio: 3.5, limit:  200000, input:  3.00, output: 15.00, provider: 'anthropic', tags: ['chat', 'legacy'] },
  'claude-opus-4-5':    { ratio: 3.5, limit:  200000, input:  5.00, output: 25.00, provider: 'anthropic', tags: ['chat', 'legacy'] },
  // Claude 3.5 — still widely deployed
  'claude-3.5-sonnet':  { ratio: 3.5, limit:  200000, input:  3.00, output: 15.00, provider: 'anthropic', tags: ['chat', 'legacy'] },
  'claude-3.5-haiku':   { ratio: 3.5, limit:  200000, input:  0.80, output:  4.00, provider: 'anthropic', tags: ['chat', 'legacy'] },

  // ─── Google — Gemini ─────────────────────────────────────────────────────
  // Gemini 3.x — current flagship (2026 release). Tiered: up to 200K vs above.
  'gemini-3.1-pro':     { ratio: 4.0, limit: 2000000, input:  2.00, output: 12.00, provider: 'google', tags: ['chat', 'flagship', 'long-context', 'multimodal'] },
  'gemini-3-pro':       { ratio: 4.0, limit: 2000000, input:  2.00, output: 12.00, provider: 'google', tags: ['chat', 'multimodal', 'long-context'] },
  'gemini-3-flash':     { ratio: 4.0, limit: 1000000, input:  0.50, output:  3.00, provider: 'google', tags: ['chat', 'multimodal', 'long-context'] },
  'gemini-3.1-flash-lite': { ratio: 4.0, limit: 1000000, input: 0.25, output:  1.50, provider: 'google', tags: ['chat', 'cheap', 'long-context'] },
  // Gemini 2.5 — moved to legacy/paid-only 2026-04
  'gemini-2.5-pro':     { ratio: 4.0, limit: 2000000, input:  1.25, output: 10.00, provider: 'google', tags: ['chat', 'legacy', 'long-context'] },
  'gemini-2.5-flash':   { ratio: 4.0, limit: 1000000, input:  0.30, output:  2.50, provider: 'google', tags: ['chat', 'legacy', 'long-context'] },
  'gemini-2.5-flash-lite':{ratio:4.0, limit: 1000000, input:  0.075,output:  0.30, provider: 'google', tags: ['chat', 'cheap', 'legacy'] },

  // ─── xAI — Grok ──────────────────────────────────────────────────────────
  'grok-4':             { ratio: 4.0, limit:  256000, input:  3.00, output: 15.00, provider: 'xai', tags: ['chat', 'flagship'] },
  'grok-4.1-fast':      { ratio: 4.0, limit: 2000000, input:  0.20, output:  0.50, provider: 'xai', tags: ['chat', 'cheap', 'long-context'] },
  'grok-4.2':           { ratio: 4.0, limit:  256000, input:  3.00, output: 15.00, provider: 'xai', tags: ['chat', 'beta'] },
  'grok-3':             { ratio: 4.0, limit:  131072, input:  3.00, output: 15.00, provider: 'xai', tags: ['chat', 'legacy'] },

  // ─── DeepSeek ────────────────────────────────────────────────────────────
  'deepseek-v3.2':      { ratio: 4.0, limit:  128000, input:  0.28, output:  0.42, provider: 'deepseek', tags: ['chat', 'cheap'] },
  'deepseek-r1':        { ratio: 4.0, limit:   65536, input:  0.70, output:  2.50, provider: 'deepseek', tags: ['reasoning'] },
  'deepseek-r2':        { ratio: 4.0, limit:  128000, input:  0.70, output:  2.50, provider: 'deepseek', tags: ['reasoning'] },

  // ─── Meta — Llama 4 ──────────────────────────────────────────────────────
  'llama-4-scout':      { ratio: 4.0, limit:10000000, input:  0.15, output:  0.60, provider: 'meta', tags: ['chat', 'multimodal', 'long-context'] },
  'llama-4-maverick':   { ratio: 4.0, limit: 1000000, input:  0.15, output:  0.60, provider: 'meta', tags: ['chat', 'multimodal', 'long-context'] },
  'llama-3.3-70b':      { ratio: 4.0, limit:  128000, input:  0.40, output:  0.40, provider: 'meta', tags: ['chat', 'legacy'] },
  'llama-3.1-70b':      { ratio: 4.0, limit:  128000, input:  0.40, output:  0.40, provider: 'meta', tags: ['chat', 'legacy'] },
  'llama-3.1-405b':     { ratio: 4.0, limit:  128000, input:  3.50, output:  3.50, provider: 'meta', tags: ['chat', 'legacy'] },

  // ─── Mistral ─────────────────────────────────────────────────────────────
  'mistral-large-3':    { ratio: 4.0, limit:  128000, input:  2.00, output:  6.00, provider: 'mistral', tags: ['chat', 'flagship'] },
  'mistral-medium-3':   { ratio: 4.0, limit:  128000, input:  1.00, output:  3.00, provider: 'mistral', tags: ['chat'] },
  'mistral-small-4':    { ratio: 4.0, limit:  128000, input:  0.15, output:  0.60, provider: 'mistral', tags: ['chat', 'reasoning', 'coding', 'multimodal', 'cheap'] },
  'mistral-small-3.1':  { ratio: 4.0, limit:  128000, input:  0.20, output:  0.60, provider: 'mistral', tags: ['chat', 'legacy'] },
  'magistral-medium':   { ratio: 4.0, limit:   40000, input:  2.00, output:  5.00, provider: 'mistral', tags: ['reasoning'] },
  'magistral-small-1.2':{ ratio: 4.0, limit:   40000, input:  0.50, output:  1.50, provider: 'mistral', tags: ['reasoning', 'cheap'] },
  'codestral':          { ratio: 4.0, limit:   32000, input:  0.20, output:  0.60, provider: 'mistral', tags: ['coding', 'cheap'] },
  'mistral-nemo':       { ratio: 4.0, limit:  128000, input:  0.02, output:  0.04, provider: 'mistral', tags: ['chat', 'cheap'] },

  // ─── Alibaba — Qwen 3 ────────────────────────────────────────────────────
  'qwen3-max':          { ratio: 4.0, limit:  262000, input:  0.78, output:  3.90, provider: 'alibaba', tags: ['chat', 'flagship'] },
  'qwen3.5-plus':       { ratio: 4.0, limit: 1000000, input:  0.26, output:  1.56, provider: 'alibaba', tags: ['chat', 'long-context', 'cheap'] },
  'qwen3':              { ratio: 4.0, limit:  131072, input:  0.50, output:  1.50, provider: 'alibaba', tags: ['chat'] },

  // ─── Cohere ──────────────────────────────────────────────────────────────
  'command-a':          { ratio: 4.0, limit:  256000, input:  2.50, output: 10.00, provider: 'cohere', tags: ['chat', 'flagship'] },
  'command-r-plus':     { ratio: 4.0, limit:  128000, input:  2.50, output: 10.00, provider: 'cohere', tags: ['chat'] },
  'command-r':          { ratio: 4.0, limit:  128000, input:  0.15, output:  0.60, provider: 'cohere', tags: ['chat', 'cheap'] },
  'command-r7b':        { ratio: 4.0, limit:  128000, input:  0.0375,output: 0.15, provider: 'cohere', tags: ['chat', 'cheap'] },

  // ─── AWS — Nova ──────────────────────────────────────────────────────────
  'nova-pro':           { ratio: 4.0, limit:  300000, input:  0.80, output:  3.20, provider: 'amazon', tags: ['chat', 'multimodal'] },
  'nova-lite':          { ratio: 4.0, limit:  300000, input:  0.06, output:  0.24, provider: 'amazon', tags: ['chat', 'cheap', 'multimodal'] },
  'nova-micro':         { ratio: 4.0, limit:  128000, input:  0.035,output:  0.14, provider: 'amazon', tags: ['chat', 'cheap'] },

  // Fallback — used when an unknown model name is passed.
  'default':            { ratio: 4.0, limit:    4096, input:  0,    output:  0,    provider: 'unknown', tags: ['fallback'] },
};

// Short aliases → canonical model keys. Resolver below is case-insensitive.
const ALIASES = {
  // OpenAI
  'gpt':            'gpt-5.4',
  'openai':         'gpt-5.4',
  'gpt-5.4-preview':'gpt-5.4',
  'gpt-4':          'gpt-4',
  'gpt-4.5':        'gpt-4.1',
  'gpt-3':          'gpt-3.5-turbo',
  'gpt-3.5':        'gpt-3.5-turbo',
  'gpt4o':          'gpt-4o',
  'chatgpt':        'gpt-5.4',
  'o1':             'o3',          // o1 retired; o3 replaces it
  'o1-mini':        'o3-mini',
  'reasoning':      'o3',

  // Anthropic
  'claude':         'claude-sonnet-4-6',
  'claude-opus':    'claude-opus-4-7',
  'claude-sonnet':  'claude-sonnet-4-6',
  'claude-haiku':   'claude-haiku-4-5',
  'claude-4':       'claude-sonnet-4-6',
  'claude-4.6':     'claude-sonnet-4-6',
  'claude-4.7':     'claude-opus-4-7',
  'claude-3':       'claude-3.5-sonnet',
  'claude-3.5':     'claude-3.5-sonnet',
  'anthropic':      'claude-sonnet-4-6',
  'opus':           'claude-opus-4-7',
  'sonnet':         'claude-sonnet-4-6',
  'haiku':          'claude-haiku-4-5',

  // Google Gemini
  'gemini':         'gemini-3-flash',
  'gemini-pro':     'gemini-3.1-pro',
  'gemini-flash':   'gemini-3-flash',
  'gemini-lite':    'gemini-3.1-flash-lite',
  'gemini-3':       'gemini-3-pro',
  'gemini-2.5':     'gemini-2.5-pro',
  'google':         'gemini-3-flash',
  'bard':           'gemini-3-flash',

  // Meta
  'llama':          'llama-4-maverick',
  'llama-4':        'llama-4-maverick',
  'llama-3':        'llama-3.3-70b',
  'llama-3.3':      'llama-3.3-70b',
  'llama-3.1':      'llama-3.1-70b',
  'meta':           'llama-4-maverick',
  'scout':          'llama-4-scout',
  'maverick':       'llama-4-maverick',

  // xAI
  'grok':           'grok-4',
  'xai':            'grok-4',
  'grok-4-fast':    'grok-4.1-fast',

  // Mistral
  'mistral':        'mistral-large-3',
  'mistral-large':  'mistral-large-3',
  'mistral-medium': 'mistral-medium-3',
  'mistral-small':  'mistral-small-4',
  'magistral':      'magistral-medium',

  // DeepSeek
  'deepseek':       'deepseek-v3.2',
  'deepseek-v3':    'deepseek-v3.2',
  'deepseek-chat':  'deepseek-v3.2',
  'deepseek-reasoner': 'deepseek-r2',

  // Alibaba
  'qwen':           'qwen3-max',
  'qwen3':          'qwen3',
  'qwen-3':         'qwen3',

  // Cohere
  'cohere':         'command-a',
  'command':        'command-a',

  // AWS
  'nova':           'nova-pro',
  'amazon':         'nova-pro',
  'aws':            'nova-pro',
};

function resolveModel(model) {
  if (!model) return 'default';
  const key = String(model).toLowerCase();
  if (MODELS[key]) return key;
  if (ALIASES[key]) return ALIASES[key];
  return 'default';
}

function getModelConfig(model) {
  const key = resolveModel(model);
  return { ...MODELS[key], canonical: key };
}

// Approximate tokenizer. Good-enough for cost/context planning without
// pulling in a 10 MB tokenizer blob. Blends word-count and char-count
// signals because neither alone is accurate across prose + code.
function countTokens(text, model = 'default') {
  if (!text || text.length === 0) return 0;

  const config = getModelConfig(model);

  const words = text.match(/\b\w+\b/g) || [];
  const punctuation = text.match(/[^\w\s]/g) || [];

  const wordTokens = words.length * 1.3;
  const punctTokens = punctuation.length;
  const charEstimate = text.length / config.ratio;

  const estimate = (wordTokens + punctTokens + charEstimate) / 2;
  return Math.ceil(estimate);
}

function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

// Compute cost for a given token count. outputTokens defaults to 0 —
// users typically know their prompt size and estimate output separately.
function estimateCost(inputTokens, outputTokens = 0, model = 'default') {
  const config = getModelConfig(model);
  const inputCost = (inputTokens / 1_000_000) * (config.input || 0);
  const outputCost = (outputTokens / 1_000_000) * (config.output || 0);
  return {
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    model: config.canonical,
    pricing: { input: config.input, output: config.output },
  };
}

function countFile(filePath, model = 'default') {
  if (!fs.existsSync(filePath)) {
    return { error: 'File not found: ' + filePath };
  }

  const stats = fs.statSync(filePath);
  if (stats.isDirectory()) {
    return countDirectory(filePath, model);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const tokens = countTokens(content, model);
  const config = getModelConfig(model);
  const cost = estimateCost(tokens, 0, model);

  return {
    file: filePath,
    tokens,
    chars: content.length,
    lines: content.split('\n').length,
    model: config.canonical,
    limit: config.limit,
    usage: ((tokens / config.limit) * 100).toFixed(2),
    cost: cost.totalCost,
    pricing: cost.pricing,
  };
}

// Text-file extensions we care about for directory counting. Comprehensive
// enough that "tokcount ." on a typical repo hits source + config + docs.
const TEXT_EXTS = new Set([
  '.txt', '.md', '.markdown', '.rst',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.php', '.go', '.rs', '.java', '.kt', '.scala',
  '.c', '.cpp', '.cc', '.h', '.hpp', '.m', '.mm', '.swift',
  '.cs', '.fs', '.vb', '.clj', '.cljs', '.ex', '.exs', '.erl', '.hs',
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env',
  '.html', '.htm', '.xml', '.svg',
  '.css', '.scss', '.sass', '.less', '.styl',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
  '.sql', '.graphql', '.gql', '.prisma',
  '.vue', '.svelte', '.astro',
  '.lua', '.r', '.jl', '.dart', '.elm', '.ml', '.nim', '.zig', '.v',
  '.proto', '.thrift', '.capnp',
  '.dockerfile', '.makefile', '.cmake',
  '.tex', '.bib', '.log', '.csv', '.tsv',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'target',
  'vendor', '__pycache__', '.venv', 'venv', 'env', '.env',
  '.next', '.nuxt', '.cache', '.turbo', 'coverage', '.nyc_output',
]);

// Rough binary detection: sample first 1 KB for NUL bytes.
function looksBinary(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(1024);
    const n = fs.readSync(fd, buf, 0, 1024, 0);
    fs.closeSync(fd);
    for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
    return false;
  } catch {
    return true;
  }
}

function countDirectory(dirPath, model = 'default') {
  const files = [];
  let totalTokens = 0;
  let totalChars = 0;

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.startsWith('.') && entry !== '.env') continue;
      if (SKIP_DIRS.has(entry)) continue;

      const fullPath = path.join(dir, entry);
      let stats;
      try { stats = fs.statSync(fullPath); } catch { continue; }

      if (stats.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!stats.isFile()) continue;

      const ext = path.extname(entry).toLowerCase();
      const basename = entry.toLowerCase();
      const knownByName = ['dockerfile', 'makefile', 'readme', 'license', 'changelog'].some(
        (n) => basename === n || basename.startsWith(n + '.'),
      );

      if (!TEXT_EXTS.has(ext) && !knownByName) continue;
      if (stats.size > 10 * 1024 * 1024) continue; // skip >10 MB files
      if (looksBinary(fullPath)) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const tokens = countTokens(content, model);
        totalTokens += tokens;
        totalChars += content.length;
        files.push({ file: fullPath, tokens, chars: content.length });
      } catch {
        // skip unreadable
      }
    }
  }

  walk(dirPath);

  const config = getModelConfig(model);
  const cost = estimateCost(totalTokens, 0, model);

  return {
    directory: dirPath,
    files,
    totalTokens,
    totalChars,
    fileCount: files.length,
    model: config.canonical,
    limit: config.limit,
    usage: ((totalTokens / config.limit) * 100).toFixed(2),
    cost: cost.totalCost,
    pricing: cost.pricing,
  };
}

function getModelLimits(model) {
  return getModelConfig(model).limit;
}

function compareModels(text, outputTokens = 0, filter = null) {
  const results = {};

  for (const key of Object.keys(MODELS)) {
    if (key === 'default') continue;
    const config = MODELS[key];
    if (filter && filter.tag && !(config.tags || []).includes(filter.tag)) continue;
    if (filter && filter.provider && config.provider !== filter.provider) continue;

    const tokens = countTokens(text, key);
    const cost = estimateCost(tokens, outputTokens, key);
    results[key] = {
      tokens,
      limit: config.limit,
      usage: ((tokens / config.limit) * 100).toFixed(2),
      provider: config.provider,
      input: config.input,
      output: config.output,
      tags: config.tags || [],
      cost: cost.totalCost,
    };
  }

  return results;
}

function getAllModels() {
  return Object.keys(MODELS).filter((m) => m !== 'default');
}

function listModels(filter = null) {
  return Object.entries(MODELS)
    .filter(([k]) => k !== 'default')
    .filter(([, v]) => !filter || !filter.tag || (v.tags || []).includes(filter.tag))
    .filter(([, v]) => !filter || !filter.provider || v.provider === filter.provider)
    .map(([k, v]) => ({
      model: k,
      provider: v.provider,
      limit: v.limit,
      input: v.input,
      output: v.output,
      tags: v.tags || [],
    }));
}

module.exports = {
  countTokens,
  estimateTokens,
  estimateCost,
  countFile,
  countDirectory,
  getModelLimits,
  compareModels,
  getAllModels,
  listModels,
  resolveModel,
  getModelConfig,
  MODELS,
  ALIASES,
  // Back-compat export — some callers may import TOKENIZERS.
  TOKENIZERS: MODELS,
};
