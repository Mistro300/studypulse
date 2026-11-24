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
  WifiOff,
} from 'lucide-react';
import { useTheme } from '@/app/providers/theme-context';
import { setAppLocale } from '@/core/i18n';
import { useSyncStore } from '@/core/offline/sync-manager';
import { useAuthStore } from '@/features/auth/auth-store';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { StudyPulseLogo } from '@/shared/ui/StudyPulseArtwork';

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
      {/* Desktop Floating Rounded Sidebar Card */}
      <div className="hidden shrink-0 p-3 md:flex">
        <aside
          className={`sp-sidebar-card sticky top-3 flex h-[calc(100dvh-1.5rem)] flex-col transition-[width] duration-200 ${
            collapsed ? 'w-[80px]' : 'w-[236px]'
          }`}
        >
          <div className="flex h-16 items-center justify-between px-4">
            <StudyPulseLogo compact={collapsed} />
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
            >
              <ChevronLeft
                className={`h-4 w-4 transition-transform rtl:rotate-180 ${
                  collapsed ? 'rotate-180 rtl:rotate-0' : ''
                }`}
              />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1.5 px-3 py-2">
            {RAIL_ITEMS.map(({ to, labelKey, icon: Icon }) => {
              const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`group flex items-center gap-3 rounded-2xl px-2.5 py-2 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-brand-soft text-brand-primary'
                      : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
                      active
                        ? 'bg-gradient-to-br from-[#8B5CF6] to-[#5B21B6] text-white shadow-[0_6px_14px_-4px_rgba(109,40,217,0.6)]'
                        : 'bg-surface-subtle text-text-secondary group-hover:text-brand-primary'
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  {!collapsed && <span className="truncate">{t(labelKey)}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border-default p-3">
            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-status-danger/10 hover:text-status-danger"
            >
              <LogOut className="h-4 w-4 shrink-0 rtl:rotate-180" />
              {!collapsed && <span className="truncate">{t('auth.logout')}</span>}
            </button>
          </div>
        </aside>
      </div>

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Global Offline Banner */}
        {(!isOnline || authStatus === 'offline-cached') && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 border-b border-border-default bg-status-warning/10 px-4 py-1.5 text-xs font-semibold text-status-warning"
          >
            <WifiOff className="h-3.5 w-3.5" />
            <span>
              {authStatus === 'offline-cached'
                ? t('common.offlineCachedBadge')
                : t('common.offline')}
            </span>
          </div>
        )}

        {/* Airy Top Utility Strip */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 bg-surface-base/85 px-3 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <StudyPulseLogo />
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <span className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-elevated px-3.5 py-1.5 text-xs font-semibold text-text-primary shadow-sm">
              {isSyncing ? (
                <CloudUpload className="h-3.5 w-3.5 animate-pulse text-brand-primary" />
              ) : (
                <span
                  className={`h-2 w-2 rounded-full ${
                    !isOnline
                      ? 'bg-status-warning'
                      : pendingCount > 0
                        ? 'bg-accent-pulse'
                        : 'bg-status-success'
                  }`}
                />
              )}
              <span>
                {isSyncing
                  ? t('common.syncing')
                  : pendingCount > 0
                    ? t('common.pendingSync', { count: pendingCount })
                    : !isOnline
                      ? t('common.offline')
                      : 'Offline-First PWA'}
              </span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            {/* Warm Amber Streak Pill */}
            <div className="inline-flex items-center gap-1 rounded-full bg-accent-pulse-soft px-2.5 py-1.5 text-xs font-bold text-accent-pulse shadow-sm sm:px-3">
              <Flame className="h-3.5 w-3.5 fill-current" />
              <span className="sp-mono-numeric">{user?.streakDays ?? 0}</span>
            </div>

            {/* Theme Pill */}
            <button
              type="button"
              onClick={cycleMode}
              aria-label={`${t('theme.label')}: ${t(`theme.${mode}`)}`}
              title={`${t('theme.label')}: ${t(`theme.${mode}`)}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-default bg-surface-elevated px-2.5 text-xs font-semibold text-text-primary shadow-sm hover:bg-surface-subtle sm:h-9 sm:px-3"
            >
              <ThemeIcon className="h-3.5 w-3.5 text-brand-primary" />
              <span className="hidden lg:inline">{t(`theme.${mode}`)}</span>
            </button>

            {/* Locale Pill */}
            <button
              type="button"
              onClick={handleToggleLocale}
              aria-label={t('nav.toggleLanguage')}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-border-default bg-surface-elevated px-2.5 text-xs font-semibold text-text-primary shadow-sm hover:bg-surface-subtle sm:h-9 sm:gap-1.5 sm:px-3.5"
            >
              <Languages className="h-3.5 w-3.5 text-text-secondary" />
              <span className="sp-mono-numeric sm:hidden">
                {currentLocale === 'ar' ? 'EN' : 'AR'}
              </span>
              <span className="hidden sm:inline">{t('nav.toggleLanguage')}</span>
            </button>

            {/* Gradient Account Avatar */}
            <Link
              to="/settings"
              aria-label={t('nav.settings')}
              title={user?.displayName ?? t('nav.settings')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED] via-[#EC4899] to-[#F97316] text-xs font-bold text-white shadow-md"
            >
              {getInitials(user?.displayName)}
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-3 pb-24 sm:px-6 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Tab Bar (4 tabs + safe-area-inset) */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border-default bg-surface-elevated/95 px-2 pt-1.5 backdrop-blur-md md:hidden">
          {MOBILE_TABS.map(({ to, labelKey, icon: Icon }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-1 rounded-control py-1.5 text-[11px] font-semibold ${
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
