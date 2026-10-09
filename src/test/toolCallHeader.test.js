import { describe, it, expect } from 'vitest';
import {
  buildToolHeaderDetail,
  commandProgram,
  formatViewRange,
  shortenPath,
  splitShellCommands,
  toolNature,
  truncateHeaderCommand,
  TOOL_NATURE,
} from '../toolCallHeader';

describe('splitShellCommands', () => {
  it('returns a lone command unchanged', () => {
    expect(splitShellCommands('ls -la')).toEqual(['ls -la']);
  });

  it('splits &&, ||, | and ; chains into their commands', () => {
    expect(splitShellCommands('cd /x && git status && git log -1')).toEqual([
      'cd /x',
      'git status',
      'git log -1',
    ]);
    expect(splitShellCommands('a || b | c')).toEqual(['a', 'b', 'c']);
    expect(splitShellCommands('make; make test')).toEqual(['make', 'make test']);
  });

  it('keeps operators inside quotes with their command', () => {
    expect(splitShellCommands('grep -n "a|b" f | head -5')).toEqual([
      'grep -n "a|b" f',
      'head -5',
    ]);
    expect(splitShellCommands("echo 'a; b'; ls")).toEqual(["echo 'a; b'", 'ls']);
  });

  it('does not split a redirect on &', () => {
    expect(splitShellCommands('cmd 2>&1 | tee log')).toEqual(['cmd 2>&1', 'tee log']);
  });

  it('splits newline-separated commands but not a heredoc body', () => {
    expect(splitShellCommands('line1\nline2')).toEqual(['line1', 'line2']);

    const heredoc = "cat > f <<'EOF'\nalpha\nbeta\nEOF";
    const commands = splitShellCommands(heredoc);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toContain('alpha');
    expect(commands[0]).toContain('beta');
  });

  it('keeps a backslash line continuation in one command', () => {
    expect(splitShellCommands('echo a \\\n  b')).toEqual(['echo a \\ b']);
  });

  it('returns no commands for empty or non-string input', () => {
    expect(splitShellCommands('')).toEqual([]);
    expect(splitShellCommands('   ')).toEqual([]);
    expect(splitShellCommands(undefined)).toEqual([]);
    expect(splitShellCommands(null)).toEqual([]);
    expect(splitShellCommands(42)).toEqual([]);
  });
});

describe('toolNature', () => {
  it('classifies shell tools', () => {
    expect(toolNature('execute_bash', { command: 'ls' })).toBe(TOOL_NATURE.SHELL);
    expect(toolNature('terminal', {})).toBe(TOOL_NATURE.SHELL);
    expect(toolNature('exec_in_container', {})).toBe(TOOL_NATURE.SHELL);
  });

  it('splits editor tools into read and edit by their command', () => {
    expect(toolNature('str_replace_editor', { command: 'view' })).toBe(TOOL_NATURE.READ);
    expect(toolNature('str_replace_editor', { command: 'str_replace' })).toBe(TOOL_NATURE.EDIT);
    expect(toolNature('str_replace_editor', { command: 'create' })).toBe(TOOL_NATURE.EDIT);
    expect(toolNature('str_replace_editor', { command: 'insert' })).toBe(TOOL_NATURE.EDIT);
    expect(toolNature('str_replace_editor', { command: 'undo_edit' })).toBe(TOOL_NATURE.EDIT);
    expect(toolNature('file_editor', { command: 'view' })).toBe(TOOL_NATURE.READ);
  });

  it('falls back to other for unknown tools, actions, and arguments', () => {
    expect(toolNature('think', {})).toBe(TOOL_NATURE.THINK);
    expect(toolNature('finish', {})).toBe(TOOL_NATURE.FINISH);
    expect(toolNature('task', {})).toBe(TOOL_NATURE.TASK);
    expect(toolNature('str_replace_editor', {})).toBe(TOOL_NATURE.OTHER);
    expect(toolNature('mystery', {})).toBe(TOOL_NATURE.OTHER);
    expect(toolNature(undefined, {})).toBe(TOOL_NATURE.OTHER);
  });
});

describe('buildToolHeaderDetail', () => {
  it('describes a str_replace edit with its file and change counts', () => {
    expect(
      buildToolHeaderDetail('str_replace_editor', {
        command: 'str_replace',
        path: 'src/app.js',
        old_str: 'a\nb',
        new_str: 'a\nc',
      })
    ).toEqual({
      kind: 'editor-edit',
      action: 'str_replace',
      path: 'src/app.js',
      additions: 1,
      removals: 1,
    });
  });

  it('counts create and insert as additions only', () => {
    expect(
      buildToolHeaderDetail('str_replace_editor', {
        command: 'create',
        path: 'src/new.js',
        file_text: 'a\nb\nc',
      })
    ).toMatchObject({ kind: 'editor-edit', additions: 3, removals: 0 });

    expect(
      buildToolHeaderDetail('str_replace_editor', {
        command: 'insert',
        path: 'src/app.js',
        insert_line: 4,
        new_str: 'one\ntwo',
      })
    ).toMatchObject({ kind: 'editor-edit', additions: 2, removals: 0 });
  });

  it('describes a view with the requested range', () => {
    expect(
      buildToolHeaderDetail('str_replace_editor', {
        command: 'view',
        path: 'src/app.js',
        view_range: [10, 20],
      })
    ).toEqual({
      kind: 'editor-read',
      action: 'view',
      path: 'src/app.js',
      range: { start: 10, end: 20 },
    });
  });

  it('resolves an open-ended range from the observed preview rows', () => {
    const presentation = {
      kind: 'preview',
      rows: [
        { newLine: 5, text: 'a' },
        { newLine: 6, text: 'b' },
        { newLine: 7, text: 'c' },
      ],
    };

    expect(
      buildToolHeaderDetail(
        'str_replace_editor',
        { command: 'view', path: 'src/app.js', view_range: [5, -1] },
        presentation
      )
    ).toMatchObject({ range: { start: 5, end: 7 } });

    expect(
      buildToolHeaderDetail(
        'str_replace_editor',
        { command: 'view', path: 'src/app.js' },
        presentation
      )
    ).toMatchObject({ range: { start: 5, end: 7 } });
  });

  it('leaves a directory listing without a range', () => {
    const presentation = { kind: 'listing', action: 'view', path: '/x', lines: ['/x/a.py'] };

    expect(
      buildToolHeaderDetail('str_replace_editor', { command: 'view', path: '/x' }, presentation)
    ).toEqual({ kind: 'editor-read', action: 'view', path: '/x', range: null });
  });

  it('describes a shell call with its informative programs', () => {
    // `cd` and `head` are plumbing; `grep` is what the call is investigating.
    expect(
      buildToolHeaderDetail('execute_bash', {
        command: 'cd /workspace && grep -rn "app_label" . | head -40',
      })
    ).toEqual({
      kind: 'shell',
      programs: [{ name: 'grep', command: 'grep -rn "app_label" .' }],
    });

    expect(buildToolHeaderDetail('terminal', { command: 'npm test' })).toEqual({
      kind: 'shell',
      programs: [{ name: 'npm', command: 'npm test' }],
    });
  });

  it('falls back to pipe utilities, and drops pure plumbing entirely', () => {
    expect(buildToolHeaderDetail('execute_bash', { command: 'cd /x && head -5 f' })).toEqual({
      kind: 'shell',
      programs: [{ name: 'head', command: 'head -5 f' }],
    });

    // Nothing but navigation and a keyword loop: the header stays clean.
    expect(buildToolHeaderDetail('execute_bash', { command: 'cd /x && echo done' })).toBeNull();
    expect(buildToolHeaderDetail('execute_bash', { command: 'for f in *; do ls; done' })).toBeNull();
  });

  it('collapses repeated programs in one chain', () => {
    expect(
      buildToolHeaderDetail('execute_bash', { command: 'git add -A && git commit -m x' })
    ).toEqual({
      kind: 'shell',
      programs: [{ name: 'git', command: 'git add -A' }],
    });
  });

  it('returns null when there is nothing useful to show', () => {
    expect(buildToolHeaderDetail('file_editor', { command: 'view', path: '/x' })).toBeNull();
    expect(buildToolHeaderDetail('str_replace_editor', {})).toBeNull();
    expect(buildToolHeaderDetail('str_replace_editor', 'not an object')).toBeNull();
    expect(buildToolHeaderDetail('execute_bash', {})).toBeNull();
    expect(buildToolHeaderDetail('execute_bash', { command: '   ' })).toBeNull();
  });
});

describe('commandProgram', () => {
  it('returns the first program token', () => {
    expect(commandProgram('grep -rn "x" .')).toBe('grep');
    expect(commandProgram('  ls -la')).toBe('ls');
  });

  it('strips env assignments and transparent wrappers', () => {
    expect(commandProgram('FOO=1 BAR=2 make test')).toBe('make');
    expect(commandProgram('sudo apt-get update')).toBe('apt-get');
    expect(commandProgram('time /usr/bin/python -m pytest')).toBe('python');
  });

  it('honors quotes in the program token', () => {
    expect(commandProgram('"my program" --flag')).toBe('my program');
  });

  it('returns null for shell syntax that is not a program', () => {
    expect(commandProgram('')).toBeNull();
    expect(commandProgram(null)).toBeNull();
    expect(commandProgram('(subshell)')).toBeNull();
    expect(commandProgram('2>&1')).toBeNull();
    expect(commandProgram('-r stray-flag')).toBeNull();
  });
});

describe('shortenPath', () => {
  it('leaves short paths untouched', () => {
    expect(shortenPath('src/app.js')).toBe('src/app.js');
  });

  it('drops parent directories in favor of the basename', () => {
    expect(shortenPath('/workspace/project/src/components/deeply/nested/Widget.jsx')).toBe(
      '…/Widget.jsx'
    );
  });

  it('keeps the right end of a basename that is itself too long', () => {
    const result = shortenPath('/a/very_long_basename_here.py', 12);
    expect(result).toBe('…/me_here.py');
    expect(result).toHaveLength(12);
  });

  it('passes non-strings through', () => {
    expect(shortenPath(undefined)).toBeUndefined();
  });
});

describe('truncateHeaderCommand', () => {
  it('leaves short commands untouched', () => {
    expect(truncateHeaderCommand('git status')).toBe('git status');
  });

  it('truncates to the limit with an ellipsis', () => {
    const result = truncateHeaderCommand('x'.repeat(200));
    expect(result).toHaveLength(52);
    expect(result.endsWith('…')).toBe(true);
  });

  it('returns an empty string for non-strings', () => {
    expect(truncateHeaderCommand(undefined)).toBe('');
  });
});

describe('formatViewRange', () => {
  it('formats closed and open-ended ranges', () => {
    expect(formatViewRange({ start: 5, end: 7 })).toBe('L5-7');
    expect(formatViewRange({ start: 5, end: null })).toBe('L5-end');
  });

  it('returns null for a missing range', () => {
    expect(formatViewRange(null)).toBeNull();
    expect(formatViewRange({ start: 'x' })).toBeNull();
  });
});
