import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const trajectory = {
    instance_id: 'arrow-demo',
    messages: [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Make it so' },
        { role: 'assistant', content: 'Working on it' },
        { role: 'user', content: 'Carry on' },
        { role: 'assistant', content: 'All done' },
    ],
};

const fileFor = () => new File([JSON.stringify(trajectory)], 'arrow-demo.json', { type: 'application/json' });

const loadLeft = async (container) => {
    await userEvent.upload(container.querySelector('input[type="file"]'), fileFor());
    return screen.findByRole('button', { name: 'All' });
};

const cards = (root) => Array.from(root.querySelectorAll('.message-container'));

const originalScrollTo = Element.prototype.scrollTo;

beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
});

afterEach(() => {
    if (originalScrollTo) Element.prototype.scrollTo = originalScrollTo;
    else delete Element.prototype.scrollTo;
    vi.restoreAllMocks();
});

describe('arrow-key navigation between messages', () => {
    it('walks the caret down to the last message and stops there', async () => {
        const { container } = render(<App />);
        await loadLeft(container);

        const list = cards(container);
        expect(list.length).toBe(5);

        act(() => list[0].focus());
        for (let i = 1; i < list.length; i++) {
            await userEvent.keyboard('{ArrowDown}');
            expect(document.activeElement).toBe(list[i]);
        }

        // At the end the caret stays put instead of looping or throwing.
        await userEvent.keyboard('{ArrowDown}');
        expect(document.activeElement).toBe(list[list.length - 1]);
    });

    it('walks the caret back up with ArrowUp', async () => {
        const { container } = render(<App />);
        await loadLeft(container);

        const list = cards(container);
        act(() => list[3].focus());

        await userEvent.keyboard('{ArrowUp}');
        expect(document.activeElement).toBe(list[2]);

        await userEvent.keyboard('{ArrowUp}');
        expect(document.activeElement).toBe(list[1]);

        await userEvent.keyboard('{ArrowUp}');
        expect(document.activeElement).toBe(list[0]);

        // At the first message the caret stays put.
        await userEvent.keyboard('{ArrowUp}');
        expect(document.activeElement).toBe(list[0]);
    });

    it('leaves the key to the browser at either end of the list', async () => {
        const { container } = render(<App />);
        await loadLeft(container);

        const list = cards(container);

        // Nothing left for the caret to move to: the browser scrolls the pane.
        act(() => list[list.length - 1].focus());
        expect(fireEvent.keyDown(list[list.length - 1], { key: 'ArrowDown' })).toBe(true);

        act(() => list[0].focus());
        expect(fireEvent.keyDown(list[0], { key: 'ArrowUp' })).toBe(true);

        // Anywhere in the middle the key is consumed, because the caret moves.
        act(() => list[1].focus());
        expect(fireEvent.keyDown(list[1], { key: 'ArrowDown' })).toBe(false);
        expect(fireEvent.keyDown(list[1], { key: 'ArrowUp' })).toBe(false);
    });

    it('scrolls the newly focused message into view', async () => {
        const { container } = render(<App />);
        await loadLeft(container);

        const list = cards(container);
        act(() => list[0].focus());
        await userEvent.keyboard('{ArrowDown}');

        const scrollContainer = container.querySelector('.trajectory-scroll');
        expect(scrollContainer.scrollTo).toHaveBeenCalledWith({ top: list[1].offsetTop, behavior: 'smooth' });
    });

    it('moves the caret of the pane that holds focus', async () => {
        const { container } = render(<App />);
        await loadLeft(container);
        await userEvent.upload(container.querySelector('[data-testid="right-trajectory-input"]'), fileFor());
        await screen.findByRole('button', { name: 'Lock scrolling' });

        const rightCards = cards(container.querySelector('.comparison-panel'));
        expect(rightCards.length).toBe(5);

        act(() => rightCards[0].focus());
        await userEvent.keyboard('{ArrowDown}');

        expect(document.activeElement).toBe(rightCards[1]);
        expect(document.activeElement.closest('.comparison-panel')).not.toBeNull();
    });
});
