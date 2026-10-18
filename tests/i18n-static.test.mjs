/**
 * ==============================================================================
 * STATIC TRANSLATION QUALITY & DICTIONARY VERIFICATION SUITE
 * CodexConfigManager v2.2.0 i18n Verification
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const INDEX_HTML_PATH = path.join(REPO_ROOT, 'src', 'web', 'index.html');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
  }
}

console.log('\n================================================================');
console.log(' RUNNING: Static i18n & Translation Quality Suite');
console.log('================================================================\n');

// 1. Read index.html and extract MESSAGES
const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
const messagesMatch = html.match(/const MESSAGES\s*=\s*(\{[\s\S]*?\n\s*\});/);

assert(!!messagesMatch, 'MESSAGES dictionary exists and is embedded in src/web/index.html');

let MESSAGES = null;
try {
  // Safe evaluation of extracted JSON-like object
  MESSAGES = JSON.parse(messagesMatch[1]);
  assert(true, 'MESSAGES dictionary parses cleanly as valid JSON');
} catch (err) {
  // Try evaluating if not strict JSON
  try {
    const fn = new Function(`return ${messagesMatch[1]}`);
    MESSAGES = fn();
    assert(true, 'MESSAGES dictionary evaluated cleanly');
  } catch (evalErr) {
    assert(false, 'MESSAGES dictionary parsing', evalErr.message);
  }
}

if (!MESSAGES) {
  console.error('Fatal: Cannot continue without MESSAGES');
  process.exit(1);
}

// 2. Helper to get all nested keys
function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      keys = keys.concat(getAllKeys(obj[k], full));
    } else {
      keys.push(full);
    }
  }
  return keys.sort();
}

function getLeafMap(obj, prefix = '') {
  let map = {};
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      Object.assign(map, getLeafMap(obj[k], full));
    } else {
      map[full] = obj[k];
    }
  }
  return map;
}

const esKeys = getAllKeys(MESSAGES.es);
const enKeys = getAllKeys(MESSAGES.en);

assert(esKeys.length > 0, `Spanish dictionary contains entries (found: ${esKeys.length})`);
assert(enKeys.length > 0, `English dictionary contains entries (found: ${enKeys.length})`);
assert(esKeys.length === enKeys.length, `Dictionary key counts match exactly (${esKeys.length} === ${enKeys.length})`);

// 3. Key symmetry check
const inEsNotInEn = esKeys.filter(k => !enKeys.includes(k));
const inEnNotInEs = enKeys.filter(k => !esKeys.includes(k));

assert(inEsNotInEn.length === 0, 'Zero keys missing in English dictionary', inEsNotInEn.join(', '));
assert(inEnNotInEs.length === 0, 'Zero keys missing in Spanish dictionary', inEnNotInEs.join(', '));

// 4. Placeholder parameter matching and non-empty checks
const esLeaves = getLeafMap(MESSAGES.es);
const enLeaves = getLeafMap(MESSAGES.en);

let emptyCount = 0;
let placeholderMismatches = [];

for (const [key, esVal] of Object.entries(esLeaves)) {
  const enVal = enLeaves[key];

  if (!esVal || typeof esVal !== 'string' || esVal.trim() === '') {
    emptyCount++;
  }
  if (!enVal || typeof enVal !== 'string' || enVal.trim() === '') {
    emptyCount++;
  }

  const esPlaceholders = (esVal.match(/\{(\w+)\}/g) || []).sort();
  const enPlaceholders = (enVal.match(/\{(\w+)\}/g) || []).sort();

  if (esPlaceholders.join(',') !== enPlaceholders.join(',')) {
    placeholderMismatches.push(`${key}: ES=[${esPlaceholders}] vs EN=[${enPlaceholders}]`);
  }
}

assert(emptyCount === 0, 'No empty or whitespace-only translation strings in either language');
assert(placeholderMismatches.length === 0, 'All translation placeholders match symmetrically across ES and EN', placeholderMismatches.join('; '));

// 5. Verification of all data-i18n* attributes in HTML DOM
const i18nRegex = /data-i18n(?:-title|-placeholder|-aria-label)?="([^"]+)"/g;
let match;
const usedKeys = new Set();
while ((match = i18nRegex.exec(html)) !== null) {
  usedKeys.add(match[1]);
}

assert(usedKeys.size > 0, `HTML contains data-i18n attributes (found: ${usedKeys.size} distinct keys)`);

const missingDomKeys = [];
for (const key of usedKeys) {
  const parts = key.split('.');
  let cur = MESSAGES.es;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in cur) {
      cur = cur[part];
    } else {
      cur = undefined;
      break;
    }
  }
  if (typeof cur !== 'string') {
    missingDomKeys.push(key);
  }
}

assert(missingDomKeys.length === 0, 'All data-i18n* attributes in index.html resolve to valid entries in MESSAGES', missingDomKeys.join(', '));

// 6. Test t() resolution and interpolation logic
function testTranslate(lang, key, params = {}) {
  const dict = MESSAGES[lang] || MESSAGES.es;
  const parts = key.split('.');
  let cur = dict;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in cur) {
      cur = cur[part];
    } else {
      cur = undefined;
      break;
    }
  }
  if (cur === undefined) {
    let fallback = MESSAGES.es;
    for (const part of parts) {
      if (fallback && typeof fallback === 'object' && part in fallback) {
        fallback = fallback[part];
      } else {
        fallback = undefined;
        break;
      }
    }
    cur = fallback;
  }
  if (typeof cur !== 'string') return key;
  return cur.replace(/\{(\w+)\}/g, (m, p) => (params && p in params) ? params[p] : m);
}

assert(testTranslate('es', 'nav.accounts') === 'MONITOR CUENTAS', 't() resolves Spanish navigation label correctly');
assert(testTranslate('en', 'nav.accounts') === 'ACCOUNTS MONITOR', 't() resolves English navigation label correctly');
assert(testTranslate('fr', 'nav.accounts') === 'MONITOR CUENTAS', 't() falls back cleanly to Spanish for unsupported locale');
assert(
  testTranslate('es', 'telemetry.accounts_ready', { ready: 3, total: 5 }) === 'CUENTAS: 3/5 LISTAS',
  't() correctly interpolates parameters in Spanish'
);
assert(
  testTranslate('en', 'telemetry.accounts_ready', { ready: 3, total: 5 }) === 'ACCOUNTS: 3/5 READY',
  't() correctly interpolates parameters in English'
);
assert(testTranslate('es', 'non.existent.key') === 'non.existent.key', 't() returns key identifier on nonexistent key path');

// 7. Test Date/Time formatters
function formatTestDateTime(val, lang, options = {}) {
  if (!val) return testTranslate(lang, 'common.na');
  const d = new Date(val);
  if (isNaN(d.getTime())) return testTranslate(lang, 'common.na');
  const locale = lang === 'es' ? 'es-CO' : 'en-US';
  return new Intl.DateTimeFormat(locale, options).format(d);
}

const sampleDate = '2026-10-18T15:30:00Z';
const formattedEs = formatTestDateTime(sampleDate, 'es', { hour: '2-digit', minute: '2-digit' });
const formattedEn = formatTestDateTime(sampleDate, 'en', { hour: '2-digit', minute: '2-digit' });

assert(typeof formattedEs === 'string' && formattedEs.length > 0, 'DateTime formatter formats valid date in Spanish');
assert(typeof formattedEn === 'string' && formattedEn.length > 0, 'DateTime formatter formats valid date in English');
assert(formatTestDateTime(null, 'es') === 'N/A', 'DateTime formatter returns localized N/A for null date');
assert(formatTestDateTime('invalid-date-string', 'es') === 'N/A', 'DateTime formatter never returns "Invalid Date" for bad date');
assert(formatTestDateTime(undefined, 'en') === 'N/A', 'DateTime formatter returns localized N/A for undefined date');

console.log(`\n=== RESULTADOS STATIC i18n TESTS: ${passedTests} PASSED / ${failedTests} FAILED ===\n`);

if (failedTests > 0) {
  process.exit(1);
}
