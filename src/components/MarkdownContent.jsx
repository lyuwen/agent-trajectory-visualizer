import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';

/**
 * Shared markdown renderer used for message content, reasoning, and
 * markdown-emitting tool results, so every markdown surface in the app
 * renders code blocks, math, and anything else react-markdown supports
 * identically.
 *
 * remark-breaks turns single newlines into <br>. Trajectory messages are
 * typed chat text rather than prose documents: CommonMark's default soft
 * break would silently collapse every single "\n" into a space, which is
 * exactly what multiline user prompts look like.
 */
const markdownComponents = {
    code({ inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '')
        return !inline && match ? (
            <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                customStyle={{ margin: 0, padding: '0.5rem 0.6rem' }}
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
        remarkPlugins={[remarkMath, remarkBreaks]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={markdownComponents}
    >
        {children}
    </ReactMarkdown>
);

export default MarkdownContent;
