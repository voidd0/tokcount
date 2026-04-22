#!/usr/bin/env node

// tokcount — count LLM tokens and estimate cost across 50+ models.
// Free forever from vøiddo — https://voiddo.com/tools/tokcount/

const counter = require('../src/counter');
const fs = require('fs');

const args = process.argv.slice(2);

const magenta = '\x1b[35m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const dim = '\x1b[2m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

function parseArgs(args) {
  const options = {
    files: [],
    model: 'gpt-4o',
    limit: null,
    breakdown: false,
    compare: false,
    json: false,
    csv: false,
    help: false,
    version: false,
    cost: false,
    outputTokens: 0,
    listModels: false,
    noColor: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--version' || arg === '-V') options.version = true;
    else if (arg === '--model' || arg === '-m') options.model = args[++i];
    else if (arg === '--limit' || arg === '-l') options.limit = parseInt(args[++i]);
    else if (arg === '--breakdown' || arg === '-b') options.breakdown = true;
    else if (arg === '--compare' || arg === '-c') options.compare = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--csv') options.csv = true;
    else if (arg === '--cost') options.cost = true;
    else if (arg === '--output-tokens' || arg === '-o') options.outputTokens = parseInt(args[++i]) || 0;
    else if (arg === '--list-models' || arg === '--models') options.listModels = true;
    else if (arg === '--no-color') options.noColor = true;
    else if (!arg.startsWith('-')) options.files.push(arg);
  }

  return options;
}

function showVersion() {
  const pkg = require('../package.json');
  console.log(`tokcount v${pkg.version} — vøiddo, free forever. https://voiddo.com/tools/tokcount/`);
}

function showHelp() {
  console.log(`
  ${bold}${magenta}tokcount${reset} — count LLM tokens and estimate cost across 50+ models.
  ${dim}Free forever from vøiddo.${reset}

  ${dim}Usage:${reset}
    tokcount [files-or-dirs] [options]
    echo "text" | tokcount
    cat file.md | tokcount --model claude

  ${dim}Options:${reset}
    -m, --model <model>        Model key or alias (default: gpt-4o)
    -l, --limit <n>            Override the model's context limit
    -o, --output-tokens <n>    Expected output tokens (for cost math)
    -c, --compare              Compare across every supported model
    -b, --breakdown            Per-file token breakdown
        --cost                 Show USD cost estimate
        --json                 Emit JSON
        --csv                  Emit CSV
        --list-models          Print every supported model + pricing
        --no-color             Disable ANSI colors
    -h, --help                 Show this help
    -V, --version              Show version

  ${dim}Models (short aliases):${reset}
    gpt, gpt-4, gpt-4o, gpt-4.1, gpt-5, o1, o3, o4-mini
    claude, claude-opus, claude-sonnet, claude-haiku, claude-4
    gemini, gemini-flash, gemini-pro, gemini-lite
    llama, llama-3.1, mistral, grok, deepseek, qwen, command, nova
    (use --list-models for the full table, including pricing)

  ${dim}Examples:${reset}
    tokcount README.md
    tokcount src/ --breakdown
    tokcount prompt.md --model claude-sonnet-4-6 --cost
    tokcount huge.txt --limit 200000
    tokcount big.md --compare --cost
    tokcount essay.txt --model gpt-4o --output-tokens 2000 --cost
    echo "how much is this?" | tokcount --model claude --cost
    tokcount --list-models

  ${dim}Docs:   ${reset} https://voiddo.com/tools/tokcount/
  ${dim}Issues: ${reset} https://github.com/voidd0/tokcount/issues
  ${dim}Contact:${reset} support@voiddo.com

  ${dim}Built by vøiddo — we write tools so you do not have to. Enjoy.${reset}
`);
}

function formatNumber(n) {
  return Number(n).toLocaleString();
}

function formatCost(usd) {
  if (!usd) return '$0.0000';
  if (usd < 0.01) return '$' + usd.toFixed(6);
  if (usd < 1)    return '$' + usd.toFixed(4);
  return '$' + usd.toFixed(2);
}

function colorize(enabled, code, text) {
  return enabled ? code + text + reset : String(text);
}

function printListModels(options) {
  const useColor = !options.noColor;
  const rows = counter.listModels();

  if (options.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (options.csv) {
    console.log('model,provider,context_tokens,input_usd_per_mtok,output_usd_per_mtok');
    for (const r of rows) {
      console.log(`${r.model},${r.provider},${r.limit},${r.input},${r.output}`);
    }
    return;
  }

  console.log('');
  console.log('  ' + colorize(useColor, bold + magenta, 'tokcount') + colorize(useColor, dim, '  — supported models') + '');
  console.log('  ' + colorize(useColor, dim, '─'.repeat(76)));
  const header = '  ' +
    'MODEL'.padEnd(22) +
    'PROVIDER'.padEnd(12) +
    'CONTEXT'.padStart(12) +
    '  INPUT $/MTok'.padStart(16) +
    '  OUTPUT $/MTok'.padStart(16);
  console.log(colorize(useColor, dim, header));
  console.log('  ' + colorize(useColor, dim, '─'.repeat(76)));

  for (const r of rows) {
    const line =
      '  ' +
      colorize(useColor, cyan, r.model.padEnd(22)) +
      r.provider.padEnd(12) +
      formatNumber(r.limit).padStart(12) +
      ('  ' + (r.input ? r.input.toFixed(4) : '—')).padStart(16) +
      ('  ' + (r.output ? r.output.toFixed(4) : '—')).padStart(16);
    console.log(line);
  }

  console.log('');
  console.log('  ' + colorize(useColor, dim, 'Prices are a 2026-04 snapshot. Providers change prices — check the vendor.'));
  console.log('');
}

function printResult(result, options) {
  const useColor = !options.noColor;

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (options.csv) {
    const tokens = result.tokens ?? result.totalTokens ?? 0;
    console.log('target,model,tokens,context_limit,usage_pct,cost_usd');
    console.log(`${result.file || result.directory},${result.model},${tokens},${result.limit},${result.usage},${(result.cost || 0).toFixed(6)}`);
    return;
  }

  const limit = options.limit || result.limit;
  const tokens = result.tokens ?? result.totalTokens ?? 0;
  const exceeds = tokens > limit;

  console.log('');
  console.log('  ' + colorize(useColor, bold + magenta, 'tokcount') + colorize(useColor, dim, '  — free forever from vøiddo'));
  console.log('  ' + colorize(useColor, dim, '─'.repeat(40)));

  if (result.file) {
    console.log('  File:     ' + colorize(useColor, cyan, result.file));
  } else if (result.directory) {
    console.log('  Dir:      ' + colorize(useColor, cyan, result.directory));
    console.log('  Files:    ' + result.fileCount);
  }

  console.log('  Model:    ' + result.model);
  console.log('  Tokens:   ' + colorize(useColor, bold + magenta, formatNumber(tokens)));
  console.log('  Context:  ' + formatNumber(limit) + colorize(useColor, dim, '  (' + result.usage + '% used)'));

  if (options.cost || result.cost) {
    const out = options.outputTokens || 0;
    const breakdown = counter.estimateCost(tokens, out, result.model);
    console.log('  Pricing:  ' + colorize(useColor, dim, `$${(result.pricing.input ?? 0).toFixed(4)} in / $${(result.pricing.output ?? 0).toFixed(4)} out per 1M tokens`));
    if (out > 0) {
      console.log('  Cost in:  ' + colorize(useColor, green, formatCost(breakdown.inputCost)));
      console.log('  Cost out: ' + colorize(useColor, green, formatCost(breakdown.outputCost)) + colorize(useColor, dim, `  (${formatNumber(out)} output tokens)`));
      console.log('  ' + colorize(useColor, bold, 'Cost:     ') + colorize(useColor, bold + green, formatCost(breakdown.totalCost)));
    } else {
      console.log('  Cost in:  ' + colorize(useColor, green, formatCost(breakdown.inputCost)) + colorize(useColor, dim, '  (add --output-tokens N for output cost)'));
    }
  }

  console.log('');
  if (exceeds) {
    const over = tokens - limit;
    console.log('  ' + colorize(useColor, red, '✗ Exceeds context by ' + formatNumber(over) + ' tokens'));
  } else {
    console.log('  ' + colorize(useColor, green, '✓ Within context window'));
  }
  console.log('');
}

function printBreakdown(result, options) {
  const useColor = !options.noColor;

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (options.csv) {
    console.log('file,tokens,chars');
    for (const f of result.files) console.log(`${f.file},${f.tokens},${f.chars}`);
    console.log(`TOTAL,${result.totalTokens},${result.totalChars}`);
    return;
  }

  console.log('');
  console.log('  ' + colorize(useColor, dim, 'FILE'.padEnd(50) + 'TOKENS'));
  console.log('  ' + colorize(useColor, dim, '─'.repeat(60)));

  const sorted = [...result.files].sort((a, b) => b.tokens - a.tokens);
  for (const f of sorted) {
    const name = f.file.length > 48 ? '…' + f.file.slice(-45) : f.file;
    console.log('  ' + colorize(useColor, cyan, name.padEnd(50)) + formatNumber(f.tokens));
  }

  console.log('  ' + colorize(useColor, dim, '─'.repeat(60)));
  console.log('  ' + 'TOTAL'.padEnd(50) + colorize(useColor, bold + magenta, formatNumber(result.totalTokens)));
  if (options.cost && result.cost) {
    console.log('  ' + 'COST'.padEnd(50) + colorize(useColor, green, formatCost(result.cost)) +
      colorize(useColor, dim, '  (' + result.model + ', input only)'));
  }
  console.log('');
}

function printCompare(text, options) {
  const useColor = !options.noColor;
  const results = counter.compareModels(text, options.outputTokens || 0);

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  if (options.csv) {
    console.log('model,provider,tokens,context_limit,usage_pct,cost_usd');
    for (const [model, data] of Object.entries(results)) {
      console.log(`${model},${data.provider},${data.tokens},${data.limit},${data.usage},${data.cost.toFixed(6)}`);
    }
    return;
  }

  console.log('');
  console.log('  ' + colorize(useColor, bold + magenta, 'tokcount') + colorize(useColor, dim, '  — cross-model comparison'));
  const header = '  ' +
    'MODEL'.padEnd(22) +
    'TOKENS'.padStart(10) +
    'CONTEXT'.padStart(12) +
    'USED'.padStart(8) +
    '    COST';
  console.log(colorize(useColor, dim, header));
  console.log('  ' + colorize(useColor, dim, '─'.repeat(60)));

  const entries = Object.entries(results).sort((a, b) => a[1].cost - b[1].cost);
  for (const [model, data] of entries) {
    const line =
      '  ' +
      colorize(useColor, cyan, model.padEnd(22)) +
      formatNumber(data.tokens).padStart(10) +
      formatNumber(data.limit).padStart(12) +
      (data.usage + '%').padStart(8) +
      '    ' + colorize(useColor, green, formatCost(data.cost));
    console.log(line);
  }
  console.log('');
  if (!options.outputTokens) {
    console.log('  ' + colorize(useColor, dim, 'Cost = input only. Pass --output-tokens N for full-trip cost.'));
  }
  console.log('');
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');

    if (process.stdin.isTTY) {
      resolve(null);
      return;
    }

    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  const options = parseArgs(args);

  if (options.version) { showVersion(); process.exit(0); }
  if (options.help)    { showHelp();    process.exit(0); }
  if (options.listModels) { printListModels(options); process.exit(0); }

  // Read from stdin if no files
  if (options.files.length === 0) {
    const stdin = await readStdin();

    if (!stdin) {
      showHelp();
      process.exit(1);
    }

    if (options.compare) {
      printCompare(stdin, options);
      return;
    }

    const tokens = counter.countTokens(stdin, options.model);
    const config = counter.getModelConfig(options.model);

    if (options.json) {
      const payload = { tokens, model: config.canonical, limit: config.limit };
      if (options.cost) {
        const c = counter.estimateCost(tokens, options.outputTokens || 0, options.model);
        payload.cost = c.totalCost;
        payload.input_cost = c.inputCost;
        payload.output_cost = c.outputCost;
        payload.pricing = c.pricing;
      }
      console.log(JSON.stringify(payload));
    } else {
      const useColor = !options.noColor;
      const line = '  ' + colorize(useColor, bold + magenta, formatNumber(tokens)) +
        ' tokens ' + colorize(useColor, dim, `(${config.canonical})`);
      console.log(line);
      if (options.cost) {
        const c = counter.estimateCost(tokens, options.outputTokens || 0, options.model);
        console.log('  ' + colorize(useColor, green, formatCost(c.totalCost)) +
          colorize(useColor, dim, options.outputTokens ? ' (input + output)' : ' (input only)'));
      }
    }
    return;
  }

  // Process files
  for (const file of options.files) {
    if (!fs.existsSync(file)) {
      console.error(red + '  Error: File not found: ' + file + reset);
      continue;
    }

    const stats = fs.statSync(file);

    if (stats.isDirectory() || options.breakdown) {
      const result = counter.countDirectory(file, options.model);
      if (options.breakdown) printBreakdown(result, options);
      else                    printResult(result, options);
    } else {
      if (options.compare) {
        const content = fs.readFileSync(file, 'utf-8');
        printCompare(content, options);
      } else {
        const result = counter.countFile(file, options.model);
        printResult(result, options);
      }
    }
  }
}

main();
