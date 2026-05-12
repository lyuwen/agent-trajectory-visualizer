import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ToolsInfo from '../components/ToolsInfo';

describe('ToolsInfo Component', () => {
  it('renders nothing when tools prop is undefined', () => {
    const { container } = render(<ToolsInfo tools={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when tools array is empty', () => {
    const { container } = render(<ToolsInfo tools={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays correct count for single tool', () => {
    const tools = [
      {
        type: 'function',
        function: {
          name: 'bash',
          description: 'Execute commands',
        },
      },
    ];
    render(<ToolsInfo tools={tools} />);
    expect(screen.getByText('1 tool')).toBeInTheDocument();
  });

  it('displays correct count for multiple tools', () => {
    const tools = [
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
      {
        type: 'function',
        function: {
          name: 'write_file',
          description: 'Write files',
        },
      },
    ];
    render(<ToolsInfo tools={tools} />);
    expect(screen.getByText('3 tools')).toBeInTheDocument();
  });

  it('displays tool names in tooltip', () => {
    const tools = [
      {
        type: 'function',
        function: {
          name: 'bash',
          description: 'Execute commands',
        },
      },
    ];
    const { container } = render(<ToolsInfo tools={tools} />);
    const tooltip = container.querySelector('.tools-tooltip');
    expect(tooltip).toHaveTextContent('bash');
  });

  it('displays tool descriptions in tooltip', () => {
    const tools = [
      {
        type: 'function',
        function: {
          name: 'bash',
          description: 'Execute commands',
        },
      },
    ];
    const { container } = render(<ToolsInfo tools={tools} />);
    const tooltip = container.querySelector('.tools-tooltip');
    expect(tooltip).toHaveTextContent('Execute commands');
  });

  it('truncates long descriptions', () => {
    const longDescription = 'A'.repeat(250);
    const tools = [
      {
        type: 'function',
        function: {
          name: 'bash',
          description: longDescription,
        },
      },
    ];
    const { container } = render(<ToolsInfo tools={tools} />);
    const tooltip = container.querySelector('.tools-tooltip');
    const descriptionText = tooltip.textContent;
    expect(descriptionText.length).toBeLessThan(longDescription.length);
    expect(descriptionText).toContain('...');
  });

  it('handles malformed tool objects gracefully', () => {
    const tools = [
      {
        type: 'function',
        function: {
          name: 'bash',
          description: 'Execute commands',
        },
      },
      {
        // Missing function property
        type: 'function',
      },
      {
        type: 'function',
        function: {
          // Missing description
          name: 'read_file',
        },
      },
    ];
    render(<ToolsInfo tools={tools} />);
    // Should still render with count (3 tools total, even if some are malformed)
    expect(screen.getByText('3 tools')).toBeInTheDocument();
    // Should render the valid tool name
    expect(screen.getByText('bash')).toBeInTheDocument();
  });

  it('renders multiple tools in tooltip', () => {
    const tools = [
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
    ];
    const { container } = render(<ToolsInfo tools={tools} />);
    const tooltip = container.querySelector('.tools-tooltip');
    expect(tooltip).toHaveTextContent('bash');
    expect(tooltip).toHaveTextContent('read_file');
    expect(tooltip).toHaveTextContent('Execute commands');
    expect(tooltip).toHaveTextContent('Read files');
  });
});
