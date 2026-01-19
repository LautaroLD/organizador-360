'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAgent } from '@/hooks/useAgent';
import { Button } from '@/components/ui/Button';
import { Bot, Send, User, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export default function AgentPage() {
  const { askAgent, loading } = useAgent();
  const params = useParams();
  const projectId = params?.id as string;

  // Cargar historial de la sesión
  const getInitialMessages = (): Message[] => {
    if (!projectId) {
      return [
        {
          role: 'assistant',
          content: '¡Hola! Soy el asistente IA de tu proyecto. Puedo ayudarte a encontrar información sobre tareas, mensajes y miembros del equipo. ¿En qué puedo ayudarte hoy?',
          timestamp: new Date()
        }
      ];
    }

    const storageKey = `agent_chat_${projectId}`;
    try {
      const item = sessionStorage.getItem(storageKey);
      if (item) {
        const parsed = JSON.parse(item);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const savedMessages = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        if (savedMessages.length > 0) {
          return savedMessages;
        }
      }
    } catch (error) {
      console.error('Error recovering chat history:', error);
    }

    return [
      {
        role: 'assistant',
        content: '¡Hola! Soy el asistente IA de tu proyecto. Puedo ayudarte a encontrar información sobre tareas, mensajes y miembros del equipo. ¿En qué puedo ayudarte hoy?',
        timestamp: new Date()
      }
    ];
  };

  const [messages, setMessages] = useState<Message[]>(getInitialMessages);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Guardar historial en la sesión
  useEffect(() => {
    if (!projectId) return;
    const storageKey = `agent_chat_${projectId}`;
    if (messages.length > 1) { // Solo guardar si hay interacción real más allá del saludo
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, projectId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    try {
      // Enviamos el historial previo (excluyendo el mensaje que acabamos de añadir localmente para evitar duplicados si la lógica cambia,
      // pero idealmente enviamos todo lo anterior).
      // Filtramos para enviar solo rol y contenido, eliminando timestamps para reducir carga
      const historyToSend = messages.map(m => ({ role: m.role, content: m.content }));

      const response = await askAgent(userMsg.content, historyToSend);
      if (response) {
        const agentMsg: Message = {
          role: 'assistant',
          content: response,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, agentMsg]);
      }
    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        role: 'assistant',
        content: "Lo siento, hubo un error al procesar tu solicitud. Por favor intenta de nuevo.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--text-secondary)]/10 flex items-center gap-3 bg-[var(--bg-secondary)]">
        <div className="p-2 bg-[var(--accent-primary)] rounded-lg">
          <Bot className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Asistente de Proyecto</h1>
          <p className="text-sm text-[var(--text-secondary)]">Pregunta sobre tareas, mensajes, documentos, y estado del equipo</p>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6"
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex items-start gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''
              }`}
          >
            <div className={`p-2 rounded-full flex-shrink-0 bg-[var(--accent-primary)] text-white`}>
              {msg.role === 'user' ? <User className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            </div>

            <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'
              }`}>
              <div className={`p-4 rounded-2xl ${msg.role === 'user'
                ? 'bg-[var(--accent-primary)] text-white rounded-tr-sm'
                : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--text-secondary)]/10 rounded-tl-sm'
                }`}>
                <div className="prose dark:prose-invert max-w-none text-sm break-words">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      ul: ({ node, ...props }) => <ul className="list-disc pl-4 my-2" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal pl-4 my-2" {...props} />,
                      li: ({ node, ...props }) => <li className="my-1" {...props} />,
                      p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
              <span className="text-xs text-[var(--text-secondary)] mt-1 px-1">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-4 max-w-4xl mx-auto">
            <div className="p-2 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex-shrink-0">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl rounded-tl-sm border border-[var(--text-secondary)]/10 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--text-secondary)]" />
              <span className="text-sm text-[var(--text-secondary)]">Analizando el proyecto...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[var(--bg-secondary)] border-t border-[var(--text-secondary)]/10">
        <form
          onSubmit={handleSend}
          className="max-w-4xl mx-auto relative flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ej: ¿Qué tareas hay pendientes para hoy?"
            className="flex-1 bg-[var(--bg-primary)] border border-[var(--text-secondary)]/20 text-[var(--text-primary)] rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50 transition-all placeholder:text-[var(--text-secondary)]/50"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={loading || !inputValue.trim()}
            className="absolute right-2 p-2 h-auto rounded-lg aspect-square"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
