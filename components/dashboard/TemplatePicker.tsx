'use client';

import clsx from 'clsx';
import { LayoutTemplate } from 'lucide-react';
import type { ProjectTemplate, ProjectTemplateId } from '@/lib/projectTemplates';
import {
  getTemplatePreviewStats,
  listProjectTemplates,
} from '@/lib/projectTemplates';

type TemplatePickerProps = {
  selectedTemplateId: ProjectTemplateId | null;
  onSelect: (templateId: ProjectTemplateId | null) => void;
  /** When false, only "En blanco" stays selectable */
  canUseTemplates?: boolean;
  showBlankOption?: boolean;
  /** Upgrade link target when templates are locked */
  upgradeHref?: string;
  className?: string;
};

function PreviewPanel({ template }: { template: ProjectTemplate }) {
  const stats = getTemplatePreviewStats(template);

  return (
    <div className='rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 p-3 space-y-2'>
      <p className='text-xs font-medium text-[var(--text-primary)]'>
        Incluye al aplicar
      </p>
      <div className='flex flex-wrap gap-1.5'>
        <span className='rounded-md bg-[var(--bg-primary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]'>
          {stats.channels} canales
        </span>
        <span className='rounded-md bg-[var(--bg-primary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]'>
          {stats.phases} fases
        </span>
        <span className='rounded-md bg-[var(--bg-primary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]'>
          {stats.tasks} tareas
        </span>
        <span className='rounded-md bg-[var(--bg-primary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]'>
          {stats.tags} tags
        </span>
        <span className='rounded-md bg-[var(--bg-primary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]'>
          onboarding {stats.onboardingDays} días
        </span>
      </div>
      <div className='flex flex-wrap gap-1'>
        {template.channels.map((channel) => (
          <span
            key={channel.name}
            className='rounded-full border border-[var(--text-secondary)]/20 px-2 py-0.5 text-[10px] text-[var(--text-secondary)]'
          >
            #{channel.name}
          </span>
        ))}
      </div>
      <p className='text-[11px] text-[var(--text-secondary)]'>
        Roadmap:{' '}
        {template.phases.map((phase) => phase.name).join(' → ')}
      </p>
    </div>
  );
}

export function TemplatePicker({
  selectedTemplateId,
  onSelect,
  canUseTemplates = true,
  showBlankOption = true,
  upgradeHref = '/settings/subscription',
  className,
}: TemplatePickerProps) {
  const templates = listProjectTemplates();
  const selectedTemplate = selectedTemplateId
    ? templates.find((t) => t.id === selectedTemplateId) ?? null
    : null;

  return (
    <div className={clsx('space-y-3', className)}>
      <div className='flex items-center justify-between gap-2'>
        <label className='block text-sm font-medium text-[var(--text-primary)]'>
          <span className='inline-flex items-center gap-1.5'>
            <LayoutTemplate className='h-4 w-4 text-[var(--accent-primary)]' />
            Plantilla de equipo
          </span>
        </label>
        {!canUseTemplates && (
          <a
            href={upgradeHref}
            className='text-xs font-medium text-[var(--accent-primary)] underline'
          >
            Plantillas en PRO
          </a>
        )}
      </div>
      <p className='text-xs text-[var(--text-secondary)]'>
        Canales, roadmap, tags, tareas iniciales y onboarding para nuevos miembros.
      </p>

      <div
        className={clsx(
          'grid gap-2',
          showBlankOption ? 'sm:grid-cols-2' : 'sm:grid-cols-3',
        )}
      >
        {showBlankOption && (
          <button
            type='button'
            onClick={() => onSelect(null)}
            className={clsx(
              'rounded-xl border p-3 text-left transition-colors',
              !selectedTemplateId
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                : 'border-[var(--text-secondary)]/20 hover:border-[var(--accent-primary)]/40',
            )}
          >
            <p className='text-sm font-medium text-[var(--text-primary)]'>En blanco</p>
            <p className='text-xs text-[var(--text-secondary)] mt-1'>
              Solo el canal general, sin seeds.
            </p>
          </button>
        )}

        {templates.map((template) => {
          const locked = !canUseTemplates;
          return (
            <button
              key={template.id}
              type='button'
              disabled={locked}
              onClick={() => onSelect(template.id)}
              className={clsx(
                'rounded-xl border p-3 text-left transition-colors',
                selectedTemplateId === template.id
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                  : 'border-[var(--text-secondary)]/20 hover:border-[var(--accent-primary)]/40',
                locked && 'cursor-not-allowed opacity-60',
              )}
            >
              <div className='flex items-start justify-between gap-2'>
                <p className='text-sm font-medium text-[var(--text-primary)]'>
                  {template.name}
                </p>
                {locked && (
                  <span className='shrink-0 text-[10px] font-medium uppercase tracking-wide text-[var(--accent-primary)]'>
                    PRO
                  </span>
                )}
              </div>
              <p className='text-xs text-[var(--text-secondary)] mt-1 line-clamp-2'>
                {template.description}
              </p>
            </button>
          );
        })}
      </div>

      {selectedTemplate && <PreviewPanel template={selectedTemplate} />}
    </div>
  );
}
