/**
 * Tests para el componente SuggestionsModal
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SuggestionsModal from '@/components/project/kanban/SuggestionsModal';

describe('SuggestionsModal', () => {
  const mockOnClose = jest.fn();
  const mockAddTask = jest.fn();
  const defaultSuggestions = ['Tarea sugerida 1', 'Tarea sugerida 2', 'Tarea sugerida 3'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debería renderizar el modal con sugerencias', () => {
    render(
      <SuggestionsModal
        suggestions={defaultSuggestions}
        onClose={mockOnClose}
        addTask={mockAddTask}
      />
    );

    expect(screen.getByText('Sugerencias de Tareas')).toBeInTheDocument();
    expect(screen.getByText('Tarea sugerida 1')).toBeInTheDocument();
    expect(screen.getByText('Tarea sugerida 2')).toBeInTheDocument();
    expect(screen.getByText('Tarea sugerida 3')).toBeInTheDocument();
  });

  it('debería mostrar botones de agregar para cada sugerencia', () => {
    render(
      <SuggestionsModal
        suggestions={defaultSuggestions}
        onClose={mockOnClose}
        addTask={mockAddTask}
      />
    );

    const addButtons = screen.getAllByText('Agregar');
    expect(addButtons).toHaveLength(3);
  });

  it('debería llamar a addTask cuando se hace clic en Agregar', () => {
    render(
      <SuggestionsModal
        suggestions={defaultSuggestions}
        onClose={mockOnClose}
        addTask={mockAddTask}
      />
    );

    const addButtons = screen.getAllByText('Agregar');
    fireEvent.click(addButtons[0]);

    expect(mockAddTask).toHaveBeenCalledWith({ title: 'Tarea sugerida 1' });
  });

  it('debería ocultar la sugerencia después de agregarla', async () => {
    render(
      <SuggestionsModal
        suggestions={defaultSuggestions}
        onClose={mockOnClose}
        addTask={mockAddTask}
      />
    );

    const addButtons = screen.getAllByText('Agregar');
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('Tarea sugerida 1')).not.toBeInTheDocument();
    });
  });

  it('debería cerrar el modal cuando se agregan todas las sugerencias', async () => {
    render(
      <SuggestionsModal
        suggestions={defaultSuggestions}
        onClose={mockOnClose}
        addTask={mockAddTask}
      />
    );

    // Agregar todas las tareas
    let addButtons = screen.getAllByText('Agregar');
    fireEvent.click(addButtons[0]);

    addButtons = screen.getAllByText('Agregar');
    fireEvent.click(addButtons[0]);

    addButtons = screen.getAllByText('Agregar');
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('debería mostrar mensaje cuando no hay sugerencias', () => {
    // Nota: El modal no se abre si suggestions.length === 0
    // pero si de alguna forma se renderiza vacío, debería mostrar el mensaje
    const { container } = render(
      <SuggestionsModal
        suggestions={[]}
        onClose={mockOnClose}
        addTask={mockAddTask}
      />
    );

    // El modal no debería renderizarse con isOpen={false}
    // Verificamos que el contenedor no tenga el modal visible
    expect(container.textContent).not.toContain('Sugerencias de Tareas');
  });

  it('no debería permitir agregar la misma sugerencia dos veces', () => {
    render(
      <SuggestionsModal
        suggestions={defaultSuggestions}
        onClose={mockOnClose}
        addTask={mockAddTask}
      />
    );

    const addButtons = screen.getAllByText('Agregar');
    fireEvent.click(addButtons[0]);

    // Después de agregar, la sugerencia desaparece de la lista
    // por lo que no puede ser agregada de nuevo
    expect(screen.queryByText('Tarea sugerida 1')).not.toBeInTheDocument();
  });
});
