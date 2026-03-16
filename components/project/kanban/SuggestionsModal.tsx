import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import React, { useEffect, useCallback } from 'react';
import { CreateTaskDTO } from '@/models';

interface SuggestionsModalProps {
  suggestions: string[];
  onClose: () => void;
  addTask: (data: Partial<CreateTaskDTO>) => void;
}

export default function SuggestionsModal({ suggestions, onClose, addTask }: SuggestionsModalProps) {
  const [tasksAdded, setTasksAdded] = React.useState<string[]>([]);

  const stableOnClose = useCallback(() => onClose(), [onClose]);
  const pendingSuggestions = suggestions.filter((suggestion) => !tasksAdded.includes(suggestion));

  const handleAddSuggestion = (suggestion: string) => {
    addTask({ title: suggestion });
    setTasksAdded((prev) => [...prev, suggestion]);
  };

  const handleAddAll = () => {
    pendingSuggestions.forEach((suggestion) => {
      addTask({ title: suggestion });
    });
    setTasksAdded((prev) => [...prev, ...pendingSuggestions]);
  };

  useEffect(() => {
    if (tasksAdded.length === suggestions.length && suggestions.length > 0) {
      stableOnClose();
    }
  }, [tasksAdded, suggestions.length, stableOnClose]);

  return (
    <Modal size='xl' isOpen={suggestions.length > 0} onClose={onClose} title="Sugerencias de Tareas">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--text-secondary)]/20 bg-[var(--bg-secondary)] px-3 py-2">
          <p className="text-sm text-[var(--text-secondary)]">
            {pendingSuggestions.length} sugerencias pendientes de agregar
          </p>
          {pendingSuggestions.length > 1 && (
            <Button size="sm" variant="outline" onClick={handleAddAll}>Agregar todas</Button>
          )}
        </div>

        {suggestions.length === 0 ? (
          <p className="text-[var(--text-secondary)]">No se encontraron sugerencias.</p>
        ) : (
          <ul className="space-y-2">
            {pendingSuggestions.map((suggestion, index) => (
              <li key={index} className="flex justify-between items-center gap-3 bg-[var(--bg-primary)] border border-[var(--text-secondary)]/20 p-3 rounded-lg">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--text-secondary)] mb-0.5">Sugerencia {index + 1}</p>
                  <p className="text-sm text-[var(--text-primary)] leading-snug">{suggestion}</p>
                </div>
                <Button size="sm" onClick={() => handleAddSuggestion(suggestion)}>Agregar</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
