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

  useEffect(() => {
    if (tasksAdded.length === suggestions.length && suggestions.length > 0) {
      stableOnClose();
    }
  }, [tasksAdded, suggestions.length, stableOnClose]);
  return (
    <Modal size='xl' isOpen={suggestions.length > 0} onClose={onClose} title="Sugerencias de Tareas">
      <div>
        {suggestions.length === 0 ? (
          <p className="text-[var(--text-secondary)]">No se encontraron sugerencias.</p>
        ) : (
          <ul>
            {suggestions.filter(suggestion => !tasksAdded.includes(suggestion)).map((suggestion, index) => (
              <li key={index} className="mb-2 flex justify-between items-center bg-[var(--bg-primary)] border border-gray-500 p-3 rounded">
                {suggestion}
                <Button onClick={() => { addTask({ title: suggestion }); setTasksAdded([...tasksAdded, suggestion]); }}>Agregar</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
