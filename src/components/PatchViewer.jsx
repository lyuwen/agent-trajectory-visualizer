import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { GitCommit, ChevronDown, ChevronRight } from 'lucide-react';
import './PatchViewer.css';

const PatchViewer = ({ patch }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!patch) return null;

    return (
        <div className="patch-container">
            <div className="patch-header" onClick={() => setIsOpen(!isOpen)}>
                <div className="patch-title">
                    <GitCommit size={20} className="patch-icon" />
                    <span>Final Result Git Patch</span>
                </div>
                {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </div>

            {isOpen && (
                <div className="patch-content">
                    <SyntaxHighlighter language="diff" style={vscDarkPlus} showLineNumbers customStyle={{ margin: 0, fontSize: '0.9rem' }}>
                        {patch}
                    </SyntaxHighlighter>
                </div>
            )}
        </div>
    );
};

export default PatchViewer;
