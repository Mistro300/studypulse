import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Locale, ThemeMode } from '@studypulse/shared';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CloudOff,
  Database,
  Download,
  HardDrive,
  Languages,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  Share,
  ShieldAlert,
  Smartphone,
  Sun,
  Trash2,
} from 'lucide-react';
import { useTheme } from '@/app/providers/theme-context';
import { setAppLocale } from '@/core/i18n';
import { offlineDb, type SyncOutboxRecord } from '@/core/offline/db';
import { useSyncStore } from '@/core/offline/sync-manager';
import { usePwaStore } from '@/core/pwa/pwa-manager';
import { useAuthStore } from '@/features/auth/auth-store';
import { DECK_KEYS } from '@/features/decks/api/decks-api';
import {
  SETTINGS_KEYS,
  useOfflineStorageOverviewQuery,
  usePushStatusQuery,
  useSubscribePushMutation,
  useUpdatePreferencesMutation,
} from '@/features/settings/api/settings-api';
import { NotificationPrePromptModal } from '@/features/settings/components/NotificationPrePromptModal';
import { SyncConflictModal } from '@/features/settings/components/SyncConflictModal';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { mode, setMode } = useTheme();
  const { isOnline } = useNetworkStatus();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const flushOutbox = useSyncStore((s) => s.flushOutbox);
  const refreshPendingCount = useSyncStore((s) => s.refreshPendingCount);

  const canInstall = usePwaStore((s) => s.canInstall);
  const isInstalled = usePwaStore((s) => s.isInstalled);
  const isIosSafari = usePwaStore((s) => s.isIosSafari);
  const offlineReady = usePwaStore((s) => s.offlineReady);
  const promptInstall = usePwaStore((s) => s.promptInstall);
  const setIosGuideOpen = usePwaStore((s) => s.setIosGuideOpen);

  const pushQuery = usePushStatusQuery(isOnline);
  const storageQuery = useOfflineStorageOverviewQuery();
  const updatePrefsMutation = useUpdatePreferencesMutation();
  const subscribePushMutation = useSubscribePushMutation();

  const [prePromptOpen, setPrePromptOpen] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [activeConflict, setActiveConflict] = useState<SyncOutboxRecord | null>(null);
  const [permissionState, setPermissionState] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  );

  const currentLocale: Locale = i18n.language === 'en' ? 'en' : 'ar';

  const handleThemeSelect = (nextTheme: ThemeMode) => {
    setMode(nextTheme);
    if (isOnline) {
      updatePrefsMutation.mutate({ theme: nextTheme });
    }
  };

  const handleLocaleSelect = (nextLocale: Locale) => {
    setAppLocale(nextLocale);
    if (isOnline) {
      updatePrefsMutation.mutate({ locale: nextLocale });
    }
  };

  const handleRequestNotifications = async () => {
    setPushMessage(null);
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermissionState('unsupported');
      setPrePromptOpen(false);
      setPushMessage(t('settings.pushUnsupported'));
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermissionState(result);
      setPrePromptOpen(false);

      if (result === 'granted') {
        // Persist opt-in preference + browser push subscription when SW PushManager is available
        if (isOnline) {
          await updatePrefsMutation.mutateAsync({ pushRemindersEnabled: true });
          const vapidKey = pushQuery.data?.vapidPublicKey;
          if ('serviceWorker' in navigator && vapidKey) {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: vapidKey,
            });
            const json = sub.toJSON();
            if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
              await subscribePushMutation.mutateAsync({
                endpoint: json.endpoint,
                keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
              });
            }
          }
        }
        setPushMessage(t('settings.pushEnabledSuccess'));
      } else if (result === 'denied') {
        setPushMessage(t('settings.pushDeniedHint'));
      }
    } catch {
      setPrePromptOpen(false);
      setPushMessage(t('settings.pushDeniedHint'));
    }
  };

  const handleRemoveOfflineDeck = async (deckId: string) => {
    await offlineDb.transaction('rw', offlineDb.offline_decks, offlineDb.offline_cards, async () => {
      await offlineDb.offline_decks.delete(deckId);
      await offlineDb.offline_cards.where('deckId').equals(deckId).delete();
    });
    void qc.invalidateQueries({ queryKey: SETTINGS_KEYS.offlineOverview });
    void qc.invalidateQueries({ queryKey: DECK_KEYS.offlineIds });
  };

  const handleFlushSync = async () => {
    await flushOutbox(user?.id);
    void qc.invalidateQueries({ queryKey: SETTINGS_KEYS.offlineOverview });
  };

  const handleResolveConflict = async (
    idempotencyKey: string,
    strategy: 'KEEP_LOCAL' | 'USE_SERVER',
  ) => {
    if (strategy === 'USE_SERVER') {
      await offlineDb.sync_outbox.delete(idempotencyKey);
    } else {
      await offlineDb.sync_outbox.update(idempotencyKey, {
        status: 'PENDING',
        lastError: null,
      });
      if (isOnline) {
        await flushOutbox(user?.id);
      }
    }
    await refreshPendingCount(user?.id);
    setActiveConflict(null);
    void qc.invalidateQueries({ queryKey: SETTINGS_KEYS.offlineOverview });
  };

  const storage = storageQuery.data;

  return (
    <div className="space-y-6 text-start">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">
          {t('settings.title')}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">{t('settings.subtitle')}</p>
      </div>

      {/* 1. Appearance, Language & Daily Goal */}
      <section className="sp-card p-6">
        <h2 className="font-heading text-base font-bold text-text-primary">
          {t('settings.appearanceTitle')}
        </h2>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {/* Theme 3-Way Segmented Control */}
          <div>
            <p className="mb-2 text-xs font-semibold text-text-secondary">{t('theme.label')}</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'system', icon: Monitor, label: t('theme.system') },
                  { id: 'light', icon: Sun, label: t('theme.light') },
                  { id: 'dark', icon: Moon, label: t('theme.dark') },
                ] as const
              ).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleThemeSelect(id)}
                  className={`sp-tactile-control flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
                    mode === id
                      ? 'border-brand-primary bg-brand-soft text-brand-primary'
                      : 'bg-surface-base text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Language Selector */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
              <Languages className="h-3.5 w-3.5" />
              <span>{t('settings.languageLabel')}</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'ar', label: 'العربية (RTL)' },
                  { id: 'en', label: 'English (LTR)' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleLocaleSelect(id)}
                  className={`sp-tactile-control py-2.5 text-xs font-semibold transition-colors ${
                    currentLocale === id
                      ? 'border-brand-primary bg-brand-soft text-brand-primary'
                      : 'bg-surface-base text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Web Push Notifications & Reminders */}
      <section className="sp-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-base font-bold text-text-primary">
              <Bell className="h-4 w-4 text-brand-primary" />
              <span>{t('settings.pushTitle')}</span>
            </h2>
            <p className="mt-1 text-xs text-text-secondary">{t('settings.pushSubtitle')}</p>
          </div>

          <button
            type="button"
            disabled={!isOnline}
            onClick={() => setPrePromptOpen(true)}
            className="sp-tactile-control border-brand-hover bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {permissionState === 'granted'
              ? t('settings.pushManageAction')
              : t('settings.pushEnableAction')}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <span className="rounded-full border border-border-default bg-surface-subtle px-3 py-1 font-medium text-text-secondary">
            {t('settings.pushPermissionStatus')}:{' '}
            <strong className="sp-mono-numeric text-text-primary">{permissionState}</strong>
          </span>
          {pushQuery.data && (
            <label className="inline-flex items-center gap-2 font-medium text-text-primary">
              <input
                type="checkbox"
                disabled={!isOnline}
                checked={pushQuery.data.pushRemindersEnabled}
                onChange={(e) =>
                  updatePrefsMutation.mutate({ pushRemindersEnabled: e.target.checked })
                }
                className="h-4 w-4 rounded accent-brand-primary"
              />
              <span>{t('settings.dailyReminderToggle')}</span>
            </label>
          )}
        </div>

        {pushMessage && (
          <p role="status" className="mt-3 text-xs font-medium text-brand-primary">
            {pushMessage}
          </p>
        )}
      </section>

      {/* 3. IndexedDB & Offline Storage Manager + Sync Outbox Viewer */}
      <section className="sp-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-base font-bold text-text-primary">
              <HardDrive className="h-4 w-4 text-brand-primary" />
              <span>{t('settings.offlineManagerTitle')}</span>
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              {t('settings.offlineManagerSubtitle')}
            </p>
          </div>

          <button
            type="button"
            disabled={!isOnline || isSyncing}
            onClick={() => void handleFlushSync()}
            className="sp-tactile-control inline-flex items-center gap-1.5 bg-surface-base px-3.5 py-2 text-xs font-semibold text-text-primary hover:bg-brand-soft hover:text-brand-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? t('common.syncing') : t('settings.syncNow')}</span>
          </button>
        </div>

        {/* Storage Quota Usage Bar */}
        {storage && (
          <div className="mt-4 rounded-control border border-border-default bg-surface-subtle p-4">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 text-text-primary">
                <Database className="h-3.5 w-3.5 text-brand-primary" />
                <span>{t('settings.storageUsageLabel')}</span>
              </span>
              <span className="sp-mono-numeric text-text-secondary">
                {formatBytes(storage.usageBytes)} / {formatBytes(storage.quotaBytes)} ({storage.usagePct}%)
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
              <div
                className="h-full rounded-full bg-brand-primary transition-[width] duration-300"
                style={{ width: `${Math.max(2, storage.usagePct)}%` }}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-surface-elevated p-2.5">
                <p className="text-[11px] text-text-secondary">{t('settings.pinnedDecksStat')}</p>
                <p className="mt-0.5">
                  <span className="sp-mono-numeric inline-block font-bold text-text-primary">
                    {storage.offlineDecks.length}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-surface-elevated p-2.5">
                <p className="text-[11px] text-text-secondary">{t('settings.cachedCardsStat')}</p>
                <p className="mt-0.5">
                  <span className="sp-mono-numeric inline-block font-bold text-text-primary">
                    {storage.cardsCount}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-surface-elevated p-2.5">
                <p className="text-[11px] text-text-secondary">{t('settings.localSrsStat')}</p>
                <p className="mt-0.5">
                  <span className="sp-mono-numeric inline-block font-bold text-brand-primary">
                    {storage.srsStatesCount}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-surface-elevated p-2.5">
                <p className="text-[11px] text-text-secondary">{t('settings.outboxStat')}</p>
                <p className="mt-0.5">
                  <span className="sp-mono-numeric inline-block font-bold text-accent-pulse">
                    {storage.outboxItems.length}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pinned Offline Decks List */}
        <div className="mt-5">
          <h3 className="text-xs font-bold text-text-secondary">
            {t('settings.pinnedDecksTitle')}
          </h3>
          {!storage || storage.offlineDecks.length === 0 ? (
            <p className="mt-2 flex items-center gap-2 rounded-control border border-dashed border-border-default p-3.5 text-xs text-text-secondary">
              <CloudOff className="h-4 w-4 shrink-0" />
              <span>{t('settings.noPinnedDecks')}</span>
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {storage.offlineDecks.map((deck) => (
                <li
                  key={deck.id}
                  className="flex items-center justify-between gap-3 rounded-control border border-border-default bg-surface-base px-3.5 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{deck.title}</p>
                    <p className="text-[11px] text-text-secondary">
                      {t('decks.cardsCount', { count: deck.cardCount })} · {deck.topic}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemoveOfflineDeck(deck.id)}
                    aria-label={t('decks.removeOffline')}
                    className="inline-flex items-center gap-1 rounded-control px-2.5 py-1.5 text-xs font-semibold text-status-danger hover:bg-status-danger/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t('common.delete')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sync Outbox Queue Viewer */}
        <div className="mt-5">
          <h3 className="text-xs font-bold text-text-secondary">{t('settings.outboxTitle')}</h3>
          {!storage || storage.outboxItems.length === 0 ? (
            <p className="mt-2 flex items-center gap-2 rounded-control bg-status-success/10 px-3.5 py-2.5 text-xs font-medium text-status-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{t('settings.outboxEmpty')}</span>
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {storage.outboxItems.map((item) => (
                <li
                  key={item.idempotencyKey}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border-default bg-surface-base px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <span className="font-semibold text-text-primary">{item.kind}</span>
                    <span className="sp-mono-numeric ms-2 text-[11px] text-text-secondary">
                      {item.idempotencyKey.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.status === 'CONFLICT'
                          ? 'bg-status-warning/15 text-status-warning'
                          : 'bg-brand-soft text-brand-primary'
                      }`}
                    >
                      {item.status}
                    </span>
                    {item.status === 'CONFLICT' && (
                      <button
                        type="button"
                        onClick={() => setActiveConflict(item)}
                        className="inline-flex items-center gap-1 rounded bg-status-warning px-2 py-1 text-[11px] font-bold text-white"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        <span>{t('settings.resolveConflict')}</span>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 4. PWA App Status & Security Logout Wipe */}
      <section className="sp-card p-6">
        <h2 className="flex items-center gap-2 font-heading text-base font-bold text-text-primary">
          <Smartphone className="h-4 w-4 text-brand-primary" />
          <span>{t('settings.pwaSectionTitle')}</span>
        </h2>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span className="rounded-full bg-surface-subtle px-3 py-1 font-medium text-text-secondary">
            {isInstalled ? t('pwa.installedBadge') : t('pwa.browserModeBadge')}
          </span>
          {offlineReady && (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-success/10 px-3 py-1 font-semibold text-status-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{t('pwa.offlineReadyBadge')}</span>
            </span>
          )}
          {canInstall && !isInstalled && (
            <button
              type="button"
              onClick={() => void promptInstall()}
              className="sp-tactile-control inline-flex items-center gap-1.5 border-brand-hover bg-brand-primary px-3.5 py-1.5 text-xs font-semibold text-white"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{t('pwa.installAction')}</span>
            </button>
          )}
          {isIosSafari && !isInstalled && (
            <button
              type="button"
              onClick={() => setIosGuideOpen(true)}
              className="sp-tactile-control inline-flex items-center gap-1.5 bg-surface-base px-3.5 py-1.5 text-xs font-semibold text-text-primary"
            >
              <Share className="h-3.5 w-3.5" />
              <span>{t('pwa.iosGuideButton')}</span>
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-border-default pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <ShieldAlert className="h-4 w-4 shrink-0 text-status-danger" />
              <span>{t('settings.logoutSecurityNote')}</span>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="sp-tactile-control inline-flex items-center gap-2 border-status-danger/40 bg-status-danger/10 px-4 py-2 text-xs font-semibold text-status-danger hover:bg-status-danger hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span>{t('auth.logoutAndClear')}</span>
            </button>
          </div>
        </div>
      </section>

      <NotificationPrePromptModal
        open={prePromptOpen}
        submitting={updatePrefsMutation.isPending || subscribePushMutation.isPending}
        onConfirm={() => void handleRequestNotifications()}
        onClose={() => setPrePromptOpen(false)}
      />

      <SyncConflictModal
        conflict={activeConflict}
        onResolve={handleResolveConflict}
        onClose={() => setActiveConflict(null)}
      />
    </div>
  );
}
