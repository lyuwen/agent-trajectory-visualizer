import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { SHORTCUT_GROUPS } from '../keyboardShortcuts';
import './KeyboardShortcutsPanel.css';

/**
 * Centered cheatsheet opened with `?`. Purely presentational: App owns the
 * open flag, this component owns focus so the panel traps the eye and returns
 * focus to whatever was focused before it opened.
 */
const KeyboardShortcutsPanel = ({ onClose }) => {
    const panelRef = useRef(null);
    const restoreRef = useRef(null);

    useEffect(() => {
        const previous = document.activeElement;
        restoreRef.current = previous instanceof HTMLElement ? previous : null;
        panelRef.current?.focus();

        return () => {
            restoreRef.current?.focus?.({ preventScroll: true });
        };
    }, []);

    return (
        <div
            className="shortcut-overlay"
            role="presentation"
            onClick={onClose}
        >
            <div
                className="shortcut-panel"
                role="dialog"
                aria-label="Keyboard shortcuts"
                tabIndex={-1}
                ref={panelRef}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="shortcut-panel__header">
                    <h2 className="shortcut-panel__title">Keyboard shortcuts</h2>
                    <button
                        type="button"
                        className="shortcut-panel__close"
                        onClick={onClose}
                        aria-label="Close keyboard shortcuts"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="shortcut-panel__groups">
                    {SHORTCUT_GROUPS.map((group) => (
                        <section className="shortcut-group" key={group.title}>
                            <h3 className="shortcut-group__title">{group.title}</h3>
                            <ul className="shortcut-group__list">
                                {group.shortcuts.map((shortcut) => (
                                    <li
                                        className="shortcut-item"
                                        key={`${group.title}:${shortcut.keys.join('+')}`}
                                    >
                                        <span className="shortcut-item__keys">
                                            {shortcut.keys.map((key, index) => (
                                                <React.Fragment key={`${key}-${index}`}>
                                                    {index > 0 && (
                                                        <span className="shortcut-item__plus" aria-hidden="true">
                                                            +
                                                        </span>
                                                    )}
                                                    <kbd className="shortcut-key">{key}</kbd>
                                                </React.Fragment>
                                            ))}
                                        </span>
                                        <span className="shortcut-item__label">{shortcut.label}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>

                <p className="shortcut-panel__hint">
                    Shortcuts are ignored while typing in a text field. Press <kbd className="shortcut-key">?</kbd> or{' '}
                    <kbd className="shortcut-key">Esc</kbd> to close.
                </p>
            </div>
        </div>
    );
};

export default KeyboardShortcutsPanel;
