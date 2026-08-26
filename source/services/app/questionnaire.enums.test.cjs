require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
    jsx: "react-jsx",
    baseUrl: ".",
    paths: {
      "@/*": ["./*"],
    },
  },
});
require("tsconfig-paths/register");

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeStateName,
} = require("@/services/app/questionnaire.enums");

test('normalizeStateName missing tests - handles state abbreviations', () => {
    assert.equal(normalizeStateName('WA'), 'Washington');
    assert.equal(normalizeStateName('NY'), 'New York');
});

test('normalizeStateName missing tests - handles full state names', () => {
    assert.equal(normalizeStateName('Washington'), 'Washington');
    assert.equal(normalizeStateName('California'), 'California');
});

test('normalizeStateName missing tests - handles mixed case state abbreviations', () => {
    assert.equal(normalizeStateName('wa'), 'Washington');
    assert.equal(normalizeStateName('Wa'), 'Washington');
});

test('normalizeStateName missing tests - handles mixed case full state names', () => {
    assert.equal(normalizeStateName('wAsHiNgToN'), 'Washington');
    assert.equal(normalizeStateName(' NEW YORK '), 'New York');
});

test('normalizeStateName missing tests - returns null for invalid state names', () => {
    assert.equal(normalizeStateName('InvalidState'), null);
    assert.equal(normalizeStateName('XY'), null);
});

test('normalizeStateName missing tests - handles non-strings gracefully', () => {
    assert.equal(normalizeStateName(null), null);
    assert.equal(normalizeStateName(undefined), null);
    assert.equal(normalizeStateName(''), null);
    assert.equal(normalizeStateName('   '), null);
});
