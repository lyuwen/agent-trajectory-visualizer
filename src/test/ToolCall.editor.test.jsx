import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToolCall from '../components/ToolCall';

const toolCall = (name, args, content) => ({
  id: 'call-1',
  function: { name, arguments: JSON.stringify(args) },
  output: content === undefined ? undefined : { role: 'tool', content },
});

// Render one tool call and expand its card by clicking the tool name text.
const openCard = async (name, args, content) => {
  const user = userEvent.setup();
  const view = render(<ToolCall toolCall={toolCall(name, args, content)} />);
  await user.click(screen.getByText(name));
  return { user, ...view };
};

const STR_REPLACE_ARGS = {
  command: 'str_replace',
  path: 'src/app.js',
  old_str: 'const b = 2;',
  new_str: 'const b = 3;',
};

describe('ToolCall str_replace_editor integration', () => {
  it('shows the viewed source region for a numbered cat -n view', async () => {
    const output = [
      "Here's the result of running `cat -n` on src/app.js:",
      '     1\tconst a = 1;',
      '     2\treturn a;',
    ].join('\n');

    await openCard('str_replace_editor', { command: 'view', path: 'src/app.js' }, output);

    expect(screen.getByText('src/app.js')).toBeInTheDocument();

    const region = screen.getByRole('region', { name: 'Viewed source' });
    expect(region).toHaveTextContent('const a = 1;');
    expect(region).toHaveTextContent('return a;');

    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders a diff with removed/added rows and hides the generic Output block', async () => {
    await openCard('str_replace_editor', STR_REPLACE_ARGS, 'Successfully replaced 1 occurrence.');

    expect(screen.getByRole('region', { name: 'Changes' })).toBeInTheDocument();
    expect(screen.getByLabelText('removed line')).toHaveTextContent('const b = 2;');
    expect(screen.getByLabelText('added line')).toHaveTextContent('const b = 3;');

    expect(screen.queryByText('Output')).toBeNull();
  });

  it('offers a closed Raw Arguments and a closed Raw Output disclosure', async () => {
    await openCard('str_replace_editor', STR_REPLACE_ARGS, 'Successfully replaced 1 occurrence.');

    const rawArguments = screen.getByText('Raw Arguments').closest('details');
    const rawOutput = screen.getByText('Raw Output').closest('details');

    expect(rawArguments).not.toBeNull();
    expect(rawOutput).not.toBeNull();
    expect(rawArguments.open).toBe(false);
    expect(rawOutput.open).toBe(false);
  });

  it('reveals the untouched raw tool result when Raw Output is expanded', async () => {
    // Valid compact JSON: pretty-printing would change it, so the exact compact
    // text proves the disclosure is wired to rawOutputContent, not outputContent.
    const rawResult = '{"b":1,"a":2}';
    const { user } = await openCard('str_replace_editor', STR_REPLACE_ARGS, rawResult);

    const rawOutput = screen.getByText('Raw Output').closest('details');
    await user.click(screen.getByText('Raw Output'));

    expect(rawOutput.open).toBe(true);
    const code = rawOutput.querySelector('code');
    expect(code.textContent).toBe(rawResult);
    expect(code.textContent).not.toContain('"b": 1');
    expect(code).toBeVisible();
  });

  it('pretty-prints JSON output for a generic tool', async () => {
    await openCard('terminal', { command: 'echo' }, '{"a":1}');

    const section = screen.getByText('Output').closest('.section');
    expect(section).not.toBeNull();
    expect(section.querySelector('code').textContent).toContain('"a": 1');
  });

  it('renders ANSI output through the ANSI renderer', async () => {
    const { container } = await openCard('terminal', { command: 'echo' }, '\u001b[31mred\u001b[0m');

    const ansi = container.querySelector('.ansi-output');
    expect(ansi).not.toBeNull();
    expect(ansi.textContent).toContain('red');
  });

  it('strips private-mode escape sequences from output', async () => {
    await openCard('terminal', { command: 'echo' }, 'before\u001b[?2004lafter');

    const section = screen.getByText('Output').closest('.section');
    expect(section.textContent).not.toContain('?2004l');
    expect(section.textContent).toContain('before');
    expect(section.textContent).toContain('after');
  });

  it('normalizes non-string tool output content', async () => {
    const user = userEvent.setup();
    render(
      <ToolCall
        toolCall={{
          id: 'call-object',
          function: { name: 'terminal', arguments: JSON.stringify({ command: 'echo' }) },
          output: { role: 'tool', content: { message: 'hi' } },
        }}
      />
    );
    await user.click(screen.getByText('terminal'));

    const section = screen.getByText('Output').closest('.section');
    expect(section.textContent).toContain('"message": "hi"');
  });

  it('surfaces explicit failures as an alert, not a success icon or a diff', async () => {
    const failure =
      '[An error occurred during execution.]\nError: old_str was not found in src/app.js';
    const { container } = await openCard(
      'str_replace_editor',
      { ...STR_REPLACE_ARGS, old_str: 'missing' },
      failure
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeVisible();
    expect(alert).toHaveTextContent('[An error occurred during execution.]');
    expect(alert).toHaveTextContent('Error: old_str was not found in src/app.js');

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(container.querySelector('.tool-status .success')).toBeNull();
    expect(container.querySelector('.tool-status .error')).not.toBeNull();
    expect(screen.queryByRole('region', { name: 'Changes' })).toBeNull();
    expect(container.querySelector('.tool-call-container')).toHaveClass('has-error');
  });

  it('keeps generic output for an unsupported undo_edit action', async () => {
    const { container } = await openCard(
      'str_replace_editor',
      { command: 'undo_edit', path: 'src/app.js' },
      'Undo successful.'
    );

    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(container.querySelector('.str-editor')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('leaves file_editor on the generic Action/Path plus Output presentation', async () => {
    const { container } = await openCard(
      'file_editor',
      { command: 'view', path: 'src/app.js' },
      '     1\tconst a = 1;'
    );

    expect(screen.getByText('view')).toBeInTheDocument();
    expect(screen.getByText('src/app.js')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(container.querySelector('.tool-status .success')).not.toBeNull();
    expect(container.querySelector('.str-editor')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('keeps a pending str_replace_editor call free of speculative output', async () => {
    const { container } = await openCard(
      'str_replace_editor',
      STR_REPLACE_ARGS,
      undefined
    );

    expect(screen.getByText('src/app.js')).toBeInTheDocument();
    expect(screen.queryByText('Output')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
    expect(container.querySelector('.tool-status .pending')).not.toBeNull();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it.each([['empty string', ''], ['null content', null]])(
    'treats %s output as pending instead of a speculative diff',
    async (_label, content) => {
      const { container } = await openCard('str_replace_editor', STR_REPLACE_ARGS, content);

      expect(screen.queryByRole('region', { name: 'Changes' })).toBeNull();
      expect(container.querySelector('.tool-status .pending')).not.toBeNull();
      expect(container.querySelector('.tool-status .success')).toBeNull();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    }
  );

  it('renders malformed tool arguments without crashing', async () => {
    const user = userEvent.setup();
    render(
      <ToolCall
        toolCall={{
          id: 'call-bad-json',
          function: { name: 'mystery_tool', arguments: '{not json' },
          output: { role: 'tool', content: 'ok' },
        }}
      />
    );
    await user.click(screen.getByText('mystery_tool'));

    expect(screen.getByText('Arguments')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
  });

  it('keeps think and finish on their existing presentations', async () => {
    const user = userEvent.setup();

    const { unmount } = render(
      <ToolCall
        toolCall={toolCall('think', { thought: 'reasoning here' }, 'done')}
      />
    );
    await user.click(screen.getByText('think'));
    expect(screen.getByText('reasoning here')).toBeInTheDocument();
    unmount();

    render(
      <ToolCall
        toolCall={toolCall('finish', { message: 'all done' }, 'done')}
      />
    );
    await user.click(screen.getByText('finish'));
    expect(screen.getByText('all done')).toBeInTheDocument();
  });
});
