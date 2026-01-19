'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Loader2, Sparkles, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AnalyzeResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  summary: string | null;
  resourceTitle: string;
}

export const AnalyzeResourceModal: React.FC<AnalyzeResourceModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  summary,
  resourceTitle,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Análisis IA de Documento" size="lg">
      <div className="p-4">
        {/* Subheader / Context */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Análisis generado para: <span className="font-semibold text-[var(--accent-primary)]">{resourceTitle}</span>
          </p>
        </div>

        {/* Content Area */}
        <div className="min-h-[200px] max-h-[60vh] overflow-y-auto p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--text-secondary)]/10">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-4 text-[var(--text-secondary)]">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
              <p className="text-sm">Leyendo y analizando documento...</p>
            </div>
          ) : summary ? (
            <div className="prose dark:prose-invert max-w-none text-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  ul: ({ node, ...props }) => <ul className="list-disc pl-4 my-2" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal pl-4 my-2" {...props} />,
                  li: ({ node, ...props }) => <li className="my-1" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />
                }}
              >
                {summary}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]/50">
              <FileText className="h-12 w-12 mb-2" />
              <p>No se ha generado ningún resumen.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end mt-4">
          <Button onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
};
