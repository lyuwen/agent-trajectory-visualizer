// Pure helpers behind the collapsed tool-card header and the message-level
// tool pills. Both surfaces summarize the same calls, so they share one notion
// of a tool's "nature" (what kind of work it does) and one shell splitter.

import { summarizeEditorChange } from './strReplaceEditorPresentation';

// Tools that run shell commands. `docker_build` has no `command` argument, so
// it never produces a command chip, but it still reads as a shell-nature tool.
const SHELL_TOOL_NAMES = new Set([
  'execute_bash',
  'terminal',
  'exec_in_container',
  'test_command',
  'docker_build',
]);

const EDITOR_TOOL_NAMES = new Set(['str_replace_editor', 'file_editor']);

const READ_TOOL_NAMES = new Set(['read_file', 'repo_structure']);

const EDITOR_EDIT_ACTIONS = new Set(['str_replace', 'insert', 'create', 'undo_edit']);

export const MAX_HEADER_PATH_CHARS = 44;
export const MAX_HEADER_COMMANDS = 4;
export const MAX_HEADER_COMMAND_CHARS = 52;
export const MAX_HEADER_PROGRAM_CHARS = 24;

export const TOOL_NATURE = {
  SHELL: 'shell',
  EDIT: 'edit',
  READ: 'read',
  THINK: 'think',
  FINISH: 'finish',
  TASK: 'task',
  OTHER: 'other',
};

// Short names used when one tool contributes more than one nature to a turn
// (for example a `str_replace_editor` call that both views and edits).
export const NATURE_LABELS = {
  shell: 'shell',
  edit: 'edit',
  read: 'read',
  think: 'think',
  finish: 'finish',
  task: 'task',
};

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const hasText = (value) =>
  typeof value === 'string' && value.length > 0 && value !== 'None';

const truncate = (text, max) =>
  text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;

// Split a shell invocation into its chained commands on `&&`, `||`, `|`, `;`,
// and newlines. Splitting is quote-aware, so an operator inside a quoted string
// (for example `grep "a|b"`) stays part of its command. Newline splitting is
// skipped when a heredoc marker is present, so a heredoc body is not shown as a
// pile of separate commands. `$()`/backtick nesting is not modelled: the header
// is a compact preview and the untruncated command stays in the card body.
export function splitShellCommands(command) {
  if (typeof command !== 'string' || command.length === 0) return [];

  const splitNewlines = !/<<-?\s*['"]?[A-Za-z_]/.test(command);
  const commands = [];
  let current = '';
  let quote = null;
  let escaped = false;

  const flush = () => {
    const trimmed = current.replace(/\s*[\r\n]+\s*/g, ' ').trim();
    if (trimmed.length > 0) commands.push(trimmed);
    current = '';
  };

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      current += char;
      escaped = true;
      continue;
    }
    if (quote !== null) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ';' || ((char === '\n' || char === '\r') && splitNewlines)) {
      flush();
      continue;
    }
    if (char === '&' && command[index + 1] === '&') {
      flush();
      index += 1;
      continue;
    }
    if (char === '|') {
      flush();
      if (command[index + 1] === '|') index += 1;
      continue;
    }
    current += char;
  }

  flush();
  return commands;
}

// Keep the informative tail of a long path visible on the single header line.
// Parent directories are the first thing to go: the basename identifies the
// file, and dropping the parents also keeps the chip short enough that the
// browser never has to cut the basename off. The full path stays available
// through the chip's title attribute.
export function shortenPath(path, max = MAX_HEADER_PATH_CHARS) {
  if (typeof path !== 'string' || path.length <= max) return path;

  const segments = path.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0) return truncate(path, max);

  const basename = segments[segments.length - 1];
  const prefixed = `…/${basename}`;
  if (prefixed.length <= max) return prefixed;

  // A very long basename still keeps its own right end, which is where the
  // extension and the most identifying characters are.
  return `…/${basename.slice(-Math.max(0, max - 2))}`;
}

export function truncateHeaderCommand(command, max = MAX_HEADER_COMMAND_CHARS) {
  if (typeof command !== 'string') return '';
  return truncate(command, max);
}

// Programs that carry no signal about what an agent is investigating.
// `PLUMBING_PROGRAMS` (navigation, assignment, shell keywords, wrappers) is
// always dropped; `PIPE_UTILITIES` (readers and stream shapers) is dropped when
// a chain also contains an informative program, so
// `cd /workspace && grep -rn x . | head -40` reads `grep` rather than
// `cd grep head`.
const PLUMBING_PROGRAMS = new Set([
  'cd', 'pwd', 'echo', 'printf', 'true', 'false', ':', 'export', 'set', 'unset',
  'source', '.', 'env', 'sudo', 'doas', 'time', 'nohup', 'command', 'builtin',
  'exec', 'yes', 'sleep', 'clear', 'date', 'seq', 'test', '[', '[[', 'then',
  'fi', 'do', 'done', 'else', 'elif', 'for', 'while', 'until', 'if', 'case',
  'select', 'function', 'return', 'declare', 'local', 'read', 'shift', 'trap',
  'wait', 'umask', 'alias', 'unalias',
]);

const PIPE_UTILITIES = new Set([
  'head', 'tail', 'sort', 'uniq', 'wc', 'tee', 'tr', 'cut', 'cat', 'more',
  'less', 'xargs', 'nl', 'column', 'paste', 'join', 'comm', 'fold',
]);

// Wrappers that run another program; the interesting program is the one after.
const COMMAND_PREFIXES = new Set([
  'sudo', 'doas', 'env', 'time', 'nohup', 'command', 'builtin', 'exec', 'xargs',
]);

const ENV_ASSIGNMENT_RE = /^[A-Za-z_][A-Za-z0-9_]*=\S*/;

// First whitespace-delimited token, honoring quotes and backslash escapes.
const firstToken = (text) => {
  let token = '';
  let quote = null;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      token += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote !== null) {
      if (char === quote) quote = null;
      else token += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) break;
    token += char;
  }

  return token;
};

// The program a chained command runs, with env assignments and wrappers
// stripped and the directory part of the program path removed. Returns null
// when the command does not start with something program-like.
export function commandProgram(command) {
  if (typeof command !== 'string') return null;
  let rest = command.trim();

  for (let guard = 0; guard < 8 && rest.length > 0; guard += 1) {
    const assignment = rest.match(ENV_ASSIGNMENT_RE);
    if (assignment) {
      rest = rest.slice(assignment[0].length).trimStart();
      continue;
    }

    const token = firstToken(rest);
    if (token.length === 0) return null;
    // A subshell group, a redirect, or a lone flag is not a program name.
    if (token.startsWith('(') || token.startsWith('-') || /[<>]/.test(token)) return null;

    const name = token.split('/').pop();
    if (COMMAND_PREFIXES.has(name)) {
      rest = rest.slice(token.length).trimStart();
      continue;
    }
    return name.length > 0 ? name : null;
  }

  return null;
}

// Display list for a shell call: one entry per distinct program, in order.
// Informative programs win; a chain of only pipe utilities still shows them so
// `head`/`tail` reads are not silent; a chain of pure plumbing shows nothing,
// because `cd` says nothing about the work and the summary already covers it.
function shellPrograms(commands) {
  const informative = [];
  const utilities = [];
  const seen = new Set();

  for (const command of commands) {
    const name = commandProgram(command);
    if (name === null || seen.has(name)) continue;
    seen.add(name);

    const entry = { name, command };
    if (PLUMBING_PROGRAMS.has(name)) continue;
    if (PIPE_UTILITIES.has(name)) utilities.push(entry);
    else informative.push(entry);
  }

  return informative.length > 0 ? informative : utilities;
}

// What a call does, independent of which tool implements it. Editors carry the
// read/edit distinction in their `command` argument, which is what lets the
// message pills separate "viewed files" from "changed files".
export function toolNature(name, args) {
  if (typeof name !== 'string') return TOOL_NATURE.OTHER;
  if (name === 'think') return TOOL_NATURE.THINK;
  if (name === 'finish') return TOOL_NATURE.FINISH;
  if (name === 'task') return TOOL_NATURE.TASK;
  if (EDITOR_TOOL_NAMES.has(name)) {
    const action = isPlainObject(args) && typeof args.command === 'string' ? args.command : null;
    if (action === 'view') return TOOL_NATURE.READ;
    if (EDITOR_EDIT_ACTIONS.has(action)) return TOOL_NATURE.EDIT;
    return TOOL_NATURE.OTHER;
  }
  if (SHELL_TOOL_NAMES.has(name)) return TOOL_NATURE.SHELL;
  if (READ_TOOL_NAMES.has(name)) return TOOL_NATURE.READ;
  return TOOL_NATURE.OTHER;
}

// Prefer the range the editor actually returned over the requested one: it
// resolves `[start, -1]` ("to end of file") into real line numbers and covers a
// `view` with no `view_range` at all. Directory listings have no line numbers,
// so they stay range-less.
const observedViewRange = (presentation) => {
  if (
    !isPlainObject(presentation) ||
    presentation.kind !== 'preview' ||
    !Array.isArray(presentation.rows)
  ) {
    return null;
  }

  let min = null;
  let max = null;
  for (const row of presentation.rows) {
    const line = isPlainObject(row) ? row.newLine : null;
    if (typeof line !== 'number' || !Number.isFinite(line)) continue;
    if (min === null || line < min) min = line;
    if (max === null || line > max) max = line;
  }

  return min === null ? null : { start: min, end: max };
};

const editorViewRange = (args, presentation) => {
  const declared = Array.isArray(args.view_range) ? args.view_range : null;
  let start = null;
  let end = null;

  if (
    declared !== null &&
    Number.isInteger(declared[0]) &&
    Number.isInteger(declared[1]) &&
    declared[0] >= 1
  ) {
    start = declared[0];
    // `[n, -1]` means "from n to the end"; only the output can close that range.
    if (declared[1] !== -1 && declared[1] >= declared[0]) end = declared[1];
  }

  const observed = observedViewRange(presentation);
  if (start === null && observed !== null) {
    start = observed.start;
    end = observed.end;
  } else if (start !== null && end === null && observed !== null) {
    end = observed.end;
  }

  if (start === null) return null;
  return { start, end };
};

export const formatViewRange = (range) => {
  if (!isPlainObject(range) || typeof range.start !== 'number') return null;
  return range.end === null || range.end === undefined
    ? `L${range.start}-end`
    : `L${range.start}-${range.end}`;
};

// Describe what a collapsed card should show beside its name. Editor edits get
// the file plus added/removed line counts; reads get the file plus the viewed
// range; shell tools get their chained commands. Everything else returns null
// and keeps the existing name-plus-summary header.
export function buildToolHeaderDetail(name, args, presentation = null) {
  const parsed = isPlainObject(args) ? args : {};

  try {
    if (name === 'str_replace_editor') {
      const action = typeof parsed.command === 'string' ? parsed.command : null;
      const path = hasText(parsed.path) ? parsed.path : null;
      const change = summarizeEditorChange(parsed);

      if (change) {
        return {
          kind: 'editor-edit',
          action,
          path,
          additions: change.additions,
          removals: change.removals,
        };
      }

      const range = editorViewRange(parsed, presentation);
      if (path === null && range === null) return null;
      return { kind: 'editor-read', action, path, range };
    }

    if (SHELL_TOOL_NAMES.has(name)) {
      const commands = splitShellCommands(parsed.command);
      if (commands.length === 0) return null;
      const programs = shellPrograms(commands);
      if (programs.length === 0) return null;
      return { kind: 'shell', programs };
    }
  } catch {
    // Hostile argument objects (for example a Proxy with a throwing get trap)
    // must never take the viewer down; a missing chip is an acceptable loss.
    return null;
  }

  return null;
}
