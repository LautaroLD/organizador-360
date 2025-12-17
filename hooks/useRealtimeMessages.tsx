'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

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

        // Subscribe to INSERT events on the messages table
        const channel = supabase
            .channel(realtimeChannelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `channel_id=eq.${channelId}`,
                },
                async (payload) => {
                    const { data: newMessage, error } = await supabase
                        .from('messages')
                        .select(`
              *,
              user:users(name, email, id)
            `)
                        .eq('id', payload.new.id)
                        .single();

                    if (error) {
                        return;
                    }

                    if (newMessage) {
                        queryClient.setQueryData(['messages', channelId], (oldData: any) => {
                            const currentMessages = Array.isArray(oldData) ? oldData : [];
                            const exists = currentMessages.some((msg: any) => msg.id === newMessage.id);
                            if (exists) {
                                return currentMessages;
                            }
                            return [...currentMessages, newMessage];
                        });
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [channelId, enabled, queryClient]);

    return {
        // Could expose additional state here if needed
        isSubscribed: !!channelRef.current,
    };
}
