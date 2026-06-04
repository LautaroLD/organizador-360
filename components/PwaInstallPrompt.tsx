'use client';

import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const STORAGE_KEY = 'pwa-install-decision';
const DISMISS_REMINDER_MS = 7 * 24 * 60 * 60 * 1000;

type InstallDecision = 'accepted' | 'dismissed';

interface StoredInstallDecision {
  outcome: InstallDecision;
  expiresAt: number | null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

function isRunningStandalone() {
  if (typeof window === 'undefined') {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };

  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

function isLikelyMobileBrowser() {
  if (typeof window === 'undefined') {
    return false;
  }

  const hasMobileUserAgent = /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent);
  const hasCompactViewport = window.matchMedia('(max-width: 768px)').matches;
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  return hasMobileUserAgent || (hasCompactViewport && hasCoarsePointer);
}

function readStoredDecision(): StoredInstallDecision | null {
  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  if (rawValue === 'accepted') {
    return { outcome: 'accepted', expiresAt: null };
  }

  if (rawValue === 'dismissed') {
    return {
      outcome: 'dismissed',
      expiresAt: Date.now() + DISMISS_REMINDER_MS,
    };
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredInstallDecision;

    if (parsed.outcome === 'accepted') {
      return { outcome: 'accepted', expiresAt: null };
    }

    if (parsed.outcome === 'dismissed' && typeof parsed.expiresAt === 'number') {
      if (parsed.expiresAt > Date.now()) {
        return parsed;
      }

      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return null;
}

function persistDecision(outcome: InstallDecision) {
  const value: StoredInstallDecision = {
    outcome,
    expiresAt: outcome === 'dismissed' ? Date.now() + DISMISS_REMINDER_MS : null,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedDecision = readStoredDecision();

    if (storedDecision || isRunningStandalone() || !isLikelyMobileBrowser()) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      persistDecision('accepted');
      setInstallEvent(null);
      setIsVisible(false);
      setIsInstalling(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    persistDecision('dismissed');
    setIsVisible(false);
  };

  const handleInstall = async () => {
    if (!installEvent) {
      return;
    }

    setIsInstalling(true);

    try {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;

      persistDecision(outcome);
      setIsVisible(false);
      setInstallEvent(null);
    } finally {
      setIsInstalling(false);
    }
  };

  if (!isVisible || !installEvent) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:hidden">
      <div className="pointer-events-auto mx-auto max-w-md rounded-[26px] border border-[var(--text-secondary)]/15 bg-[var(--bg-secondary)] p-4 shadow-[0_-14px_40px_rgba(0,0,0,0.14)]">
        <div className="relative">
          <button
            type="button"
            aria-label="Cerrar recomendación de instalación"
            className="absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--bg-primary)] hover:text-[var(--accent-primary)]"
            onClick={ handleDismiss }
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3 pr-9">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="pt-0.5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-primary)]/80">Instala la app</p>
              <h2 className="mt-1 text-lg font-semibold leading-tight text-[var(--text-primary)]">Abre Veenzo desde tu pantalla de inicio</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Accede más rápido y usa Veenzo con una experiencia más fluida en móvil.
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <Button
              size="md"
              variant="secondary"
              className="min-h-11 flex-1 rounded-xl border-[var(--text-secondary)]/20 bg-[var(--bg-primary)]"
              onClick={ handleDismiss }
            >
              Ahora no
            </Button>
            <Button
              size="md"
              className="min-h-11 flex-1 gap-2 rounded-xl"
              onClick={ handleInstall }
              disabled={ isInstalling }
            >
              <Download className="h-4 w-4" />
              { isInstalling ? 'Abriendo...' : 'Instalar' }
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}