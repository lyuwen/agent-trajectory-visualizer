import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
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
                </div>
                <div className="expand-icon">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
            </div>

            {isExpanded && (
                <div className="message-content">
                    {message.content && (
                        <div className="markdown-body">
                            <ReactMarkdown
                                components={{
                                    code({ inline, className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || '')
                                        return !inline && match ? (
                                            <SyntaxHighlighter
                                                style={vscDarkPlus}
                                                language={match[1]}
                                                PreTag="div"
                                                {...props}
                                            >
                                                {String(children).replace(/\n$/, '')}
                                            </SyntaxHighlighter>
                                        ) : (
                                            <code className={className} {...props}>
                                                {children}
                                            </code>
                                        )
                                    }
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    )}

                    {message.reasoning_content && (
                        <div className="reasoning-block">
                            <div className="reasoning-label">Reasoning</div>
                            <div className="reasoning-text">{message.reasoning_content}</div>
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
