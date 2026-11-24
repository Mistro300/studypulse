import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Locale } from '@studypulse/shared';
import { ar } from './locales/ar';
import { en } from './locales/en';

export const LOCALE_STORAGE_KEY = 'studypulse.locale';

function getInitialLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // Ignore storage access errors in restricted modes
  }
  return 'ar';
}

export function applyDocumentDirection(locale: Locale): void {
  const root = document.documentElement;
  root.setAttribute('lang', locale);
  root.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
}

const initialLocale = getInitialLocale();
applyDocumentDirection(initialLocale);

void i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: initialLocale,
  fallbackLng: 'ar',
  interpolation: {
    escapeValue: false,
  },
});

export function setAppLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage quota errors
  }
  applyDocumentDirection(locale);
  void i18n.changeLanguage(locale);
}

export default i18n;
