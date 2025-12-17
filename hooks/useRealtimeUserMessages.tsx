'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useNotifications } from '@/hooks/useNotifications';

interface UseRealtimeUserMessagesOptions {
    userId: string | null | undefined;
    enabled?: boolean;
}

/**
 * Hook to subscribe to realtime message updates for ALL channels across ALL user's projects
 * This allows users to receive messages and notifications regardless of which view they're in
 * Automatically updates React Query cache when new messages arrive
 */
export function useRealtimeUserMessages({ userId, enabled = true }: UseRealtimeUserMessagesOptions) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const channelsRef = useRef<RealtimeChannel[]>([]);
    const channelDataRef = useRef<Array<{ id: string; name: string; projectName: string; }>>([]);
    const { notify } = useNotifications();

    useEffect(() => {
        // Don't subscribe if disabled or no user
        if (!enabled || !userId) {
            return;
        }

        const setupSubscriptions = async () => {
            // Cleanup any existing subscriptions first
            if (channelsRef.current.length > 0) {
                channelsRef.current.forEach(channel => {
                    supabase.removeChannel(channel);
                });
                channelsRef.current = [];
                channelDataRef.current = [];
            }

            // Fetch all projects the user is a member of
            const { data: projectMemberships, error: projectError } = await supabase
                .from('project_members')
                .select('project_id, projects(id, name)')
                .eq('user_id', userId);

            if (projectError) {
                console.error('Error fetching user projects:', projectError);
                return;
            }

            if (!projectMemberships || projectMemberships.length === 0) {
                return;
            }

            // Get all project IDs
            const projectIds = projectMemberships
                .map(pm => pm.project_id)
                .filter(Boolean);

            if (projectIds.length === 0) {
                return;
            }

            // Fetch all channels for all user's projects
            const { data: channels, error: channelsError } = await supabase
                .from('channels')
                .select('id, name, project_id, projects(name)')
                .in('project_id', projectIds);

            if (channelsError) {
                console.error('Error fetching channels:', channelsError);
                return;
            }

            if (!channels || channels.length === 0) {
                return;
            }

            // Subscribe to each channel
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            channels.forEach((channel: any) => {
                const projectName = (channel.projects as Record<string, unknown>)?.name as string || 'Unknown Project';
                const realtimeChannelName = `user-messages:${channel.id}`;

                const realtimeChannel = supabase
                    .channel(realtimeChannelName)
                    .on(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'messages',
                            filter: `channel_id=eq.${channel.id}`,
                        },
                        async (payload) => {
                            // Fetch the complete message with user data
                            const { data: newMessage, error: fetchError } = await supabase
                                .from('messages')
                                .select(`
                                    *,
                                    user:users(name, email, id)
                                `)
                                .eq('id', payload.new.id)
                                .single();

                            if (fetchError) {
                                console.error('Error fetching new message:', fetchError);
                                return;
                            }

                            if (newMessage) {
                                // Invalidate the cache to trigger a fresh fetch
                                // This ensures we always get the latest data from the database
                                // instead of relying on potentially stale cached data
                                queryClient.invalidateQueries({
                                    queryKey: ['messages', channel.id],
                                    refetchType: 'active' // Only refetch if the query is currently active
                                });

                                // Show notification if message is from another user
                                if (newMessage.user?.id !== userId) {
                                    notify(
                                        `Nuevo mensaje en #${channel.name}`,
                                        `${newMessage.user?.name || 'Usuario'}: ${newMessage.content}`,
                                        {
                                            playSound: true,
                                            onClick: () => {
                                                window.focus();
                                            },
                                        }
                                    );
                                }
                            }
                        }
                    )
                    .subscribe(() => { });

                channelsRef.current.push(realtimeChannel);
                channelDataRef.current.push({
                    id: channel.id,
                    name: channel.name,
                    projectName,
                });
            });
        };

        setupSubscriptions();

        // Cleanup: unsubscribe when component unmounts or user changes
        return () => {
            channelsRef.current.forEach(channel => {
                supabase.removeChannel(channel);
            });
            channelsRef.current = [];
            channelDataRef.current = [];
        };
    }, [userId, enabled, queryClient, notify]);
}
