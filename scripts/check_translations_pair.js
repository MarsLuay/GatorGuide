const fs = require('fs');
const path = require('path');
const [,, srcLang, tgtLang] = process.argv;
if (!srcLang || !tgtLang) {
  console.error('Usage: node check_translations_pair.js <SourceLang> <TargetLang>');
  process.exit(2);
}
const file = path.join(__dirname, '..', 'services', 'translations.ts');
const src = fs.readFileSync(file, 'utf8');

function extractBlock(name) {
  const start = src.indexOf(`${name}: {`);
  if (start < 0) return null;
  // find next language block by looking for '\n\n  ' + Capitalized word + ': {' pattern after start
  const nextLangRegex = /\n\n\s{2}[A-Z][^:]{1,100}: \{/g;
  nextLangRegex.lastIndex = start + 1;
  const m = nextLangRegex.exec(src);
  const end = m ? m.index : src.indexOf('\n\n};', start);
  if (end < 0) return src.slice(start + `${name}: {`.length);
  return src.slice(start + `${name}: {`.length, end);
}

function extractKeys(blockText) {
  const keys = new Set();
  const re = /"([^"\\]+)":/g;
  let k;
  while ((k = re.exec(blockText)) !== null) keys.add(k[1]);
  return keys;
}

const enBlock = extractBlock(srcLang);
const esBlock = extractBlock(tgtLang);
if (!enBlock) { console.error(srcLang + ' block not found'); process.exit(2); }
if (!esBlock) { console.error(tgtLang + ' block not found'); process.exit(2); }
const enKeys = extractKeys(enBlock);
const esKeys = extractKeys(esBlock);
const missing = [];
for (const k of enKeys) if (!esKeys.has(k)) missing.push(k);
console.log(`${srcLang} keys total:`, enKeys.size);
console.log(`${tgtLang} keys total:`, esKeys.size);
console.log('Missing in', tgtLang + ':', missing.length);
missing.forEach(k => console.log(k));
