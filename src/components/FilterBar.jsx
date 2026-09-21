import React from 'react';
import { User, Settings, Wrench, RotateCcw, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import clsx from 'clsx';
import './FilterBar.css';

const CHIP_ICONS = {
    'role:user': User,
    'role:system': Settings,
};

const ROLE_CHIPS = [
    { key: 'role:user', label: 'user', className: 'filter-chip--user' },
    { key: 'role:system', label: 'system', className: 'filter-chip--system' },
];

const formatCount = (value, comparisonOpen) => {
    if (!value) return '0';
    if (!comparisonOpen) return String(value.left);
    return `${value.left} | ${value.right}`;
};

const FilterBar = ({
    counts,
    hiddenFilters,
    onToggle,
    onReset,
    comparisonOpen,
    onCollapseAll,
    onExpandAll,
}) => {
    const roles = counts?.roles ?? {};
    const tools = counts?.tools ?? {};

    const toolEntries = Object.entries(tools).sort((a, b) => {
        const totalA = a[1].left + a[1].right;
        const totalB = b[1].left + b[1].right;
        if (totalB !== totalA) return totalB - totalA;
        return a[0].localeCompare(b[0]);
    });

    const anyHidden = hiddenFilters.size > 0;

    const renderChip = ({ key, label, className, value }) => {
        const hidden = hiddenFilters.has(key);
        const ChipIcon = CHIP_ICONS[key] ?? Wrench;

        return (
            <button
                key={key}
                type="button"
                className={clsx('filter-chip', className, hidden && 'filter-chip--off')}
                aria-pressed={!hidden}
                title={hidden ? `Show ${label}` : `Hide ${label}`}
                onClick={(event) => {
                    event.stopPropagation();
                    onToggle(key);
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
                <span className="filter-bar__title">Filter</span>

                <button
                    type="button"
                    className={clsx('filter-chip', 'filter-chip--reset', !anyHidden && 'filter-chip--idle')}
                    onClick={(event) => {
                        event.stopPropagation();
                        onReset();
                    }}
                    disabled={!anyHidden}
                    title="Show every type again"
                >
                    <RotateCcw size={12} className="filter-chip__icon" />
                    <span className="filter-chip__label">All</span>
                </button>

                <span className="filter-bar__divider" aria-hidden="true" />

                {ROLE_CHIPS.filter((chip) => roles[chip.key.slice(5)]).map((chip) =>
                    renderChip({ ...chip, value: roles[chip.key.slice(5)] })
                )}

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
                    onClick={(event) => {
                        event.stopPropagation();
                        onCollapseAll();
                    }}
                    title="Collapse every message"
                    aria-label="Collapse all messages"
                >
                    <ChevronsDownUp size={13} className="filter-chip__icon" />
                    <span className="filter-chip__label">Collapse all</span>
                </button>

                <button
                    type="button"
                    className="filter-chip filter-chip--action"
                    onClick={(event) => {
                        event.stopPropagation();
                        onExpandAll();
                    }}
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
