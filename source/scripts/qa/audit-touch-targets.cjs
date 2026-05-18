#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

let rootDir = process.cwd();
if (!fs.existsSync(path.join(rootDir, "app")) && fs.existsSync(path.join(rootDir, "source", "app"))) {
  rootDir = path.join(rootDir, "source");
}

const scanRoots = ["app", "components"].map((relativePath) => path.join(rootDir, relativePath));

const interactiveComponents = [
  "Pressable",
  "AnimatedCardPressable",
  "AnimatedChipPressable",
  "AnimatedIconPressable",
  "TouchCard",
  "TouchChip",
  "TouchIconButton",
  "TouchOptionRow",
  "TouchToggleRow",
  "GlassButton",
  "AppButton",
];

const safeIconOnlyComponents = new Set(["AnimatedIconPressable", "TouchIconButton"]);
const touchSafeComponents = new Set([
  "AnimatedCardPressable",
  "AnimatedChipPressable",
  "AnimatedIconPressable",
  "TouchCard",
  "TouchChip",
  "TouchIconButton",
  "TouchOptionRow",
  "TouchToggleRow",
  "GlassButton",
  "AppButton",
]);

const suspiciousClassTokens = ["py-1", "py-1.5", "h-6", "h-7", "h-8", "w-6", "w-7", "w-8"];

const lowLevelPrimitiveFiles = new Set([
  "components/ui/AnimatedPressables.tsx",
  "components/ui/TouchPrimitives.tsx",
  "components/ui/GlassButton.tsx",
  "components/ui/AppButton.tsx",
  "components/ui/SearchableSelect.tsx",
  "components/GlassTabBar.tsx",
  "components/ResourcesAwareTabBar.tsx",
]);

const lowLevelPrimitivePatterns = [
  /^components\/ui\/(?:.*Button|.*Pressable|.*Select|.*Picker|.*Dropdown)\.tsx$/,
  /^components\/layouts\//,
];

const devOnlyPatterns = [
  /^components\/dev\//,
  /(?:^|\/)(?:.*Dev.*|.*Debug.*)\.tsx$/,
];

function toRelative(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function walkTsxFiles(directory, files = []) {
  if (!fs.existsSync(directory)) return files;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkTsxFiles(entryPath, files);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push(entryPath);
    }
  }

  return files;
}

function maskComments(text) {
  const blank = (value) => value.replace(/[^\r\n]/g, " ");

  return text
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/.*$/gm, (match, prefix) => `${prefix}${blank(match.slice(prefix.length))}`);
}

function buildLineOffsets(text) {
  const offsets = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) {
      offsets.push(index + 1);
    }
  }
  return offsets;
}

function lineNumberForOffset(lineOffsets, offset) {
  let low = 0;
  let high = lineOffsets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineOffsets[mid] <= offset) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return high + 1;
}

function getLineWindow(lines, lineNumber, before = 4, after = 4) {
  const start = Math.max(0, lineNumber - before - 1);
  const end = Math.min(lines.length, lineNumber + after);
  return lines.slice(start, end).join("\n");
}

function hasIgnoreComment(lines, lineNumber) {
  const context = getLineWindow(lines, lineNumber, 3, 1);
  return /touch-audit-ignore/.test(context);
}

function isLowLevelPrimitiveFile(relativePath) {
  return lowLevelPrimitiveFiles.has(relativePath) || lowLevelPrimitivePatterns.some((pattern) => pattern.test(relativePath));
}

function isDevOnlyFile(relativePath) {
  return devOnlyPatterns.some((pattern) => pattern.test(relativePath));
}

function isContextAllowlisted(relativePath, lines, lineNumber, openingTag) {
  if (isLowLevelPrimitiveFile(relativePath) || isDevOnlyFile(relativePath)) {
    return true;
  }

  const context = `${getLineWindow(lines, lineNumber, 14, 10)}\n${openingTag}`;

  if (/(?:__DEV__|debug|dev-only|developer tool|onboardingDebug)/i.test(context)) {
    return true;
  }

  if (/DeadlineCalendarPage\.tsx$/.test(relativePath) && /(?:dayCell|selectedDateKey|dateKey|calendar)/i.test(context)) {
    return true;
  }

  if (/(?:accessible=\{false\}|stopPropagation|backdrop|onRequestClose|KeyboardAvoidingView)/.test(context)) {
    return true;
  }

  return false;
}

function findOpeningTagEnd(text, startIndex) {
  let quote = null;
  let braceDepth = 0;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    const previous = text[index - 1];

    if (quote) {
      if (char === quote && previous !== "\\") {
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      braceDepth += 1;
      continue;
    }

    if (char === "}" && braceDepth > 0) {
      braceDepth -= 1;
      continue;
    }

    if (char === ">" && braceDepth === 0) {
      return index;
    }
  }

  return -1;
}

function getClassNameText(openingTag) {
  const match = openingTag.match(/\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([\s\S]*?)`\}|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/);
  return match ? match.slice(1).find(Boolean) || "" : "";
}

function hasClassToken(className, token) {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)(?:[a-z0-9_-]+:)*${escapedToken}(?:\\s|$)`).test(className);
}

function usesTouchTargetOptOut(openingTag) {
  return /\benforceTouchTarget\s*=\s*\{\s*false\s*\}/.test(openingTag) || /\bcompact\s*=\s*\{\s*true\s*\}/.test(openingTag);
}

function findClosingTagStart(text, tagName, openingTagEnd) {
  const closingTag = `</${tagName}>`;
  return text.indexOf(closingTag, openingTagEnd + 1);
}

function looksIconOnly(originalText, tagName, startIndex, openingTagEnd) {
  const closingTagStart = findClosingTagStart(originalText, tagName, openingTagEnd);
  if (closingTagStart === -1) return false;

  const inner = originalText.slice(openingTagEnd + 1, closingTagStart);
  if (inner.length > 900 || inner.split(/\r?\n/).length > 24) return false;

  const hasIcon = /<(?:Ionicons|MaterialIcons|MaterialCommunityIcons|Feather|FontAwesome(?:5)?|AntDesign|Entypo|Octicons|SimpleLineIcons|Fontisto|EvilIcons|Zocial)\b/.test(inner);
  if (!hasIcon || /<Text\b/.test(inner)) return false;

  const textAfterRemovingMarkup = inner
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\{[\s\S]*?\}/g, "")
    .trim();

  return textAfterRemovingMarkup.length === 0;
}

function addIssue(issues, file, line, reason, suggestion) {
  issues.push({ file, line, reason, suggestion });
}

function auditFile(filePath) {
  const relativePath = toRelative(filePath);
  const originalText = fs.readFileSync(filePath, "utf8");
  const maskedText = maskComments(originalText);
  const lineOffsets = buildLineOffsets(originalText);
  const lines = originalText.split(/\r?\n/);
  const issues = [];

  const tagPattern = new RegExp(`<(${interactiveComponents.join("|")})\\b`, "g");
  let match;

  while ((match = tagPattern.exec(maskedText)) !== null) {
    const tagName = match[1];
    const startIndex = match.index;
    const openingTagEnd = findOpeningTagEnd(maskedText, startIndex);
    if (openingTagEnd === -1) continue;

    const line = lineNumberForOffset(lineOffsets, startIndex);
    const openingTag = originalText.slice(startIndex, openingTagEnd + 1);
    const ignored = hasIgnoreComment(lines, line);
    const contextAllowed = isContextAllowlisted(relativePath, lines, line, openingTag);

    if (ignored || contextAllowed) {
      continue;
    }

    if (tagName === "Pressable") {
      const iconOnly = looksIconOnly(originalText, tagName, startIndex, openingTagEnd);
      addIssue(
        issues,
        relativePath,
        line,
        iconOnly ? "Raw icon-only <Pressable> in product UI." : "Raw <Pressable> in product UI.",
        iconOnly
          ? "Use TouchIconButton or AnimatedIconPressable; add // touch-audit-ignore only with a short justification."
          : "Use TouchCard, TouchOptionRow, TouchToggleRow, TouchChip, or TouchIconButton; add // touch-audit-ignore only with a short justification."
      );
      continue;
    }

    const className = getClassNameText(openingTag);
    const smallTokens = suspiciousClassTokens.filter((token) => hasClassToken(className, token));
    const isTouchSafeWithoutOptOut = touchSafeComponents.has(tagName) && !usesTouchTargetOptOut(openingTag);

    if (smallTokens.length > 0 && !isTouchSafeWithoutOptOut) {
      addIssue(
        issues,
        relativePath,
        line,
        `Suspicious small touch sizing class on <${tagName}>: ${smallTokens.join(", ")}.`,
        "Use a touch primitive with the default 48px target, increase the wrapper to min-h-12/min-w-12, or add // touch-audit-ignore with a short justification."
      );
    }

    if (!safeIconOnlyComponents.has(tagName) && looksIconOnly(originalText, tagName, startIndex, openingTagEnd)) {
      addIssue(
        issues,
        relativePath,
        line,
        `Icon-only <${tagName}> action is not using TouchIconButton or AnimatedIconPressable.`,
        "Wrap icon-only actions in TouchIconButton so the target is centered and at least 48x48."
      );
    }
  }

  return issues;
}

const files = scanRoots.flatMap((scanRoot) => walkTsxFiles(scanRoot)).sort();
const issues = files.flatMap(auditFile).sort((left, right) => {
  if (left.file === right.file) return left.line - right.line;
  return left.file.localeCompare(right.file);
});

if (issues.length > 0) {
  console.error(`[touch-target-audit] Found ${issues.length} probable touch target issue${issues.length === 1 ? "" : "s"}.`);
  console.error("[touch-target-audit] Use // touch-audit-ignore only for intentionally dense, documented cases.\n");

  for (const issue of issues) {
    console.error(`${issue.file}:${issue.line}`);
    console.error(`  reason: ${issue.reason}`);
    console.error(`  suggested replacement: ${issue.suggestion}\n`);
  }

  process.exitCode = 1;
} else {
  console.log(`[touch-target-audit] Passed. Scanned ${files.length} TSX files under app/ and components/.`);
}
