import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalyzeResourceModal } from '@/components/resources/AnalyzeResourceModal';

jest.mock('react-markdown', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockReactMarkdown = (props: any) => <div data-testid="react-markdown">{props.children}</div>;
  MockReactMarkdown.displayName = 'ReactMarkdown';
  return MockReactMarkdown;
});

jest.mock('remark-gfm', () => () => { });

describe('AnalyzeResourceModal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('no debe renderizarse cuando isOpen es false', () => {
    render(
      <AnalyzeResourceModal
        isOpen={false}
        onClose={mockOnClose}
        isLoading={false}
        summary={null}
        resourceTitle="Test Document"
      />
    );

    // Check if title is not present
    expect(screen.queryByText('Análisis IA de Documento')).not.toBeInTheDocument();
  });

  it('debe mostrar estado de carga', () => {
    render(
      <AnalyzeResourceModal
        isOpen={true}
        onClose={mockOnClose}
        isLoading={true}
        summary={null}
        resourceTitle="Test Document"
      />
    );

    expect(screen.getByText('Análisis IA de Documento')).toBeInTheDocument();
    expect(screen.getByText('Leyendo y analizando documento...')).toBeInTheDocument();
  });

  it('debe mostrar el resumen cuando está listo', () => {
    const summaryText = 'Este es un resumen generado por IA.';
    render(
      <AnalyzeResourceModal
        isOpen={true}
        onClose={mockOnClose}
        isLoading={false}
        summary={summaryText}
        resourceTitle="Documento Importante"
      />
    );

    expect(screen.getByText(summaryText)).toBeInTheDocument();
    expect(screen.getByText('Documento Importante')).toBeInTheDocument();
  });

  it('debe llamar a onClose al hacer clic en cerrar', () => {
    render(
      <AnalyzeResourceModal
        isOpen={true}
        onClose={mockOnClose}
        isLoading={false}
        summary="Cerrar test."
        resourceTitle="Test"
      />
    );

    // Assuming the Modal component has a close button or we can click the overlay/button
    // Looking at the code, it uses a generic Modal. Usually has a Close button or "Cerrar".
    // Alternatively, verify the "Cerrar" button at the bottom
    const closeButton = screen.getByText('Cerrar');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
