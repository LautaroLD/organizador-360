'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

interface MessageContentProps {
  content: string;
  className?: string;
}

// Custom schema to allow style attribute for colors
const customSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span || []), 'style'],
  },
  tagNames: [...(defaultSchema.tagNames || []), 'span'],
};

/**
 * Component to render message content with rich text formatting (Markdown)
 * Supports: **bold**, *italic*, ~~strikethrough~~, `code`, lists, links, colors, etc.
 */
export const MessageContent: React.FC<MessageContentProps> = ({ content, className = '' }) => {
  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, customSchema]]}
        components={{
          // Customize paragraph rendering
          p: ({ children }) => (
            <p className="text-sm text-[var(--text-primary)] break-words whitespace-pre-wrap m-0 mb-1 last:mb-0">
              {children}
            </p>
          ),
          // Bold text
          strong: ({ children }) => (
            <strong className="font-bold text-[var(--text-primary)]">
              {children}
            </strong>
          ),
          // Italic text
          em: ({ children }) => (
            <em className="italic text-[var(--text-primary)]">
              {children}
            </em>
          ),
          // Strikethrough
          del: ({ children }) => (
            <del className="line-through text-[var(--text-secondary)]">
              {children}
            </del>
          ),
          // Inline code
          code: ({ children, className: codeClassName }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code className="bg-[var(--bg-primary)] border border-[var(--text-secondary)]/20 px-1.5 py-0.5 rounded text-xs font-mono text-[var(--accent-primary)]">
                  {children}
                </code>
              );
            }
            return (
              <code className={`block bg-[var(--bg-primary)] border border-[var(--text-secondary)]/20 p-2 rounded text-xs font-mono overflow-x-auto ${codeClassName}`}>
                {children}
              </code>
            );
          },
          // Code blocks
          pre: ({ children }) => (
            <pre className="bg-[var(--bg-primary)] border border-[var(--text-secondary)]/20 p-2 rounded text-xs font-mono overflow-x-auto my-2">
              {children}
            </pre>
          ),
          // Unordered lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside my-1 ml-2 text-sm text-[var(--text-primary)]">
              {children}
            </ul>
          ),
          // Ordered lists
          ol: ({ children }) => (
            <ol className="list-decimal list-inside my-1 ml-2 text-sm text-[var(--text-primary)]">
              {children}
            </ol>
          ),
          // List items
          li: ({ children }) => (
            <li className="text-sm text-[var(--text-primary)] my-0.5">
              {children}
            </li>
          ),
          // Links
          a: ({ href, children }) => {
            // Ensure URLs have a protocol, otherwise they become relative links
            let finalHref = href || '';
            if (finalHref && !finalHref.startsWith('http://') && !finalHref.startsWith('https://') && !finalHref.startsWith('mailto:') && !finalHref.startsWith('tel:')) {
              finalHref = `https://${finalHref}`;
            }
            return (
              <a
                href={finalHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-primary)] hover:underline"
              >
                {children}
              </a>
            );
          },
          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[var(--accent-primary)] pl-3 my-2 italic text-[var(--text-secondary)]">
              {children}
            </blockquote>
          ),
          // Headings
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-[var(--text-primary)] my-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-[var(--text-primary)] my-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold text-[var(--text-primary)] my-1">{children}</h3>
          ),
          // Horizontal rule
          hr: () => (
            <hr className="border-[var(--text-secondary)]/30 my-2" />
          ),
          // Task list items (checkboxes)
          input: ({ type, checked }) => {
            if (type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="mr-2 accent-[var(--accent-primary)]"
                />
              );
            }
            return null;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MessageContent;
