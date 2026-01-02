'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeProjectMessagesOptions {
    projectId: string | null | undefined;
    enabled?: boolean;
}

/**
 * Hook to subscribe to realtime message updates for ALL channels in a project
 * This allows users to receive messages even when not viewing the chat
 * Automatically updates React Query cache when new messages arrive
 */
export function useRealtimeProjectMessages({ projectId, enabled = true }: UseRealtimeProjectMessagesOptions) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const channelsRef = useRef<RealtimeChannel[]>([]);
    const channelIdsRef = useRef<string[]>([]);

    useEffect(() => {
        // Don't subscribe if disabled or no project selected
        if (!enabled || !projectId) {
            return;
        }

        const setupSubscriptions = async () => {
            // Cleanup any existing subscriptions first
            if (channelsRef.current.length > 0) {
                channelsRef.current.forEach(channel => {
                    supabase.removeChannel(channel);
                });
                channelsRef.current = [];
                channelIdsRef.current = [];
            }

            // Fetch all channels for this project
            const { data: channels, error } = await supabase
                .from('channels')
                .select('id, name')
                .eq('project_id', projectId);

            if (error) {
                console.error('Error fetching channels for project:', error);
                return;
            }

            if (!channels || channels.length === 0) {
                return;
            }

            // Subscribe to each channel
            channels.forEach(channel => {
                const realtimeChannelName = `project-messages:${channel.id}`;

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
                                // Fetch replied message if exists
                                let repliedMessage = null;
                                if (newMessage.reply_to) {
                                    const { data: repliedMsg } = await supabase
                                        .from('messages')
                                        .select(`
                                            id,
                                            content,
                                            channel_id,
                                            user:users(name)
                                        `)
                                        .eq('id', newMessage.reply_to)
                                        .single();
                                    repliedMessage = repliedMsg || null;
                                }

                                const messageWithReply = {
                                    ...newMessage,
                                    replied_message: repliedMessage
                                };

                                // Update the messages cache for this specific channel
                                queryClient.setQueryData(['messages', channel.id], (oldData: unknown) => {
                                    // Ensure oldData is always treated as an array
                                    const currentMessages = Array.isArray(oldData) ? oldData : [];

                                    // Check if message already exists to avoid duplicates
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const exists = currentMessages.some((msg: any) => msg.id === messageWithReply.id);
                                    if (exists) {
                                        return currentMessages;
                                    }

                                    // Create new array with message appended
                                    const updatedMessages = [...currentMessages, messageWithReply];
                                    return updatedMessages;
                                });
                            }
                        }
                    )
                    .subscribe(() => { });

                channelsRef.current.push(realtimeChannel);
                channelIdsRef.current.push(channel.id);
            });
        };

        setupSubscriptions();

        // Cleanup: unsubscribe when component unmounts or projectId changes
        return () => {
            channelsRef.current.forEach(channel => {
                supabase.removeChannel(channel);
            });
            channelsRef.current = [];
            channelIdsRef.current = [];
        };
    }, [projectId, enabled, queryClient]);

    return null;
}
