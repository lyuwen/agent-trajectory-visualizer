import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Message from '../components/Message';

describe('Message reasoning rendering', () => {
  const reasoning = 'First line.\n\nSecond paragraph.\n\n- bullet one\n- bullet two';

  it('renders reasoning content verbatim, keeping newlines', () => {
    render(<Message message={{ role: 'assistant', content: '', reasoning_content: reasoning }} />);

    const block = screen.getByText(/First line\./);
    expect(block).toHaveClass('reasoning-text');
    expect(block.textContent).toBe(reasoning);
    expect(block.textContent).toContain('\n\n');
  });

  it('preserves line breaks in styling (white-space: pre-wrap)', () => {
    render(<Message message={{ role: 'assistant', content: '', reasoning_content: reasoning }} />);

    const block = screen.getByText(/First line\./);
    expect(getComputedStyle(block).whiteSpace).toBe('pre-wrap');
  });
});
