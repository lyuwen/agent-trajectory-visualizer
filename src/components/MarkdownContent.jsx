import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';

/**
 * Shared markdown renderer used for message content, reasoning, and
 * markdown-emitting tool results, so every markdown surface in the app
 * renders code blocks, math, and anything else react-markdown supports
 * identically.
 */
const markdownComponents = {
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
};

const MarkdownContent = ({ children }) => (
    <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={markdownComponents}
    >
        {children}
    </ReactMarkdown>
);

export default MarkdownContent;
