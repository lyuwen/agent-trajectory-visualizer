import React from 'react';
import { User, Settings, MessageSquare, Wrench, RotateCcw, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import clsx from 'clsx';
import './FilterBar.css';

const CHIP_ICONS = {
    'role:user': User,
    'role:system': Settings,
    'kind:reply': MessageSquare,
};

// Message-level chips; one chip per tool name is built from the facets below.
// `kind:reply` covers assistant turns that call no tools — they belong to no
// tool type, and they are what a role solo would otherwise leak. It is labelled
// `assistant` because that is the role badge users see, while the key stays
// distinct from `role:assistant` (which would drop tool turns too).
const MESSAGE_CHIPS = [
    { key: 'role:user', label: 'user', className: 'filter-chip--user', bucket: 'roles', name: 'user' },
    { key: 'role:system', label: 'system', className: 'filter-chip--system', bucket: 'roles', name: 'system' },
    {
        key: 'kind:reply',
        label: 'assistant',
        className: 'filter-chip--assistant',
        bucket: 'kinds',
        name: 'reply',
        hint: 'turns with no tool calls',
    },
];

const formatCount = (value, comparisonOpen) => {
    if (!value) return '0';
    if (!comparisonOpen) return String(value.left);
    return `${value.left} | ${value.right}`;
};

const countTotal = (value) => (value?.left ?? 0) + (value?.right ?? 0);

const FilterBar = ({
    counts,
    hiddenFilters,
    onToggle,
    onSolo,
    onReset,
    comparisonOpen,
    onCollapseAll,
    onExpandAll,
}) => {
    const tools = counts?.tools ?? {};

    const toolEntries = Object.entries(tools).sort((a, b) => {
        const totalA = a[1].left + a[1].right;
        const totalB = b[1].left + b[1].right;
        if (totalB !== totalA) return totalB - totalA;
        return a[0].localeCompare(b[0]);
    });

    const messageChips = MESSAGE_CHIPS
        .map((chip) => ({ ...chip, value: counts?.[chip.bucket]?.[chip.name] }))
        .filter((chip) => countTotal(chip.value) > 0);

    const anyHidden = hiddenFilters.size > 0;

    // A double-click fires click twice. These chips carry one action each, so
    // run it once rather than twice (two expand-all tokens means two remounts).
    const actionClick = (action) => (event) => {
        event.stopPropagation();
        if (event.detail > 1) return;
        action();
    };

    const renderChip = ({ key, label, className, value, hint }) => {
        const hidden = hiddenFilters.has(key);
        const ChipIcon = CHIP_ICONS[key] ?? Wrench;
        const described = hint ? `${label} (${hint})` : label;
        const title = `${hidden ? `Show ${described}` : `Hide ${described}`} · double-click or shift-click to show only ${label}`;

        return (
            <button
                key={key}
                type="button"
                className={clsx('filter-chip', className, hidden && 'filter-chip--off')}
                aria-pressed={!hidden}
                title={title}
                onClick={(event) => {
                    event.stopPropagation();
                    // A double-click arrives as click, click, dblclick. The
                    // first click already toggled, and the solo that follows
                    // is what sticks; swallowing the second click keeps it
                    // from flipping the chip back before that lands. Deferring
                    // the first click instead would add double-click-window
                    // latency to every plain toggle.
                    if (event.detail > 1) return;
                    // Shift-click — and Shift+Enter/Space for keyboard users —
                    // shows only this type.
                    if (event.shiftKey) {
                        onSolo(key);
                        return;
                    }
                    onToggle(key);
                }}
                onDoubleClick={(event) => {
                    event.stopPropagation();
                    onSolo(key);
                }}
            >
                <ChipIcon size={13} className="filter-chip__icon" />
                <span className="filter-chip__label">{label}</span>
                <span className="filter-chip__count">{formatCount(value, comparisonOpen)}</span>
            </button>
        );
    };

    return (
        <div
            className="filter-bar"
            role="toolbar"
            aria-label="Filter trajectory messages"
            onClick={(event) => event.stopPropagation()}
        >
            <div className="filter-bar__inner">
                <span
                    className="filter-bar__title"
                    title="Click a chip to show or hide that type · double-click to show only it"
                >
                    Filter
                </span>

                <button
                    type="button"
                    className={clsx('filter-chip', 'filter-chip--reset', !anyHidden && 'filter-chip--idle')}
                    onClick={actionClick(onReset)}
                    disabled={!anyHidden}
                    title="Show every type again"
                >
                    <RotateCcw size={12} className="filter-chip__icon" />
                    <span className="filter-chip__label">All</span>
                </button>

                <span className="filter-bar__divider" aria-hidden="true" />

                {messageChips.map((chip) => renderChip(chip))}

                {toolEntries.length > 0 && <span className="filter-bar__divider" aria-hidden="true" />}

                {toolEntries.map(([name, value]) =>
                    renderChip({
                        key: `tool:${name}`,
                        label: name,
                        className: 'filter-chip--tool',
                        value,
                    })
                )}

                <span className="filter-bar__divider" aria-hidden="true" />

                <button
                    type="button"
                    className="filter-chip filter-chip--action"
                    onClick={actionClick(onCollapseAll)}
                    title="Collapse every message"
                    aria-label="Collapse all messages"
                >
                    <ChevronsDownUp size={13} className="filter-chip__icon" />
                    <span className="filter-chip__label">Collapse all</span>
                </button>

                <button
                    type="button"
                    className="filter-chip filter-chip--action"
                    onClick={actionClick(onExpandAll)}
                    title="Expand every message"
                    aria-label="Expand all messages"
                >
                    <ChevronsUpDown size={13} className="filter-chip__icon" />
                    <span className="filter-chip__label">Expand all</span>
                </button>
            </div>
        </div>
    );
};

export default FilterBar;
