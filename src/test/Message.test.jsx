import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Message from '../components/Message';

const renderReasoning = (reasoning) =>
  render(<Message message={{ role: 'assistant', content: '', reasoning_content: reasoning }} />);

describe('Message reasoning rendering', () => {
  it('renders reasoning as markdown paragraphs', () => {
    const { container } = renderReasoning('First paragraph.\n\nSecond paragraph.');

    const block = container.querySelector('.reasoning-text');
    expect(block).toBeTruthy();

    const paragraphs = block.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toHaveTextContent('First paragraph.');
    expect(paragraphs[1]).toHaveTextContent('Second paragraph.');
  });

  it('renders fenced code blocks in reasoning with syntax highlighting', () => {
    const { container } = renderReasoning('Check this:\n\n```bash\nls -la\n```');

    const code = container.querySelector('.reasoning-text pre code');
    expect(code).toBeTruthy();
    expect(code.className).toContain('language-bash');
    expect(code).toHaveTextContent('ls -la');
  });

  it('renders reasoning with the same markdown pipeline as message content', () => {
    const markdown = '# Heading\n\nUse `inline` code.';

    const { container: content } = render(
      <Message message={{ role: 'assistant', content: markdown }} />
    );
    const { container: reasoning } = renderReasoning(markdown);

    expect(content.querySelector('.markdown-body h1')).toHaveTextContent('Heading');
    expect(reasoning.querySelector('.reasoning-text h1')).toHaveTextContent('Heading');
    expect(reasoning.querySelector('.reasoning-text code')).toHaveTextContent('inline');
  });

  it('renders inline and display math in reasoning', () => {
    const { container } = renderReasoning(
      'Energy: $E = mc^2$.\n\n$$\n\\frac{a}{b}\n$$'
    );

    const block = container.querySelector('.reasoning-text');
    expect(block.querySelector('.katex')).toBeTruthy();
    expect(block.querySelector('.katex-display')).toBeTruthy();
    // KaTeX renders both a MathML and an HTML tree; no fallback error node.
    expect(block.querySelector('.katex-error')).toBeNull();
  });

  it('renders math in regular message content too', () => {
    const { container } = render(
      <Message message={{ role: 'assistant', content: 'Inline math $a^2 + b^2 = c^2$.' }} />
    );

    expect(container.querySelector('.markdown-body .katex')).toBeTruthy();
  });
});
