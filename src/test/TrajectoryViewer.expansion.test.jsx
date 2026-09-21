import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrajectoryViewer from '../components/TrajectoryViewer';

const data = {
  instance_id: 'expansion-demo',
  messages: [
    { role: 'system', content: 'System body text' },
    { role: 'user', content: 'User body text' },
    { role: 'assistant', content: 'Assistant body text' },
  ],
};

describe('TrajectoryViewer bulk expansion', () => {
  it('renders non-system messages expanded by default', () => {
    render(<TrajectoryViewer data={data} />);
    expect(screen.getByText('User body text')).toBeInTheDocument();
    expect(screen.getByText('Assistant body text')).toBeInTheDocument();
    expect(screen.queryByText('System body text')).not.toBeInTheDocument();
  });

  it('collapses every message when the signal says collapsed', () => {
    render(<TrajectoryViewer data={data} expandSignal={{ token: 1, expanded: false }} />);
    expect(screen.queryByText('User body text')).not.toBeInTheDocument();
    expect(screen.queryByText('Assistant body text')).not.toBeInTheDocument();
    expect(screen.queryByText('System body text')).not.toBeInTheDocument();
  });

  it('leaves system messages folded on expand all', () => {
    render(<TrajectoryViewer data={data} expandSignal={{ token: 1, expanded: true }} />);
    expect(screen.getByText('User body text')).toBeInTheDocument();
    expect(screen.getByText('Assistant body text')).toBeInTheDocument();
    expect(screen.queryByText('System body text')).not.toBeInTheDocument();
  });

  it('re-applies a new signal token to already-mounted messages', () => {
    const { rerender } = render(
      <TrajectoryViewer data={data} expandSignal={{ token: 1, expanded: true }} />
    );
    expect(screen.getByText('Assistant body text')).toBeInTheDocument();

    rerender(<TrajectoryViewer data={data} expandSignal={{ token: 2, expanded: false }} />);
    expect(screen.queryByText('Assistant body text')).not.toBeInTheDocument();

    rerender(<TrajectoryViewer data={data} expandSignal={{ token: 3, expanded: true }} />);
    expect(screen.getByText('Assistant body text')).toBeInTheDocument();
    expect(screen.queryByText('System body text')).not.toBeInTheDocument();
  });
});
