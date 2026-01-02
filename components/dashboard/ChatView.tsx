'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { ChevronsLeft, Hash, Plus, Send, Trash2, MessageSquare, Bell, BellOff, Loader2, Pin, PinOff, Edit2, MoreVertical, X, Check, Reply } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import clsx from 'clsx';
import { Channel } from '@/models';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationStore } from '@/store/notificationStore';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';

interface MessageFormData {
  content: string;
}

interface ChannelFormData {
  name: string;
  description: string;
}

export const ChatView: React.FC = () => {
  const supabase = createClient();
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNotificationLoading, setIsNotificationLoading] = useState(false);
  const { user } = useAuthStore();
  const { currentProject } = useProjectStore();
  const { notificationsEnabled, pushEnabled, setNotificationsEnabled, setPushEnabled } = useNotificationStore();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { permission, requestPermission, isSupported } = useNotifications();
  const { subscribe: subscribePush, unsubscribe: unsubscribePush, isSupported: isPushSupported } = usePushNotifications();

  const [activeTab, setActiveTab] = useState<'chat' | 'pinned'>('chat');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null); const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null); const messageRefs = useRef<{ [key: string]: HTMLDivElement | null; }>({});

  // Subscribe to realtime messages
  useRealtimeMessages({
    channelId: selectedChannel?.id,
    enabled: !!selectedChannel?.id,
  });

  const { register: registerMessage, handleSubmit: handleSubmitMessage, reset: resetMessage } =
    useForm<MessageFormData>();
  const { register: registerChannel, handleSubmit: handleSubmitChannel, reset: resetChannel, formState: { errors } } =
    useForm<ChannelFormData>();

  // Fetch channels
  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ['channels', currentProject?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('channels')
        .select('*')
        .eq('project_id', currentProject!.id)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!currentProject?.id,
  });

  // Fetch messages for selected channel
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedChannel?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          user:users(name, email, id)
        `)
        .eq('channel_id', selectedChannel!.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Fetch replied messages separately for messages that have reply_to
      const messagesWithReplies = await Promise.all(
        data.map(async (msg) => {
          if (msg.reply_to) {
            const { data: repliedMsg } = await supabase
              .from('messages')
              .select(`
                id,
                content,
                channel_id,
                user:users(name)
              `)
              .eq('id', msg.reply_to)
              .single();

            return {
              ...msg,
              replied_message: repliedMsg || null
            };
          }
          return {
            ...msg,
            replied_message: null
          };
        })
      );

      return messagesWithReplies;
    },
    enabled: !!selectedChannel?.id,
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Always fetch fresh data when component mounts
    staleTime: 0, // Consider data stale immediately, but realtime will keep it updated
    gcTime: 0, // Don't keep unused data in cache
  });

  // Create channel mutation
  const createChannelMutation = useMutation({
    mutationFn: async (data: ChannelFormData) => {
      const { error } = await supabase
        .from('channels')
        .insert({
          project_id: currentProject!.id,
          name: data.name,
          description: data.description,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Canal creado exitosamente');
      setIsChannelModalOpen(false);
      resetChannel();
    },
    onError: (error) => {
      toast.error(error.message || 'Error al crear canal');
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from('messages')
        .insert({
          channel_id: selectedChannel!.id,
          user_id: user?.id,
          content,
          reply_to: replyingTo?.id || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      // Don't invalidate queries here - the realtime subscription will handle cache updates
      resetMessage();
      setReplyingTo(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Error al enviar mensaje');
    },
  });

  // Delete channel mutation
  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      // Delete messages first
      await supabase.from('messages').delete().eq('channel_id', channelId);

      // Delete channel
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', channelId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Canal eliminado');
      setSelectedChannel(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Error al eliminar canal');
    },
  });

  // Toggle Pin Mutation
  const togglePinMutation = useMutation({
    mutationFn: async ({ messageId }: { messageId: string; }) => {
      const { error } = await supabase
        .rpc('toggle_message_pin', { message_id: messageId });
      if (error) throw error;
    },
    onSuccess: () => {
      // Realtime will handle update
      setOpenMenuMessageId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  // Delete Message Mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted: true })
        .eq('id', messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Mensaje eliminado');
      setOpenMenuMessageId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  // Update Message Mutation
  const updateMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string; }) => {
      const { error } = await supabase
        .from('messages')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingMessageId(null);
      setEditContent('');
      toast.success('Mensaje editado');
    },
    onError: (error) => toast.error(error.message),
  });

  // Filter messages
  const filteredMessages = messages?.filter(msg => {
    if (msg.is_deleted) return false;
    if (activeTab === 'pinned') return msg.is_pinned;
    return true;
  });

  // Auto-select first channel
  useEffect(() => {
    if (channels && channels.length > 0 && !selectedChannel) {

      setSelectedChannel(channels[0]);
    }
  }, [channels, selectedChannel]);

  // Invalidate messages cache when selecting a channel to ensure fresh data
  useEffect(() => {
    if (selectedChannel?.id) {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedChannel.id] });
    }
  }, [selectedChannel?.id, queryClient]);

  // AGGRESSIVE CACHE INVALIDATION: Force refresh when window gains focus or becomes visible
  // This fixes the issue where opening the browser shows stale data from bfcache
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedChannel?.id) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedChannel.id] });
      }
    };

    const handleFocus = () => {
      if (selectedChannel?.id) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedChannel.id] });
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [selectedChannel?.id, queryClient]);

  // Scroll to bottom on new messages
  const lastMessageId = filteredMessages?.[filteredMessages.length - 1]?.id;

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lastMessageId, activeTab]);

  // Handle pending scroll after channel change
  useEffect(() => {
    if (pendingScrollMessageId && messages && !messagesLoading) {
      // Wait a bit for the DOM to update
      setTimeout(() => {
        const messageElement = messageRefs.current[pendingScrollMessageId];
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedMessageId(pendingScrollMessageId);
          setTimeout(() => setHighlightedMessageId(null), 2000);
        }
        setPendingScrollMessageId(null);
      }, 100);
    }
  }, [pendingScrollMessageId, messages, messagesLoading]);

  // Request notification permission when enabled
  useEffect(() => {
    if (notificationsEnabled && permission === 'default') {
      requestPermission();
    }
  }, [notificationsEnabled, permission, requestPermission]);

  // Close sidebar on mobile when channel is selected
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle escape key to close sidebar on mobile
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const onSubmitMessage = (data: MessageFormData) => {
    if (data.content.trim()) {
      sendMessageMutation.mutate(data.content);
    }
  };

  const onSubmitChannel = (data: ChannelFormData) => {
    createChannelMutation.mutate(data);
  };

  const scrollToMessage = async (repliedMessage: any) => {
    if (!repliedMessage) return;

    const messageId = repliedMessage.id;
    const messageChannelId = repliedMessage.channel_id;

    // Check if the message is in a different channel
    if (messageChannelId && messageChannelId !== selectedChannel?.id) {
      // Find the channel
      const targetChannel = channels?.find(ch => ch.id === messageChannelId);
      if (targetChannel) {
        setActiveTab('chat');
        // Switch to that channel
        setSelectedChannel(targetChannel);
        // Set pending scroll to execute after messages load
        setPendingScrollMessageId(messageId);
        // Close sidebar on mobile
        if (window.innerWidth < 768) {
          setIsSidebarOpen(false);
        }
        return;
      }
    }

    // Message is in current channel, scroll immediately
    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
    // Close sidebar on mobile after selecting channel
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--text-secondary)]">Selecciona un proyecto primero</p>
      </div>
    );
  }

  return (
    <div className="flex grow max-h-full overflow-hidden relative">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Channels Sidebar */}
      <aside
        className={clsx(
          "w-64 border-r border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] flex flex-col transition-transform duration-300 ease-in-out z-40",
          "md:relative md:translate-x-0 md:z-0",
          "fixed inset-y-0 left-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Canales de chat"
      >
        <div className="p-4 border-b border-[var(--text-secondary)]/20">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-primary)]">Canales</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsChannelModalOpen(true)}
              aria-label="Crear nuevo canal"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2" aria-label="Lista de canales">
          {channelsLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-[var(--text-secondary)]">Cargando canales...</p>
            </div>
          ) : channels && channels.length > 0 ? (
            channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => handleChannelSelect(channel)}
                className={clsx(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg mb-1 transition-colors",
                  selectedChannel?.id === channel.id
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
                )}
                aria-label={`Canal ${channel.name}`}
                aria-current={selectedChannel?.id === channel.id ? 'page' : undefined}
              >
                <div className="flex items-center min-w-0">
                  <Hash className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{channel.name}</span>
                </div>
                {channel.name !== 'general' && selectedChannel?.id === channel.id && (
                  <Trash2
                    className="h-4 w-4 cursor-pointer hover:bg-white/20 rounded flex-shrink-0 ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('¿Eliminar este canal?')) {
                        deleteChannelMutation.mutate(channel.id);
                      }
                    }}
                    aria-label="Eliminar canal"
                  />
                )}
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Hash className="h-12 w-12 text-[var(--text-secondary)]/50 mb-3" />
              <p className="text-sm text-[var(--text-secondary)] mb-2">No hay canales</p>
              <p className="text-xs text-[var(--text-secondary)]">Crea uno para comenzar</p>
            </div>
          )}
        </nav>
      </aside>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedChannel ? (
          <>
            {/* Channel Header */}
            <header className="flex flex-col border-b border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] flex-shrink-0">
              <div className="p-3 md:p-4 flex items-center gap-2">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={clsx(
                    "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] md:hidden rounded-lg cursor-pointer p-1 transition-transform duration-300",
                    !isSidebarOpen && 'rotate-180'
                  )}
                  aria-label={isSidebarOpen ? 'Cerrar sidebar' : 'Abrir sidebar'}
                >
                  <ChevronsLeft size={24} />
                </button>
                <Hash className="h-5 w-5 text-[var(--text-secondary)] flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-[var(--text-primary)] truncate">
                    {selectedChannel.name}
                  </h2>
                  <p className="text-xs md:text-sm text-[var(--text-secondary)] truncate">
                    {selectedChannel.description || 'Sin descripción'}
                  </p>
                </div>
                {/* Notification Toggle */}
                {isSupported && (
                  <button
                    onClick={async () => {
                      setIsNotificationLoading(true);
                      try {
                        if (!notificationsEnabled && permission === 'default') {
                          await requestPermission();

                          if (Notification.permission === 'granted') {
                            setNotificationsEnabled(true);

                            if (isPushSupported) {
                              try {
                                const pushSuccess = await subscribePush();
                                if (pushSuccess) {
                                  setPushEnabled(true);
                                  toast.success('Notificaciones push activadas');
                                } else {
                                  toast.success('Notificaciones del navegador activadas');
                                }
                              } catch {
                                toast.success('Notificaciones del navegador activadas');
                              }
                            } else {
                              toast.success('Notificaciones activadas');
                            }
                          }
                        } else if (permission === 'granted') {
                          const newState = !notificationsEnabled;
                          setNotificationsEnabled(newState);

                          if (newState && isPushSupported && !pushEnabled) {
                            try {
                              const pushSuccess = await subscribePush();
                              if (pushSuccess) {
                                setPushEnabled(true);
                              }
                            } catch {
                              // Continue with browser notifications only
                            }
                          } else if (!newState && pushEnabled) {
                            try {
                              await unsubscribePush();
                              setPushEnabled(false);
                            } catch {
                              // Continue
                            }
                          }

                          toast.success(newState ? 'Notificaciones activadas' : 'Notificaciones desactivadas');
                        } else if (permission === 'denied') {
                          toast.error('Notificaciones bloqueadas. Habilítalas en la configuración del navegador.');
                        }
                      } finally {
                        setIsNotificationLoading(false);
                      }
                    }}
                    disabled={isNotificationLoading}
                    className={clsx(
                      "p-2 rounded-lg transition-colors flex-shrink-0 relative",
                      notificationsEnabled
                        ? "text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]",
                      isNotificationLoading && "opacity-50 cursor-not-allowed"
                    )}
                    aria-label={notificationsEnabled ? 'Desactivar notificaciones' : 'Activar notificaciones'}
                    title={notificationsEnabled ? (pushEnabled ? 'Notificaciones push activadas' : 'Notificaciones activadas') : 'Activar notificaciones'}
                  >
                    {isNotificationLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : notificationsEnabled ? (
                      <Bell className="h-5 w-5" />
                    ) : (
                      <BellOff className="h-5 w-5" />
                    )}
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex px-4 gap-4">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={clsx(
                    "pb-2 text-sm font-medium border-b-2 transition-colors",
                    activeTab === 'chat'
                      ? "border-[var(--accent-primary)] text-[var(--text-primary)]"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('pinned')}
                  className={clsx(
                    "pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1",
                    activeTab === 'pinned'
                      ? "border-[var(--accent-primary)] text-[var(--text-primary)]"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <Pin className="h-3 w-3" />
                  Destacados
                </button>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 p-3 md:p-4 flex flex-col gap-3 md:gap-4 bg-[var(--bg-primary)] overflow-y-auto">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-[var(--text-secondary)]">Cargando mensajes...</p>
                </div>
              ) : filteredMessages && filteredMessages.length > 0 ? (
                filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    ref={(el) => {
                      messageRefs.current[message.id] = el;
                    }}
                    className={clsx(
                      "group relative flex gap-2 md:gap-3 max-w-[85%] md:max-w-[70%] w-fit transition-colors duration-300",
                      message.user?.id === user?.id ? 'ml-auto flex-row-reverse' : 'flex-row',
                      highlightedMessageId === message.id && 'bg-[var(--accent-primary)]/10 rounded-lg'
                    )}
                    onMouseLeave={() => setOpenMenuMessageId(null)}
                  >
                    {/* Avatar */}
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {message.user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>

                    {/* Message Content */}
                    <div className={clsx(
                      "flex-1 flex flex-col min-w-0",
                      message.user?.id === user?.id ? 'items-end' : 'items-start'
                    )}>
                      <div className="flex items-baseline space-x-2 mb-1">
                        <span className="font-semibold text-sm truncate space-x-2">
                          {message.user?.name || 'Usuario'}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                          {formatTime(message.created_at)}
                        </span>
                        {message.is_pinned && (
                          <Pin className="h-3 w-3 text-[var(--accent-primary)]" />
                        )}
                      </div>

                      <div className={clsx(
                        "relative py-2 md:py-3 px-2 md:px-3 rounded-xl w-full",
                        "bg-[var(--bg-secondary)] border border-[var(--accent-primary)]/40"
                      )}>
                        {message.replied_message && (
                          <button
                            onClick={() => scrollToMessage(message.replied_message)}
                            className="mb-2 border-l-2 border-[var(--accent-primary)] p-2 bg-[var(--bg-primary)]/50 rounded hover:bg-[var(--bg-primary)]/70 transition-colors w-full text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)] mb-1">
                              <Reply className="h-3 w-3" />
                              <span className="font-semibold">{message.replied_message.user?.name}</span>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                              {message.replied_message.content}
                            </p>
                          </button>
                        )}
                        {editingMessageId === message.id ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full bg-[var(--bg-primary)] border border-[var(--text-secondary)]/30 rounded p-2 text-sm resize-none focus:outline-none focus:border-[var(--accent-primary)]"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingMessageId(null)}
                                className="p-1 hover:bg-[var(--bg-primary)] rounded text-[var(--text-secondary)]"
                              >
                                <X className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (editContent.trim()) {
                                    updateMessageMutation.mutate({ messageId: message.id, content: editContent });
                                  }
                                }}
                                className="p-1 hover:bg-[var(--bg-primary)] rounded text-[var(--accent-primary)]"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-[var(--text-primary)] break-words whitespace-pre-wrap">
                            {message.content}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions Menu */}
                    {!editingMessageId && (
                      <div className={clsx(
                        "flex items-start pt-6 transition-opacity",
                        message.user?.id === user?.id ? 'flex-row-reverse' : 'flex-row',
                        openMenuMessageId === message.id ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                      )}>
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuMessageId(openMenuMessageId === message.id ? null : message.id)}
                            className="p-1 hover:bg-[var(--bg-secondary)] rounded text-[var(--text-secondary)]"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {openMenuMessageId === message.id && (
                            <div className={clsx(
                              "absolute top-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--text-secondary)]/20 rounded-lg shadow-lg z-50 min-w-[120px] min-h-auto py-1",
                              message.user?.id === user?.id ? '-right-10' : '-left-10'
                            )}>
                              <button
                                onClick={() => {
                                  setReplyingTo(message);
                                  setOpenMenuMessageId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-primary)] flex items-center gap-2"
                              >
                                <Reply className="h-3 w-3" />
                                Responder
                              </button>
                              <button
                                onClick={() => togglePinMutation.mutate({ messageId: message.id })}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-primary)] flex items-center gap-2"
                              >
                                {message.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                                {message.is_pinned ? 'Desfijar' : 'Fijar'}
                              </button>

                              {message.user?.id === user?.id && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingMessageId(message.id);
                                      setEditContent(message.content);
                                      setOpenMenuMessageId(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-primary)] flex items-center gap-2"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm('¿Eliminar mensaje?')) {
                                        deleteMessageMutation.mutate(message.id);
                                      }
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-primary)] text-red-500 flex items-center gap-2"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Eliminar
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <MessageSquare className="h-12 w-12 md:h-16 md:w-16 text-[var(--text-secondary)]/50 mb-3" />
                  <p className="text-sm md:text-base text-[var(--text-secondary)] mb-2">
                    {activeTab === 'pinned' ? 'No hay mensajes destacados' : 'No hay mensajes aún'}
                  </p>
                  <p className="text-xs md:text-sm text-[var(--text-secondary)]">
                    {activeTab === 'pinned'
                      ? 'Destaca mensajes importantes para verlos aquí'
                      : `Sé el primero en enviar un mensaje en #${selectedChannel.name}`}
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-3 md:p-4 border-t border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] flex-shrink-0">
              {replyingTo && (
                <div className="mb-2 p-2 bg-[var(--bg-primary)] rounded-lg border border-[var(--accent-primary)]/40 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)] mb-1">
                      <Reply className="h-3 w-3" />
                      <span className="font-semibold">Respondiendo a {replyingTo.user?.name}</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] truncate">{replyingTo.content}</p>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="ml-2 p-1 hover:bg-[var(--bg-secondary)] rounded text-[var(--text-secondary)]"
                    aria-label="Cancelar respuesta"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <form onSubmit={handleSubmitMessage(onSubmitMessage)} className="flex space-x-2">
                <input
                  {...registerMessage('content')}
                  placeholder={`Mensaje en #${selectedChannel.name}`}
                  className="flex-1 h-9 md:h-10 rounded-lg border border-[var(--text-secondary)]/30 bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-shadow"
                  aria-label="Escribir mensaje"
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  disabled={sendMessageMutation.isPending}
                  aria-label="Enviar mensaje"
                  className="flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Hash className="h-12 w-12 md:h-16 md:w-16 text-[var(--text-secondary)]/50 mb-3" />
            <p className="text-sm md:text-base text-[var(--text-secondary)] mb-2">Selecciona un canal</p>
            <p className="text-xs md:text-sm text-[var(--text-secondary)]">Elige un canal de la lista para comenzar a chatear</p>
          </div>
        )}
      </div>

      {/* Create Channel Modal */}
      <Modal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        title="Crear Nuevo Canal"
      >
        <form onSubmit={handleSubmitChannel(onSubmitChannel)} className="space-y-4">
          <Input
            label="Nombre del Canal"
            {...registerChannel('name', {
              required: 'El nombre es requerido',
              pattern: {
                value: /^[a-z0-9-]+$/,
                message: 'Solo letras minúsculas, números y guiones',
              },
            })}
            error={errors.name?.message}
            placeholder="nombre-del-canal"
          />
          <Input
            label="Descripción"
            {...registerChannel('description')}
            placeholder="Descripción del canal"
          />
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsChannelModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createChannelMutation.isPending}>
              {createChannelMutation.isPending ? 'Creando...' : 'Crear Canal'}
            </Button>
          </div>
        </form>
      </Modal>
    </div >
  );
};
