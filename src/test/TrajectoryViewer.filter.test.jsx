import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrajectoryViewer from '../components/TrajectoryViewer';

const data = {
  instance_id: 'filter-demo',
  messages: [
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'Do the thing' },
    {
      role: 'assistant',
      content: 'Mixed turn',
      tool_calls: [
        { id: 'a', function: { name: 'terminal', arguments: '{"command":"ls"}' } },
        { id: 'b', function: { name: 'think', arguments: '{"thought":"hmm"}' } },
      ],
    },
    { role: 'tool', tool_call_id: 'a', content: 'file.txt' },
    { role: 'tool', tool_call_id: 'b', content: 'ok' },
    {
      // Text plus a single terminal call: hiding terminal must remove the turn,
      // not leave a tool-less assistant message behind.
      role: 'assistant',
      content: 'Follow-up notes',
      tool_calls: [{ id: 'c', function: { name: 'terminal', arguments: '{"command":"pwd"}' } }],
    },
    { role: 'tool', tool_call_id: 'c', content: '/tmp' },
  ],
};

const renderWith = (hidden) =>
  render(<TrajectoryViewer data={data} hiddenFilters={new Set(hidden)} />);

// A trajectory whose assistant work is split between a plain reply and a
// tool-calling turn: two classes that must be filterable independently.
const replyData = {
  instance_id: 'reply-demo',
  messages: [
    { role: 'user', content: 'Ask' },
    { role: 'assistant', content: 'A plain reply' },
    {
      role: 'assistant',
      content: 'Runs a tool',
      tool_calls: [{ id: 't', function: { name: 'terminal', arguments: '{"command":"ls"}' } }],
    },
    { role: 'tool', tool_call_id: 't', content: 'file.txt' },
  ],
};

const cardCount = (container) => container.querySelectorAll('.message-container').length;
const toolCards = (container, name) =>
  container.querySelectorAll(`.tool-call-container${name ? `.${name}` : ''}`).length;

describe('TrajectoryViewer filtering', () => {
  it('shows every message and tool call when nothing is hidden', () => {
    const { container } = renderWith([]);
    // system, user, and two assistant turns
    expect(cardCount(container)).toBe(4);
    expect(toolCards(container)).toBe(3);
    expect(toolCards(container, 'terminal')).toBe(2);
    expect(toolCards(container, 'think')).toBe(1);
  });

  it('hides a role when its chip is switched off', () => {
    const { container } = renderWith(['role:system']);
    expect(cardCount(container)).toBe(3);
    expect(screen.queryByText('system')).not.toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
  });

  it('drops a turn whose only tool calls are hidden, text included', () => {
    const { container } = renderWith(['tool:terminal']);
    expect(screen.queryByText('Follow-up notes')).not.toBeInTheDocument();
    expect(screen.queryByText('pwd')).not.toBeInTheDocument();
    expect(cardCount(container)).toBe(3);
  });

  it('keeps a turn that still has a visible tool call, showing only that card', () => {
    const { container } = renderWith(['tool:terminal']);
    expect(screen.getByText('Mixed turn')).toBeInTheDocument();
    expect(toolCards(container, 'terminal')).toBe(0);
    expect(toolCards(container, 'think')).toBe(1);
  });

  it('keeps messages that call no tools whatever tool chips are off', () => {
    const { container } = renderWith(['tool:terminal', 'tool:think']);
    expect(cardCount(container)).toBe(2);
    expect(screen.getByText('user')).toBeInTheDocument();
    expect(screen.queryByText('Mixed turn')).not.toBeInTheDocument();
  });

  it('does not hand a survivor the folded state of the message a filter removed', () => {
    const { rerender } = render(<TrajectoryViewer data={data} hiddenFilters={new Set()} />);
    // The user message is expanded by default; the system message above it is
    // folded. Hiding system shifts the user message up one slot.
    expect(screen.getByText('Do the thing')).toBeInTheDocument();

    rerender(<TrajectoryViewer data={data} hiddenFilters={new Set(['role:system'])} />);

    expect(screen.queryByText('System prompt')).not.toBeInTheDocument();
    expect(screen.getByText('Do the thing')).toBeInTheDocument();
  });

  it('hides plain assistant replies when their own class is off', () => {
    const { container } = render(
      <TrajectoryViewer data={replyData} hiddenFilters={new Set(['kind:reply'])} />
    );

    expect(screen.queryByText('A plain reply')).not.toBeInTheDocument();
    expect(screen.getByText('Ask')).toBeInTheDocument();
    expect(screen.getByText('Runs a tool')).toBeInTheDocument();
    expect(cardCount(container)).toBe(2);
  });

  it('drops plain replies under a tool solo, so "only this tool" stays literal', () => {
    const { container } = render(
      <TrajectoryViewer
        data={replyData}
        hiddenFilters={new Set(['role:user', 'role:system', 'kind:reply', 'tool:think'])}
      />
    );

    expect(screen.queryByText('A plain reply')).not.toBeInTheDocument();
    expect(screen.queryByText('Ask')).not.toBeInTheDocument();
    expect(screen.getByText('Runs a tool')).toBeInTheDocument();
    expect(cardCount(container)).toBe(1);
    expect(toolCards(container, 'terminal')).toBe(1);
  });

  it('explains the empty state when no message has anything left to show', () => {
    const nothingLeft = {
      instance_id: 'empty-after-filter',
      messages: [
        { role: 'user', content: 'only a user message' },
        {
          role: 'assistant',
          content: 'text that goes away with its calls',
          tool_calls: [{ id: 'z', function: { name: 'terminal', arguments: '{"command":"pwd"}' } }],
        },
        { role: 'tool', tool_call_id: 'z', content: '/tmp' },
      ],
    };

    render(
      <TrajectoryViewer
        data={nothingLeft}
        hiddenFilters={new Set(['role:user', 'tool:terminal'])}
      />
    );

    expect(screen.getByText(/Every message is filtered out/i)).toBeInTheDocument();
  });
});
