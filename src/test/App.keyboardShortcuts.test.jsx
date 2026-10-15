import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const trajectory = {
    instance_id: 'shortcut-demo',
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

const fileFor = (data, name) =>
    new File([JSON.stringify(data)], name, { type: 'application/json' });

const loadLeft = async (container) => {
    await userEvent.upload(container.querySelector('input[type="file"]'), fileFor(trajectory, 'shortcut-demo.json'));
    return screen.findByRole('button', { name: 'All' });
};

const loadRight = async (container) => {
    await userEvent.upload(
        container.querySelector('[data-testid="right-trajectory-input"]'),
        fileFor(trajectory, 'shortcut-right.json')
    );
    return screen.findByRole('button', { name: 'Lock scrolling' });
};

const cards = (container, selector = '') => container.querySelectorAll(`.message-container${selector}`);

describe('App keyboard shortcuts — messages', () => {
    it('collapses every message with f and expands them again with e', async () => {
        const { container } = render(<App />);
        await loadLeft(container);
        expect(screen.getByText('Make it so')).toBeInTheDocument();

        await userEvent.keyboard('f');
        expect(screen.queryByText('Make it so')).not.toBeInTheDocument();
        expect(screen.queryByText('Mixed turn')).not.toBeInTheDocument();

        await userEvent.keyboard('e');
        expect(screen.getByText('Make it so')).toBeInTheDocument();
        expect(screen.getByText('Mixed turn')).toBeInTheDocument();
        // Expand-all still skips system prompts.
        expect(screen.queryByText('System prompt')).not.toBeInTheDocument();
    });

    it('toggles only the focused message with c', async () => {
        const { container } = render(<App />);
        await loadLeft(container);

        const userCard = container.querySelector('.message-container.user');
        await userEvent.click(within(userCard).getByText('user'));

        // Clicking a message focuses it (which is what `c` acts on) and folds it.
        expect(document.activeElement).toBe(userCard);
        expect(screen.queryByText('Make it so')).not.toBeInTheDocument();

        await userEvent.keyboard('c');
        expect(screen.getByText('Make it so')).toBeInTheDocument();
        // The other messages were left alone.
        expect(screen.getByText('Mixed turn')).toBeInTheDocument();

        await userEvent.keyboard('c');
        expect(screen.queryByText('Make it so')).not.toBeInTheDocument();
    });

    it('ignores c when no message is focused', async () => {
        const { container } = render(<App />);
        await loadLeft(container);

        document.activeElement?.blur?.();
        await userEvent.keyboard('c');
        expect(screen.getByText('Make it so')).toBeInTheDocument();
    });
});

describe('App keyboard shortcuts — filters', () => {
    it('shows only the hovered chip with d and restores everything with a', async () => {
        const { container } = render(<App />);
        await loadLeft(container);
        expect(cards(container).length).toBe(4);

        await userEvent.hover(screen.getByRole('button', { name: /terminal/i }));
        await userEvent.keyboard('d');

        expect(cards(container).length).toBe(1);
        expect(cards(container, '.assistant').length).toBe(1);
        expect(cards(container, '.user').length).toBe(0);
        expect(container.querySelectorAll('.tool-call-container.think').length).toBe(0);

        await userEvent.keyboard('a');
        expect(cards(container).length).toBe(4);
    });

    it('does nothing with d when the mouse is over no chip', async () => {
        const { container } = render(<App />);
        await loadLeft(container);

        await userEvent.keyboard('d');
        expect(cards(container).length).toBe(4);
    });

    it('shows only the focused message’s tool calls with Shift+D', async () => {
        const { container } = render(<App />);
        await loadLeft(container);

        // The "Thinking only" turn calls think, never terminal.
        const thinkingTurn = cards(container, '.assistant')[1];
        act(() => thinkingTurn.focus());
        await userEvent.keyboard('{Shift>}D{/Shift}');

        expect(cards(container).length).toBe(2);
        expect(cards(container, '.user').length).toBe(0);
        expect(cards(container, '.system').length).toBe(0);
        // Both turns keep their think cards, and no terminal call survives.
        expect(container.querySelectorAll('.tool-call-container.think').length).toBe(2);
        expect(container.querySelectorAll('.tool-call-container.terminal').length).toBe(0);
    });

    it('explains itself when the focused message calls no tools', async () => {
        const { container } = render(<App />);
        await loadLeft(container);

        act(() => cards(container, '.user')[0].focus());
        await userEvent.keyboard('{Shift>}D{/Shift}');

        expect(screen.getByText(/Focus a message that calls a tool/)).toBeInTheDocument();
        expect(cards(container).length).toBe(4);
    });
});

describe('App keyboard shortcuts — split view', () => {
    it('toggles the split panel with s', async () => {
        const { container } = render(<App />);
        await loadLeft(container);
        expect(container.querySelector('.comparison-panel')).toBeNull();

        await userEvent.keyboard('s');
        expect(container.querySelector('.comparison-panel')).not.toBeNull();

        await userEvent.keyboard('s');
        await waitFor(() => expect(container.querySelector('.comparison-panel')).toBeNull());
    });

    it('opens the split’s trajectory picker with o', async () => {
        const { container } = render(<App />);
        await loadLeft(container);

        const rightInput = container.querySelector('[data-testid="right-trajectory-input"]');
        const clickSpy = vi.spyOn(rightInput, 'click').mockImplementation(() => {});

        await userEvent.keyboard('o');

        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.comparison-panel')).not.toBeNull();
        clickSpy.mockRestore();
    });

    it('toggles scroll lock with w only once both panes are loaded', async () => {
        const { container } = render(<App />);
        await loadLeft(container);

        await userEvent.keyboard('w');
        expect(screen.queryByRole('button', { name: /scrolling/i })).toBeNull();

        await loadRight(container);
        const lock = screen.getByRole('button', { name: 'Lock scrolling' });
        expect(lock).toHaveAttribute('aria-pressed', 'false');

        await userEvent.keyboard('w');
        expect(screen.getByRole('button', { name: 'Unlock scrolling' })).toHaveAttribute('aria-pressed', 'true');

        await userEvent.keyboard('w');
        expect(screen.getByRole('button', { name: 'Lock scrolling' })).toHaveAttribute('aria-pressed', 'false');
    });
});

describe('App keyboard shortcuts — page jumps', () => {
    it('jumps the focused pane with gg and Shift+G', async () => {
        const scrollTo = vi.fn();
        const original = Element.prototype.scrollTo;
        Element.prototype.scrollTo = scrollTo;

        try {
            const { container } = render(<App />);
            await loadLeft(container);

            const scroll = container.querySelector('.trajectory-scroll');
            act(() => scroll.focus());
            Object.defineProperty(scroll, 'scrollHeight', { value: 1234, configurable: true });

            await userEvent.keyboard('gg');
            expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });

            await userEvent.keyboard('{Shift>}G{/Shift}');
            expect(scrollTo).toHaveBeenLastCalledWith({ top: 1234, behavior: 'smooth' });
        } finally {
            if (original) Element.prototype.scrollTo = original;
            else delete Element.prototype.scrollTo;
        }
    });

    it('drops a half-typed gg chord when another key follows', async () => {
        const scrollTo = vi.fn();
        const original = Element.prototype.scrollTo;
        Element.prototype.scrollTo = scrollTo;

        try {
            const { container } = render(<App />);
            await loadLeft(container);
            act(() => container.querySelector('.trajectory-scroll').focus());

            await userEvent.keyboard('g');
            await userEvent.keyboard('e');

            expect(scrollTo).not.toHaveBeenCalled();
        } finally {
            if (original) Element.prototype.scrollTo = original;
            else delete Element.prototype.scrollTo;
        }
    });
});

describe('App keyboard shortcuts — help panel', () => {
    it('shows the cheatsheet with ? and closes it with Escape', async () => {
        const { container } = render(<App />);
        await loadLeft(container);

        await userEvent.keyboard('?');
        const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
        expect(within(dialog).getByText('Toggle the focused message')).toBeInTheDocument();
        expect(within(dialog).getByText('Show only the chip under the mouse')).toBeInTheDocument();
        expect(within(dialog).getByText('Toggle scroll lock (split only)')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes again with ? and keeps other shortcuts inert while open', async () => {
        const { container } = render(<App />);
        await loadLeft(container);

        await userEvent.keyboard('?');
        expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();

        // `f` would collapse everything if the cheatsheet did not own the keys.
        await userEvent.keyboard('f');
        expect(screen.getByText('Make it so')).toBeInTheDocument();

        await userEvent.keyboard('?');
        expect(screen.queryByRole('dialog')).toBeNull();

        await userEvent.keyboard('f');
        expect(screen.queryByText('Make it so')).not.toBeInTheDocument();
    });
});
