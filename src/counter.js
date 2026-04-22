// tokcount — token counter + cost estimator. Free forever from vøiddo.
// https://voiddo.com/tools/tokcount/

const fs = require('fs');
const path = require('path');

// Pricing snapshot 2026-04. Prices drift monthly — check the provider's
// pricing page for the latest. input/output are USD per 1,000,000 tokens.
// `ratio` is chars-per-token used for the approximate counter.
// `limit` is the model's context window in tokens.
//
// Aliases handled by the resolver below so users can pass short names
// like "gpt-4", "claude", "gemini" and hit a sensible default.
const MODELS = {
  // OpenAI — GPT family
  'gpt-3.5-turbo':      { ratio: 4.0, limit:   16385, input:  0.50, output:  1.50, provider: 'openai' },
  'gpt-4':              { ratio: 4.0, limit:    8192, input: 30.00, output: 60.00, provider: 'openai' },
  'gpt-4-turbo':        { ratio: 4.0, limit:  128000, input: 10.00, output: 30.00, provider: 'openai' },
  'gpt-4o':             { ratio: 4.0, limit:  128000, input:  2.50, output: 10.00, provider: 'openai' },
  'gpt-4o-mini':        { ratio: 4.0, limit:  128000, input:  0.15, output:  0.60, provider: 'openai' },
  'gpt-4.1':            { ratio: 4.0, limit: 1000000, input:  2.00, output:  8.00, provider: 'openai' },
  'gpt-4.1-mini':       { ratio: 4.0, limit: 1000000, input:  0.40, output:  1.60, provider: 'openai' },
  'gpt-4.1-nano':       { ratio: 4.0, limit: 1000000, input:  0.10, output:  0.40, provider: 'openai' },
  'gpt-5':              { ratio: 4.0, limit:  400000, input:  1.25, output: 10.00, provider: 'openai' },
  'gpt-5-mini':         { ratio: 4.0, limit:  400000, input:  0.25, output:  2.00, provider: 'openai' },
  'gpt-5-nano':         { ratio: 4.0, limit:  400000, input:  0.05, output:  0.40, provider: 'openai' },
  'o1':                 { ratio: 4.0, limit:  200000, input: 15.00, output: 60.00, provider: 'openai' },
  'o1-mini':            { ratio: 4.0, limit:  128000, input:  3.00, output: 12.00, provider: 'openai' },
  'o3':                 { ratio: 4.0, limit:  200000, input:  2.00, output:  8.00, provider: 'openai' },
  'o3-mini':            { ratio: 4.0, limit:  200000, input:  1.10, output:  4.40, provider: 'openai' },
  'o4-mini':            { ratio: 4.0, limit:  200000, input:  1.10, output:  4.40, provider: 'openai' },

  // Anthropic — Claude family
  'claude-3-haiku':     { ratio: 3.5, limit:  200000, input:  0.25, output:  1.25, provider: 'anthropic' },
  'claude-3-sonnet':    { ratio: 3.5, limit:  200000, input:  3.00, output: 15.00, provider: 'anthropic' },
  'claude-3-opus':      { ratio: 3.5, limit:  200000, input: 15.00, output: 75.00, provider: 'anthropic' },
  'claude-3.5-haiku':   { ratio: 3.5, limit:  200000, input:  0.80, output:  4.00, provider: 'anthropic' },
  'claude-3.5-sonnet':  { ratio: 3.5, limit:  200000, input:  3.00, output: 15.00, provider: 'anthropic' },
  'claude-3.7-sonnet':  { ratio: 3.5, limit:  200000, input:  3.00, output: 15.00, provider: 'anthropic' },
  'claude-haiku-4-5':   { ratio: 3.5, limit:  200000, input:  1.00, output:  5.00, provider: 'anthropic' },
  'claude-sonnet-4':    { ratio: 3.5, limit:  200000, input:  3.00, output: 15.00, provider: 'anthropic' },
  'claude-sonnet-4-6':  { ratio: 3.5, limit:  200000, input:  3.00, output: 15.00, provider: 'anthropic' },
  'claude-opus-4':      { ratio: 3.5, limit:  200000, input: 15.00, output: 75.00, provider: 'anthropic' },
  'claude-opus-4-7':    { ratio: 3.5, limit: 1000000, input: 15.00, output: 75.00, provider: 'anthropic' },

  // Google — Gemini family
  'gemini-1.5-flash':   { ratio: 4.0, limit: 1000000, input:  0.075, output:  0.30, provider: 'google' },
  'gemini-1.5-pro':     { ratio: 4.0, limit: 2000000, input:  1.25, output:  5.00, provider: 'google' },
  'gemini-2.0-flash':   { ratio: 4.0, limit: 1000000, input:  0.10, output:  0.40, provider: 'google' },
  'gemini-2.5-flash-lite':{ratio: 4.0, limit: 1000000, input:  0.075, output:  0.30, provider: 'google' },
  'gemini-2.5-flash':   { ratio: 4.0, limit: 1000000, input:  0.30, output:  2.50, provider: 'google' },
  'gemini-2.5-pro':     { ratio: 4.0, limit: 2000000, input:  1.25, output: 10.00, provider: 'google' },

  // Mistral
  'mistral-small':      { ratio: 4.0, limit:   32000, input:  0.20, output:  0.60, provider: 'mistral' },
  'mistral-medium':     { ratio: 4.0, limit:   32000, input:  2.70, output:  8.10, provider: 'mistral' },
  'mistral-large':      { ratio: 4.0, limit:  128000, input:  2.00, output:  6.00, provider: 'mistral' },
  'mistral-nemo':       { ratio: 4.0, limit:  128000, input:  0.15, output:  0.15, provider: 'mistral' },
  'codestral':          { ratio: 4.0, limit:   32000, input:  0.20, output:  0.60, provider: 'mistral' },

  // Meta — Llama family
  'llama-3-8b':         { ratio: 4.0, limit:    8192, input:  0.10, output:  0.10, provider: 'meta' },
  'llama-3-70b':        { ratio: 4.0, limit:    8192, input:  0.60, output:  0.60, provider: 'meta' },
  'llama-3.1-8b':       { ratio: 4.0, limit:  128000, input:  0.05, output:  0.05, provider: 'meta' },
  'llama-3.1-70b':      { ratio: 4.0, limit:  128000, input:  0.40, output:  0.40, provider: 'meta' },
  'llama-3.1-405b':     { ratio: 4.0, limit:  128000, input:  3.50, output:  3.50, provider: 'meta' },
  'llama-3.3-70b':      { ratio: 4.0, limit:  128000, input:  0.40, output:  0.40, provider: 'meta' },

  // xAI — Grok
  'grok-2':             { ratio: 4.0, limit:  128000, input:  2.00, output: 10.00, provider: 'xai' },
  'grok-3':             { ratio: 4.0, limit:  131072, input:  3.00, output: 15.00, provider: 'xai' },
  'grok-4':             { ratio: 4.0, limit:  256000, input:  5.00, output: 15.00, provider: 'xai' },

  // DeepSeek
  'deepseek-v3':        { ratio: 4.0, limit:   65536, input:  0.27, output:  1.10, provider: 'deepseek' },
  'deepseek-r1':        { ratio: 4.0, limit:   65536, input:  0.55, output:  2.19, provider: 'deepseek' },

  // Alibaba — Qwen
  'qwen-2.5':           { ratio: 4.0, limit:  131072, input:  0.40, output:  1.20, provider: 'alibaba' },
  'qwen-3':             { ratio: 4.0, limit:  131072, input:  0.50, output:  1.50, provider: 'alibaba' },

  // Cohere
  'command-r':          { ratio: 4.0, limit:  128000, input:  0.15, output:  0.60, provider: 'cohere' },
  'command-r-plus':     { ratio: 4.0, limit:  128000, input:  2.50, output: 10.00, provider: 'cohere' },

  // AWS — Nova
  'nova-micro':         { ratio: 4.0, limit:  128000, input:  0.035, output: 0.14, provider: 'amazon' },
  'nova-lite':          { ratio: 4.0, limit:  300000, input:  0.06, output:  0.24, provider: 'amazon' },
  'nova-pro':           { ratio: 4.0, limit:  300000, input:  0.80, output:  3.20, provider: 'amazon' },

  // Fallback
  'default':            { ratio: 4.0, limit:    4096, input:  0,    output:  0,    provider: 'unknown' },
};

// Short aliases → canonical model keys.
const ALIASES = {
  'gpt':                'gpt-4o',
  'gpt-3':              'gpt-3.5-turbo',
  'gpt-3.5':            'gpt-3.5-turbo',
  'gpt4':               'gpt-4',
  'gpt-4.5':            'gpt-4.1',
  'openai':             'gpt-4o',
  'claude':             'claude-sonnet-4-6',
  'claude-instant':     'claude-3-haiku',
  'claude-3':           'claude-3-sonnet',
  'claude-3.5':         'claude-3.5-sonnet',
  'claude-4':           'claude-sonnet-4-6',
  'claude-opus':        'claude-opus-4-7',
  'claude-sonnet':      'claude-sonnet-4-6',
  'claude-haiku':       'claude-haiku-4-5',
  'anthropic':          'claude-sonnet-4-6',
  'gemini':             'gemini-2.5-flash',
  'gemini-pro':         'gemini-2.5-pro',
  'gemini-flash':       'gemini-2.5-flash',
  'gemini-lite':        'gemini-2.5-flash-lite',
  'google':             'gemini-2.5-flash',
  'llama':              'llama-3.3-70b',
  'llama-3':            'llama-3-70b',
  'llama-3.1':          'llama-3.1-70b',
  'meta':               'llama-3.3-70b',
  'mistral':            'mistral-large',
  'grok':               'grok-4',
  'xai':                'grok-4',
  'deepseek':           'deepseek-v3',
  'qwen':               'qwen-3',
  'cohere':             'command-r-plus',
  'command':            'command-r-plus',
  'nova':               'nova-pro',
  'amazon':             'nova-pro',
  'aws':                'nova-pro',
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

function compareModels(text, outputTokens = 0) {
  const results = {};

  for (const key of Object.keys(MODELS)) {
    if (key === 'default') continue;
    const config = MODELS[key];
    const tokens = countTokens(text, key);
    const cost = estimateCost(tokens, outputTokens, key);
    results[key] = {
      tokens,
      limit: config.limit,
      usage: ((tokens / config.limit) * 100).toFixed(2),
      provider: config.provider,
      input: config.input,
      output: config.output,
      cost: cost.totalCost,
    };
  }

  return results;
}

function getAllModels() {
  return Object.keys(MODELS).filter((m) => m !== 'default');
}

function listModels() {
  return Object.entries(MODELS)
    .filter(([k]) => k !== 'default')
    .map(([k, v]) => ({
      model: k,
      provider: v.provider,
      limit: v.limit,
      input: v.input,
      output: v.output,
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
  // Back-compat: some callers may import TOKENIZERS.
  TOKENIZERS: MODELS,
};
