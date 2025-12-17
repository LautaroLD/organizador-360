'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Crown, Shield, Eye, Code, Users, MoreVertical, Clock, Tag } from 'lucide-react';
import type { MemberCardProps } from '@/models';

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'Owner':
      return <Crown className="h-5 w-5 text-yellow-500" />;
    case 'Admin':
      return <Shield className="h-5 w-5 text-[var(--accent-primary)]" />;
    case 'Developer':
      return <Code className="h-5 w-5 text-[var(--accent-success)]" />;
    case 'Viewer':
      return <Eye className="h-5 w-5 text-[var(--text-secondary)]" />;
    default:
      return <Users className="h-5 w-5" />;
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case 'Owner':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
    case 'Admin':
      return 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/30';
    case 'Developer':
      return 'bg-[var(--accent-success)]/10 text-[var(--accent-success)] border-[var(--accent-success)]/30';
    case 'Viewer':
      return 'bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] border-[var(--text-secondary)]/30';
    default:
      return 'bg-[var(--bg-primary)]';
  }
};

export const MemberCard: React.FC<MemberCardProps> = ({
  member,
  currentUserId,
  canManage,
  onManageClick,
  onManageTags,
}) => {
  const memberTags = member.tags?.map(mt => mt.tag) || [];

  return (
    <Card className='bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20'>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            <div className='bg-[var(--accent-primary)]/10 p-3 rounded-full'>
              {getRoleIcon(member.role)}
            </div>
            <div>
              <CardTitle className='text-base'>{member.user.name || 'Usuario'}</CardTitle>
              <CardDescription className='text-xs'>{member.user.email}</CardDescription>
            </div>
          </div>
          {canManage && member.role !== 'Owner' && member.user_id !== currentUserId && (
            <button
              onClick={() => onManageClick(member)}
              className='p-1 rounded hover:bg-[var(--bg-primary)] transition-colors'
            >
              <MoreVertical className='h-4 w-4 text-[var(--text-secondary)]' />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-xs font-medium ${getRoleColor(member.role)}`}>
            {member.role}
          </div>

          {memberTags.length > 0 && (
            <div className='flex flex-wrap gap-1.5'>
              {memberTags.map((tag) => (
                <span
                  key={tag.id}
                  className='inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white'
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}

          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              className='w-full text-xs'
              onClick={() => onManageTags(member)}
            >
              <Tag className='h-3 w-3 mr-1' />
              Gestionar Tags
            </Button>
          )}

          <div className='flex items-center gap-2 text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--text-secondary)]/10'>
            <Clock className='h-3 w-3' />
            <span>
              Se unió el {new Date(member.joined_at).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
