import { describe, it, expect } from 'vitest';
import { render, within } from '@testing-library/react';
import ToolCall from '../components/ToolCall';

const toolCall = (name, args, content) => ({
  id: 'call-1',
  function: { name, arguments: JSON.stringify(args) },
  output: content === undefined ? undefined : { role: 'tool', content },
});

const renderCall = (name, args, content) => render(<ToolCall toolCall={toolCall(name, args, content)} />);

const inHeader = (container) => within(container.querySelector('.tool-header'));

const STR_REPLACE_ARGS = {
  command: 'str_replace',
  path: 'src/app.js',
  old_str: 'const b = 2;',
  new_str: 'const b = 3;',
};

const NUMBERED_VIEW = [
  "Here's the result of running `cat -n` on src/app.js:",
  '     5\tline five',
  '     6\tline six',
  '     7\tline seven',
].join('\n');

describe('ToolCall header detail', () => {
  it('shows the file and green/red change counts for a str_replace edit', () => {
    const { container } = renderCall('str_replace_editor', STR_REPLACE_ARGS, 'Successfully replaced 1 occurrence.');

    expect(inHeader(container).getByText('src/app.js')).toBeInTheDocument();

    const added = inHeader(container).getByText('++1');
    const removed = inHeader(container).getByText('--1');
    expect(added).toHaveClass('is-add');
    expect(removed).toHaveClass('is-remove');
  });

  it('counts every created line as an addition and none as a removal', () => {
    const { container } = renderCall(
      'str_replace_editor',
      { command: 'create', path: 'src/new.js', file_text: 'a\nb\nc' },
      'File created.'
    );

    expect(inHeader(container).getByText('++3')).toBeInTheDocument();
    expect(inHeader(container).getByText('--0')).toBeInTheDocument();
  });

  it('counts an insert as additions with no removals', () => {
    const { container } = renderCall(
      'str_replace_editor',
      { command: 'insert', path: 'src/app.js', insert_line: 4, new_str: 'one\ntwo' },
      'Inserted.'
    );

    expect(inHeader(container).getByText('++2')).toBeInTheDocument();
    expect(inHeader(container).getByText('--0')).toBeInTheDocument();
  });

  it('shows the change counts even while the call is still pending', () => {
    const { container } = renderCall('str_replace_editor', STR_REPLACE_ARGS, undefined);

    expect(inHeader(container).getByText('++1')).toBeInTheDocument();
    expect(inHeader(container).getByText('--1')).toBeInTheDocument();
  });

  it('renders a view as a read: file plus the requested line range', () => {
    const { container } = renderCall(
      'str_replace_editor',
      { command: 'view', path: 'src/app.js', view_range: [10, 20] },
      NUMBERED_VIEW
    );

    const header = inHeader(container);
    expect(header.getByText('src/app.js')).toBeInTheDocument();
    expect(header.getByText('L10-20')).toHaveClass('tool-meta-range');
    expect(header.queryByText('++0')).toBeNull();
    expect(header.queryByText('--0')).toBeNull();
  });

  it('derives the viewed range from numbered output when no range was requested', () => {
    const { container } = renderCall(
      'str_replace_editor',
      { command: 'view', path: 'src/app.js' },
      NUMBERED_VIEW
    );

    expect(inHeader(container).getByText('L5-7')).toBeInTheDocument();
  });

  it('closes an open-ended view range with the last observed line', () => {
    const { container } = renderCall(
      'str_replace_editor',
      { command: 'view', path: 'src/app.js', view_range: [5, -1] },
      NUMBERED_VIEW
    );

    expect(inHeader(container).getByText('L5-7')).toBeInTheDocument();
  });

  it('shows only the path for a directory listing with no line range', () => {
    const output = "Here's the files and directories in /x:\n/x/a.py\n/x/b";
    const { container } = renderCall(
      'str_replace_editor',
      { command: 'view', path: '/x' },
      output
    );

    expect(inHeader(container).getByText('/x')).toBeInTheDocument();
    expect(container.querySelector('.tool-header .tool-meta-range')).toBeNull();
  });

  it('keeps the full path on the chip title while shortening a long path', () => {
    const path = '/workspace/project/src/components/deeply/nested/Widget.jsx';
    const { container } = renderCall(
      'str_replace_editor',
      { command: 'view', path, view_range: [1, 2] },
      NUMBERED_VIEW
    );

    const chip = inHeader(container).getByText('…/Widget.jsx');
    expect(chip).toHaveAttribute('title', path);
  });

  it('uses the edit symbol for edits and the read symbol for views', () => {
    const edit = renderCall('str_replace_editor', STR_REPLACE_ARGS, 'ok');
    expect(edit.container.querySelector('.tool-header .tool-icon')).toHaveClass('nature-edit');
    edit.unmount();

    const read = renderCall(
      'str_replace_editor',
      { command: 'view', path: 'src/app.js' },
      NUMBERED_VIEW
    );
    expect(read.container.querySelector('.tool-header .tool-icon')).toHaveClass('nature-read');
  });

  it('shows only the informative program of a chained shell call', () => {
    const { container } = renderCall(
      'execute_bash',
      { command: 'cd /workspace/astropy && git status --short | head -3' },
      'ok'
    );

    const header = inHeader(container);
    const chip = header.getByText('git');
    expect(chip).toHaveClass('tool-meta-command');
    expect(chip).toHaveAttribute('title', 'git status --short');
    expect(header.queryByText('cd')).toBeNull();
    expect(header.queryByText('head')).toBeNull();
    expect(container.querySelector('.tool-header .tool-icon')).toHaveClass('nature-shell');
  });

  it('falls back to pipe utilities and drops a chain of pure plumbing', () => {
    const withUtility = renderCall('execute_bash', { command: 'cd /x && head -5 f' }, 'ok');
    expect(inHeader(withUtility.container).getByText('head')).toBeInTheDocument();
    withUtility.unmount();

    const plumbingOnly = renderCall('execute_bash', { command: 'cd /x && echo done' }, 'ok');
    expect(plumbingOnly.container.querySelector('.tool-header .tool-meta')).toBeNull();
  });

  it('caps the command chips and reports how many are hidden', () => {
    const { container } = renderCall('execute_bash', { command: 'a && b && c && d && e && f' }, 'ok');

    const header = inHeader(container);
    for (const command of ['a', 'b', 'c', 'd']) {
      expect(header.getByText(command)).toBeInTheDocument();
    }
    expect(header.queryByText('e')).toBeNull();
    expect(header.getByText('+2')).toHaveAttribute('title', 'e  |  f');
  });

  it('truncates a long program name but keeps the full command on the title', () => {
    const command = 'x'.repeat(200);
    const { container } = renderCall('execute_bash', { command }, 'ok');

    const chip = inHeader(container).getByTitle(command);
    expect(chip.textContent).toHaveLength(24);
    expect(chip.textContent.endsWith('…')).toBe(true);
  });

  it('keeps the tool summary after the detail chips', () => {
    const { container } = renderCall(
      'execute_bash',
      { command: 'git status', summary: 'Check working tree' },
      'ok'
    );

    const header = container.querySelector('.tool-header');
    expect(within(header).getByText('- Check working tree')).toBeInTheDocument();
    expect(header.querySelector('.tool-summary')).not.toBeNull();
  });

  it('leaves tools without header detail on the plain name-and-summary header', () => {
    const { container } = renderCall(
      'file_editor',
      { command: 'view', path: 'src/app.js', summary: 'Open a file' },
      '     1\tconst a = 1;'
    );

    expect(container.querySelector('.tool-header .tool-meta')).toBeNull();
    expect(inHeader(container).getByText('file_editor')).toBeInTheDocument();
  });

  it('renders malformed arguments without a crash or a chip', () => {
    const { container } = render(
      <ToolCall
        toolCall={{
          id: 'call-bad',
          function: { name: 'str_replace_editor', arguments: '{not json' },
          output: { role: 'tool', content: 'ok' },
        }}
      />
    );

    expect(inHeader(container).getByText('str_replace_editor')).toBeInTheDocument();
    expect(container.querySelector('.tool-header .tool-meta')).toBeNull();
  });
});
