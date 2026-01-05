'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Mail, Clock, UserPlus, ChevronRight } from 'lucide-react';

interface PendingInvitation {
  id: string;
  project_id: string;
  role: string;
  token: string;
  created_at: string;
  expires_at: string;
  project?: {
    name?: string;
    description?: string;
  } | null;
  inviter?: {
    name?: string;
    email?: string;
  } | null;
}

export const InvitationsWidget: React.FC = () => {
  const supabase = createClient();
  const { user } = useAuthStore();
  const router = useRouter();

  const { data: invitations, isLoading } = useQuery({
    queryKey: ['pending-invitations', user?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_invitations')
        .select(`
          *,
          project:projects (
            name,
            description
          ),
          inviter:users!inviter_id (
            name,
            email
          )
        `)
        .eq('invitee_email', user?.email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PendingInvitation[];
    },
    enabled: !!user?.email,
  });

  if (isLoading) {
    return null;
  }

  if (!invitations || invitations.length === 0) {
    return null;
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `hace ${diffMins}m`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    return `hace ${diffDays}d`;
  };

  return (
    <div className='mb-6'>
      <Card className='border-[var(--accent-primary)] bg-[var(--bg-secondary)]'>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div className='flex items-center'>
              <div className='bg-[var(--accent-primary)] p-2 rounded-lg mr-3'>
                <Mail className='h-5 w-5 text-white' />
              </div>
              <div>
                <CardTitle className='text-lg'>
                  Invitaciones Pendientes
                </CardTitle>
                <CardDescription>
                  Tienes {invitations.length} {invitations.length === 1 ? 'invitación' : 'invitaciones'} para revisar
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {invitations.map((invitation) => {
              const timeAgo = formatTimeAgo(invitation.created_at);

              const daysUntilExpiration = Math.ceil(
                (new Date(invitation.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );

              return (
                <div
                  key={invitation.id}
                  className='bg-[var(--bg-primary)] rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow'
                >
                  <div className='flex items-start justify-between'>
                    <div className='flex-1'>
                      <div className='flex items-center mb-2'>
                        <UserPlus className='h-4 w-4 text-[var(--accent-primary)] mr-2' />
                        <h4 className='font-semibold text-[var(--text-primary)]'>
                          {invitation.project?.name ?? 'Proyecto sin nombre'}
                        </h4>
                      </div>

                      <p className='text-sm  mb-2'>
                        {(invitation.inviter?.name ?? invitation.inviter?.email ?? 'Usuario desconocido')} te invitó como <strong>{invitation.role}</strong>
                      </p>

                      <div className='flex items-center gap-3 text-xs text-[var(--text-secondary)]'>
                        <span className='flex items-center'>
                          <Clock className='h-3 w-3 mr-1' />
                          {timeAgo}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full ${daysUntilExpiration <= 2
                          ? 'border-[var(--accent-danger)] border text-[var(--accent-danger)] font-semibold'
                          : 'border-[var(--accent-warning)] border text-[var(--accent-warning)] font-semibold'
                          }`}>
                          Expira en {daysUntilExpiration}d
                        </span>
                      </div>
                    </div>

                    <Button
                      size='sm'
                      onClick={() => router.push(`/invitations/${invitation.token}`)}
                      className='ml-4'
                    >
                      Ver
                      <ChevronRight className='h-4 w-4 ml-1' />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
