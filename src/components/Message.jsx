import React, { useState } from 'react';
import { User, Bot, Settings, ChevronDown, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';
import MarkdownContent from './MarkdownContent';
import { natureIcon } from './natureIcons';
import ToolCall from './ToolCall';
import { NATURE_LABELS, TOOL_NATURE, toolNature } from '../toolCallHeader';
import './Message.css';

const parseArguments = (raw) => {
    if (typeof raw !== 'string') return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

/**
 * Tool calls made in this turn, grouped by tool *and* by what the call does.
 * A `str_replace_editor` turn that both views and edits therefore reads as two
 * pills — a read (eye) and an edit (pencil) — instead of one ambiguous name.
 * Includes how many calls have produced output (the completion signal ToolCall
 * uses) and the label to show: the tool name, or the nature word when one tool
 * spans several natures.
 */
const summarizeToolCalls = (toolCalls) => {
    const order = [];
    const byKey = new Map();

    for (const call of toolCalls) {
        const name = call?.function?.name;
        if (!name) continue;

        const nature = toolNature(name, parseArguments(call?.function?.arguments));
        const key = `${name}::${nature}`;

        let entry = byKey.get(key);
        if (!entry) {
            entry = { key, name, nature, total: 0, done: 0 };
            byKey.set(key, entry);
            order.push(entry);
        }
        entry.total += 1;
        if (call.output) entry.done += 1;
    }

    const groupsByName = new Map();
    for (const entry of order) {
        groupsByName.set(entry.name, (groupsByName.get(entry.name) ?? 0) + 1);
    }

    return order.map((entry) => ({
        ...entry,
        label:
            groupsByName.get(entry.name) > 1 && entry.nature !== TOOL_NATURE.OTHER
                ? NATURE_LABELS[entry.nature]
                : entry.name,
    }));
};

const Message = ({ message, expandSignal }) => {
    const isSystem = message.role === 'system';
    // A collapse-all / expand-all click supersedes the per-message default.
    // TrajectoryViewer keys messages by the signal token, so a bulk action
    // remounts them and this initializer is what applies the new state; a
    // message mounted later (e.g. revealed by a filter) adopts it as well.
    //
    // Expand-all deliberately skips system messages: they are long, folded by
    // default, and rarely what you want inline. Collapse-all still closes them.
    const [isExpanded, setIsExpanded] = useState(() => {
        if (!expandSignal?.token) return !isSystem;
        return expandSignal.expanded && !isSystem;
    });

    const Icon = message.role === 'user' ? User : (message.role === 'assistant' ? Bot : Settings);
    const toolSummary = summarizeToolCalls(message.tool_calls ?? []);

    return (
        <div className={clsx("message-container", message.role)}>
            <div className="message-header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="role-badge">
                    <Icon size={16} />
                    <span>{message.role}</span>
                    {message.turnIndex !== null && message.turnIndex !== undefined && (
                        <span className="message-index">Turn {message.turnIndex}</span>
                    )}
                </div>

                {toolSummary.length > 0 && (
                    <div className="message-tools" title="Tools called in this turn">
                        {toolSummary.map(({ key, label, name, nature, total, done }) => {
                            const complete = done === total;
                            const NatureIcon = natureIcon(nature);
                            return (
                                <span
                                    key={key}
                                    className={clsx(
                                        'message-tool-pill',
                                        `nature-${nature}`,
                                        complete ? 'is-complete' : 'is-pending'
                                    )}
                                    title={`${label === name ? name : `${name} · ${nature}`} ×${total} — ${done}/${total} completed`}
                                >
                                    <NatureIcon size={10} className="message-tool-pill__icon" />
                                    <span className="message-tool-pill__name">{label}</span>
                                    {total > 1 && <span className="message-tool-pill__count">×{total}</span>}
                                    {complete
                                        ? <CheckCircle size={11} className="message-tool-pill__status" />
                                        : <XCircle size={11} className="message-tool-pill__status" />}
                                </span>
                            );
                        })}
                    </div>
                )}

                <div className="expand-icon">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
            </div>

            {isExpanded && (
                <div className="message-content">
                    {message.content && (
                        <div className="markdown-body">
                            <MarkdownContent>{message.content}</MarkdownContent>
                        </div>
                    )}

                    {message.reasoning_content && (
                        <div className="reasoning-block">
                            <div className="reasoning-label">Reasoning</div>
                            <div className="reasoning-text markdown-body">
                                <MarkdownContent>{message.reasoning_content}</MarkdownContent>
                            </div>
                        </div>
                    )}

                    {message.tool_calls && message.tool_calls.map((tc) => (
                        <ToolCall key={tc.id} toolCall={tc} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Message;
