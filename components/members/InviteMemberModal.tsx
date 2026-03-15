'use client';

import React, { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'react-toastify';
import {
  Mail,
  Clock,
  Link2,
  Copy,
  Check,
  Shield,
  Eye,
  Pencil,
  FolderKanban,
  AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import type { InviteFormData, InviteMemberModalProps } from '@/models';

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  currentMemberCount,
  memberLimit,
  isPremium,
  planTier,
  onSuccess,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm<InviteFormData>({
    defaultValues: {
      role: 'Collaborator',
      inviteType: 'email',
    },
  });

  const inviteType = useWatch({ control, name: 'inviteType' });
  const selectedRole = useWatch({ control, name: 'role' });
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleClose = () => {
    reset();
    setGeneratedLink(null);
    setLinkCopied(false);
    onClose();
  };

  const inviteUserMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      if (!projectId) throw new Error('Proyecto no seleccionado');

      const resolvedInviteType = data.inviteType ?? 'email';
      const resolvedRole = data.role ?? 'Collaborator';

      const response = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          inviteeEmail: resolvedInviteType === 'email' ? data.email : null,
          role: resolvedRole,
          inviteType: resolvedInviteType,
        }),
      });

      const result = await response.json().catch(() => null) as {
        success?: boolean;
        error?: string;
        message?: string;
        invitationUrl?: string;
        isNewUser?: boolean;
      };

      if (!response.ok) {
        throw new Error(result?.error || result?.message || `Error al enviar invitación (${response.status})`);
      }
      if (!result?.success) {
        throw new Error(result?.error || 'Error al enviar invitación');
      }
      return result;
    },
    onSuccess: (data, variables) => {
      onSuccess?.();
      if (variables.inviteType === 'link') {
        setGeneratedLink(data.invitationUrl ?? null);
        toast.success('Enlace de invitación generado');
      } else {
        if (data.isNewUser) {
          toast.success('¡Invitación enviada! El usuario deberá crear una cuenta primero.', { autoClose: 5000 });
        } else {
          toast.success('¡Invitación enviada! El usuario recibirá un email para aceptarla.');
        }
        handleClose();
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al enviar invitación');
    },
  });

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setLinkCopied(true);
      toast.success('Enlace copiado al portapapeles');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  };

  const isNearMemberLimit =
    currentMemberCount !== undefined &&
    memberLimit !== undefined &&
    currentMemberCount >= memberLimit - 2;

  return (
    <Modal isOpen={isOpen} size='xl' onClose={handleClose} title='Invitar Colaborador'>
      <form onSubmit={handleSubmit((data) => inviteUserMutation.mutate(data))} className='space-y-5'>

        {/* Project context banner */}
        {projectName && (
          <div className='flex items-center gap-3 rounded-xl bg-[var(--accent-primary)]/8 border border-[var(--accent-primary)]/20 px-4 py-3'>
            <div className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)]/15'>
              <FolderKanban className='h-4 w-4 text-[var(--accent-primary)]' />
            </div>
            <div className='min-w-0'>
              <p className='text-xs text-[var(--text-secondary)]'>Invitando a</p>
              <p className='text-sm font-semibold text-[var(--text-primary)] truncate'>{projectName}</p>
            </div>
          </div>
        )}

        {/* Member limit warning */}
        {currentMemberCount !== undefined && memberLimit !== undefined && (
          <div className={clsx(
            'flex items-start gap-3 rounded-xl border px-4 py-3',
            isNearMemberLimit
              ? 'border-orange-500/30 bg-orange-500/5'
              : 'border-[var(--text-secondary)]/15 bg-[var(--bg-secondary)]'
          )}>
            <AlertTriangle className={clsx('h-4 w-4 flex-shrink-0 mt-0.5', isNearMemberLimit ? 'text-orange-500' : 'text-[var(--text-secondary)]')} />
            <div>
              <p className='text-xs font-medium text-[var(--text-primary)]'>
                Plan {planTier?.toUpperCase() ?? (isPremium ? 'PRO' : 'FREE')}
                <span className='ml-2 font-normal text-[var(--text-secondary)]'>
                  · {currentMemberCount} / {memberLimit} miembros
                </span>
              </p>
              {isNearMemberLimit && (
                <p className='text-xs text-orange-500 mt-0.5'>Cerca del límite. Actualiza tu plan para agregar más miembros.</p>
              )}
            </div>
          </div>
        )}

        {/* Invite method toggle */}
        <div>
          <p className='text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2'>Método de invitación</p>
          <div className='grid grid-cols-2 gap-2'>
            {[
              { value: 'email', label: 'Por Email', icon: Mail, desc: 'Envía un correo directo' },
              { value: 'link', label: 'Por Enlace', icon: Link2, desc: 'Genera un link compartible' },
            ].map(({ value, label, icon: Icon, desc }) => (
              <label
                key={value}
                className={clsx(
                  'relative flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3.5 transition-all duration-150',
                  inviteType === value
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/8'
                    : 'border-[var(--text-secondary)]/15 bg-[var(--bg-secondary)] hover:border-[var(--text-secondary)]/30'
                )}
              >
                <input type='radio' value={value} {...register('inviteType')} className='sr-only' />
                <div className='flex items-center gap-2'>
                  <Icon className={clsx('h-4 w-4', inviteType === value ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]')} />
                  <span className={clsx('text-sm font-medium', inviteType === value ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]')}>{label}</span>
                  {inviteType === value && (
                    <span className='ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent-primary)]'>
                      <Check className='h-2.5 w-2.5 text-white' />
                    </span>
                  )}
                </div>
                <p className='text-xs text-[var(--text-secondary)] pl-6'>{desc}</p>
              </label>
            ))}
          </div>
        </div>

        {/* Email input */}
        {inviteType === 'email' && (
          <Input
            label='Email del colaborador'
            type='email'
            {...register('email', {
              validate: (value) => {
                if (inviteType !== 'email') return true;
                if (!value) return 'El email es requerido';
                return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)
                  ? true
                  : 'Email inválido';
              },
            })}
            error={errors.email?.message}
            placeholder='colaborador@ejemplo.com'
            icon={<Mail className='h-4 w-4' />}
          />
        )}

        {/* Generated link */}
        {inviteType === 'link' && generatedLink && (
          <div className='rounded-xl border border-[var(--accent-primary)]/25 bg-[var(--accent-primary)]/5 p-4'>
            <p className='text-xs font-medium text-[var(--text-secondary)] mb-2'>Enlace generado</p>
            <div className='flex gap-2'>
              <div className='flex-1 min-w-0 flex items-center gap-2 rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] px-3 py-2'>
                <Link2 className='h-3.5 w-3.5 text-[var(--text-secondary)] flex-shrink-0' />
                <span className='text-xs text-[var(--text-primary)] truncate font-mono'>{generatedLink}</span>
              </div>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={handleCopyLink}
                className='flex-shrink-0 gap-1.5 transition-all'
              >
                {linkCopied
                  ? <><Check className='h-3.5 w-3.5 text-emerald-500' />Copiado</>
                  : <><Copy className='h-3.5 w-3.5' />Copiar</>
                }
              </Button>
            </div>
          </div>
        )}

        {/* Role selector */}
        <div>
          <p className='text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2'>Rol del colaborador</p>
          <div className='grid grid-cols-3 gap-2'>
            {[
              { value: 'Admin', icon: Shield, color: 'blue', label: 'Admin', desc: 'Gestiona el proyecto e invita usuarios' },
              { value: 'Collaborator', icon: Pencil, color: 'emerald', label: 'Colaborador', desc: 'Chat, recursos y eventos' },
              { value: 'Viewer', icon: Eye, color: 'slate', label: 'Viewer', desc: 'Solo lectura' },
            ].map(({ value, icon: Icon, color, label, desc }) => {
              const isSelected = selectedRole === value;
              const colorMap: Record<string, string> = {
                blue: isSelected ? 'border-blue-500 bg-blue-500/8' : 'border-[var(--text-secondary)]/15 bg-[var(--bg-secondary)] hover:border-blue-500/30',
                emerald: isSelected ? 'border-emerald-500 bg-emerald-500/8' : 'border-[var(--text-secondary)]/15 bg-[var(--bg-secondary)] hover:border-emerald-500/30',
                slate: isSelected ? 'border-[var(--text-secondary)]/50 bg-[var(--text-secondary)]/8' : 'border-[var(--text-secondary)]/15 bg-[var(--bg-secondary)] hover:border-[var(--text-secondary)]/30',
              };
              const iconColorMap: Record<string, string> = {
                blue: 'text-blue-500',
                emerald: 'text-emerald-500',
                slate: 'text-[var(--text-secondary)]',
              };
              return (
                <label key={value} className={clsx('relative flex cursor-pointer flex-col gap-1.5 rounded-xl border-2 p-3 transition-all duration-150', colorMap[color])}>
                  <input type='radio' value={value} {...register('role')} className='sr-only' />
                  <div className='flex items-center justify-between'>
                    <Icon className={clsx('h-4 w-4', iconColorMap[color])} />
                    {isSelected && (
                      <span className={clsx('h-2 w-2 rounded-full', {
                        'bg-blue-500': color === 'blue',
                        'bg-emerald-500': color === 'emerald',
                        'bg-[var(--text-secondary)]': color === 'slate',
                      })} />
                    )}
                  </div>
                  <p className='text-xs font-semibold text-[var(--text-primary)]'>{label}</p>
                  <p className='text-[10px] text-[var(--text-secondary)] leading-tight'>{desc}</p>
                </label>
              );
            })}
          </div>
        </div>

        {/* Expiry notice */}
        <div className='flex items-center gap-2.5 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3.5 py-2.5'>
          <Clock className='h-4 w-4 flex-shrink-0 text-orange-500' />
          <p className='text-xs text-[var(--text-secondary)]'>
            La invitación <span className='font-medium text-[var(--text-primary)]'>expirará en 7 días</span> si no es aceptada.
          </p>
        </div>

        <div className='flex justify-end gap-2 pt-1'>
          <Button type='button' variant='secondary' onClick={handleClose}>
            Cancelar
          </Button>
          <Button type='submit' disabled={inviteUserMutation.isPending} className='gap-2'>
            {inviteUserMutation.isPending ? (
              <><div className='h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white' />Enviando...</>
            ) : inviteType === 'link' ? (
              <><Link2 className='h-4 w-4' />Generar Enlace</>
            ) : (
              <><Mail className='h-4 w-4' />Enviar Invitación</>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
