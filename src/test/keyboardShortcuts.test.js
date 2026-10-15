import { describe, it, expect } from 'vitest';
import { SHORTCUT_GROUPS, G_CHORD_TIMEOUT_MS, isTypingTarget } from '../keyboardShortcuts';

const allShortcuts = SHORTCUT_GROUPS.flatMap((group) => group.shortcuts);
const keySignature = (shortcut) => shortcut.keys.join('+');

describe('SHORTCUT_GROUPS', () => {
    it('documents every binding the viewer implements', () => {
        expect(allShortcuts.map(keySignature)).toEqual([
            'e',
            'f',
            'c',
            'd',
            'Shift+d',
            'a',
            's',
            'o',
            'w',
            'g+g',
            'Shift+G',
            '?',
        ]);
    });

    it('gives every shortcut a label and at least one keycap', () => {
        for (const shortcut of allShortcuts) {
            expect(shortcut.keys.length).toBeGreaterThan(0);
            expect(shortcut.keys.every((key) => typeof key === 'string' && key.length > 0)).toBe(true);
            expect(shortcut.label.length).toBeGreaterThan(0);
        }
    });

    it('groups shortcuts under non-empty titles with unique keys', () => {
        const signatures = new Set();
        for (const group of SHORTCUT_GROUPS) {
            expect(group.title.length).toBeGreaterThan(0);
            expect(group.shortcuts.length).toBeGreaterThan(0);
            for (const shortcut of group.shortcuts) {
                const signature = keySignature(shortcut);
                expect(signatures.has(signature)).toBe(false);
                signatures.add(signature);
            }
        }
    });

    it('waits long enough to type a gg chord', () => {
        expect(G_CHORD_TIMEOUT_MS).toBeGreaterThanOrEqual(300);
    });
});

describe('isTypingTarget', () => {
    const target = (tagName, attributes = {}, extra = {}) => ({
        tagName,
        isContentEditable: false,
        getAttribute: (name) => attributes[name] ?? null,
        ...extra,
    });

    it('leaves text fields and editable hosts to their own keys', () => {
        expect(isTypingTarget(target('INPUT', { type: 'text' }))).toBe(true);
        expect(isTypingTarget(target('INPUT'))).toBe(true); // defaults to text
        expect(isTypingTarget(target('INPUT', { type: 'search' }))).toBe(true);
        expect(isTypingTarget(target('TEXTAREA'))).toBe(true);
        expect(isTypingTarget(target('SELECT'))).toBe(true);
        expect(isTypingTarget(target('DIV', {}, { isContentEditable: true }))).toBe(true);
    });

    it('lets shortcuts through non-text controls and ordinary nodes', () => {
        expect(isTypingTarget(target('INPUT', { type: 'file' }))).toBe(false);
        expect(isTypingTarget(target('INPUT', { type: 'checkbox' }))).toBe(false);
        expect(isTypingTarget(target('BUTTON'))).toBe(false);
        expect(isTypingTarget(target('DIV'))).toBe(false);
        expect(isTypingTarget({ tagName: 'DIV' })).toBe(false);
    });

    it('tolerates a missing target', () => {
        expect(isTypingTarget(null)).toBe(false);
        expect(isTypingTarget(undefined)).toBe(false);
    });
});
