import { useState, type ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  ChevronLeft,
  CloudUpload,
  Flame,
  Home,
  Languages,
  Layers,
  LogOut,
  Monitor,
  Moon,
  Radio,
  Settings,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useTheme } from '@/app/providers/theme-context';
import { setAppLocale } from '@/core/i18n';
import { useSyncStore } from '@/core/offline/sync-manager';
import { useAuthStore } from '@/features/auth/auth-store';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';

interface AppShellProps {
  children: ReactNode;
  focusMode?: boolean;
}

const RAIL_ITEMS = [
  { to: '/', labelKey: 'nav.dashboard', icon: Home },
  { to: '/decks', labelKey: 'nav.decks', icon: Layers },
  { to: '/rooms', labelKey: 'nav.rooms', icon: Radio },
  { to: '/analytics', labelKey: 'nav.analytics', icon: BarChart3 },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
] as const;

const MOBILE_TABS = RAIL_ITEMS.slice(0, 4);

function getInitials(name: string | undefined): string {
  if (!name) return 'SP';
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function AppShell({ children, focusMode = false }: AppShellProps) {
  const { t, i18n } = useTranslation();
  const { mode, cycleMode } = useTheme();
  const { isOnline } = useNetworkStatus();
  const user = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  const logout = useAuthStore((s) => s.logout);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const currentLocale = i18n.language === 'en' ? 'en' : 'ar';

  const handleToggleLocale = () => {
    setAppLocale(currentLocale === 'ar' ? 'en' : 'ar');
  };

  const ThemeIcon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor;

  if (focusMode) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh bg-surface-base text-text-primary">
      {/* Desktop Collapsible Rail (240px / 72px) */}
      <aside
        className={`hidden shrink-0 flex-col border-e border-border-default bg-surface-elevated transition-[width] duration-200 md:flex ${
          collapsed ? 'w-rail-collapsed' : 'w-rail-expanded'
        }`}
      >
        <div className="flex h-top-strip items-center justify-between border-b border-border-default px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-control bg-brand-primary text-sm font-bold text-white">
                SP
              </span>
              <span className="font-heading text-base font-bold tracking-tight">
                {t('common.appName')}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            className="flex h-8 w-8 items-center justify-center rounded-control text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
          >
            <ChevronLeft
              className={`h-4 w-4 transition-transform rtl:rotate-180 ${
                collapsed ? 'rotate-180 rtl:rotate-0' : ''
              }`}
            />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2.5">
          {RAIL_ITEMS.map(({ to, labelKey, icon: Icon }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-soft text-brand-primary'
                    : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{t(labelKey)}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border-default p-2.5">
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 rounded-control px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-status-danger/10 hover:text-status-danger"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{t('auth.logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Global Offline Banner */}
        {(!isOnline || authStatus === 'offline-cached') && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 border-b border-border-default bg-surface-subtle px-4 py-1.5 text-xs font-medium text-status-warning"
          >
            <WifiOff className="h-3.5 w-3.5" />
            <span>
              {authStatus === 'offline-cached'
                ? t('common.offlineCachedBadge')
                : t('common.offline')}
            </span>
          </div>
        )}

        {/* Top Strip (56px) */}
        <header className="sticky top-0 z-20 flex h-top-strip items-center justify-between gap-2 border-b border-border-default bg-surface-elevated px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-1.5 md:hidden">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-brand-primary text-xs font-bold text-white">
              SP
            </span>
            <span className="truncate font-heading text-sm font-bold">{t('common.appName')}</span>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-primary">
              {t('common.phase1Badge')}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Network / Sync Status Pill */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-subtle px-2 py-1 text-xs font-medium sm:px-2.5">
              {isSyncing ? (
                <CloudUpload className="h-3.5 w-3.5 animate-pulse text-brand-primary" />
              ) : isOnline ? (
                <Wifi className="h-3.5 w-3.5 text-status-success" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-status-warning" />
              )}
              <span className="hidden sm:inline">
                {isSyncing
                  ? t('common.syncing')
                  : pendingCount > 0
                    ? t('common.pendingSync', { count: pendingCount })
                    : isOnline
                      ? t('common.synced')
                      : t('common.offline')}
              </span>
            </div>

            {/* Streak Badge */}
            <div className="inline-flex items-center gap-1 rounded-full bg-accent-pulse-soft px-2 py-1 text-xs font-semibold text-accent-pulse sm:px-2.5">
              <Flame className="h-3.5 w-3.5" />
              <span className="sp-mono-numeric">{user?.streakDays ?? 0}</span>
            </div>

            {/* Theme Switcher */}
            <button
              type="button"
              onClick={cycleMode}
              aria-label={`${t('theme.label')}: ${t(`theme.${mode}`)}`}
              title={`${t('theme.label')}: ${t(`theme.${mode}`)}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border-default bg-surface-base px-2 text-xs font-medium text-text-primary hover:bg-surface-subtle sm:h-9 sm:px-2.5"
            >
              <ThemeIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t(`theme.${mode}`)}</span>
            </button>

            {/* Locale Toggle */}
            <button
              type="button"
              onClick={handleToggleLocale}
              aria-label={t('nav.toggleLanguage')}
              className="inline-flex h-8 items-center gap-1 rounded-control border border-border-default bg-surface-base px-2 text-xs font-medium text-text-primary hover:bg-surface-subtle sm:h-9 sm:gap-1.5 sm:px-2.5"
            >
              <Languages className="h-4 w-4" />
              <span className="sp-mono-numeric sm:hidden">
                {currentLocale === 'ar' ? 'EN' : 'AR'}
              </span>
              <span className="hidden sm:inline">{t('nav.toggleLanguage')}</span>
            </button>

            {/* Account Avatar */}
            <Link
              to="/settings"
              aria-label={t('nav.settings')}
              title={user?.displayName ?? t('nav.settings')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-primary"
            >
              {getInitials(user?.displayName)}
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Tab Bar (4 tabs + safe-area-inset) */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border-default bg-surface-elevated px-2 pt-1.5 md:hidden">
          {MOBILE_TABS.map(({ to, labelKey, icon: Icon }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-1 rounded-control py-1.5 text-[11px] font-medium ${
                  active ? 'text-brand-primary' : 'text-text-secondary'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{t(labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
