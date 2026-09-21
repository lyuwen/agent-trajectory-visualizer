import { describe, it, expect } from 'vitest';
import {
  isExplicitEditorError,
  parseNumberedEditorOutput,
  buildEditorPresentation,
} from '../strReplaceEditorPresentation';

const NUMBERED_HEADER = "Here's the result of running `cat -n` on /tmp/a.py:";
const EXPLICIT_ERROR = '[An error occurred during execution.]\n\nInvalid path';

const numberedLine = (lineNumber, text) => `    ${lineNumber}\t${text}`;

const numberedOutput = (...entries) => [NUMBERED_HEADER, ...entries].join('\n');

describe('parseNumberedEditorOutput', () => {
  it('preserves line numbers, source tabs, and a blank numbered line', () => {
    expect(
      parseNumberedEditorOutput(
        "Here's the result of running `cat -n` on /tmp/a.py:\n    8\tvalue = 'a\\tb'\n    9\t"
      )
    ).toEqual({
      intro: "Here's the result of running `cat -n` on /tmp/a.py:",
      rows: [
        { lineNumber: 8, text: "value = 'a\\tb'" },
        { lineNumber: 9, text: '' },
      ],
    });
  });

  it('returns null for a directory listing with no numbered rows', () => {
    const listing =
      "Here's the files and directories up to 2 levels deep in /x, excluding hidden items:\n/x/a.py\n/x/b.py";
    expect(parseNumberedEditorOutput(listing)).toBeNull();
  });

  it('ignores unnumbered prose that follows the numbered rows', () => {
    expect(
      parseNumberedEditorOutput('header\n    1\tone\nReview the changes and make sure they are as expected.')
    ).toEqual({
      intro: 'header',
      rows: [{ lineNumber: 1, text: 'one' }],
    });
  });

  it('does not throw and returns null for non-string input', () => {
    expect(parseNumberedEditorOutput(null)).toBeNull();
    expect(parseNumberedEditorOutput(undefined)).toBeNull();
    expect(parseNumberedEditorOutput(42)).toBeNull();
    expect(parseNumberedEditorOutput({ a: 1 })).toBeNull();
  });

  it('returns null when the coerced text contains no numbered row', () => {
    expect(parseNumberedEditorOutput('plain text')).toBeNull();
    expect(parseNumberedEditorOutput('')).toBeNull();
  });
});

describe('isExplicitEditorError', () => {
  it('detects the explicit failure prefix, allowing leading whitespace', () => {
    expect(isExplicitEditorError('[An error occurred during execution.]\n\nInvalid path')).toBe(true);
    expect(isExplicitEditorError('   \n[An error occurred during execution.] oops')).toBe(true);
  });

  it('does not flag ordinary source text that contains the word error', () => {
    expect(isExplicitEditorError('raise ValueError("error")')).toBe(false);
    expect(isExplicitEditorError('// an error occurred here')).toBe(false);
  });

  it('returns false for non-strings', () => {
    expect(isExplicitEditorError(null)).toBe(false);
    expect(isExplicitEditorError(undefined)).toBe(false);
    expect(isExplicitEditorError({ message: '[An error occurred during execution.]' })).toBe(false);
  });
});

describe('buildEditorPresentation: view', () => {
  it('renders numbered output as neutral context rows keeping real line numbers', () => {
    const output = ['header', numberedLine(8, 'one'), numberedLine(9, 'two')].join('\n');

    expect(buildEditorPresentation({ command: 'view', path: '/tmp/a.py', view_range: [8, 9] }, output)).toEqual({
      kind: 'preview',
      action: 'view',
      path: '/tmp/a.py',
      rows: [
        { type: 'context', oldLine: 8, newLine: 8, text: 'one' },
        { type: 'context', oldLine: 9, newLine: 9, text: 'two' },
      ],
    });
  });

  it('preserves tabs and blank numbered lines in a preview', () => {
    const output = numberedOutput(numberedLine(3, "value = 'a\\tb'"), numberedLine(4, ''));

    expect(buildEditorPresentation({ command: 'view', path: '/p' }, output)).toEqual({
      kind: 'preview',
      action: 'view',
      path: '/p',
      rows: [
        { type: 'context', oldLine: 3, newLine: 3, text: "value = 'a\\tb'" },
        { type: 'context', oldLine: 4, newLine: 4, text: '' },
      ],
    });
  });

  it('renders a directory listing with each path preserved verbatim', () => {
    const output =
      "Here's the files and directories up to 2 levels deep in /x, excluding hidden items:\n/x/a.py\n/x/b.py";

    expect(buildEditorPresentation({ command: 'view', path: '/x' }, output)).toEqual({
      kind: 'listing',
      action: 'view',
      path: '/x',
      lines: ['/x/a.py', '/x/b.py'],
    });
  });

  it('falls back when the view output is neither numbered nor a listing', () => {
    expect(buildEditorPresentation({ command: 'view', path: '/x' }, 'nothing useful')).toEqual({
      kind: 'fallback',
      action: 'view',
      path: '/x',
      content: 'nothing useful',
    });
  });

  it('falls back with empty content when the view output is missing', () => {
    expect(buildEditorPresentation({ command: 'view', path: '/x' }, null)).toEqual({
      kind: 'fallback',
      action: 'view',
      path: '/x',
      content: '',
    });
  });
});

describe('buildEditorPresentation: create', () => {
  it('renders every file_text line as added, numbered from 1', () => {
    expect(
      buildEditorPresentation({ command: 'create', path: '/tmp/a.py', file_text: 'one\ntwo' }, null)
    ).toEqual({
      kind: 'diff',
      action: 'create',
      path: '/tmp/a.py',
      rows: [
        { type: 'add', oldLine: null, newLine: 1, text: 'one' },
        { type: 'add', oldLine: null, newLine: 2, text: 'two' },
      ],
    });
  });

  it('drops only the synthetic trailing line from file_text', () => {
    expect(
      buildEditorPresentation({ command: 'create', path: '/p', file_text: 'one\n\nthree\n' }, null).rows
    ).toEqual([
      { type: 'add', oldLine: null, newLine: 1, text: 'one' },
      { type: 'add', oldLine: null, newLine: 2, text: '' },
      { type: 'add', oldLine: null, newLine: 3, text: 'three' },
    ]);
  });

  it('falls back when file_text is missing', () => {
    expect(buildEditorPresentation({ command: 'create', path: '/x' }, 'output')).toEqual({
      kind: 'fallback',
      action: 'create',
      path: '/x',
      content: 'output',
    });
  });
});

describe('buildEditorPresentation: str_replace', () => {
  it('interleaves context/remove/add rows instead of two wholesale blocks', () => {
    const result = buildEditorPresentation(
      { command: 'str_replace', path: '/tmp/a.py', old_str: 'a\nb\nc', new_str: 'a\nx\nc' },
      null
    );

    expect(result).toEqual({
      kind: 'diff',
      action: 'str_replace',
      path: '/tmp/a.py',
      rows: [
        { type: 'context', oldLine: null, newLine: null, text: 'a' },
        { type: 'remove', oldLine: null, newLine: null, text: 'b' },
        { type: 'add', oldLine: null, newLine: null, text: 'x' },
        { type: 'context', oldLine: null, newLine: null, text: 'c' },
      ],
    });
    expect(result.rows.map((row) => row.type)).toEqual(['context', 'remove', 'add', 'context']);
  });

  it('anchors line numbers when new_str occurs in the numbered post-edit output', () => {
    const output = numberedOutput(
      numberedLine(5, 'a'),
      numberedLine(6, 'x'),
      numberedLine(7, 'c'),
      'Review the changes and make sure they are as expected.'
    );

    expect(
      buildEditorPresentation(
        { command: 'str_replace', path: '/tmp/a.py', old_str: 'a\nb\nc', new_str: 'a\nx\nc' },
        output
      )
    ).toEqual({
      kind: 'diff',
      action: 'str_replace',
      path: '/tmp/a.py',
      rows: [
        { type: 'context', oldLine: 5, newLine: 5, text: 'a' },
        { type: 'remove', oldLine: 6, newLine: null, text: 'b' },
        { type: 'add', oldLine: null, newLine: 6, text: 'x' },
        { type: 'context', oldLine: 7, newLine: 7, text: 'c' },
      ],
    });
  });

  it('leaves line numbers null when the new_str sequence is not in the output', () => {
    const output = numberedOutput(numberedLine(1, 'unrelated'));

    expect(
      buildEditorPresentation(
        { command: 'str_replace', path: '/p', old_str: 'a\nb\nc', new_str: 'a\nx\nc' },
        output
      ).rows
    ).toEqual([
      { type: 'context', oldLine: null, newLine: null, text: 'a' },
      { type: 'remove', oldLine: null, newLine: null, text: 'b' },
      { type: 'add', oldLine: null, newLine: null, text: 'x' },
      { type: 'context', oldLine: null, newLine: null, text: 'c' },
    ]);
  });

  it('falls back when old_str or new_str is missing or a None filler', () => {
    expect(buildEditorPresentation({ command: 'str_replace', path: '/x', old_str: 'a' }, 'o')).toEqual({
      kind: 'fallback',
      action: 'str_replace',
      path: '/x',
      content: 'o',
    });
    expect(
      buildEditorPresentation({ command: 'str_replace', path: '/x', old_str: 'a', new_str: 'None' }, 'o')
    ).toEqual({
      kind: 'fallback',
      action: 'str_replace',
      path: '/x',
      content: 'o',
    });
  });

  it('uses the bounded fallback above the LCS cell guard, dropping shared context', () => {
    // 1000x1000 middle with 200 shared lines: below the guard the LCS would keep
    // those as context rows; above it every middle line becomes a remove/add.
    const block = (prefix, count) => Array.from({ length: count }, (_, i) => `${prefix}_${i}`);
    const oldLines = [...block('old', 400), ...block('keep', 200), ...block('tail', 400)];
    const newLines = [...block('new', 400), ...block('keep', 200), ...block('end', 400)];

    const result = buildEditorPresentation(
      {
        command: 'str_replace',
        path: '/p',
        old_str: oldLines.join('\n'),
        new_str: newLines.join('\n'),
      },
      null
    );

    expect(result.kind).toBe('diff');
    expect(result.rows).toHaveLength(2000);
    expect(result.rows.filter((row) => row.type === 'context')).toHaveLength(0);
    expect(result.rows.filter((row) => row.type === 'remove')).toHaveLength(1000);
    expect(result.rows.filter((row) => row.type === 'add')).toHaveLength(1000);
    expect(result.rows[0].type).toBe('remove');
    expect(result.rows[result.rows.length - 1].type).toBe('add');
    expect(result.rows.every((row) => row.oldLine === null && row.newLine === null)).toBe(true);
  });

  it('keeps shared lines as context inside a multi-line LCS middle', () => {
    const result = buildEditorPresentation(
      {
        command: 'str_replace',
        path: '/p',
        old_str: 'x1\nkeep1\nx2\nkeep2\nx3',
        new_str: 'y1\nkeep1\ny2\nkeep2\ny3',
      },
      null
    );

    expect(result.rows.filter((row) => row.type === 'context').map((row) => row.text)).toEqual([
      'keep1',
      'keep2',
    ]);
  });

  it('does not overflow the stack when a diff emits more than V8-spread-limit rows', () => {
    // V8's spread-argument limit is ~125247 on the reference runtime, so this
    // must exceed that for the assertion to prove the append-not-spread fix.
    const oldLines = Array.from({ length: 150000 }, (_, i) => `o_${i}`);

    const result = buildEditorPresentation(
      { command: 'str_replace', path: '/p', old_str: oldLines.join('\n'), new_str: 'a\nb\nc' },
      null
    );

    expect(result.kind).toBe('diff');
    expect(result.rows).toHaveLength(150003);
  });
});

describe('robustness and line-ending handling', () => {
  it('normalizes CRLF in argument text before diffing and anchoring', () => {
    const output = ['header', '    5\ta', '    6\tx', '    7\tc'].join('\r\n');

    const result = buildEditorPresentation(
      { command: 'str_replace', path: '/p', old_str: 'a\r\nb\r\nc', new_str: 'a\r\nx\r\nc' },
      output
    );

    expect(result.rows).toEqual([
      { type: 'context', oldLine: 5, newLine: 5, text: 'a' },
      { type: 'remove', oldLine: 6, newLine: null, text: 'b' },
      { type: 'add', oldLine: null, newLine: 6, text: 'x' },
      { type: 'context', oldLine: 7, newLine: 7, text: 'c' },
    ]);

    expect(
      buildEditorPresentation({ command: 'create', path: '/p', file_text: 'one\r\ntwo\r\n' }, null).rows.map(
        (row) => row.text
      )
    ).toEqual(['one', 'two']);
  });

  it('preserves real tab characters inside numbered source text', () => {
    const parsed = parseNumberedEditorOutput('header\n    1\ta\tb\n');

    expect(parsed.rows).toEqual([{ lineNumber: 1, text: 'a\tb' }]);
    expect(parsed.rows[0].text.charCodeAt(1)).toBe(9);
  });

  it('never throws when output cannot be coerced to text', () => {
    const hostile = {
      toJSON() {
        throw new Error('boom');
      },
      toString: null,
      valueOf: null,
    };

    expect(() => buildEditorPresentation({ command: 'undo_edit', path: '/p' }, hostile)).not.toThrow();
    expect(buildEditorPresentation({ command: 'undo_edit', path: '/p' }, hostile).kind).toBe('fallback');
  });

  it('never throws when reading an argument property throws', () => {
    const proxy = new Proxy(
      {},
      {
        get() {
          throw new Error('trap');
        },
      }
    );

    expect(() => buildEditorPresentation(proxy, 'x')).not.toThrow();
    expect(buildEditorPresentation(proxy, 'x').kind).toBe('fallback');
  });

  it('falls back for non-integer or negative insert_line values', () => {
    for (const insertLine of [2.5, -1]) {
      const result = buildEditorPresentation(
        { command: 'insert', path: '/p', new_str: 'x', insert_line: insertLine },
        null
      );
      expect(result.kind).toBe('fallback');
    }

    expect(
      buildEditorPresentation({ command: 'insert', path: '/p', new_str: 'x', insert_line: 0 }, null).rows
    ).toEqual([{ type: 'add', oldLine: null, newLine: 1, text: 'x' }]);
  });

  it('does not anchor an all-blank new_str sequence', () => {
    const output = ['header', '    3\t', '    4\tz'].join('\n');

    const result = buildEditorPresentation(
      { command: 'insert', path: '/p', insert_line: 2, new_str: '\n' },
      output
    );

    expect(result.rows).toEqual([{ type: 'add', oldLine: null, newLine: 3, text: '' }]);
  });

  it('still anchors a large but realistic snippet below the comparison budget', () => {
    const anchorLines = Array.from({ length: 300 }, (_, i) => `line_${i}`);
    const filler = Array.from({ length: 4700 }, (_, i) => `filler_${i}`);
    const numbered = [...anchorLines, ...filler].map((line, i) => `    ${i + 1}\t${line}`);
    const output = ['header', ...numbered].join('\n');

    const result = buildEditorPresentation(
      { command: 'str_replace', path: '/p', old_str: 'x', new_str: anchorLines.join('\n') },
      output
    );

    expect(result.rows).toHaveLength(301);
    expect(result.rows[0]).toEqual({ type: 'remove', oldLine: 1, newLine: null, text: 'x' });
    expect(result.rows[1]).toEqual({ type: 'add', oldLine: null, newLine: 1, text: 'line_0' });
    expect(result.rows[300].newLine).toBe(300);
  });

  it('skips the anchor search when the comparison budget is exceeded', () => {
    const numbered = Array.from({ length: 10000 }, (_, i) => `    ${i + 1}\tline_${i}`);
    const output = ['header', ...numbered].join('\n');
    const newStr = Array.from({ length: 4000 }, (_, i) => `line_${i}`).join('\n');

    const result = buildEditorPresentation(
      { command: 'str_replace', path: '/p', old_str: 'x', new_str: newStr },
      output
    );

    expect(result.rows.every((row) => row.oldLine === null && row.newLine === null)).toBe(true);
  });

  it('preserves a listing line that contains the listing header phrase', () => {
    const output = [
      "Here's the files and directories up to 2 levels deep in /x, excluding hidden items:",
      '/x/a.py',
      "/x/Here's the files and directories.py",
    ].join('\n');

    expect(buildEditorPresentation({ command: 'view', path: '/x' }, output).lines).toEqual([
      '/x/a.py',
      "/x/Here's the files and directories.py",
    ]);
  });
});

describe('buildEditorPresentation: insert', () => {
  it('combines numbered surrounding context with inserted rows', () => {
    const output = numberedOutput(
      numberedLine(1, 'one'),
      numberedLine(2, 'two'),
      numberedLine(3, 'X'),
      numberedLine(4, 'Y'),
      numberedLine(5, 'three')
    );

    expect(
      buildEditorPresentation(
        { command: 'insert', path: '/tmp/a.py', insert_line: 2, new_str: 'X\nY' },
        output
      )
    ).toEqual({
      kind: 'diff',
      action: 'insert',
      path: '/tmp/a.py',
      rows: [
        { type: 'context', oldLine: 1, newLine: 1, text: 'one' },
        { type: 'context', oldLine: 2, newLine: 2, text: 'two' },
        { type: 'add', oldLine: null, newLine: 3, text: 'X' },
        { type: 'add', oldLine: null, newLine: 4, text: 'Y' },
        { type: 'context', oldLine: 3, newLine: 5, text: 'three' },
      ],
    });
  });

  it('starts addition-only rows after insert_line when no output context matches', () => {
    expect(
      buildEditorPresentation(
        { command: 'insert', path: '/tmp/a.py', insert_line: 9, new_str: 'one\ntwo' },
        null
      )
    ).toEqual({
      kind: 'diff',
      action: 'insert',
      path: '/tmp/a.py',
      rows: [
        { type: 'add', oldLine: null, newLine: 10, text: 'one' },
        { type: 'add', oldLine: null, newLine: 11, text: 'two' },
      ],
    });
  });

  it('falls back when new_str or a numeric insert_line is missing', () => {
    expect(buildEditorPresentation({ command: 'insert', path: '/x', new_str: 'a' }, 'o')).toEqual({
      kind: 'fallback',
      action: 'insert',
      path: '/x',
      content: 'o',
    });
    expect(
      buildEditorPresentation({ command: 'insert', path: '/x', new_str: 'a', insert_line: '1' }, 'o')
    ).toEqual({
      kind: 'fallback',
      action: 'insert',
      path: '/x',
      content: 'o',
    });
  });
});

describe('buildEditorPresentation: explicit failures', () => {
  const errorCases = [
    { command: 'view', path: '/x' },
    { command: 'create', path: '/x', file_text: 'a' },
    { command: 'str_replace', path: '/x', old_str: 'a', new_str: 'b' },
    { command: 'insert', path: '/x', new_str: 'a', insert_line: 1 },
  ];

  it.each(errorCases)('reports the error branch for $command and preserves the message', (args) => {
    expect(buildEditorPresentation(args, EXPLICIT_ERROR)).toEqual({
      kind: 'error',
      action: args.command,
      path: '/x',
      message: EXPLICIT_ERROR,
    });
  });

  it('takes priority over invalid arguments', () => {
    expect(buildEditorPresentation(null, EXPLICIT_ERROR)).toEqual({
      kind: 'error',
      action: null,
      path: null,
      message: EXPLICIT_ERROR,
    });
  });
});

describe('buildEditorPresentation: fallback', () => {
  it('falls back for an unsupported undo_edit action', () => {
    expect(buildEditorPresentation({ command: 'undo_edit', path: '/x' }, 'output')).toEqual({
      kind: 'fallback',
      action: 'undo_edit',
      path: '/x',
      content: 'output',
    });
  });

  it('treats None filler paths and missing commands as absent', () => {
    expect(buildEditorPresentation({ command: 'create', path: 'None', file_text: 'None' }, null)).toEqual({
      kind: 'fallback',
      action: 'create',
      path: null,
      content: '',
    });
    expect(buildEditorPresentation({ path: '/x' }, null)).toEqual({
      kind: 'fallback',
      action: null,
      path: '/x',
      content: '',
    });
  });

  it('never throws for malformed arguments', () => {
    const malformed = [null, undefined, 'not an object', ['create'], 42, true];

    for (const args of malformed) {
      const result = buildEditorPresentation(args, null);
      expect(result).toEqual({ kind: 'fallback', action: null, path: null, content: '' });
    }
  });

  it('coerces non-string output into fallback content', () => {
    expect(buildEditorPresentation({ command: 'undo_edit', path: '/x' }, { message: 'x' })).toEqual({
      kind: 'fallback',
      action: 'undo_edit',
      path: '/x',
      content: '{"message":"x"}',
    });
    expect(buildEditorPresentation({ command: 'undo_edit', path: '/x' }, 42)).toEqual({
      kind: 'fallback',
      action: 'undo_edit',
      path: '/x',
      content: '42',
    });
  });
});
