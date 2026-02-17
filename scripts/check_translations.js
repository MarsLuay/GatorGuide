const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'services', 'translations.ts');
const src = fs.readFileSync(file, 'utf8');

function extractBlock(name, nextName) {
  const start = src.indexOf(`${name}: {`);
  if (start < 0) return null;
  const next = src.indexOf(`\n  ${nextName}: {`, start + 1);
  if (next < 0) {
    // fallback: find end of object by finding first '\n  }' after start
    const endMarker = '\n  },\n\n';
    const end = src.indexOf(endMarker, start);
    if (end < 0) return src.slice(start + `${name}: {`.length);
    return src.slice(start + `${name}: {`.length, end);
  }
  return src.slice(start + `${name}: {`.length, next);
}

function extractKeys(blockText) {
  const keys = new Set();
  const re = /"([^"]+)":/g;
  let k;
  while ((k = re.exec(blockText)) !== null) {
    keys.add(k[1]);
  }
  return keys;
}

const enBlock = extractBlock('English', 'Spanish');
const esBlock = extractBlock('Spanish', 'Chinese (Simplified)');
if (!enBlock) {
  console.error('English block not found');
  process.exit(2);
}
if (!esBlock) {
  console.error('Spanish block not found');
  process.exit(2);
}

const enKeys = extractKeys(enBlock);
const esKeys = extractKeys(esBlock);

const missing = [];
for (const k of enKeys) {
  if (!esKeys.has(k)) missing.push(k);
}

console.log('English keys total:', enKeys.size);
console.log('Spanish keys total:', esKeys.size);
console.log('Missing in Spanish:', missing.length);
missing.forEach(k => console.log(k));

process.exit(0);
