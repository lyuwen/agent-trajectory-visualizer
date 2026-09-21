import React, { useState } from 'react';
import { User, Bot, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import MarkdownContent from './MarkdownContent';
import ToolCall from './ToolCall';
import './Message.css';

const Message = ({ message }) => {
    const isSystem = message.role === 'system';
    const [isExpanded, setIsExpanded] = useState(!isSystem);

    const Icon = message.role === 'user' ? User : (message.role === 'assistant' ? Bot : Settings);

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
