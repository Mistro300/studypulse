import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Locale, ThemeMode } from '@studypulse/shared';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  CloudOff,
  Database,
  Download,
  Eye,
  FolderClosed,
  LogOut,
  RefreshCw,
  Share,
  Smartphone,
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
import { GlossySquircle } from '@/shared/ui/StudyPulseArtwork';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
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
  const [installNotice, setInstallNotice] = useState<string | null>(null);
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

  const handleInstallClick = async () => {
    setInstallNotice(null);
    if (canInstall && !isInstalled) {
      await promptInstall();
      return;
    }
    if (isIosSafari && !isInstalled) {
      setIosGuideOpen(true);
      return;
    }
    setInstallNotice(
      isInstalled
        ? t('pwa.installedBadge')
        : isAr
          ? 'يمكنك تثبيت التطبيق من قائمة المتصفح (Add to Home Screen / Install App).'
          : 'You can install the app from your browser menu (Install App / Add to Home Screen).',
    );
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
  const pushBadgeLabel =
    permissionState === 'granted'
      ? isAr
        ? 'مفعّلة'
        : 'Enabled'
      : permissionState === 'denied'
        ? isAr
          ? 'مرفوضة'
          : 'Blocked'
        : isAr
          ? 'جاهز للتفعيل'
          : 'Ready to enable';

  return (
    <div className="space-y-6 text-start">
      {/* Page Header */}
      <div>
        <h1 className="font-heading text-2xl font-extrabold text-text-primary sm:text-3xl">
          {t('settings.title')}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {isAr ? 'Settings & Offline App Management' : t('settings.subtitle')}
        </p>
      </div>

      {/* Primary 2x2 Bento Card Grid */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Card 1: Review Notifications */}
        <section className="sp-card flex flex-col justify-between rounded-[24px] p-6">
          <div>
            <div className="flex items-center gap-3.5">
              <GlossySquircle tone="soft" size="lg">
                <Bell className="h-5 w-5 text-brand-primary" />
              </GlossySquircle>
              <h2 className="font-heading text-lg font-extrabold text-text-primary">
                {t('settings.pushTitle')}
              </h2>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-text-secondary sm:text-sm">
              {t('settings.pushSubtitle')}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-primary">
                {pushBadgeLabel}
              </span>
              {pushQuery.data && (
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary">
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
              <p role="status" className="mt-3 text-xs font-semibold text-brand-primary">
                {pushMessage}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={!isOnline}
            onClick={() => setPrePromptOpen(true)}
            className="sp-btn-violet mt-5 w-full rounded-xl py-3 text-sm font-bold disabled:opacity-50"
          >
            {permissionState === 'granted'
              ? t('settings.pushManageAction')
              : t('settings.pushEnableAction')}
          </button>
        </section>

        {/* Card 2: Appearance & Language */}
        <section className="sp-card flex flex-col justify-between rounded-[24px] p-6">
          <div className="flex items-center gap-3.5">
            <GlossySquircle tone="soft" size="lg">
              <Eye className="h-5 w-5 text-brand-primary" />
            </GlossySquircle>
            <h2 className="font-heading text-lg font-extrabold text-text-primary">
              {t('settings.appearanceTitle')}
            </h2>
          </div>

          <div className="mt-5 space-y-4">
            {/* Theme Pill Segmented Control */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-text-secondary">{t('theme.label')}</span>
              <div className="grid flex-1 grid-cols-3 rounded-full border border-border-default bg-surface-subtle/80 p-1">
                {(
                  [
                    { id: 'dark', label: t('theme.dark') },
                    { id: 'light', label: t('theme.light') },
                    { id: 'system', label: t('theme.system') },
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleThemeSelect(id)}
                    className={`rounded-full py-1.5 text-xs font-bold transition-all ${
                      mode === id
                        ? 'bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Pill Segmented Control */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-text-secondary">
                {t('settings.languageLabel')}
              </span>
              <div className="grid flex-1 grid-cols-2 rounded-full border border-border-default bg-surface-subtle/80 p-1">
                {(
                  [
                    { id: 'en', label: 'English LTR' },
                    { id: 'ar', label: 'العربية RTL' },
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleLocaleSelect(id)}
                    className={`rounded-full py-1.5 text-xs font-bold transition-all ${
                      currentLocale === id
                        ? 'bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Card 3: PWA Status & Local Data Wipe */}
        <section className="sp-card flex flex-col justify-between rounded-[24px] p-6">
          <div>
            <div className="flex items-center gap-3.5">
              <GlossySquircle tone="soft" size="lg">
                <Smartphone className="h-5 w-5 text-brand-primary" />
              </GlossySquircle>
              <h2 className="font-heading text-lg font-extrabold text-text-primary">
                {t('settings.pwaSectionTitle')}
              </h2>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-text-secondary">
                {isInstalled ? t('pwa.installedBadge') : t('pwa.browserModeBadge')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success/15 px-3 py-1 font-bold text-status-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  {offlineReady
                    ? isAr
                      ? 'نشط (SW Active)'
                      : 'Active (SW Ready)'
                    : isAr
                      ? 'جاهز للعمل أوفلاين'
                      : 'Offline Ready'}
                </span>
              </span>
            </div>

            {installNotice && (
              <p role="status" className="mt-2.5 text-xs font-medium text-brand-primary">
                {installNotice}
              </p>
            )}
          </div>

          <div className="mt-5 space-y-2.5">
            <button
              type="button"
              onClick={() => void handleInstallClick()}
              className="sp-btn-violet inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
            >
              {isIosSafari && !isInstalled ? (
                <Share className="h-4 w-4" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{t('pwa.installAction')}</span>
            </button>

            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-status-danger/20 bg-status-danger/10 py-3 text-sm font-bold text-status-danger transition-colors hover:bg-status-danger hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span>{isAr ? 'مسح البيانات المحلية' : t('auth.logoutAndClear')}</span>
            </button>
          </div>
        </section>

        {/* Card 4: Local Storage & Sync */}
        <section className="sp-card flex flex-col justify-between rounded-[24px] p-6">
          <div>
            <div className="flex items-center gap-3.5">
              <GlossySquircle tone="soft" size="lg">
                <Database className="h-5 w-5 text-brand-primary" />
              </GlossySquircle>
              <h2 className="font-heading text-lg font-extrabold text-text-primary">
                {t('settings.offlineManagerTitle')}
              </h2>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                <span className="text-text-secondary">{t('settings.storageUsageLabel')}</span>
                <span className="sp-mono-numeric font-bold text-text-primary">
                  {storage
                    ? `${formatBytes(storage.usageBytes)} / ${formatBytes(storage.quotaBytes)}`
                    : '...'}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-soft">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#6366F1] transition-[width] duration-300"
                  style={{ width: `${Math.max(6, storage?.usagePct ?? 6)}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="flex items-center justify-center gap-2 rounded-full bg-surface-subtle/80 px-3 py-2 text-xs font-bold text-text-primary">
                  <Clock className="h-3.5 w-3.5 text-brand-primary" />
                  <span>
                    {t('settings.outboxStat')}:{' '}
                    <span className="sp-mono-numeric">{storage?.outboxItems.length ?? 0}</span>
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2 rounded-full bg-surface-subtle/80 px-3 py-2 text-xs font-bold text-text-primary">
                  <FolderClosed className="h-3.5 w-3.5 text-brand-primary" />
                  <span>
                    {t('settings.pinnedDecksStat')}:{' '}
                    <span className="sp-mono-numeric">{storage?.offlineDecks.length ?? 0}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={!isOnline || isSyncing}
            onClick={() => void handleFlushSync()}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-elevated py-3 text-sm font-bold text-text-primary shadow-sm transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? t('common.syncing') : t('settings.syncNow')}</span>
          </button>
        </section>
      </div>

      {/* Pinned Offline Decks & Sync Outbox Details */}
      <div className="grid gap-5 md:grid-cols-2">
        <section className="sp-card rounded-[24px] p-5">
          <h3 className="font-heading text-sm font-extrabold text-text-primary">
            {t('settings.pinnedDecksTitle')}
          </h3>
          {!storage || storage.offlineDecks.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-border-default p-4 text-xs text-text-secondary">
              <CloudOff className="h-4 w-4 shrink-0" />
              <span>{t('settings.noPinnedDecks')}</span>
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {storage.offlineDecks.map((deck) => (
                <li
                  key={deck.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border-default bg-surface-base px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-bold text-text-primary">{deck.title}</p>
                    <p className="text-[11px] text-text-secondary">
                      {t('decks.cardsCount', { count: deck.cardCount })} · {deck.topic}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemoveOfflineDeck(deck.id)}
                    aria-label={t('decks.removeOffline')}
                    className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-status-danger hover:bg-status-danger/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t('common.delete')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sp-card rounded-[24px] p-5">
          <h3 className="font-heading text-sm font-extrabold text-text-primary">
            {t('settings.outboxTitle')}
          </h3>
          {!storage || storage.outboxItems.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 rounded-2xl bg-status-success/12 px-4 py-3.5 text-xs font-bold text-status-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{t('settings.outboxEmpty')}</span>
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {storage.outboxItems.map((item) => (
                <li
                  key={item.idempotencyKey}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border-default bg-surface-base px-4 py-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-text-primary">{item.kind}</span>
                    <span className="sp-mono-numeric ms-2 text-[11px] text-text-secondary">
                      {item.idempotencyKey.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
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
                        className="inline-flex items-center gap-1 rounded-lg bg-status-warning px-2.5 py-1 text-[11px] font-bold text-white"
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
        </section>
      </div>

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
