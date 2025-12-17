'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Plus, X } from 'lucide-react';
import type { MemberTagsModalProps } from '@/models';

export const MemberTagsModal: React.FC<MemberTagsModalProps> = ({
  member,
  projectTags,
  onClose,
  onAssignTag,
  onRemoveTag,
}) => {
  if (!member) return null;
  const memberTags = member.tags?.map(mt => mt.tag) || [];
  const availableTags = projectTags.filter(
    tag => !memberTags.some(mt => mt.id === tag.id)
  );

  return (
    <Modal
      isOpen={!!member}
      onClose={onClose}
      title={`Tags de ${member.user.name}`}
    >
      <div className='space-y-4'>
        <div className='bg-[var(--bg-primary)] p-3 rounded-lg'>
          <p className='text-sm text-[var(--text-secondary)]'>
            Asigna tags para identificar roles, habilidades o responsabilidades
          </p>
        </div>

        {/* Current Tags */}
        {memberTags.length > 0 && (
          <div>
            <p className='text-sm font-medium text-[var(--text-primary)] mb-2'>
              Tags Actuales:
            </p>
            <div className='flex flex-wrap gap-2'>
              {memberTags.map((tag) => (
                <span
                  key={tag.id}
                  className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white'
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.label}
                  <button
                    onClick={() => onRemoveTag(member.id, tag.id)}
                    className='hover:bg-white/20 rounded-full p-0.5 transition-colors'
                  >
                    <X className='h-3 w-3' />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Available Tags */}
        <div>
          <p className='text-sm font-medium text-[var(--text-primary)] mb-2'>
            Tags Disponibles:
          </p>
          {availableTags.length > 0 ? (
            <div className='flex flex-wrap gap-2'>
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => onAssignTag(member.id, tag.id)}
                  className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white hover:opacity-80 transition-opacity'
                  style={{ backgroundColor: tag.color }}
                >
                  <Plus className='h-3 w-3' />
                  {tag.label}
                </button>
              ))}
            </div>
          ) : (
            <p className='text-sm text-[var(--text-secondary)]'>
              {projectTags.length === 0
                ? 'No hay tags disponibles. Crea tags en "Gestionar Tags"'
                : 'Todos los tags están asignados a este miembro'}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
