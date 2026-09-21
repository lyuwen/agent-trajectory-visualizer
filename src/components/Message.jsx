import React, { useState } from 'react';
import { User, Bot, Settings, ChevronDown, ChevronRight, Wrench, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';
import MarkdownContent from './MarkdownContent';
import ToolCall from './ToolCall';
import './Message.css';

/**
 * Deduplicated tool names called in this turn, in first-seen order, with how
 * many of them have produced output (the same completion signal ToolCall uses).
 */
const summarizeToolCalls = (toolCalls) => {
    const order = [];
    const byName = new Map();

    for (const call of toolCalls) {
        const name = call?.function?.name;
        if (!name) continue;

        let entry = byName.get(name);
        if (!entry) {
            entry = { name, total: 0, done: 0 };
            byName.set(name, entry);
            order.push(entry);
        }
        entry.total += 1;
        if (call.output) entry.done += 1;
    }

    return order;
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
                        {toolSummary.map(({ name, total, done }) => {
                            const complete = done === total;
                            return (
                                <span
                                    key={name}
                                    className={clsx('message-tool-pill', complete ? 'is-complete' : 'is-pending')}
                                    title={`${name} ×${total} — ${done}/${total} completed`}
                                >
                                    <Wrench size={10} className="message-tool-pill__icon" />
                                    <span className="message-tool-pill__name">{name}</span>
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
