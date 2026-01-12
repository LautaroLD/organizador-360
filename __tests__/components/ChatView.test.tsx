
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatView } from '@/components/dashboard/ChatView';
import useGemini from '@/hooks/useGemini';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useQuery } from '@tanstack/react-query';

// Mocks
jest.mock('@/hooks/useGemini');
jest.mock('@/store/authStore');
jest.mock('@/store/projectStore');
jest.mock('@/store/notificationStore');

// Mock specific hooks used in ChatView
jest.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    permission: 'granted',
    requestPermission: jest.fn(),
    isSupported: true,
  }),
}));

jest.mock('@/hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    isSupported: true,
  }),
}));

jest.mock('@/hooks/useRealtimeMessages', () => ({
  useRealtimeMessages: () => ({}),
}));

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null })
        })
      })
    })
  }),
}));

// Mock React Query
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: () => ({
    mutate: jest.fn(),
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
}));

// Mock toast
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock UI components that might cause issues or are not focus of this test
jest.mock('@/components/ui/RichTextEditor', () => ({
  RichTextEditor: ({ onChange }: { onChange: (value: string) => void }) => <textarea data-testid="rich-text-editor" onChange={(e) => onChange(e.target.value)} />
}));

// Mock MessageContent to avoid react-markdown ESM issues
jest.mock('@/components/ui/MessageContent', () => ({
  MessageContent: ({ content }: { content: string; }) => <div data-testid="message-content">{content}</div>
}));

describe('ChatView Summary', () => {
  const mockGenerateChatSummary = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useGemini as jest.Mock).mockReturnValue({
      generateChatSummary: mockGenerateChatSummary,
    });

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: 'user1' },
    });

    (useProjectStore as unknown as jest.Mock).mockReturnValue({
      currentProject: { id: 'proj1', name: 'Test Project', created_by: 'user1' },
    });

    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      notificationsEnabled: true,
      pushEnabled: false,
      setNotificationsEnabled: jest.fn(),
      setPushEnabled: jest.fn(),
    });

    // Mock useQuery to return channels and messages
    (useQuery as jest.Mock).mockImplementation((options: { queryKey: unknown }) => {
      const queryKey = options.queryKey;

      if (Array.isArray(queryKey) && queryKey[0] === 'channels') {
        return {
          data: [{ id: 'chan1', name: 'General', description: 'General channel' }],
          isLoading: false,
        };
      }
      if (Array.isArray(queryKey) && queryKey[0] === 'messages') {
        return {
          data: [
            { id: '1', content: 'Msg 1', created_at: '2023-10-01T10:00:00Z', user_id: 'user1', profiles: { full_name: 'User 1' } },
            { id: '2', content: 'Msg 2', created_at: '2023-10-02T10:00:00Z', user_id: 'user1', profiles: { full_name: 'User 1' } }
          ],
          isLoading: false,
        };
      }
      return { data: [], isLoading: false };
    });
  });

  it('opens summary modal and generates summary', async () => {
    render(<ChatView />);

    // Wait for channels to load and General to be displayed
    await waitFor(() => {
      const elements = screen.getAllByText('General');
      expect(elements.length).toBeGreaterThan(0);
    });

    // Find the summary button by its title
    const summaryBtn = screen.getByTitle('Resumir chat con IA');
    expect(summaryBtn).toBeInTheDocument();

    fireEvent.click(summaryBtn);

    // Check modal opens
    await waitFor(() => {
      expect(screen.getByText('Resumen del Chat con IA')).toBeInTheDocument();
    });

    // Check generate button exists
    const generateBtn = screen.getByRole('button', { name: /generar resumen/i });

    // Configure logic for summary generation
    mockGenerateChatSummary.mockResolvedValue('Resumen generado exitosamente.');

    // Interact with date inputs
    const startDateInput = screen.getByLabelText('Fecha Inicio');
    const endDateInput = screen.getByLabelText('Fecha Fin');

    fireEvent.change(startDateInput, { target: { value: '2023-10-01' } });
    fireEvent.change(endDateInput, { target: { value: '2023-10-03' } });

    // Trigger generation
    fireEvent.click(generateBtn);

    // Verify loading state or call
    await waitFor(() => {
      expect(mockGenerateChatSummary).toHaveBeenCalled();
    });

    // Check arguments passed to generateChatSummary
    expect(mockGenerateChatSummary).toHaveBeenCalledWith(expect.objectContaining({
      startDate: '2023-10-01',
      endDate: '2023-10-03',
      channelName: 'General'
    }));

    // Check result is displayed
    expect(await screen.findByText('Resumen generado exitosamente.')).toBeInTheDocument();
  });
});
