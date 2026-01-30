import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Terminal, ChevronRight, ChevronDown, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';
import './ToolCall.css';

const ToolCall = ({ toolCall }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { function: fn, output } = toolCall;
    const args = JSON.stringify(JSON.parse(fn.arguments), null, 2);

    // Parse output content if it is JSON, otherwise keep as string
    let outputContent = output?.content;
    try {
        if (outputContent) {
            const parsed = JSON.parse(outputContent);
            outputContent = JSON.stringify(parsed, null, 2);
        }
    } catch (e) {
        // Not JSON, keep as is
    }

    return (
        <div className="tool-call-container">
            <div className="tool-header" onClick={() => setIsOpen(!isOpen)}>
                <div className="tool-title">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <Terminal size={16} className="tool-icon" />
                    <span className="fn-name">{fn.name}</span>
                </div>
                <div className="tool-status">
                    {output ? <CheckCircle size={16} className="success" /> : <XCircle size={16} className="pending" />}
                </div>
            </div>

            {isOpen && (
                <div className="tool-body">
                    <div className="section">
                        <div className="label">Arguments</div>
                        <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: '0.5rem' }}>
                            {args}
                        </SyntaxHighlighter>
                    </div>
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
