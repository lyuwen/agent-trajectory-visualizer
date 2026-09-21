import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Message from '../components/Message';

const assistant = {
  role: 'assistant',
  content: 'Assistant body text',
  reasoning_content: 'Assistant reasoning',
};

const system = { role: 'system', content: 'System body text' };

describe('Message bulk expansion', () => {
  it('keeps the per-role default with no signal', () => {
    render(<Message message={assistant} />);
    expect(screen.getByText('Assistant body text')).toBeInTheDocument();

    render(<Message message={system} />);
    expect(screen.queryByText('System body text')).not.toBeInTheDocument();
  });

  it('collapses every role when the signal says collapsed', () => {
    render(<Message message={assistant} expandSignal={{ token: 1, expanded: false }} />);
    render(<Message message={system} expandSignal={{ token: 1, expanded: false }} />);

    expect(screen.queryByText('Assistant body text')).not.toBeInTheDocument();
    expect(screen.queryByText('System body text')).not.toBeInTheDocument();
  });

  it('expands collapsed non-system roles when the signal says expanded', () => {
    render(<Message message={assistant} expandSignal={{ token: 2, expanded: true }} />);
    expect(screen.getByText('Assistant body text')).toBeInTheDocument();
  });

  it('never expands a system message on expand-all', () => {
    render(<Message message={system} expandSignal={{ token: 2, expanded: true }} />);
    expect(screen.queryByText('System body text')).not.toBeInTheDocument();
  });

  it('applies the current bulk state to a message mounted later', () => {
    // Simulates a message revealed by a filter change after "collapse all".
    render(<Message message={{ role: 'user', content: 'Later message' }} expandSignal={{ token: 3, expanded: false }} />);
    expect(screen.queryByText('Later message')).not.toBeInTheDocument();
  });
});
