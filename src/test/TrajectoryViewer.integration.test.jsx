import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrajectoryViewer from '../components/TrajectoryViewer';

describe('TrajectoryViewer Integration', () => {
  it('passes data.tools to ToolsInfo component', () => {
    const mockData = {
      instance_id: 'test-123',
      messages: [],
      tools: [
        {
          type: 'function',
          function: {
            name: 'bash',
            description: 'Execute commands',
          },
        },
      ],
    };

    render(<TrajectoryViewer data={mockData} />);
    expect(screen.getByText('1 tool')).toBeInTheDocument();
  });

  it('displays tools count in header metadata row', () => {
    const mockData = {
      instance_id: 'test-123',
      messages: [
        { role: 'assistant', content: 'Hello' },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'bash',
            description: 'Execute commands',
          },
        },
        {
          type: 'function',
          function: {
            name: 'read_file',
            description: 'Read files',
          },
        },
      ],
    };

    const { container } = render(<TrajectoryViewer data={mockData} />);
    const metaDiv = container.querySelector('.meta');

    expect(metaDiv).toHaveTextContent('test-123');
    expect(metaDiv).toHaveTextContent('1 turns');
    expect(metaDiv).toHaveTextContent('2 tools');
  });

  it('handles missing tools field gracefully', () => {
    const mockData = {
      instance_id: 'test-123',
      messages: [],
      // No tools field
    };

    render(<TrajectoryViewer data={mockData} />);
    expect(screen.queryByText(/tool/)).not.toBeInTheDocument();
  });

  it('displays correct format with separators', () => {
    const mockData = {
      instance_id: 'test-123',
      messages: [
        { role: 'assistant', content: 'Hello' },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'bash',
            description: 'Execute commands',
          },
        },
      ],
    };

    const { container } = render(<TrajectoryViewer data={mockData} />);
    const metaDiv = container.querySelector('.meta');
    const text = metaDiv.textContent;

    // Check format: "Instance ID: xxx · N turns · N tools"
    expect(text).toMatch(/test-123.*·.*1 turns.*·.*1 tool/);
  });
});
