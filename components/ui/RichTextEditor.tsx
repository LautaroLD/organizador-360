'use client';

import React, { useRef, useState } from 'react';
import { Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote, Link, Type, Palette, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface RichTextEditorProps {
  value: string;
  rows?: number;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showToolbar?: boolean;
}

interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
}

type FormatAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'code'
  | 'codeblock'
  | 'list'
  | 'orderedlist'
  | 'quote'
  | 'link'
  | 'heading'
  | 'color';

const COLORS = [
  { name: 'Rojo', code: 'red', class: 'text-red-500', bg: 'bg-red-500' },
  { name: 'Naranja', code: 'orange', class: 'text-orange-500', bg: 'bg-orange-500' },
  { name: 'Amarillo', code: 'yellow', class: 'text-yellow-500', bg: 'bg-yellow-500' },
  { name: 'Verde', code: 'green', class: 'text-green-500', bg: 'bg-green-500' },
  { name: 'Azul', code: 'blue', class: 'text-blue-500', bg: 'bg-blue-500' },
  { name: 'Púrpura', code: 'purple', class: 'text-purple-500', bg: 'bg-purple-500' },
  { name: 'Rosa', code: 'pink', class: 'text-pink-500', bg: 'bg-pink-500' },
];

// Toolbar button component - defined outside the main component
const ToolbarButton: React.FC<ToolbarButtonProps> = ({ onClick, title, children, active }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={clsx(
      "p-1.5 rounded hover:bg-[var(--bg-primary)] transition-colors",
      active ? "bg-[var(--bg-primary)] text-[var(--accent-primary)]" : "text-[var(--text-secondary)]"
    )}
  >
    {children}
  </button>
);

/**
 * Rich text editor component with formatting toolbar
 * Produces Markdown output that can be rendered by MessageContent
 */
export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Escribe un mensaje...',
  disabled = false,
  className = '',
  showToolbar = true,
  rows = 3,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHeadingPicker, setShowHeadingPicker] = useState(false);

  const insertFormat = (action: FormatAction, extra?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    let newText = value;
    let newCursorPos = start;

    switch (action) {
      case 'bold':
        newText = value.substring(0, start) + `**${selectedText || 'texto'}**` + value.substring(end);
        newCursorPos = selectedText ? end + 4 : start + 2;
        break;
      case 'italic':
        newText = value.substring(0, start) + `*${selectedText || 'texto'}*` + value.substring(end);
        newCursorPos = selectedText ? end + 2 : start + 1;
        break;
      case 'strikethrough':
        newText = value.substring(0, start) + `~~${selectedText || 'texto'}~~` + value.substring(end);
        newCursorPos = selectedText ? end + 4 : start + 2;
        break;
      case 'code':
        newText = value.substring(0, start) + `\`${selectedText || 'código'}\`` + value.substring(end);
        newCursorPos = selectedText ? end + 2 : start + 1;
        break;
      case 'codeblock':
        newText = value.substring(0, start) + `\n\`\`\`\n${selectedText || 'código'}\n\`\`\`\n` + value.substring(end);
        newCursorPos = selectedText ? end + 8 : start + 5;
        break;
      case 'list':
        const listItems = selectedText ? selectedText.split('\n').map(line => `- ${line}`).join('\n') : '- ';
        newText = value.substring(0, start) + listItems + value.substring(end);
        newCursorPos = start + listItems.length;
        break;
      case 'orderedlist':
        const orderedItems = selectedText
          ? selectedText.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n')
          : '1. ';
        newText = value.substring(0, start) + orderedItems + value.substring(end);
        newCursorPos = start + orderedItems.length;
        break;
      case 'quote':
        const quoteLines = selectedText
          ? selectedText.split('\n').map(line => `> ${line}`).join('\n')
          : '> cita';
        newText = value.substring(0, start) + quoteLines + value.substring(end);
        newCursorPos = start + quoteLines.length;
        break;
      case 'link':
        const linkText = selectedText || 'texto';
        newText = value.substring(0, start) + `[${linkText}](url)` + value.substring(end);
        newCursorPos = start + linkText.length + 3;
        break;
      case 'heading':
        const headingLevel = extra || '##';
        newText = value.substring(0, start) + `${headingLevel} ${selectedText || 'Título'}` + value.substring(end);
        newCursorPos = start + headingLevel.length + 1;
        break;
      case 'color':
        // Using HTML span for colors (supported by some markdown renderers)
        const color = extra || 'red';
        newText = value.substring(0, start) + `<span style="color:${color}">${selectedText || 'texto'}</span>` + value.substring(end);
        newCursorPos = start + `<span style="color:${color}">`.length;
        break;
    }

    onChange(newText);

    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      if (!selectedText) {
        textarea.setSelectionRange(newCursorPos, newCursorPos + (action === 'bold' || action === 'strikethrough' ? 5 : action === 'italic' ? 5 : 0));
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Shift + Enter
    if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      onSubmit?.();
      return;
    }

    // Handle Enter key for lists
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const textBefore = value.substring(0, start);
      const lineStart = textBefore.lastIndexOf('\n') + 1;
      const currentLine = textBefore.substring(lineStart);

      // Check if current line starts with a list marker
      // Matches: "- ", "* ", "1. ", "10. " with optional leading spaces
      const listMatch = currentLine.match(/^(\s*)((?:-|\*)|\d+\.)\s/);

      if (listMatch) {
        // Check if the list item is effectively empty (to terminate list)
        const nextNewline = value.indexOf('\n', end);
        const lineEnd = nextNewline === -1 ? value.length : nextNewline;
        const textAfter = value.substring(end, lineEnd);
        const fullLine = currentLine + textAfter;

        const contentMatch = fullLine.match(/^(\s*(?:(?:-|\*)|\d+\.)\s)(.*)/);
        if (contentMatch) {
          const [, , content] = contentMatch;
          if (!content.trim()) {
            // Empty list item - terminate list
            e.preventDefault();
            // Remove the current line content, keeping the newlines around it if needed
            // If we are deleting the line content, we just want to remove characters from lineStart to lineEnd
            // But we usually want to keep the line itself as an empty line.
            // value = "prev\n- \nnext" -> "prev\n\nnext"

            // If it's the first line: "- \n" -> "\n" (empty line)
            const newValue = value.substring(0, lineStart) + value.substring(lineEnd);
            onChange(newValue);

            // Move cursor to start of this (now empty) line
            setTimeout(() => {
              textarea.setSelectionRange(lineStart, lineStart);
              textarea.focus();
            }, 0);
            return;
          }
        }

        // Continue list
        e.preventDefault();
        const [, spaces, marker] = listMatch;
        let nextMarker = marker;

        // If ordered list, increment number
        if (/^\d+\.$/.test(marker)) {
          const num = parseInt(marker);
          nextMarker = `${num + 1}.`;
        }

        const insertion = `\n${spaces}${nextMarker} `;
        const newValue = value.substring(0, start) + insertion + value.substring(end);

        onChange(newValue);
        setTimeout(() => {
          const newPos = start + insertion.length;
          textarea.setSelectionRange(newPos, newPos);
          textarea.focus();
        }, 0);
        return;
      }
    }

    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          insertFormat('bold');
          break;
        case 'i':
          e.preventDefault();
          insertFormat('italic');
          break;
        case 'u':
          e.preventDefault();
          insertFormat('strikethrough');
          break;
        case 'k':
          e.preventDefault();
          insertFormat('link');
          break;
      }
    }
  };
  return (
    <div className={`flex flex-col border border-[var(--text-secondary)]/30 rounded-lg bg-[var(--bg-primary)] ${className}`}>
      {/* Toolbar */}
      {showToolbar &&
        <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] rounded-t-lg">
          <ToolbarButton onClick={() => insertFormat('bold')} title="Negrita (Ctrl+B)">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => insertFormat('italic')} title="Cursiva (Ctrl+I)">
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => insertFormat('strikethrough')} title="Tachado (Ctrl+U)">
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-4 bg-[var(--text-secondary)]/30 mx-1" />

          <ToolbarButton onClick={() => insertFormat('code')} title="Código en línea">
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => insertFormat('quote')} title="Cita">
            <Quote className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-4 bg-[var(--text-secondary)]/30 mx-1" />

          <ToolbarButton onClick={() => insertFormat('list')} title="Lista">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => insertFormat('orderedlist')} title="Lista numerada">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>

          <div className="w-px h-4 bg-[var(--text-secondary)]/30 mx-1" />

          <ToolbarButton onClick={() => insertFormat('link')} title="Enlace (Ctrl+K)">
            <Link className="h-4 w-4" />
          </ToolbarButton>

          {/* Heading picker */}
          <div className="relative">
            <ToolbarButton
              onClick={() => {
                setShowHeadingPicker(!showHeadingPicker);
                setShowColorPicker(false);
              }}
              title="Encabezado"
              active={showHeadingPicker}
            >
              <Type className="h-4 w-4" />
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </ToolbarButton>
            {showHeadingPicker && (
              <div className="absolute top-full left-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-lg shadow-lg z-50 py-1 min-w-[100px]">
                {['# H1', '## H2', '### H3'].map((heading) => (
                  <button
                    key={heading}
                    type="button"
                    onClick={() => {
                      insertFormat('heading', heading.split(' ')[0]);
                      setShowHeadingPicker(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  >
                    {heading}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Color picker */}
          <div className="relative">
            <ToolbarButton
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowHeadingPicker(false);
              }}
              title="Color de texto"
              active={showColorPicker}
            >
              <Palette className="h-4 w-4" />
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </ToolbarButton>
            {showColorPicker && (
              <div className="absolute top-full right-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-lg shadow-lg z-50 p-2 min-w-[120px]">
                <div className="grid grid-cols-4 gap-1">
                  {COLORS.map((color) => (
                    <button
                      key={color.code}
                      type="button"
                      onClick={() => {
                        insertFormat('color', color.code);
                        setShowColorPicker(false);
                      }}
                      title={color.name}
                      className={`w-6 h-6 rounded ${color.bg} hover:ring-2 ring-offset-1 ring-[var(--accent-primary)] transition-shadow`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      }
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className="flex-1 resize-none px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] bg-transparent focus-visible:outline-0 min-h-[60px]"
        aria-label="Escribir mensaje"
        autoComplete="off"
      />


    </div>
  );
};

export default RichTextEditor;
