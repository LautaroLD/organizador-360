'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Message {
    id: string;
    content: string;
    channel_id: string;
    reply_to?: string | null;
    user?: {
        name: string;
        email?: string;
        id?: string;
    };
    replied_message?: Message | null;
    [key: string]: unknown;
}

interface UseRealtimeMessagesOptions {
    channelId: string | null | undefined;
    enabled?: boolean;
}

/**
 * Hook to subscribe to realtime message updates for a specific channel
 * Automatically updates React Query cache when new messages arrive
 */
export function useRealtimeMessages({ channelId, enabled = true }: UseRealtimeMessagesOptions) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const channelRef = useRef<RealtimeChannel | null>(null);
    const [isSubscribed, setIsSubscribed] = useState(false);

    useEffect(() => {
        // Don't subscribe if disabled or no channel selected
        if (!enabled || !channelId) {
            return;
        }

        // Cleanup any existing subscription first to prevent duplicates
        if (channelRef.current) {

            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        // Create a unique channel name for this subscription
        const realtimeChannelName = `messages:${channelId}`;

        // Subscribe to ALL events on the messages table
        const channel = supabase
            .channel(realtimeChannelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                    filter: `channel_id=eq.${channelId}`,
                },
                async (payload) => {
                    // Handle INSERT
                    if (payload.eventType === 'INSERT') {
                        const { data: newMessage, error } = await supabase
                            .from('messages')
                            .select(`
                                *,
                                user:users(name, email, id)
                            `)
                            .eq('id', payload.new.id)
                            .single();

                        if (!error && newMessage) {
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

                            queryClient.setQueryData(['messages', channelId], (oldData: Message[] | undefined) => {
                                const currentMessages = Array.isArray(oldData) ? oldData : [];
                                const exists = currentMessages.some((msg: Message) => msg.id === messageWithReply.id);
                                if (exists) return currentMessages;
                                return [...currentMessages, messageWithReply];
                            });
                        }
                    }
                    // Handle UPDATE
                    else if (payload.eventType === 'UPDATE') {
                        queryClient.setQueryData(['messages', channelId], (oldData: Message[] | undefined) => {
                            const currentMessages = Array.isArray(oldData) ? oldData : [];
                            return currentMessages.map((msg: Message) => {
                                if (msg.id === payload.new.id) {
                                    // Merge the new data with existing data (preserving user relation if not returned in payload)
                                    // Note: payload.new only contains the columns, not the relations.
                                    // We keep the existing 'user' object from the old message.
                                    return { ...msg, ...payload.new };
                                }
                                return msg;
                            });
                        });
                    }
                    // Handle DELETE
                    else if (payload.eventType === 'DELETE') {
                        queryClient.setQueryData(['messages', channelId], (oldData: Message[] | undefined) => {
                            const currentMessages = Array.isArray(oldData) ? oldData : [];
                            return currentMessages.filter((msg: Message) => msg.id !== payload.old.id);
                        });
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsSubscribed(true);

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
                setIsSubscribed(false);
            }
        };
    }, [channelId, enabled, queryClient, supabase]);

    return {
        // Could expose additional state here if needed
        isSubscribed,
    };
}
