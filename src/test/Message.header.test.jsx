import { describe, it, expect } from 'vitest';
import { render, within } from '@testing-library/react';
import Message from '../components/Message';

const message = {
  role: 'assistant',
  turnIndex: 2,
  content: 'Working on it',
  tool_calls: [
    {
      id: 'a',
      function: { name: 'terminal', arguments: '{"command":"ls"}' },
      output: { role: 'tool', content: 'file.txt' },
    },
    {
      id: 'b',
      function: { name: 'terminal', arguments: '{"command":"pwd"}' },
      output: { role: 'tool', content: '/tmp' },
    },
    {
      id: 'c',
      function: { name: 'think', arguments: '{"thought":"hmm"}' },
    },
  ],
};

const headerTools = () => within(document.querySelector('.message-tools'));
const pill = (name) => headerTools().getByText(name).closest('.message-tool-pill');

describe('Message title bar tool list', () => {
  it('lists each distinct tool called in the turn', () => {
    render(<Message message={message} />);
    expect(pill('terminal')).toBeTruthy();
    expect(pill('think')).toBeTruthy();
  });

  it('collapses repeats into a count', () => {
    render(<Message message={message} />);
    // One pill for two terminal calls, plus the card in the body.
    expect(headerTools().getAllByText('terminal')).toHaveLength(1);
    expect(headerTools().getByText('×2')).toBeInTheDocument();
  });

  it('marks a tool complete when every call has output', () => {
    render(<Message message={message} />);
    expect(pill('terminal')).toHaveClass('is-complete');
    expect(pill('terminal')).not.toHaveClass('is-pending');
  });

  it('marks a tool pending while a call has no output yet', () => {
    render(<Message message={message} />);
    expect(pill('think')).toHaveClass('is-pending');
    expect(pill('think')).not.toHaveClass('is-complete');
  });

  it('describes the completion ratio in the title', () => {
    render(<Message message={message} />);
    expect(pill('terminal')).toHaveAttribute('title', 'terminal ×2 — 2/2 completed');
    expect(pill('think')).toHaveAttribute('title', 'think ×1 — 0/1 completed');
  });

  it('renders no pills for a message without tool calls', () => {
    render(<Message message={{ role: 'assistant', content: 'No tools here' }} />);
    expect(document.querySelector('.message-tools')).toBeNull();
  });

  it('marks each pill with the nature of the work', () => {
    render(<Message message={message} />);
    expect(pill('terminal')).toHaveClass('nature-shell');
    expect(pill('think')).toHaveClass('nature-think');
  });

  it('separates file reads from file edits in the same turn', () => {
    const editorTurn = {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'v',
          function: { name: 'str_replace_editor', arguments: '{"command":"view","path":"/a"}' },
          output: { role: 'tool', content: 'ok' },
        },
        {
          id: 'e',
          function: {
            name: 'str_replace_editor',
            arguments: '{"command":"str_replace","path":"/a","old_str":"x","new_str":"y"}',
          },
          output: { role: 'tool', content: 'ok' },
        },
      ],
    };

    render(<Message message={editorTurn} />);

    const readPill = headerTools().getByText('read').closest('.message-tool-pill');
    const editPill = headerTools().getByText('edit').closest('.message-tool-pill');

    expect(readPill).toHaveClass('nature-read');
    expect(editPill).toHaveClass('nature-edit');
    expect(editPill).toHaveAttribute('title', 'str_replace_editor · edit ×1 — 1/1 completed');
  });

  it('shows the informative programs of shell calls on the pill', () => {
    render(<Message message={message} />);

    const shellPill = pill('terminal');
    expect(within(shellPill).getByText('ls')).toHaveClass('message-tool-pill__program');
    // `pwd` is plumbing and stays out of the collapsed evidence.
    expect(within(shellPill).queryByText('pwd')).toBeNull();
  });

  it('caps the programs on a pill and reports how many are hidden', () => {
    const shellTurn = {
      role: 'assistant',
      content: '',
      tool_calls: ['grep a', 'find b', 'sed c', 'awk d'].map((command, index) => ({
        id: `s${index}`,
        function: { name: 'execute_bash', arguments: JSON.stringify({ command }) },
        output: { role: 'tool', content: 'ok' },
      })),
    };

    render(<Message message={shellTurn} />);

    const shellPill = pill('execute_bash');
    for (const program of ['grep', 'find', 'sed']) {
      expect(within(shellPill).getByText(program)).toBeInTheDocument();
    }
    expect(within(shellPill).queryByText('awk')).toBeNull();
    expect(within(shellPill).getByText('+1')).toBeInTheDocument();
  });

  it('aggregates the line changes of edits into the edit pill', () => {
    const editTurn = {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'e1',
          function: {
            name: 'str_replace_editor',
            arguments: '{"command":"str_replace","path":"/a","old_str":"x","new_str":"y"}',
          },
          output: { role: 'tool', content: 'ok' },
        },
        {
          id: 'e2',
          function: {
            name: 'str_replace_editor',
            arguments: '{"command":"create","path":"/b","file_text":"a\\nb\\nc"}',
          },
          output: { role: 'tool', content: 'ok' },
        },
      ],
    };

    render(<Message message={editTurn} />);

    const editPill = pill('str_replace_editor');
    // +1/-1 from the replacement plus +3/-0 from the create.
    expect(within(editPill).getByText('++4')).toHaveClass('is-add');
    expect(within(editPill).getByText('--1')).toHaveClass('is-remove');
    expect(within(editPill).getByText('×2')).toBeInTheDocument();
  });

  it('leaves a read pill without change or program evidence', () => {
    const readTurn = {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'v',
          function: { name: 'str_replace_editor', arguments: '{"command":"view","path":"/a"}' },
          output: { role: 'tool', content: 'ok' },
        },
      ],
    };

    render(<Message message={readTurn} />);

    const readPill = pill('str_replace_editor');
    expect(readPill.querySelector('.message-tool-pill__evidence')).toBeNull();
  });
});
