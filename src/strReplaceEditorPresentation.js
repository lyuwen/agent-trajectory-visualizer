const NUMBERED_LINE_RE = /^\s*(\d+)\t(.*)$/;
const EXPLICIT_ERROR_RE = /^\s*\[An error occurred during execution\.\]/;
const LISTING_HEADER_RE = /(^|\n)Here's the files and directories/;
const LISTING_HEADER_LINE_RE = /^Here's the files and directories/;
const MAX_LCS_CELLS = 250000;
// Bound the O(rows x new_str) anchor search so a pathological call cannot block
// the render thread. Realistic snippets are far below this; a 25M-cell scan is
// roughly 30ms, while the worst observed pathological case was 200M cells.
const MAX_ANCHOR_COMPARISONS = 25000000;

function coerceOutputText(output) {
  if (output === null || output === undefined) return null;
  if (typeof output === 'string') return output;
  if (typeof output === 'number' || typeof output === 'boolean') return String(output);
  if (typeof output === 'object') {
    try {
      const serialized = JSON.stringify(output);
      return serialized === undefined ? String(output) : serialized;
    } catch {
      try {
        return String(output);
      } catch {
        return null;
      }
    }
  }
  try {
    return String(output);
  } catch {
    return null;
  }
}

function splitLines(text) {
  if (typeof text !== 'string') return [];
  // Treat CRLF as a single line terminator so argument text stays aligned with
  // the numbered output parser, which already splits on /\r?\n/.
  const lines = text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

function hasText(value) {
  return typeof value === 'string' && value.length > 0 && value !== 'None';
}

function normalizeArgs(args) {
  if (args !== null && typeof args === 'object' && !Array.isArray(args)) {
    return args;
  }
  return {};
}

// Emit the LCS-based diff of two already prefix/suffix-reduced line arrays.
// `oldOffset`/`newOffset` are the counts of leading context lines already
// emitted, so 1-based indices stay anchored to the full inputs.
function diffMiddle(oldLines, newLines, oldOffset, newOffset) {
  const oldCount = oldLines.length;
  const newCount = newLines.length;
  const rows = [];

  if (oldCount * newCount > MAX_LCS_CELLS) {
    for (let i = 0; i < oldCount; i += 1) {
      rows.push({ type: 'remove', oldIndex: oldOffset + i + 1, newIndex: null, text: oldLines[i] });
    }
    for (let j = 0; j < newCount; j += 1) {
      rows.push({ type: 'add', oldIndex: null, newIndex: newOffset + j + 1, text: newLines[j] });
    }
    return rows;
  }

  const table = Array.from({ length: oldCount + 1 }, () => new Array(newCount + 1).fill(0));
  for (let i = oldCount - 1; i >= 0; i -= 1) {
    for (let j = newCount - 1; j >= 0; j -= 1) {
      table[i][j] =
        oldLines[i] === newLines[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  let i = 0;
  let j = 0;
  while (i < oldCount && j < newCount) {
    if (oldLines[i] === newLines[j]) {
      rows.push({
        type: 'context',
        oldIndex: oldOffset + i + 1,
        newIndex: newOffset + j + 1,
        text: oldLines[i],
      });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      rows.push({ type: 'remove', oldIndex: oldOffset + i + 1, newIndex: null, text: oldLines[i] });
      i += 1;
    } else {
      rows.push({ type: 'add', oldIndex: null, newIndex: newOffset + j + 1, text: newLines[j] });
      j += 1;
    }
  }
  while (i < oldCount) {
    rows.push({ type: 'remove', oldIndex: oldOffset + i + 1, newIndex: null, text: oldLines[i] });
    i += 1;
  }
  while (j < newCount) {
    rows.push({ type: 'add', oldIndex: null, newIndex: newOffset + j + 1, text: newLines[j] });
    j += 1;
  }
  return rows;
}

// Line diff with common prefix/suffix reduction, returning rows of
// { type, oldIndex, newIndex, text } whose indices are 1-based within the
// respective inputs (null when the row is absent from that side).
function diffLines(oldLines, newLines) {
  const rows = [];
  const oldLength = oldLines.length;
  const newLength = newLines.length;

  let prefix = 0;
  const maxPrefix = Math.min(oldLength, newLength);
  while (prefix < maxPrefix && oldLines[prefix] === newLines[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  const maxSuffix = Math.min(oldLength - prefix, newLength - prefix);
  while (
    suffix < maxSuffix &&
    oldLines[oldLength - 1 - suffix] === newLines[newLength - 1 - suffix]
  ) {
    suffix += 1;
  }

  for (let k = 0; k < prefix; k += 1) {
    rows.push({ type: 'context', oldIndex: k + 1, newIndex: k + 1, text: oldLines[k] });
  }

  const oldMiddle = oldLines.slice(prefix, oldLength - suffix);
  const newMiddle = newLines.slice(prefix, newLength - suffix);
  // Append instead of spreading: diffMiddle can return >125k rows, which would
  // overflow the argument stack.
  const middle = diffMiddle(oldMiddle, newMiddle, prefix, prefix);
  for (let k = 0; k < middle.length; k += 1) {
    rows.push(middle[k]);
  }

  for (let k = 0; k < suffix; k += 1) {
    rows.push({
      type: 'context',
      oldIndex: oldLength - suffix + k + 1,
      newIndex: newLength - suffix + k + 1,
      text: oldLines[oldLength - suffix + k],
    });
  }

  return rows;
}

// Index of the parsed numbered row where `sequence` first appears, or -1.
function findSequenceIndex(rows, sequence) {
  if (!rows || sequence.length === 0) return -1;
  // An all-blank sequence would match the first blank line anywhere in the
  // snippet and mislabel a pre-existing line as inserted.
  if (sequence.every((line) => line === '')) return -1;
  if (rows.length * sequence.length > MAX_ANCHOR_COMPARISONS) return -1;
  for (let i = 0; i + sequence.length <= rows.length; i += 1) {
    let matches = true;
    for (let j = 0; j < sequence.length; j += 1) {
      if (rows[i + j].text !== sequence[j]) {
        matches = false;
        break;
      }
    }
    if (matches) return i;
  }
  return -1;
}

export function isExplicitEditorError(output) {
  if (typeof output !== 'string') return false;
  return EXPLICIT_ERROR_RE.test(output);
}

export function parseNumberedEditorOutput(output) {
  const text = coerceOutputText(output);
  if (text === null) return null;

  const lines = text.split(/\r?\n/);
  const rows = [];
  const introLines = [];
  let foundRow = false;

  for (const line of lines) {
    const match = line.match(NUMBERED_LINE_RE);
    if (match) {
      foundRow = true;
      rows.push({ lineNumber: Number(match[1]), text: match[2] });
    } else if (!foundRow) {
      introLines.push(line);
    }
    // Unnumbered lines after the first numbered row (trailing prose) are ignored.
  }

  if (!foundRow) return null;

  return { intro: introLines.join('\n'), rows };
}

function buildEditorPresentationUnsafe(args, output) {
  const normalizedArgs = normalizeArgs(args);
  const action =
    typeof normalizedArgs.command === 'string' ? normalizedArgs.command : null;
  const path = hasText(normalizedArgs.path) ? normalizedArgs.path : null;
  const rawText = coerceOutputText(output);

  const fallback = () => ({ kind: 'fallback', action, path, content: rawText ?? '' });

  if (isExplicitEditorError(rawText)) {
    return { kind: 'error', action, path, message: rawText };
  }

  if (action === 'view') {
    const parsed = parseNumberedEditorOutput(rawText);
    if (parsed) {
      return {
        kind: 'preview',
        action: 'view',
        path,
        rows: parsed.rows.map((row) => ({
          type: 'context',
          oldLine: row.lineNumber,
          newLine: row.lineNumber,
          text: row.text,
        })),
      };
    }
    if (typeof rawText === 'string' && LISTING_HEADER_RE.test(rawText)) {
      return {
        kind: 'listing',
        action: 'view',
        path,
        lines: splitLines(rawText).filter(
          (line) => line.length > 0 && !LISTING_HEADER_LINE_RE.test(line)
        ),
      };
    }
    return fallback();
  }

  if (action === 'create') {
    if (hasText(normalizedArgs.file_text)) {
      return {
        kind: 'diff',
        action: 'create',
        path,
        rows: splitLines(normalizedArgs.file_text).map((text, index) => ({
          type: 'add',
          oldLine: null,
          newLine: index + 1,
          text,
        })),
      };
    }
    return fallback();
  }

  if (action === 'str_replace') {
    if (hasText(normalizedArgs.old_str) && hasText(normalizedArgs.new_str)) {
      const newLines = splitLines(normalizedArgs.new_str);
      const parsed = parseNumberedEditorOutput(rawText);
      const anchorIndex = parsed ? findSequenceIndex(parsed.rows, newLines) : -1;
      const anchor = anchorIndex >= 0 ? parsed.rows[anchorIndex].lineNumber : null;

      return {
        kind: 'diff',
        action: 'str_replace',
        path,
        rows: diffLines(splitLines(normalizedArgs.old_str), newLines).map((row) => ({
          type: row.type,
          oldLine: row.oldIndex == null || anchor == null ? null : anchor + row.oldIndex - 1,
          newLine: row.newIndex == null || anchor == null ? null : anchor + row.newIndex - 1,
          text: row.text,
        })),
      };
    }
    return fallback();
  }

  if (action === 'insert') {
    const insertLine = normalizedArgs.insert_line;
    if (
      hasText(normalizedArgs.new_str) &&
      typeof insertLine === 'number' &&
      Number.isInteger(insertLine) &&
      insertLine >= 0
    ) {
      const newLines = splitLines(normalizedArgs.new_str);
      const parsed = parseNumberedEditorOutput(rawText);
      const anchorIndex = parsed ? findSequenceIndex(parsed.rows, newLines) : -1;

      if (anchorIndex >= 0) {
        const insertedCount = newLines.length;
        return {
          kind: 'diff',
          action: 'insert',
          path,
          rows: parsed.rows.map((row, index) => {
            if (index < anchorIndex) {
              return {
                type: 'context',
                oldLine: row.lineNumber,
                newLine: row.lineNumber,
                text: row.text,
              };
            }
            if (index < anchorIndex + insertedCount) {
              return { type: 'add', oldLine: null, newLine: row.lineNumber, text: row.text };
            }
            return {
              type: 'context',
              oldLine: row.lineNumber - insertedCount,
              newLine: row.lineNumber,
              text: row.text,
            };
          }),
        };
      }

      return {
        kind: 'diff',
        action: 'insert',
        path,
        rows: newLines.map((text, index) => ({
          type: 'add',
          oldLine: null,
          newLine: insertLine + 1 + index,
          text,
        })),
      };
    }
    return fallback();
  }

  return fallback();
}

// Never throws: argument property access can fail for hostile objects (for
// example a Proxy with a throwing get trap), and a viewer must never crash.
export function buildEditorPresentation(args, output) {
  try {
    return buildEditorPresentationUnsafe(args, output);
  } catch {
    return { kind: 'fallback', action: null, path: null, content: '' };
  }
}
