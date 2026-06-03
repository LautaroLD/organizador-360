import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEventMock = Event & {
  prompt: jest.Mock<Promise<void>, []>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
};

function mockEnvironment({
  isMobile,
  isStandalone = false,
}: {
  isMobile: boolean;
  isStandalone?: boolean;
}) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: isMobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  });

  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: false,
  });

  (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
    matches:
      (query === '(max-width: 768px)' && isMobile) ||
      (query === '(pointer: coarse)' && isMobile) ||
      (query === '(display-mode: standalone)' && isStandalone),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

async function dispatchBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = jest.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEventMock;

  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({
      outcome,
      platform: 'web',
    }),
  });

  await act(async () => {
    window.dispatchEvent(event);
  });

  return { event, prompt };
}

describe('PwaInstallPrompt', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-03T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    jest.setSystemTime(new Date('2026-06-03T12:00:00.000Z'));
  });

  it('shows the bottom sheet only on mobile browsers after beforeinstallprompt', async () => {
    mockEnvironment({ isMobile: true });

    render(<PwaInstallPrompt />);
    await dispatchBeforeInstallPrompt();

    expect(await screen.findByText('Abre Veenzo desde tu pantalla de inicio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Instalar' })).toBeInTheDocument();
  });

  it('stores dismissal for one week and does not show again before it expires', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    mockEnvironment({ isMobile: true });

    const { unmount } = render(<PwaInstallPrompt />);
    await dispatchBeforeInstallPrompt();

    await user.click(await screen.findByRole('button', { name: 'Ahora no' }));

    expect(JSON.parse(window.localStorage.getItem('pwa-install-decision') ?? '{}')).toEqual({
      outcome: 'dismissed',
      expiresAt: Date.now() + ONE_WEEK_MS,
    });

    unmount();

    render(<PwaInstallPrompt />);
    await dispatchBeforeInstallPrompt();

    await waitFor(() => {
      expect(screen.queryByText('Abre Veenzo desde tu pantalla de inicio')).not.toBeInTheDocument();
    });
  });

  it('shows the prompt again after one week if the user keeps opening from the browser', async () => {
    mockEnvironment({ isMobile: true });

    window.localStorage.setItem('pwa-install-decision', JSON.stringify({
      outcome: 'dismissed',
      expiresAt: Date.now() - 1,
    }));

    render(<PwaInstallPrompt />);
    await dispatchBeforeInstallPrompt();

    expect(await screen.findByText('Abre Veenzo desde tu pantalla de inicio')).toBeInTheDocument();
  });

  it('calls beforeinstallprompt.prompt and stores the accepted decision', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    mockEnvironment({ isMobile: true });

    render(<PwaInstallPrompt />);
    const { prompt } = await dispatchBeforeInstallPrompt('accepted');

    await user.click(await screen.findByRole('button', { name: 'Instalar' }));

    await waitFor(() => {
      expect(prompt).toHaveBeenCalledTimes(1);
      expect(JSON.parse(window.localStorage.getItem('pwa-install-decision') ?? '{}')).toEqual({
        outcome: 'accepted',
        expiresAt: null,
      });
      expect(screen.queryByText('Abre Veenzo desde tu pantalla de inicio')).not.toBeInTheDocument();
    });
  });
});