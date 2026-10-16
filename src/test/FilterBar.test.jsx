import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterBar from '../components/FilterBar';

const counts = {
  roles: {
    user: { left: 2, right: 1 },
    system: { left: 1, right: 0 },
  },
  kinds: {
    reply: { left: 3, right: 0 },
  },
  tools: {
    terminal: { left: 5, right: 3 },
    think: { left: 2, right: 0 },
  },
};

const setup = (props = {}) => {
  const onToggle = vi.fn();
  const onSolo = vi.fn();
  const onReset = vi.fn();
  const onCollapseAll = vi.fn();
  const onExpandAll = vi.fn();
  render(
    <FilterBar
      counts={counts}
      hiddenFilters={props.hiddenFilters ?? new Set()}
      onToggle={onToggle}
      onSolo={onSolo}
      onReset={onReset}
      comparisonOpen={props.comparisonOpen ?? false}
      onCollapseAll={onCollapseAll}
      onExpandAll={onExpandAll}
    />
  );
  return { onToggle, onSolo, onReset, onCollapseAll, onExpandAll };
};

describe('FilterBar', () => {
  it('shows a chip per role, assistant class and tool type with counts', () => {
    setup();
    expect(screen.getByRole('button', { name: /user/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /assistant/i })).toHaveTextContent('3');
    // Labelled like the role badge, so the tooltip carries the precision.
    expect(screen.getByRole('button', { name: /assistant/i })).toHaveAttribute(
      'title',
      expect.stringMatching(/turns with no tool calls/i)
    );
    expect(screen.getByRole('button', { name: /terminal/i })).toHaveTextContent('5');
    expect(screen.getByRole('button', { name: /think/i })).toHaveTextContent('2');
  });

  it('shows both panes side by side in comparison view', () => {
    setup({ comparisonOpen: true });
    expect(screen.getByRole('button', { name: /terminal/i })).toHaveTextContent('5 | 3');
    expect(screen.getByRole('button', { name: /system/i })).toHaveTextContent('1 | 0');
    expect(screen.getByRole('button', { name: /assistant/i })).toHaveTextContent('3 | 0');
  });

  it('treats every type as on by default', () => {
    setup();
    for (const name of [/user/i, /system/i, /assistant/i, /terminal/i, /think/i]) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('leaves out chips for classes the trajectory does not contain', () => {
    render(
      <FilterBar
        counts={{
          roles: { user: { left: 0, right: 0 }, system: { left: 2, right: 0 } },
          kinds: { reply: { left: 0, right: 0 } },
          tools: {},
        }}
        hiddenFilters={new Set()}
        onToggle={vi.fn()}
        onSolo={vi.fn()}
        onReset={vi.fn()}
        comparisonOpen={false}
        onCollapseAll={vi.fn()}
        onExpandAll={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /user/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assistant/i })).not.toBeInTheDocument();
  });

  it('reports the type turned off when a chip is clicked', async () => {
    const { onToggle } = setup();
    await userEvent.click(screen.getByRole('button', { name: /terminal/i }));
    expect(onToggle).toHaveBeenCalledWith('tool:terminal');
  });

  it('shows only one type on double-click, including the assistant class', async () => {
    const { onSolo, onToggle } = setup();
    await userEvent.dblClick(screen.getByRole('button', { name: /terminal/i }));
    expect(onSolo).toHaveBeenCalledWith('tool:terminal');
    // The second click of the double-click is swallowed; the first one toggles
    // once, and the solo that follows is the state that sticks.
    expect(onToggle).toHaveBeenCalledTimes(1);

    await userEvent.dblClick(screen.getByRole('button', { name: /assistant/i }));
    expect(onSolo).toHaveBeenLastCalledWith('kind:reply');
  });

  it('shows only one type on shift-click and on Shift+Enter', async () => {
    const { onSolo, onToggle } = setup();
    const terminal = screen.getByRole('button', { name: /terminal/i });

    fireEvent.click(terminal, { shiftKey: true, detail: 1 });
    expect(onSolo).toHaveBeenCalledWith('tool:terminal');

    onSolo.mockClear();
    terminal.focus();
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(onSolo).toHaveBeenCalledWith('tool:terminal');
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('keeps the isolate gesture in the chip tooltips, not in the bar', () => {
    setup();
    expect(screen.getByRole('button', { name: /terminal/i })).toHaveAttribute(
      'title',
      expect.stringMatching(/show only terminal/i)
    );
    expect(screen.queryByText(/double-click a chip/i)).not.toBeInTheDocument();
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
        onSolo={vi.fn()}
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

  it('runs a single action when an action chip is double-clicked', async () => {
    const { onCollapseAll, onExpandAll, onReset } = setup({
      hiddenFilters: new Set(['tool:think']),
    });

    await userEvent.dblClick(screen.getByRole('button', { name: /expand all/i }));
    expect(onExpandAll).toHaveBeenCalledTimes(1);

    await userEvent.dblClick(screen.getByRole('button', { name: /collapse all/i }));
    expect(onCollapseAll).toHaveBeenCalledTimes(1);

    await userEvent.dblClick(screen.getByRole('button', { name: 'All' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  describe('overflowing chip strip', () => {
    // The strip hides its scrollbar, so the wheel is the way a mouse reaches
    // the chips that scrolled out of view. jsdom has no layout, so the
    // measured widths are stubbed.
    const overflow = () => {
      setup();
      const strip = document.querySelector('.filter-bar__inner');
      Object.defineProperty(strip, 'scrollWidth', { value: 900, configurable: true });
      Object.defineProperty(strip, 'clientWidth', { value: 400, configurable: true });
      return strip;
    };

    it('turns a vertical wheel into horizontal travel', () => {
      const strip = overflow();
      const event = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
      strip.dispatchEvent(event);

      expect(strip.scrollLeft).toBe(120);
      // The page behind must not scroll along with the strip.
      expect(event.defaultPrevented).toBe(true);
    });

    it('honours a horizontal wheel and normalises line deltas', () => {
      const strip = overflow();

      strip.dispatchEvent(new WheelEvent('wheel', { deltaX: -60, deltaY: 10, bubbles: true, cancelable: true }));
      expect(strip.scrollLeft).toBe(-60);

      strip.scrollLeft = 0;
      strip.dispatchEvent(new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, bubbles: true, cancelable: true }));
      expect(strip.scrollLeft).toBe(72);
    });

    it('leaves the wheel alone when every chip fits', () => {
      setup();
      const strip = document.querySelector('.filter-bar__inner');
      const event = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
      strip.dispatchEvent(event);

      expect(strip.scrollLeft).toBe(0);
      expect(event.defaultPrevented).toBe(false);
    });
  });
});
