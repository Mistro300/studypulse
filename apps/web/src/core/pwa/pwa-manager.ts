import { create } from 'zustand';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaStoreState {
  updateAvailable: boolean;
  offlineReady: boolean;
  canInstall: boolean;
  isInstalled: boolean;
  isIosSafari: boolean;
  installDismissed: boolean;
  iosGuideOpen: boolean;
  initPwa: () => void;
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  promptInstall: () => Promise<void>;
  dismissInstallBanner: () => void;
  setIosGuideOpen: (open: boolean) => void;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let updateServiceWorkerFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
let pwaInitialized = false;

function detectIsInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone =
    'standalone' in window.navigator &&
    Boolean((window.navigator as { standalone?: boolean }).standalone);
  return standaloneMedia || iosStandalone;
}

function detectIsIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isOtherBrowser = /CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIos && isWebkit && !isOtherBrowser;
}

export const usePwaStore = create<PwaStoreState>((set) => ({
  updateAvailable: false,
  offlineReady: false,
  canInstall: false,
  isInstalled: detectIsInstalled(),
  isIosSafari: detectIsIosSafari(),
  installDismissed: false,
  iosGuideOpen: false,

  initPwa: () => {
    if (pwaInitialized || typeof window === 'undefined') return;
    pwaInitialized = true;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      set({ canInstall: true });
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      set({ canInstall: false, isInstalled: true });
    });

    try {
      updateServiceWorkerFn = registerSW({
        immediate: true,
        onNeedRefresh() {
          set({ updateAvailable: true });
        },
        onOfflineReady() {
          set({ offlineReady: true });
        },
      });
    } catch {
      // Ignore SW registration failure in unsupported/dev contexts
    }
  },

  applyUpdate: async () => {
    if (updateServiceWorkerFn) {
      await updateServiceWorkerFn(true);
    } else {
      window.location.reload();
    }
  },

  dismissUpdate: () => set({ updateAvailable: false }),

  promptInstall: async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      deferredPrompt = null;
      set({ canInstall: false, isInstalled: true });
    } else {
      set({ installDismissed: true });
    }
  },

  dismissInstallBanner: () => set({ installDismissed: true }),
  setIosGuideOpen: (iosGuideOpen) => set({ iosGuideOpen }),
}));
