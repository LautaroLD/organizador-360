import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from './Modal';
import { Button } from './Button';
import { MessageSquare } from 'lucide-react';
import { createFeedback } from '@/lib/feedback';
import { toast } from 'react-toastify';

export default function FeedbackModal() {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: {
      type: 'general',
      message: ''
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const message = watch('message');
  const feedbackTypes = [
    { value: 'general', label: 'Comentario general' },
    { value: 'bug', label: 'Reportar un error' },
    { value: 'feature', label: 'Sugerencia de mejora' },
    { value: 'other', label: 'Otro' },
  ];

  const onSubmit = async (data: { type: string, message: string; }) => {
    setIsSubmitting(true);

    const metadata = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
      url: window.location.href,
    };

    try {
      await createFeedback({
        type: data.type,
        message: data.message,
        metadata,
      });
      toast.success('¡Gracias por tu feedback!');
    } catch (error) {
      console.error('Error al enviar feedback:', error);
      toast.error('Error al enviar feedback. Por favor, inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
      reset();
      setIsOpen(false);
    }
  };

  return (
    <>
      <span onClick={ () => setIsOpen(true) } className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors flex items-center space-x-3 cursor-pointer">
        <MessageSquare className="h-4 w-4 text-[var(--text-secondary)]" />
        <p >Feedback</p>
      </span>
      <Modal isOpen={ isOpen } onClose={ () => setIsOpen(false) } title="Enviar comentarios">
        <form onSubmit={ handleSubmit(onSubmit) } className="space-y-4">
          <p className="text-[var(--text-secondary)] text-sm">
            ¿Tienes alguna sugerencia o encontraste un problema? Nos encantaría saber qué piensas.
          </p>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Categoría
            </label>
            <select
              { ...register('type') }
              className="w-full rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-primary)] p-2 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            >
              { feedbackTypes.map((type) => (
                <option key={ type.value } value={ type.value }>
                  { type.label }
                </option>
              )) }
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Tu mensaje
            </label>
            <textarea
              { ...register('message', { required: true }) }
              className="w-full min-h-[120px] rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              placeholder="Escribe aquí tu feedback..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={ () => setIsOpen(false) } type="button">
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={ isSubmitting || !message?.trim() }>
              { isSubmitting ? 'Enviando...' : 'Enviar Feedback' }
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

