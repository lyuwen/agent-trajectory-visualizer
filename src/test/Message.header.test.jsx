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
});
