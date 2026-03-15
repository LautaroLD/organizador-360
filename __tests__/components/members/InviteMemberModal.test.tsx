import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InviteMemberModal } from '@/components/members/InviteMemberModal';

jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (config: {
    mutationFn: (data: unknown) => Promise<unknown>;
    onSuccess?: (result: unknown, variables: unknown) => void;
    onError?: (error: Error) => void;
  }) => ({
    mutate: async (data: unknown) => {
      try {
        const result = await config.mutationFn(data);
        config.onSuccess?.(result, data);
      } catch (error) {
        config.onError?.(error as Error);
      }
    },
    isPending: false,
  }),
}));

describe('InviteMemberModal', () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        invitationUrl: 'https://app.test/invite/abc',
        isNewUser: false,
      }),
    }) as unknown as typeof fetch;
  });

  it('envia invitacion por email y cierra modal al completar', async () => {
    render(
      <InviteMemberModal
        isOpen={true}
        onClose={onClose}
        projectId='project-1'
        projectName='Proyecto Demo'
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('colaborador@ejemplo.com'), {
      target: { value: 'user@test.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: /enviar invitación/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'project-1',
          inviteeEmail: 'user@test.com',
          role: 'Collaborator',
          inviteType: 'email',
        }),
      });
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('genera enlace y lo muestra en UI cuando inviteType es link', async () => {
    render(
      <InviteMemberModal
        isOpen={true}
        onClose={onClose}
        projectId='project-1'
        projectName='Proyecto Demo'
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByText('Por Enlace'));
    fireEvent.click(screen.getByRole('button', { name: /generar enlace/i }));

    await waitFor(() => {
      expect(screen.getByText('Enlace generado')).toBeInTheDocument();
      expect(screen.getByText('https://app.test/invite/abc')).toBeInTheDocument();
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
