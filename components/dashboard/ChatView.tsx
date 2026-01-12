'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { MessageContent } from '@/components/ui/MessageContent';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { ChevronsLeft, Hash, Plus, Send, Trash2, MessageSquare, Bell, BellOff, Loader2, Pin, PinOff, Edit2, MoreVertical, X, Check, Reply, ChevronDown, ChevronUp, FileText, Sparkles } from 'lucide-react';
import useGemini from '@/hooks/useGemini';
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
  const { generateChatSummary } = useGemini();
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summaryStartDate, setSummaryStartDate] = useState('');
  const [summaryEndDate, setSummaryEndDate] = useState('');
  const [summaryResult, setSummaryResult] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const openSummaryModal = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);

    setSummaryStartDate(start.toISOString().split('T')[0]);
    setSummaryEndDate(end.toISOString().split('T')[0]);
    setSummaryResult('');
    setIsSummaryModalOpen(true);
  };

  const handleGenerateSummary = async () => {
    if (!selectedChannel) return;
    setIsGeneratingSummary(true);
    try {
      // Usamos T00:00:00 para asegurar que se interprete como hora local del usuario y no UTC
      const start = new Date(`${summaryStartDate}T00:00:00`);
      const end = new Date(`${summaryEndDate}T23:59:59.999`);

      const msgsToSummarize = messages?.filter(msg => {
        if (msg.is_deleted) return false;
        const msgDate = new Date(msg.created_at);
        return msgDate >= start && msgDate <= end;
      }) || [];

      if (msgsToSummarize.length === 0) {
        toast.info('No hay mensajes en el rango de fechas seleccionado.');
        setIsGeneratingSummary(false);
        return;
      }

      const summary = await generateChatSummary({
        messages: msgsToSummarize,
        startDate: summaryStartDate,
        endDate: summaryEndDate,
        channelName: selectedChannel.name
      });

      setSummaryResult(summary);
    } catch (error) {
      console.error(error);
      toast.error('Error al generar el resumen');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'chat' | 'pinned'>('chat');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null); const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null); const messageRefs = useRef<{ [key: string]: HTMLDivElement | null; }>({});
  const [messageContent, setMessageContent] = useState('');

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
      setMessageContent('');
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

  const onSubmitMessage = () => {
    if (messageContent.trim()) {
      sendMessageMutation.mutate(messageContent);
    }
  };

  const onSubmitChannel = (data: ChannelFormData) => {
    createChannelMutation.mutate(data);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const [showToolbar, setShowToolbar] = useState(true);
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
                {/* Summary Button */}
                <Button
                  variant="ghost"
                  onClick={openSummaryModal}
                  title="Resumir chat con IA"
                  className="mr-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" fill="currentColor"><path d="M10.6144 17.7956 11.492 15.7854C12.2731 13.9966 13.6789 12.5726 15.4325 11.7942L17.8482 10.7219C18.6162 10.381 18.6162 9.26368 17.8482 8.92277L15.5079 7.88394C13.7092 7.08552 12.2782 5.60881 11.5105 3.75894L10.6215 1.61673C10.2916.821765 9.19319.821767 8.8633 1.61673L7.97427 3.75892C7.20657 5.60881 5.77553 7.08552 3.97685 7.88394L1.63658 8.92277C.868537 9.26368.868536 10.381 1.63658 10.7219L4.0523 11.7942C5.80589 12.5726 7.21171 13.9966 7.99275 15.7854L8.8704 17.7956C9.20776 18.5682 10.277 18.5682 10.6144 17.7956ZM19.4014 22.6899 19.6482 22.1242C20.0882 21.1156 20.8807 20.3125 21.8695 19.8732L22.6299 19.5353C23.0412 19.3526 23.0412 18.7549 22.6299 18.5722L21.9121 18.2532C20.8978 17.8026 20.0911 16.9698 19.6586 15.9269L19.4052 15.3156C19.2285 14.8896 18.6395 14.8896 18.4628 15.3156L18.2094 15.9269C17.777 16.9698 16.9703 17.8026 15.956 18.2532L15.2381 18.5722C14.8269 18.7549 14.8269 19.3526 15.2381 19.5353L15.9985 19.8732C16.9874 20.3125 17.7798 21.1156 18.2198 22.1242L18.4667 22.6899C18.6473 23.104 19.2207 23.104 19.4014 22.6899Z"></path></svg>
                </Button>

                {/* Notification Toggle */}
                {isSupported && (
                  <Button
                    variant='ghost'
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
                  </Button>
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
                      "group relative flex gap-2 md:gap-3 max-w-[85%] md:max-w-[70%] w-fit transition-colors duration-300 p-1",
                      message.user?.id === user?.id ? 'ml-auto flex-row-reverse' : 'flex-row',
                      highlightedMessageId === message.id && 'bg-[var(--accent-primary)]/30 rounded-lg'
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
                            <RichTextEditor
                              value={editContent}
                              onChange={setEditContent}
                              onSubmit={() => {
                                if (editContent.trim()) {
                                  updateMessageMutation.mutate({ messageId: message.id, content: editContent });
                                }
                              }}
                              placeholder="Editar mensaje..."
                              className="w-full"
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
                          <MessageContent content={message.content} />
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
            <div className="p-2 md:p-4 border-t border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] flex-shrink-0">
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
              <div className="flex gap-2 flex-row">
                <RichTextEditor
                  showToolbar={showToolbar}
                  value={messageContent}
                  onChange={setMessageContent}
                  onSubmit={onSubmitMessage}
                  placeholder={`Mensaje en #${selectedChannel.name}`}
                  disabled={sendMessageMutation.isPending}
                  className="flex-1"
                />
                <div className='flex flex-col justify-between'>
                  <Button aria-label={showToolbar ? 'Ocultar barra de herramientas' : 'Mostrar barra de herramientas'} title={showToolbar ? 'Ocultar barra de herramientas' : 'Mostrar barra de herramientas'} variant='ghost' onClick={() => setShowToolbar(!showToolbar)}>
                    {
                      !showToolbar ? <ChevronUp className="h-5 w-5" /> :
                        <ChevronDown className="h-5 w-5" />
                    }
                  </Button>
                  <Button
                    type="button"
                    title="Enviar mensaje (Shift + Enter)"
                    onClick={onSubmitMessage}
                    disabled={sendMessageMutation.isPending || !messageContent.trim()}
                    aria-label="Enviar mensaje"
                  >
                    <Send className="h-5 w-5" />
                  </Button>

                </div>
              </div>
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

      {/* Summary Modal */}
      <Modal
        size='lg'
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        title="Resumen del Chat con IA"
      >
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Desde
              </label>
              <Input
                type="date"
                aria-label="Fecha Inicio"
                value={summaryStartDate}
                onChange={(e) => setSummaryStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Hasta
              </label>
              <Input
                type="date"
                aria-label="Fecha Fin"
                value={summaryEndDate}
                onChange={(e) => setSummaryEndDate(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <Button
            onClick={handleGenerateSummary}
            disabled={isGeneratingSummary}
            className="w-full flex items-center justify-center gap-2 bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity"
          >
            {isGeneratingSummary ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Generar Resumen
              </>
            )}
          </Button>

          {summaryResult && (
            <div className="mt-4 p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--text-secondary)]/20 max-h-60 overflow-y-auto">
              <h4 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
                Resumen Generado
              </h4>
              <MessageContent content={summaryResult} />
            </div>
          )}
        </div>
      </Modal>

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
