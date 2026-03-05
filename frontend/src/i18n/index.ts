import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import arAdmin from './locales/ar/admin.json';
import arAudit from './locales/ar/audit.json';
import arAuth from './locales/ar/auth.json';
import arCommon from './locales/ar/common.json';
import arDocument from './locales/ar/document.json';
import arErrors from './locales/ar/errors.json';
import arInstaller from './locales/ar/installer.json';
import arLibrary from './locales/ar/library.json';
import arWorkflow from './locales/ar/workflow.json';
import enAdmin from './locales/en/admin.json';
import enAudit from './locales/en/audit.json';
import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enDocument from './locales/en/document.json';
import enErrors from './locales/en/errors.json';
import enInstaller from './locales/en/installer.json';
import enLibrary from './locales/en/library.json';
import enWorkflow from './locales/en/workflow.json';
import frAdmin from './locales/fr/admin.json';
import frAudit from './locales/fr/audit.json';
import frAuth from './locales/fr/auth.json';
import frCommon from './locales/fr/common.json';
import frDocument from './locales/fr/document.json';
import frErrors from './locales/fr/errors.json';
import frInstaller from './locales/fr/installer.json';
import frLibrary from './locales/fr/library.json';
import frWorkflow from './locales/fr/workflow.json';

export const supportedLocales = ['fr', 'en', 'ar'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

const resources = {
  fr: {
    common: frCommon,
    auth: frAuth,
    installer: frInstaller,
    library: frLibrary,
    document: frDocument,
    workflow: frWorkflow,
    admin: frAdmin,
    audit: frAudit,
    errors: frErrors,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    installer: enInstaller,
    library: enLibrary,
    document: enDocument,
    workflow: enWorkflow,
    admin: enAdmin,
    audit: enAudit,
    errors: enErrors,
  },
  ar: {
    common: arCommon,
    auth: arAuth,
    installer: arInstaller,
    library: arLibrary,
    document: arDocument,
    workflow: arWorkflow,
    admin: arAdmin,
    audit: arAudit,
    errors: arErrors,
  },
} as const;

function normalizeLocale(input?: string | null): SupportedLocale {
  if (!input) {
    return 'fr';
  }

  const lowered = input.toLowerCase();
  if (supportedLocales.includes(lowered as SupportedLocale)) {
    return lowered as SupportedLocale;
  }

  const base = lowered.split('-')[0];
  if (supportedLocales.includes(base as SupportedLocale)) {
    return base as SupportedLocale;
  }

  return 'fr';
}

function resolveInitialLocale(): SupportedLocale {
  const rawStorage = localStorage.getItem('openged.locale');
  if (rawStorage) {
    return normalizeLocale(rawStorage);
  }

  return normalizeLocale(navigator.language);
}

function applyDocumentLocale(locale: SupportedLocale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.classList.toggle('font-arabic', locale === 'ar');
}

i18n.use(initReactI18next).init({
  resources,
  lng: resolveInitialLocale(),
  fallbackLng: 'fr',
  supportedLngs: [...supportedLocales],
  defaultNS: 'common',
  ns: ['common', 'auth', 'installer', 'library', 'document', 'workflow', 'admin', 'audit', 'errors'],
  interpolation: {
    escapeValue: false,
  },
});

applyDocumentLocale(i18n.language as SupportedLocale);

i18n.on('languageChanged', (language) => {
  const locale = normalizeLocale(language);
  localStorage.setItem('openged.locale', locale);
  applyDocumentLocale(locale);
});

export { i18n };
