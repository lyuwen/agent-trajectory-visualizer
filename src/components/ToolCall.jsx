import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Terminal, ChevronRight, ChevronDown, CheckCircle, XCircle, FileText, Brain, Flag } from 'lucide-react';
import clsx from 'clsx';
import './ToolCall.css';

const ToolCall = ({ toolCall }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { function: fn, output } = toolCall;

    let parsedArgs = {};
    try {
        parsedArgs = JSON.parse(fn.arguments);
    } catch {
        parsedArgs = { raw: fn.arguments };
    }
    const argsJson = JSON.stringify(parsedArgs, null, 2);

    // Parse output content if it is JSON, otherwise keep as string
    let outputContent = output?.content;
    try {
        if (outputContent) {
            const parsed = JSON.parse(outputContent);
            outputContent = JSON.stringify(parsed, null, 2);
        }
    } catch {
        // Not JSON, keep as is
    }

    const getIcon = () => {
        switch (fn.name) {
            case 'terminal': return <Terminal size={16} className="tool-icon" />;
            case 'file_editor': return <FileText size={16} className="tool-icon" />;
            case 'think': return <Brain size={16} className="tool-icon" />;
            case 'finish': return <Flag size={16} className="tool-icon" />;
            default: return <Terminal size={16} className="tool-icon" />;
        }
    };

    const renderSpecialToolBody = () => {
        if (fn.name === 'finish') {
            return (
                <div className="special-tool-content">
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
                            {parsedArgs.message}
                        </ReactMarkdown>
                    </div>
                </div>
            );
        }
        if (fn.name === 'think') {
            return (
                <div className="special-tool-content">
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
                            {parsedArgs.thought}
                        </ReactMarkdown>
                    </div>
                </div>
            );
        }
        if (fn.name === 'terminal') {
            return (
                <div className="special-tool-content">
                    <div className="info-row">
                        <span className="info-label">Command:</span>
                        <code className="info-value command">{parsedArgs.command}</code>
                    </div>
                </div>
            );
        }
        if (fn.name === 'file_editor' || fn.name === 'str_replace_editor') {
            return (
                <div className="special-tool-content">
                    <div className="info-row">
                        <span className="info-label">Action:</span>
                        <span className="info-value cap">{parsedArgs.command}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Path:</span>
                        <code className="info-value path">{parsedArgs.path}</code>
                    </div>
                </div>
            );
        }
        return (
            <div className="section">
                <div className="label">Arguments</div>
                <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: '0.5rem' }}>
                    {argsJson}
                </SyntaxHighlighter>
            </div>
        );
    };

    return (
        <div className={clsx("tool-call-container", fn.name)}>
            <div className="tool-header" onClick={() => setIsOpen(!isOpen)}>
                <div className="tool-title">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    {getIcon()}
                    <span className="fn-name">{fn.name}</span>
                    {parsedArgs.summary && (
                        <span className="tool-summary">- {parsedArgs.summary}</span>
                    )}
                </div>
                <div className="tool-status">
                    {output ? <CheckCircle size={16} className="success" /> : <XCircle size={16} className="pending" />}
                </div>
            </div>

            {isOpen && (
                <div className="tool-body">
                    {renderSpecialToolBody()}

                    {/* Show raw arguments for specialized tools */}
                    {['file_editor', 'str_replace_editor', 'terminal', 'finish', 'think'].includes(fn.name) && (
                        <div className="section collapsible-args">
                            <details>
                                <summary className="label cursor-pointer">Raw Arguments</summary>
                                <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: '0.5rem' }}>
                                    {argsJson}
                                </SyntaxHighlighter>
                            </details>
                        </div>
                    )}

                    {output && (
                        <div className="section">
                            <div className="label">Output</div>
                            <SyntaxHighlighter language="text" style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: '0.5rem', maxHeight: '400px', overflow: 'auto' }}>
                                {outputContent}
                            </SyntaxHighlighter>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ToolCall;
