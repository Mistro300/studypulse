import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LoginInputSchema, RegisterInputSchema } from '@studypulse/shared';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Flame,
  Languages,
  Lock,
  Mail,
  Monitor,
  Moon,
  Sparkles,
  Sun,
  User,
} from 'lucide-react';
import { useTheme } from '@/app/providers/theme-context';
import { ApiClientError } from '@/core/api/client';
import { setAppLocale } from '@/core/i18n';
import { useAuthStore } from '@/features/auth/auth-store';
import { CircularProgressRing, StudyPulseLogo } from '@/shared/ui/StudyPulseArtwork';

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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    <div className="grid min-h-dvh bg-surface-base text-text-primary lg:grid-cols-2">
      {/* Start Half: Clean Floating Auth / Onboarding Card */}
      <div className="relative flex flex-col justify-center px-4 py-10 sm:px-10">
        {/* Compact Top-Start Utility Controls */}
        <div className="absolute inset-x-4 top-4 flex items-center justify-end gap-2 sm:inset-x-8">
          <button
            type="button"
            onClick={cycleMode}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-default bg-surface-elevated px-3 text-xs font-semibold shadow-sm hover:bg-surface-subtle"
          >
            <ThemeIcon className="h-3.5 w-3.5 text-brand-primary" />
            <span>{t(`theme.${mode}`)}</span>
          </button>
          <button
            type="button"
            onClick={handleToggleLocale}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-default bg-surface-elevated px-3 text-xs font-semibold shadow-sm hover:bg-surface-subtle"
          >
            <Languages className="h-3.5 w-3.5 text-text-secondary" />
            <span>{t('nav.toggleLanguage')}</span>
          </button>
        </div>

        <div className="mx-auto w-full max-w-[430px] pt-8">
          {step === 'credentials' ? (
            <div className="sp-card rounded-[26px] p-7 text-start sm:p-8">
              <div className="flex justify-center">
                <StudyPulseLogo />
              </div>

              <div className="mt-5 text-center">
                <h1 className="font-heading text-2xl font-extrabold text-text-primary">
                  {t('auth.welcomeTitle')}
                </h1>
                <p className="mt-1.5 text-sm text-text-secondary">{t('auth.welcomeSubtitle')}</p>
              </div>

              {/* Soft Lavender Demo Box */}
              <div className="mt-6 rounded-2xl bg-brand-soft p-3 text-center">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleDemoLogin}
                  className="sp-btn-violet inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-bold disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{t('auth.demoButton')}</span>
                </button>
              </div>

              {/* Segmented Tabs */}
              <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-2xl bg-surface-subtle p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setFieldErrors({});
                    setFormError(null);
                  }}
                  className={`rounded-xl py-2.5 text-xs font-bold transition-all ${
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
                  className={`rounded-xl py-2.5 text-xs font-bold transition-all ${
                    tab === 'register'
                      ? 'bg-surface-elevated text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t('auth.registerTab')}
                </button>
              </div>

              <form onSubmit={handleCredentialsSubmit} noValidate className="mt-5 space-y-3.5">
                {tab === 'register' && (
                  <div>
                    <div className="relative">
                      <User className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={t('auth.displayName')}
                        className="w-full rounded-xl border border-border-default bg-surface-base py-2.5 pe-3.5 ps-10 text-sm text-text-primary"
                      />
                    </div>
                    {fieldErrors.displayName && (
                      <p className="mt-1 text-xs text-status-danger">{fieldErrors.displayName}</p>
                    )}
                  </div>
                )}

                <div>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                    <input
                      type="email"
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('auth.email')}
                      className="w-full rounded-xl border border-border-default bg-surface-base py-2.5 pe-3.5 ps-10 text-sm text-text-primary"
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="mt-1 text-xs text-status-danger">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('auth.password')}
                      className="w-full rounded-xl border border-border-default bg-surface-base py-2.5 pe-10 ps-10 text-sm text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label="Toggle password visibility"
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="mt-1 text-xs text-status-danger">{fieldErrors.password}</p>
                  )}
                </div>

                {tab === 'login' && (
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded accent-brand-primary"
                      />
                      <span>{currentLocale === 'ar' ? 'تذكرني' : 'Remember me'}</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleDemoLogin}
                      className="font-medium text-brand-primary hover:underline"
                    >
                      {currentLocale === 'ar' ? 'جرّب الحساب التجريبي؟' : 'Try Demo account?'}
                    </button>
                  </div>
                )}

                {formError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger"
                  >
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="sp-btn-violet mt-1 inline-flex w-full items-center justify-center gap-2 py-3 text-sm font-bold disabled:opacity-60"
                >
                  <span>
                    {submitting
                      ? t('common.loading')
                      : tab === 'login'
                        ? t('auth.loginAction')
                        : t('auth.registerAction')}
                  </span>
                  <ArrowLeft className="h-4 w-4 ltr:rotate-180" />
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleFinishOnboarding} className="sp-card rounded-[26px] p-7 text-start">
              <h1 className="font-heading text-2xl font-extrabold">{t('auth.onboardingTitle')}</h1>
              <p className="mt-1.5 text-sm text-text-secondary">{t('auth.onboardingSubtitle')}</p>

              <div className="mt-5">
                <p className="mb-2 text-xs font-bold text-text-secondary">
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
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
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
                <div className="mb-2 flex items-center justify-between text-xs font-bold">
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
                      className={`sp-tactile-control sp-mono-numeric py-2 text-sm font-bold ${
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
                className="sp-btn-violet mt-6 w-full py-3 text-sm font-bold disabled:opacity-50"
              >
                {submitting ? t('common.loading') : t('auth.finishOnboarding')}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* End Half: Deep Violet Glassmorphic 3D Showcase Panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#1E1B4B] via-[#3B0764] to-[#4C1D95] p-12 text-white lg:flex lg:flex-col lg:items-center lg:justify-center">
        {/* Ambient radial glow + mesh waves */}
        <div className="pointer-events-none absolute -top-24 end-10 h-96 w-96 rounded-full bg-[#8B5CF6]/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 start-10 h-80 w-80 rounded-full bg-[#6366F1]/25 blur-3xl" />
        <svg
          viewBox="0 0 600 400"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
          preserveAspectRatio="none"
        >
          <path
            d="M0 240 C150 180, 250 320, 420 220 C500 175, 550 210, 600 180"
            stroke="#C4B5FD"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M0 270 C170 210, 270 350, 440 250 C520 205, 560 240, 600 210"
            stroke="#A78BFA"
            strokeWidth="1.2"
            fill="none"
          />
        </svg>

        {/* Floating Glassmorphic 3D Cards Cluster */}
        <div className="relative z-10 h-[420px] w-full max-w-md">
          {/* Card 1: Flashcards */}
          <div className="absolute start-10 top-4 w-44 -rotate-6 rounded-3xl border border-white/25 bg-gradient-to-br from-[#8B5CF6]/70 to-[#5B21B6]/60 p-5 text-center shadow-2xl backdrop-blur-xl">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Sparkles className="h-6 w-6 text-amber-300" />
            </span>
            <p className="mt-3 font-heading text-base font-extrabold">
              {currentLocale === 'ar' ? 'بطاقات الاستذكار' : 'FSRS-5 Cards'}
            </p>
            <p className="mt-1 text-[11px] text-purple-100/80">
              {currentLocale === 'ar' ? 'تكرار متباعد ذكي' : 'Offline-First Recall'}
            </p>
          </div>

          {/* Card 2: 3-Day Streak Glass Card */}
          <div className="absolute end-4 top-32 z-20 flex w-64 rotate-2 items-center gap-4 rounded-3xl border border-white/25 bg-white/12 p-5 shadow-2xl backdrop-blur-xl">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FBBF24] to-[#EA580C] shadow-lg">
              <Flame className="h-8 w-8 fill-current text-white" />
            </span>
            <div className="text-start">
              <p className="font-heading text-2xl font-extrabold">
                {currentLocale === 'ar' ? '3 أيام' : '3 Days'}
              </p>
              <p className="text-xs text-purple-100/90">
                {currentLocale === 'ar' ? 'سلسلة الدراسة اليومية' : 'Daily Study Streak'}
              </p>
            </div>
          </div>

          {/* Card 3: 72% Retention Ring Card */}
          <div className="absolute bottom-4 start-20 flex w-48 -rotate-3 flex-col items-center rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
            <CircularProgressRing
              percentage={72}
              size={68}
              color="#34D399"
              trackColor="rgba(255,255,255,0.2)"
              labelClassName="text-white text-sm"
            />
            <p className="mt-3 text-xs font-bold text-white">
              {currentLocale === 'ar' ? 'نسبة الاسترجاع' : 'Retention Rate'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
