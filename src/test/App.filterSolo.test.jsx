import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const trajectory = {
  instance_id: 'solo-demo',
  messages: [
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'Make it so' },
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
      role: 'assistant',
      content: 'Thinking only',
      tool_calls: [{ id: 'c', function: { name: 'think', arguments: '{"thought":"more"}' } }],
    },
    { role: 'tool', tool_call_id: 'c', content: 'ok' },
  ],
};

// Assistant work split between a plain reply and a tool-calling turn: the two
// classes must be filterable independently.
const replyTrajectory = {
  instance_id: 'reply-demo',
  messages: [
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'Ask something' },
    { role: 'assistant', content: 'A plain reply' },
    {
      role: 'assistant',
      content: 'Tool turn',
      tool_calls: [{ id: 'a', function: { name: 'terminal', arguments: '{"command":"ls"}' } }],
    },
    { role: 'tool', tool_call_id: 'a', content: 'file.txt' },
  ],
};

const loadTrajectory = async (container, data = trajectory) => {
  const file = new File([JSON.stringify(data)], 'solo-demo.json', { type: 'application/json' });
  await userEvent.upload(container.querySelector('input[type="file"]'), file);
  return screen.findByRole('button', { name: 'All' });
};

const chip = (name) => screen.getByRole('button', { name: new RegExp(name, 'i') });
const cards = (container, selector = '') => container.querySelectorAll(`.message-container${selector}`);

describe('App filter solo (double-click)', () => {
  it('shows only the double-clicked type, and All brings everything back', async () => {
    const { container } = render(<App />);
    await loadTrajectory(container);

    // Baseline: system + user + two assistant turns.
    expect(cards(container).length).toBe(4);

    await userEvent.dblClick(chip('terminal'));

    // Solo keeps the assistant turn that carries the terminal call and drops
    // every other type — including the user and system messages.
    expect(cards(container).length).toBe(1);
    expect(cards(container, '.assistant').length).toBe(1);
    expect(cards(container, '.user').length).toBe(0);
    expect(cards(container, '.system').length).toBe(0);
    expect(container.querySelectorAll('.tool-call-container.terminal').length).toBe(1);
    expect(container.querySelectorAll('.tool-call-container.think').length).toBe(0);

    expect(chip('terminal')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('think')).toHaveAttribute('aria-pressed', 'false');
    expect(chip('user')).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByRole('button', { name: 'All' }));

    expect(cards(container).length).toBe(4);
    expect(chip('think')).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps a plain click as a single-type toggle', async () => {
    const { container } = render(<App />);
    await loadTrajectory(container);

    await userEvent.click(chip('think'));

    // Only think is off: the other types stay on.
    expect(chip('think')).toHaveAttribute('aria-pressed', 'false');
    expect(chip('terminal')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('user')).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelectorAll('.tool-call-container.think').length).toBe(0);
  });

  it('leaves only the isolated role in view, plain replies included', async () => {
    const { container } = render(<App />);
    await loadTrajectory(container, replyTrajectory);
    expect(cards(container).length).toBe(4);

    await userEvent.dblClick(chip('user'));

    // "Only user" now means only user: the text-only assistant turn and the
    // tool turn both drop, instead of the reply riding along.
    expect(cards(container).length).toBe(1);
    expect(cards(container, '.user').length).toBe(1);
    expect(screen.queryByText('A plain reply')).not.toBeInTheDocument();
    expect(screen.queryByText('Tool turn')).not.toBeInTheDocument();
    expect(chip('assistant')).toHaveAttribute('aria-pressed', 'false');
  });

  it('isolates plain assistant replies with their own chip', async () => {
    const { container } = render(<App />);
    await loadTrajectory(container, replyTrajectory);

    expect(chip('assistant')).toHaveTextContent('1');

    await userEvent.dblClick(chip('assistant'));

    expect(cards(container).length).toBe(1);
    expect(screen.getByText('A plain reply')).toBeInTheDocument();
    expect(screen.queryByText('Tool turn')).not.toBeInTheDocument();
    expect(chip('terminal')).toHaveAttribute('aria-pressed', 'false');
  });
});
