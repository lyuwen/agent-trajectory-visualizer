import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterBar from '../components/FilterBar';

const counts = {
  roles: {
    user: { left: 2, right: 1 },
    system: { left: 1, right: 0 },
  },
  tools: {
    terminal: { left: 5, right: 3 },
    think: { left: 2, right: 0 },
  },
};

const setup = (props = {}) => {
  const onToggle = vi.fn();
  const onReset = vi.fn();
  const onCollapseAll = vi.fn();
  const onExpandAll = vi.fn();
  render(
    <FilterBar
      counts={counts}
      hiddenFilters={props.hiddenFilters ?? new Set()}
      onToggle={onToggle}
      onReset={onReset}
      comparisonOpen={props.comparisonOpen ?? false}
      onCollapseAll={onCollapseAll}
      onExpandAll={onExpandAll}
    />
  );
  return { onToggle, onReset, onCollapseAll, onExpandAll };
};

describe('FilterBar', () => {
  it('shows a chip per role and tool type with counts', () => {
    setup();
    expect(screen.getByRole('button', { name: /user/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /terminal/i })).toHaveTextContent('5');
    expect(screen.getByRole('button', { name: /think/i })).toHaveTextContent('2');
  });

  it('shows both panes side by side in comparison view', () => {
    setup({ comparisonOpen: true });
    expect(screen.getByRole('button', { name: /terminal/i })).toHaveTextContent('5 | 3');
    expect(screen.getByRole('button', { name: /system/i })).toHaveTextContent('1 | 0');
  });

  it('treats every type as on by default', () => {
    setup();
    for (const name of [/user/i, /system/i, /terminal/i, /think/i]) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('reports the type turned off when a chip is clicked', async () => {
    const { onToggle } = setup();
    await userEvent.click(screen.getByRole('button', { name: /terminal/i }));
    expect(onToggle).toHaveBeenCalledWith('tool:terminal');
  });

  it('marks hidden types as pressed=false', () => {
    setup({ hiddenFilters: new Set(['role:system']) });
    expect(screen.getByRole('button', { name: /system/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /user/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('disables the All chip when nothing is hidden', () => {
    setup();
    expect(screen.getByRole('button', { name: 'All' })).toBeDisabled();
  });

  it('resets every type through the All chip once something is hidden', async () => {
    const { onReset } = setup({ hiddenFilters: new Set(['tool:think']) });
    const all = screen.getByRole('button', { name: 'All' });
    expect(all).toBeEnabled();
    await userEvent.click(all);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('does not render tool chips when the trajectory has no tool calls', () => {
    render(
      <FilterBar
        counts={{ roles: { user: { left: 1, right: 0 } }, tools: {} }}
        hiddenFilters={new Set()}
        onToggle={vi.fn()}
        onReset={vi.fn()}
        comparisonOpen={false}
        onCollapseAll={vi.fn()}
        onExpandAll={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /user/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /terminal/i })).not.toBeInTheDocument();
  });

  it('offers collapse-all and expand-all actions', async () => {
    const { onCollapseAll, onExpandAll } = setup();

    await userEvent.click(screen.getByRole('button', { name: /collapse all/i }));
    expect(onCollapseAll).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /expand all/i }));
    expect(onExpandAll).toHaveBeenCalledTimes(1);
  });
});
