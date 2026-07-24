'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FolderKanban, MessageSquare, LayoutGrid } from 'lucide-react';

type PreviewTab = {
  id: string;
  label: string;
  icon: React.ReactNode;
  src: string;
  alt: string;
};

const tabs: PreviewTab[] = [
  {
    id: 'kanban',
    label: 'Kanban',
    icon: <FolderKanban className="h-3.5 w-3.5" />,
    src: '/landing/kanban.png',
    alt: 'Tablero Kanban de Veenzo con columnas y tareas',
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    src: '/landing/chat.png',
    alt: 'Chat del proyecto en Veenzo con canales y mensajes',
  },
  {
    id: 'dashboard',
    label: 'Proyectos',
    icon: <LayoutGrid className="h-3.5 w-3.5" />,
    src: '/landing/dashboard.png',
    alt: 'Dashboard de proyectos en Veenzo',
  },
];

export function ProductPreview() {
  const [activeId, setActiveId] = useState(tabs[0].id);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const hasImage = !failed[active.id];

  return (
    <div className="landing-preview relative mx-auto mt-14 max-w-5xl">
      <div
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[var(--accent-primary)]/10 blur-2xl"
        aria-hidden
      />

      <div className="relative mb-4 flex flex-wrap items-center justify-center gap-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)]'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--text-secondary)]/20 hover:border-[var(--accent-primary)]/40 hover:text-[var(--accent-primary)]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] shadow-2xl shadow-[var(--accent-primary)]/10">
        <div className="flex items-center gap-2 border-b border-[var(--text-secondary)]/15 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-secondary)]/35" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-secondary)]/35" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-secondary)]/35" />
          <div className="ml-3 flex-1 rounded-md bg-[var(--bg-primary)] px-3 py-1 text-[11px] text-[var(--text-secondary)]">
            veenzo · {active.label.toLowerCase()}
          </div>
        </div>

        <div className="relative w-full bg-[var(--bg-primary)]">
          {hasImage ? (
            <Image
              key={active.src}
              src={active.src}
              alt={active.alt}
              width={2880}
              height={1352}
              className="h-auto w-full landing-preview-fade"
              sizes="(max-width: 1024px) 100vw, 1024px"
              priority={active.id === 'kanban'}
              onError={() => setFailed((prev) => ({ ...prev, [active.id]: true }))}
            />
          ) : (
            <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Falta la captura de {active.label}
              </p>
              <p className="max-w-sm text-xs text-[var(--text-secondary)]">
                Guardá la imagen en <code className="text-[var(--accent-primary)]">public/landing/{active.id}.png</code>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
