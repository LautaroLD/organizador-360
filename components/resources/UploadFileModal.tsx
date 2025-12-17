'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { UploadFileModalProps } from '@/models';
export const UploadFileModal: React.FC<UploadFileModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  isLoading,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setSelectedFile(null);
    onClose();
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
      setSelectedFile(null);
    }
  };
  useEffect(() => {
    if (selectedFile && (selectedFile.size / 1024 / 1024) > 50) {
      // eslint-disable-next-line
      setError('El archivo es demasiado grande, el limite es de 50 MB');
    } else {
      setError(null);
    }
  }, [selectedFile]);
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title='Subir Archivo'>
      <div className='space-y-4'>
        <div className='bg-[var(--accent-primary)]/5 border-2 border-[var(--accent-primary)]/30 rounded-lg p-3 mb-4'>
          <p className='text-xs text-[var(--text-primary)]'>
            <strong>Tipos soportados:</strong> Documentos (PDF, DOC, XLS, PPT), Imágenes (JPG, PNG,
            GIF), Videos (MP4, AVI, MOV) y más.
          </p>
          <strong className='text-sm text-[var(--text-primary)] underline'>El tamaño del archivo no debe superar los 50 MB</strong>
        </div>

        <div>
          <label className='block text-sm font-medium text-[var(--text-primary)] mb-2'>
            Seleccionar Archivo
          </label>
          <input
            type='file'

            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className='block w-full text-sm text-[var(--text-primary)]
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-[var(--accent-primary)] file:text-white
              hover:file:opacity-90 cursor-pointer
              border border-[var(--text-secondary)]/30 rounded-lg'
          />
          {selectedFile && (
            <div className='mt-3 p-3 bg-[var(--bg-primary)] rounded-lg'>
              <p className='text-sm font-medium text-[var(--text-primary)]'>
                Archivo seleccionado:
              </p>
              <p className='text-xs text-[var(--text-secondary)] mt-1'>
                {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            </div>
          )}
          {
            error && (
              <div className='mt-3 p-3 bg-[var(--bg-primary)] rounded-lg'>
                <p className='text-sm font-medium text-[var(--text-primary)]'>
                  Error:
                </p>
                <p className='text-xs text-[var(--text-secondary)] mt-1'>
                  {error}
                </p>
              </div>
            )
          }
        </div>
        <div className='flex justify-end space-x-2 pt-4'>
          <Button type='button' variant='secondary' onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={!selectedFile || isLoading || !!error}>
            {isLoading ? 'Subiendo...' : 'Subir Archivo'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
