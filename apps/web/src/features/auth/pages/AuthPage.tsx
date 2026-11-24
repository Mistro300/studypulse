import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LoginInputSchema, RegisterInputSchema } from '@studypulse/shared';
import { Check, Languages, Monitor, Moon, Sparkles, Sun } from 'lucide-react';
import { useTheme } from '@/app/providers/theme-context';
import { ApiClientError } from '@/core/api/client';
import { setAppLocale } from '@/core/i18n';
import { useAuthStore } from '@/features/auth/auth-store';

const INTEREST_OPTIONS = [
  'Frontend',
  'Backend',
  'System Design',
  'TypeScript',
  'PWA',
  'Databases',
  'Algorithms',
  'Cloud',
];

export function AuthPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { mode, cycleMode } = useTheme();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const loginDemo = useAuthStore((s) => s.loginDemo);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'credentials' | 'onboarding'>('credentials');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Onboarding state
  const [interests, setInterests] = useState<string[]>(['Frontend', 'System Design']);
  const [dailyGoal, setDailyGoal] = useState(20);

  const currentLocale = i18n.language === 'en' ? 'en' : 'ar';
  const ThemeIcon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor;

  const handleToggleLocale = () => {
    setAppLocale(currentLocale === 'ar' ? 'en' : 'ar');
  };

  const handleCredentialsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    if (tab === 'login') {
      const parsed = LoginInputSchema.safeParse({ email, password });
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? '_root');
          errs[key] = issue.message;
        }
        setFieldErrors(errs);
        return;
      }

      setSubmitting(true);
      try {
        const user = await login(parsed.data);
        if (!user.preferences.onboardingCompleted) {
          setStep('onboarding');
        } else {
          await navigate({ to: '/' });
        }
      } catch (err) {
        setFormError(
          err instanceof ApiClientError ? err.normalized.message : t('auth.invalidCredentials'),
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const parsed = RegisterInputSchema.safeParse({
      email,
      password,
      displayName,
      locale: currentLocale,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '_root');
        errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      await register(parsed.data);
      setStep('onboarding');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.normalized.message);
        if (err.normalized.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, list] of Object.entries(err.normalized.fieldErrors)) {
            if (list[0]) mapped[k] = list[0];
          }
          setFieldErrors(mapped);
        }
      } else {
        setFormError(t('errors.unexpectedTitle'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setFormError(null);
    setSubmitting(true);
    try {
      await loginDemo();
      await navigate({ to: '/' });
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.normalized.message : t('errors.unexpectedTitle'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleInterest = (topic: string) => {
    setInterests((prev) =>
      prev.includes(topic) ? prev.filter((item) => item !== topic) : [...prev, topic],
    );
  };

  const handleFinishOnboarding = async (e: FormEvent) => {
    e.preventDefault();
    if (interests.length === 0) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await completeOnboarding({
        interests,
        dailyGoal,
        locale: currentLocale,
        theme: mode,
      });
      await navigate({ to: '/' });
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.normalized.message : t('errors.unexpectedTitle'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface-base text-text-primary">
      {/* Top utility bar */}
      <header className="flex h-top-strip items-center justify-between border-b border-border-default bg-surface-elevated px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-control bg-brand-primary text-sm font-bold text-white">
            SP
          </span>
          <span className="font-heading text-base font-bold">{t('common.appName')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cycleMode}
            className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border-default bg-surface-base px-2.5 text-xs font-medium hover:bg-surface-subtle"
          >
            <ThemeIcon className="h-4 w-4" />
            <span>{t(`theme.${mode}`)}</span>
          </button>
          <button
            type="button"
            onClick={handleToggleLocale}
            className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border-default bg-surface-base px-2.5 text-xs font-medium hover:bg-surface-subtle"
          >
            <Languages className="h-4 w-4" />
            <span>{t('nav.toggleLanguage')}</span>
          </button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        {step === 'credentials' ? (
          <div className="sp-card w-full max-w-md p-6 text-start">
            <div className="mb-5">
              <h1 className="font-heading text-2xl font-bold text-text-primary">
                {t('auth.welcomeTitle')}
              </h1>
              <p className="mt-1.5 text-sm text-text-secondary">{t('auth.welcomeSubtitle')}</p>
            </div>

            {/* 1-Click Recruiter Demo Card */}
            <div className="mb-5 rounded-control border border-brand-primary/30 bg-brand-soft p-3.5">
              <button
                type="button"
                disabled={submitting}
                onClick={handleDemoLogin}
                className="sp-tactile-control flex w-full items-center justify-center gap-2 border-brand-hover bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                <span>{t('auth.demoButton')}</span>
              </button>
              <p className="mt-2 text-xs text-text-secondary">{t('auth.demoHint')}</p>
            </div>

            {/* Auth Mode Tabs */}
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-control bg-surface-subtle p-1">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setFieldErrors({});
                  setFormError(null);
                }}
                className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                  tab === 'login'
                    ? 'bg-surface-elevated text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {t('auth.loginTab')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setFieldErrors({});
                  setFormError(null);
                }}
                className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                  tab === 'register'
                    ? 'bg-surface-elevated text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {t('auth.registerTab')}
              </button>
            </div>

            <form onSubmit={handleCredentialsSubmit} noValidate className="space-y-3.5">
              {tab === 'register' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {t('auth.displayName')}
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Mohamed Bahaa"
                    className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                  />
                  {fieldErrors.displayName && (
                    <p className="mt-1 text-xs text-status-danger">{fieldErrors.displayName}</p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {t('auth.email')}
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-status-danger">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {t('auth.password')}
                </label>
                <input
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                />
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-status-danger">{fieldErrors.password}</p>
                )}
              </div>

              {formError && (
                <p
                  role="alert"
                  className="rounded-control border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger"
                >
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="sp-tactile-control w-full border-border-default bg-surface-subtle px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-brand-soft hover:text-brand-primary disabled:opacity-60"
              >
                {submitting
                  ? t('common.loading')
                  : tab === 'login'
                    ? t('auth.loginAction')
                    : t('auth.registerAction')}
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleFinishOnboarding} className="sp-card w-full max-w-lg p-6 text-start">
            <h1 className="font-heading text-2xl font-bold">{t('auth.onboardingTitle')}</h1>
            <p className="mt-1.5 text-sm text-text-secondary">{t('auth.onboardingSubtitle')}</p>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold text-text-secondary">
                {t('auth.interestsLabel')}
              </p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((topic) => {
                  const selected = interests.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleInterest(topic)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        selected
                          ? 'border-brand-primary bg-brand-soft text-brand-primary'
                          : 'border-border-default bg-surface-base text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                      <span>{topic}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span className="text-text-secondary">{t('auth.dailyGoalLabel')}</span>
                <span className="sp-mono-numeric inline-block text-brand-primary">
                  {t('auth.cardsPerDay', { count: dailyGoal })}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[10, 20, 35, 50].map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => setDailyGoal(goal)}
                    className={`sp-tactile-control sp-mono-numeric py-2 text-sm font-semibold ${
                      dailyGoal === goal
                        ? 'border-brand-primary bg-brand-soft text-brand-primary'
                        : 'bg-surface-base text-text-secondary'
                    }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>

            {formError && (
              <p role="alert" className="mt-4 text-xs text-status-danger">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || interests.length === 0}
              className="sp-tactile-control mt-6 w-full border-brand-hover bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {submitting ? t('common.loading') : t('auth.finishOnboarding')}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
