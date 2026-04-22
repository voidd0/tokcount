// tokcount — tests. vøiddo, free forever.

const counter = require('./src/counter');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('\x1b[32m✓ ' + name + '\x1b[0m');
    passed++;
  } catch (e) {
    console.log('\x1b[31m✗ ' + name + '\x1b[0m');
    console.log('  ' + e.message);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// --- countTokens -----------------------------------------------------------
test('countTokens returns number', () => {
  const result = counter.countTokens('Hello, how are you today?');
  assert(typeof result === 'number', 'Should return number');
  assert(result > 0, 'Should be positive');
});

test('countTokens handles empty string', () => {
  assert(counter.countTokens('') === 0, 'Empty should be 0');
});

test('countTokens handles null/undefined', () => {
  assert(counter.countTokens(null) === 0, 'Null should be 0');
  assert(counter.countTokens(undefined) === 0, 'Undefined should be 0');
});

// --- estimateTokens --------------------------------------------------------
test('estimateTokens is close to countTokens', () => {
  const text = 'This is a test string with some words in it.';
  const count = counter.countTokens(text);
  const estimate = counter.estimateTokens(text);
  const diff = Math.abs(count - estimate);
  const tolerance = Math.max(count, estimate) * 0.5;
  assert(diff < tolerance, 'Estimate should be within 50% of count');
});

// --- resolveModel / aliases -------------------------------------------------
test('resolveModel canonicalizes known keys', () => {
  assert(counter.resolveModel('gpt-4o') === 'gpt-4o');
  assert(counter.resolveModel('GPT-4O') === 'gpt-4o');
});

test('resolveModel maps aliases', () => {
  assert(counter.resolveModel('claude') === 'claude-sonnet-4-6', 'claude alias');
  assert(counter.resolveModel('gemini') === 'gemini-3-flash', 'gemini alias');
  assert(counter.resolveModel('openai') === 'gpt-5.4', 'openai alias');
  assert(counter.resolveModel('llama') === 'llama-4-maverick', 'llama alias');
  assert(counter.resolveModel('opus') === 'claude-opus-4-7', 'opus alias');
  assert(counter.resolveModel('reasoning') === 'o3', 'reasoning alias');
  assert(counter.resolveModel('o1') === 'o3', 'o1 alias redirects to o3 after retirement');
});

test('reasoning models are tagged', () => {
  const reasoning = counter.listModels({ tag: 'reasoning' });
  assert(reasoning.length >= 5, `Should have ≥5 reasoning models, got ${reasoning.length}`);
  const keys = reasoning.map((r) => r.model);
  assert(keys.includes('o3'), 'should include o3');
  assert(keys.includes('deepseek-r1') || keys.includes('deepseek-r2'), 'should include deepseek R');
  assert(keys.includes('magistral-medium'), 'should include magistral');
});

test('provider filter narrows listModels', () => {
  const anthropic = counter.listModels({ provider: 'anthropic' });
  assert(anthropic.length > 0);
  assert(anthropic.every((r) => r.provider === 'anthropic'));
});

test('resolveModel falls back to default for unknown', () => {
  assert(counter.resolveModel('does-not-exist') === 'default');
});

// --- countFile -------------------------------------------------------------
test('countFile reads and counts', () => {
  const testFile = '/tmp/tokcount-test-' + Date.now() + '.txt';
  fs.writeFileSync(testFile, 'Hello world, this is a test file with some content.');

  const result = counter.countFile(testFile);
  assert(result.tokens > 0, 'Should count tokens');
  assert(result.file === testFile, 'Should include file path');
  assert(result.model, 'Should include model');
  assert(typeof result.cost === 'number', 'Should include cost');

  fs.unlinkSync(testFile);
});

test('countFile handles missing file', () => {
  const result = counter.countFile('/nonexistent/file.txt');
  assert(result.error, 'Should return error for missing file');
});

// --- countDirectory --------------------------------------------------------
test('countDirectory sums text files', () => {
  const testDir = '/tmp/tokcount-test-dir-' + Date.now();
  fs.mkdirSync(testDir);
  fs.writeFileSync(path.join(testDir, 'file1.txt'), 'Content one, pretty short.');
  fs.writeFileSync(path.join(testDir, 'file2.md'),  '# Heading\n\nA paragraph of test content.');

  const result = counter.countDirectory(testDir);
  assert(result.totalTokens > 0, 'Should have total tokens');
  assert(result.files.length === 2, 'Should have 2 files');

  fs.rmSync(testDir, { recursive: true });
});

test('countDirectory skips node_modules and binary files', () => {
  const testDir = '/tmp/tokcount-test-skip-' + Date.now();
  fs.mkdirSync(testDir);
  fs.mkdirSync(path.join(testDir, 'node_modules'));
  fs.writeFileSync(path.join(testDir, 'node_modules', 'should-skip.js'), 'x'.repeat(5000));
  fs.writeFileSync(path.join(testDir, 'ok.txt'), 'just some text');
  fs.writeFileSync(path.join(testDir, 'bin.dat'), Buffer.from([0, 1, 2, 3, 0, 4, 5]));

  const result = counter.countDirectory(testDir);
  assert(result.files.length === 1, 'Should skip node_modules + binary, got ' + result.files.length);
  assert(result.files[0].file.endsWith('ok.txt'), 'Should include the text file');

  fs.rmSync(testDir, { recursive: true });
});

// --- getModelLimits / getModelConfig --------------------------------------
test('getModelLimits returns context window', () => {
  assert(counter.getModelLimits('gpt-4o')     === 128000, 'gpt-4o should be 128k');
  assert(counter.getModelLimits('claude-sonnet-4-6') === 200000, 'claude-sonnet-4-6 should be 200k');
  assert(counter.getModelLimits('gemini-2.5-flash') === 1000000, 'gemini-2.5-flash should be 1M');
  assert(counter.getModelLimits('gpt-4.1') === 1000000, 'gpt-4.1 should be 1M');
});

test('getModelConfig returns pricing', () => {
  const cfg = counter.getModelConfig('claude-sonnet-4-6');
  assert(typeof cfg.input === 'number' && cfg.input > 0);
  assert(typeof cfg.output === 'number' && cfg.output > 0);
  assert(cfg.provider === 'anthropic');
});

// --- estimateCost ----------------------------------------------------------
test('estimateCost computes input + output USD', () => {
  // 1,000,000 input tokens at $3/MTok on claude-sonnet-4-6 → $3.00
  const c = counter.estimateCost(1_000_000, 0, 'claude-sonnet-4-6');
  assert(Math.abs(c.inputCost - 3.00) < 0.0001, 'inputCost should be $3.00, got ' + c.inputCost);
  assert(c.outputCost === 0, 'outputCost should be 0');
  assert(Math.abs(c.totalCost - 3.00) < 0.0001);
});

test('estimateCost adds output tokens', () => {
  // 100k in @ $3 + 10k out @ $15 = 0.30 + 0.15 = 0.45 on claude-sonnet-4-6
  const c = counter.estimateCost(100_000, 10_000, 'claude-sonnet-4-6');
  assert(Math.abs(c.totalCost - 0.45) < 0.001, 'totalCost should be ~$0.45, got ' + c.totalCost);
});

// --- compareModels ---------------------------------------------------------
test('compareModels covers major providers', () => {
  const result = counter.compareModels('Hello world, this is a prompt.');
  assert(typeof result === 'object', 'Should return object');
  for (const key of ['gpt-4o', 'claude-sonnet-4-6', 'gemini-2.5-flash', 'llama-3.3-70b']) {
    assert(key in result, `Should include ${key}`);
    assert(result[key].tokens > 0, `${key} should have tokens`);
    assert(typeof result[key].cost === 'number', `${key} should have cost`);
  }
});

test('compareModels honors outputTokens param', () => {
  const withOut = counter.compareModels('hi', 10_000);
  const without = counter.compareModels('hi', 0);
  assert(withOut['claude-sonnet-4-6'].cost > without['claude-sonnet-4-6'].cost,
    'Adding output tokens should increase cost');
});

// --- getAllModels / listModels --------------------------------------------
test('getAllModels returns array of 30+ models', () => {
  const models = counter.getAllModels();
  assert(Array.isArray(models), 'Should return array');
  assert(models.length >= 30, 'Should have 30+ models, got ' + models.length);
  assert(models.includes('gpt-4o'));
  assert(models.includes('claude-sonnet-4-6'));
  assert(models.includes('gemini-2.5-flash'));
});

test('listModels returns structured rows', () => {
  const rows = counter.listModels();
  assert(Array.isArray(rows));
  assert(rows[0].model && rows[0].provider && typeof rows[0].limit === 'number');
});

// --- unicode ---------------------------------------------------------------
test('handles UTF-8', () => {
  const text = 'Hello 世界 🌍 café';
  assert(counter.countTokens(text) > 0, 'Should handle UTF-8');
});

test('different models give plausibly different counts', () => {
  const text = 'This is a longer text to test tokenization differences across models. ' .repeat(5);
  const gpt = counter.countTokens(text, 'gpt-4o');
  const claude = counter.countTokens(text, 'claude-sonnet-4-6');
  assert(Math.abs(gpt - claude) / Math.max(gpt, claude) < 0.3, 'Counts should be in the same ballpark');
});

console.log('\n' + passed + '/' + (passed + failed) + ' tests passed\n');
if (failed > 0) process.exit(1);
