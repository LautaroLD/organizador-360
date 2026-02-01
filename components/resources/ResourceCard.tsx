'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { FileText, Link2, ExternalLink, Trash2, ImageIcon, Video, File, Sparkles, Lock } from 'lucide-react';
import type { Resource, ResourceCardProps } from '@/models';
import { formatBytes } from '@/lib/subscriptionUtils';

const getFileCategory = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'].includes(ext)) {
    return 'images';
  }

  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext)) {
    return 'videos';
  }

  if (
    ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(ext)
  ) {
    return 'documents';
  }

  return 'others';
};

const getResourceIcon = (resource: Resource) => {
  if (resource.type === 'link') {
    return <Link2 className='h-8 w-8 text-[var(--accent-success)]' />;
  }

  const category = getFileCategory(resource.title);
  switch (category) {
    case 'images':
      return <ImageIcon className='h-8 w-8 text-purple-500' />;
    case 'videos':
      return <Video className='h-8 w-8 text-red-500' />;
    case 'documents':
      return <FileText className='h-8 w-8 text-[var(--accent-primary)]' />;
    default:
      return <File className='h-8 w-8 text-[var(--text-secondary)]' />;
  }
};

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource, onDelete, onAnalyze, isPremium = false, selected, onSelect, selectionMode }) => {
  return (
    <Card
      className={`hover:shadow-lg transition-all hover:scale-[1.02] bg-[var(--bg-secondary)] border ${selected ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20' : 'border-[var(--text-secondary)]/20'}`}
      onClick={() => selectionMode && onSelect && onSelect(resource, !selected)}
    >
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            {selectionMode && (
              <div className="relative flex items-center" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => onSelect && onSelect(resource, e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                />
              </div>
            )}
            <div className='bg-[var(--bg-primary)] p-2 rounded-lg'>
              {getResourceIcon(resource)}
            </div>
          </div>
          {!selectionMode && (
            <div className="flex items-center gap-1">
              {resource.type === 'file' && onAnalyze && (
                <div className="relative group">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isPremium) {
                        onAnalyze(resource);
                      }
                    }}
                    disabled={!isPremium}
                    className={`p-1.5 rounded-lg transition-colors ${isPremium
                      ? 'hover:bg-indigo-100 dark:hover:bg-indigo-900/20 text-indigo-500'
                      : 'text-gray-400 cursor-not-allowed'
                      }`}
                    title={!isPremium ? 'Función disponible solo en Plan Pro o Enterprise' : 'Analizar con IA'}
                  >
                    {isPremium ? <Sparkles className='h-4 w-4' /> : <Lock className='h-4 w-4' />}
                  </button>
                  {!isPremium && (
                    <div className="absolute hidden group-hover:block z-10 w-48 p-2 mt-1 right-0 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md shadow-lg text-xs text-[var(--text-secondary)]">
                      <p>Función disponible solo en Plan Pro o Enterprise</p>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('¿Eliminar este recurso?')) {
                    onDelete(resource);
                  }
                }}
                className='p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 transition-colors'
              >
                <Trash2 className='h-4 w-4' />
              </button>
            </div>
          )}
        </div>
        <div className='mt-3'>
          <CardTitle className='text-base truncate'>{resource.title}</CardTitle>
          <CardDescription className='text-xs mt-1'>
            Subido por{' '}
            <span className='font-medium'>{resource.uploader?.name || 'Usuario'}</span>
          </CardDescription>
          <CardDescription className='text-xs flex justify-between items-center'>
            <span>
              {new Date(resource.created_at).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            {resource.size && resource.size > 0 && (
              <span className='font-medium text-[var(--text-primary)]'>
                {formatBytes(resource.size)}
              </span>
            )}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <a
          href={resource.url}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-1 text-sm font-medium text-[var(--accent-primary)] hover:underline'
          onClick={(e) => selectionMode && e.preventDefault()}
        >
          {resource.type === 'link' ? 'Visitar Link' : 'Descargar'}
          <ExternalLink className='h-3.5 w-3.5' />
        </a>
      </CardContent>
    </Card>
  );
};
