import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RichTextEditor } from '@/components/ui/RichTextEditor';

describe('RichTextEditor keyboard submit behavior', () => {
  it('submits with Shift+Enter by default', () => {
    const onSubmit = jest.fn();

    render(<RichTextEditor value="hola" onChange={jest.fn()} onSubmit={onSubmit} />);

    const editor = screen.getByLabelText('Escribir mensaje');
    fireEvent.keyDown(editor, { key: 'Enter', shiftKey: true });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit with Enter by default', () => {
    const onSubmit = jest.fn();

    render(<RichTextEditor value="hola" onChange={jest.fn()} onSubmit={onSubmit} />);

    const editor = screen.getByLabelText('Escribir mensaje');
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits with Enter when submitBehavior is enter', () => {
    const onSubmit = jest.fn();

    render(
      <RichTextEditor
        value="hola"
        onChange={jest.fn()}
        onSubmit={onSubmit}
        submitBehavior="enter"
      />
    );

    const editor = screen.getByLabelText('Escribir mensaje');
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit with Shift+Enter when submitBehavior is enter', () => {
    const onSubmit = jest.fn();

    render(
      <RichTextEditor
        value="hola"
        onChange={jest.fn()}
        onSubmit={onSubmit}
        submitBehavior="enter"
      />
    );

    const editor = screen.getByLabelText('Escribir mensaje');
    fireEvent.keyDown(editor, { key: 'Enter', shiftKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits with Ctrl+Enter regardless of submitBehavior', () => {
    const onSubmit = jest.fn();

    render(
      <RichTextEditor
        value="hola"
        onChange={jest.fn()}
        onSubmit={onSubmit}
        submitBehavior="shift-enter"
      />
    );

    const editor = screen.getByLabelText('Escribir mensaje');
    fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
