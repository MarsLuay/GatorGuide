#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const rootDir = path.resolve(__dirname, "../..");
const englishLocalePath = path.join(rootDir, "constants", "locales", "en.json");
const isJson = process.argv.includes("--json");

const scanRoots = [
  "app",
  "components",
  "hooks",
  "services",
].map((relativePath) => path.join(rootDir, relativePath));

const scannedExtensions = new Set([".ts", ".tsx"]);
const skippedPathParts = new Set([
  "constants",
  "node_modules",
  ".expo",
  ".tmp",
  "dist",
]);

const userFacingAttributeNames = new Set([
  "accessibilityHint",
  "accessibilityLabel",
  "actionLabel",
  "emptyText",
  "label",
  "loadingMessage",
  "message",
  "placeholder",
  "searchPlaceholder",
  "subtitle",
  "text",
  "title",
]);

const userFacingObjectPropertyNames = new Set([
  "accessibilityHint",
  "accessibilityLabel",
  "actionLabel",
  "description",
  "emptyText",
  "label",
  "message",
  "placeholder",
  "subtitle",
  "text",
  "title",
]);

const ignoredStringValues = new Set([
  "",
  " ",
  "...",
  "Gator Guide",
  "GatorGuide",
]);

const ignoredFilePatterns = [
  /(^|\/)components\/dev\//,
  /(^|\/)components\/pages\/OpportunityAdminPage\.tsx$/,
  /(^|\/)components\/pages\/opportunity-admin\//,
  /(^|\/)app\/\+html\.tsx$/,
  /(^|\/)services\/ai\//,
  /(^|\/)services\/notifications\//,
  /(^|\/)services\/planning\//,
];

const ignoredHardcodedPatterns = [
  /^[A-Z0-9_]+$/,
  /^https?:\/\//i,
  /^mailto:/i,
  /^app:\/\//i,
  /^#[0-9a-f]{3,8}$/i,
  /^rgba?\(/i,
  /^hsla?\(/i,
  /^[a-z]+(-[a-z]+)*$/i,
  /^[a-z0-9_.:-]+$/i,
  /^[<>=~/$.,:;'"()[\]{}+*?|\s-]+$/,
  /^\{\{.+\}\}$/,
];

function toRelative(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skippedPathParts.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (scannedExtensions.has(path.extname(entry.name))) {
      const relativePath = toRelative(fullPath);
      if (!ignoredFilePatterns.some((pattern) => pattern.test(relativePath))) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function flatten(value, prefix = "", output = {}) {
  for (const [key, item] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      flatten(item, nextKey, output);
    } else if (typeof item === "string") {
      output[nextKey] = item;
    }
  }
  return output;
}

function loadTranslations() {
  return {
    English: flatten(JSON.parse(fs.readFileSync(englishLocalePath, "utf8"))),
  };
}

function hasHumanText(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || ignoredStringValues.has(trimmed)) return false;
  const withoutPlaceholders = trimmed.replace(/\{[^}]+\}/g, "").trim();
  if (!/[A-Za-z]/.test(withoutPlaceholders)) return false;
  if (/^[A-Z0-9\s._()/:-]+$/.test(withoutPlaceholders)) return false;
  return !ignoredHardcodedPatterns.some((pattern) => pattern.test(trimmed));
}

function locationFor(sourceFile, node) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${toRelative(sourceFile.fileName)}:${line + 1}:${character + 1}`;
}

function getPropertyNameText(name) {
  if (!name) return "";
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return "";
}

function getStringLiteralText(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function isTranslateCall(node) {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t";
}

function isAlertAlertCall(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "alert" &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "Alert"
  );
}

function isTranslateKeyArgument(node) {
  return (
    node.parent &&
    isTranslateCall(node.parent) &&
    node.parent.arguments[0] === node
  );
}

function isPotentialInlineTextExpression(node) {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateExpression(node) ||
    ts.isConditionalExpression(node) ||
    ts.isBinaryExpression(node) ||
    ts.isParenthesizedExpression(node)
  );
}

function auditFile(filePath, englishKeys) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    path.extname(filePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const missingKeys = [];
  const hardcodedStrings = [];

  function addHardcoded(node, value, kind) {
    const trimmed = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!hasHumanText(trimmed)) return;
    hardcodedStrings.push({
      location: locationFor(sourceFile, node),
      kind,
      value: trimmed,
    });
  }

  function addHardcodedFromExpression(node, kind) {
    if (!node) return;
    if (ts.isJsxElement(node) || ts.isJsxFragment(node) || ts.isJsxSelfClosingElement(node)) {
      return;
    }
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isBlock(node)
    ) {
      return;
    }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isTranslateKeyArgument(node)) {
      addHardcoded(node, node.text, kind);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      const value = [
        node.head.text,
        ...node.templateSpans.map((span) => `{value}${span.literal.text}`),
      ].join("");
      addHardcoded(node, value, kind);
      return;
    }
    if (ts.isCallExpression(node) && isTranslateCall(node)) {
      for (const argument of node.arguments.slice(1)) {
        addHardcodedFromExpression(argument, kind);
      }
      return;
    }
    ts.forEachChild(node, (child) => addHardcodedFromExpression(child, kind));
  }

  function visit(node) {
    if (isTranslateCall(node)) {
      const key = getStringLiteralText(node.arguments[0]);
      if (key && !englishKeys.has(key)) {
        missingKeys.push({
          location: locationFor(sourceFile, node.arguments[0]),
          key,
        });
      }
    }

    if (isAlertAlertCall(node)) {
      for (const argument of node.arguments.slice(0, 2)) {
        addHardcodedFromExpression(argument, "Alert.alert");
      }
    }

    if (ts.isJsxText(node)) {
      addHardcoded(node, node.getText(sourceFile), "JSX text");
    }

    if (ts.isJsxAttribute(node)) {
      const attributeName = node.name.text;
      if (userFacingAttributeNames.has(attributeName) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          addHardcoded(node.initializer, node.initializer.text, `JSX ${attributeName}`);
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          addHardcodedFromExpression(node.initializer.expression, `JSX ${attributeName}`);
        }
      }
    }

    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      isPotentialInlineTextExpression(node.expression)
    ) {
      addHardcodedFromExpression(node.expression, "JSX expression");
    }

    if (ts.isParameter(node) && node.initializer) {
      const name = ts.isIdentifier(node.name) ? node.name.text : "";
      if (/fallback|message|label|title|placeholder/i.test(name)) {
        addHardcodedFromExpression(node.initializer, `parameter ${name}`);
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const propertyName = getPropertyNameText(node.name);
      if (userFacingObjectPropertyNames.has(propertyName)) {
        const value = getStringLiteralText(node.initializer);
        if (value) addHardcoded(node.initializer, value, `property ${propertyName}`);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    missingKeys,
    hardcodedStrings,
  };
}

function main() {
  const translations = loadTranslations();
  const englishKeys = new Set(Object.keys(translations.English ?? {}));
  const files = scanRoots.flatMap((root) => walk(root)).sort((left, right) => left.localeCompare(right));
  const missingKeys = [];
  const hardcodedStrings = [];

  for (const filePath of files) {
    const result = auditFile(filePath, englishKeys);
    missingKeys.push(...result.missingKeys);
    hardcodedStrings.push(...result.hardcodedStrings);
  }

  if (isJson) {
    console.log(JSON.stringify({ missingKeys, hardcodedStrings }, null, 2));
    return;
  }

  if (missingKeys.length > 0 || hardcodedStrings.length > 0) {
    if (missingKeys.length > 0) {
      console.error(`Missing translation keys (${missingKeys.length}):`);
      for (const entry of missingKeys.slice(0, 80)) {
        console.error(`  - ${entry.location} ${entry.key}`);
      }
      if (missingKeys.length > 80) console.error(`  ...and ${missingKeys.length - 80} more`);
    }

    if (hardcodedStrings.length > 0) {
      console.error(`Hardcoded user-facing strings (${hardcodedStrings.length}):`);
      for (const entry of hardcodedStrings.slice(0, 120)) {
        console.error(`  - ${entry.location} [${entry.kind}] ${JSON.stringify(entry.value)}`);
      }
      if (hardcodedStrings.length > 120) console.error(`  ...and ${hardcodedStrings.length - 120} more`);
    }

    process.exitCode = 1;
    return;
  }

  console.log(`i18n usage audit passed: ${files.length} files, ${englishKeys.size} translation keys.`);
}

main();
