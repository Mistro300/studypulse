import { useTranslation } from 'react-i18next';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePwaStore } from '@/core/pwa/pwa-manager';

/**
 * Non-intrusive PWA Install Banner for Desktop/Android + dedicated iOS Safari
 * "Share -> Add to Home Screen" instruction guide.
 */
export function PwaInstallBanner() {
  const { t } = useTranslation();
  const canInstall = usePwaStore((s) => s.canInstall);
  const isInstalled = usePwaStore((s) => s.isInstalled);
  const isIosSafari = usePwaStore((s) => s.isIosSafari);
  const installDismissed = usePwaStore((s) => s.installDismissed);
  const iosGuideOpen = usePwaStore((s) => s.iosGuideOpen);
  const promptInstall = usePwaStore((s) => s.promptInstall);
  const dismissInstallBanner = usePwaStore((s) => s.dismissInstallBanner);
  const setIosGuideOpen = usePwaStore((s) => s.setIosGuideOpen);

  const showBanner = !isInstalled && !installDismissed && (canInstall || isIosSafari);

  return (
    <>
      {showBanner && (
        <div className="border-b border-brand-primary/25 bg-brand-soft px-4 py-2">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 text-start">
            <div className="flex min-w-0 items-center gap-2.5">
              <Smartphone className="h-4 w-4 shrink-0 text-brand-primary" />
              <p className="truncate text-xs font-medium text-text-primary">
                {t('pwa.installBannerText')}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canInstall ? (
                <button
                  type="button"
                  onClick={() => void promptInstall()}
                  className="inline-flex items-center gap-1 rounded-control bg-brand-primary px-3 py-1 text-xs font-semibold text-white hover:bg-brand-hover"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{t('pwa.installAction')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIosGuideOpen(true)}
                  className="inline-flex items-center gap-1 rounded-control bg-brand-primary px-3 py-1 text-xs font-semibold text-white hover:bg-brand-hover"
                >
                  <Share className="h-3.5 w-3.5" />
                  <span>{t('pwa.iosGuideButton')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={dismissInstallBanner}
                aria-label={t('common.close')}
                className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {iosGuideOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="sp-card w-full max-w-md p-6 text-start">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold">{t('pwa.iosGuideTitle')}</h2>
              <button
                type="button"
                onClick={() => setIosGuideOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-control text-text-secondary hover:bg-surface-subtle"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="mt-4 list-decimal space-y-2.5 ps-5 text-sm text-text-secondary">
              <li>{t('pwa.iosStep1')}</li>
              <li>{t('pwa.iosStep2')}</li>
              <li>{t('pwa.iosStep3')}</li>
            </ol>
            <button
              type="button"
              onClick={() => setIosGuideOpen(false)}
              className="sp-tactile-control mt-5 w-full border-brand-hover bg-brand-primary py-2 text-xs font-semibold text-white"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
