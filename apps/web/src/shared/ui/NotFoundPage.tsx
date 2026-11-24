import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Compass, Home } from 'lucide-react';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="sp-card max-w-md p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-card bg-brand-soft text-brand-primary">
          <Compass className="h-6 w-6" />
        </span>
        <p className="sp-mono-numeric mt-4 text-3xl font-extrabold text-brand-primary">404</p>
        <h1 className="mt-2 font-heading text-xl font-bold text-text-primary">
          {t('errors.notFoundTitle')}
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">{t('errors.notFoundSubtitle')}</p>
        <Link
          to="/"
          className="sp-tactile-control mt-6 inline-flex items-center gap-2 border-brand-hover bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          <Home className="h-4 w-4" />
          <span>{t('study.backToDashboard')}</span>
        </Link>
      </div>
    </div>
  );
}
