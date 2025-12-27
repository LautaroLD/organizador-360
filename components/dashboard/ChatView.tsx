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
import { ChevronsLeft, Hash, Plus, Send, Trash2, MessageSquare, Bell, BellOff, Loader2 } from 'lucide-react';
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
      const { data } = await supabase
        .from('messages')
        .select(`
          *,
          user:users(name, email, id)
        `)
        .eq('channel_id', selectedChannel!.id)
        .order('created_at', { ascending: true });

      return data || [];
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
        });
      if (error) throw error;
    },
    onSuccess: () => {
      // Don't invalidate queries here - the realtime subscription will handle cache updates
      resetMessage();
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
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
            <header className="p-3 md:p-4 border-b border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] flex-shrink-0">
              <div className="flex items-center gap-2">
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
            </header>

            {/* Messages */}
            <div className="flex-1 p-3 md:p-4 flex flex-col gap-3 md:gap-4 bg-[var(--bg-primary)] overflow-y-auto">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-[var(--text-secondary)]">Cargando mensajes...</p>
                </div>
              ) : messages && messages.length > 0 ? (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={clsx(
                      "bg-[var(--bg-secondary)] border border-[var(--accent-primary)]/40 py-2 md:py-3 px-3 md:px-6 rounded-xl w-fit max-w-[85%] md:max-w-[70%] flex gap-2 md:gap-3",
                      message.user?.id === user?.id ? 'flex-row-reverse ml-auto' : 'flex-row'
                    )}
                  >
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {message.user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
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
                      </div>
                      <p className="text-sm text-[var(--text-primary)] break-words max-w-full">
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <MessageSquare className="h-12 w-12 md:h-16 md:w-16 text-[var(--text-secondary)]/50 mb-3" />
                  <p className="text-sm md:text-base text-[var(--text-secondary)] mb-2">No hay mensajes aún</p>
                  <p className="text-xs md:text-sm text-[var(--text-secondary)]">Sé el primero en enviar un mensaje en #{selectedChannel.name}</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-3 md:p-4 border-t border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] flex-shrink-0">
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
