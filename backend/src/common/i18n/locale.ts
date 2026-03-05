export const SUPPORTED_LOCALES = ['fr', 'en', 'ar'] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_ENUM_BY_CODE: Record<LocaleCode, 'FR' | 'EN' | 'AR'> = {
  fr: 'FR',
  en: 'EN',
  ar: 'AR',
};

export const LOCALE_CODE_BY_ENUM: Record<'FR' | 'EN' | 'AR', LocaleCode> = {
  FR: 'fr',
  EN: 'en',
  AR: 'ar',
};

export function isSupportedLocale(locale?: string | null): locale is LocaleCode {
  return Boolean(locale && SUPPORTED_LOCALES.includes(locale as LocaleCode));
}

export function normalizeLocale(input?: string | null): LocaleCode | undefined {
  if (!input) {
    return undefined;
  }

  const lowered = input.toLowerCase();

  if (isSupportedLocale(lowered)) {
    return lowered;
  }

  const base = lowered.split('-')[0];

  if (isSupportedLocale(base)) {
    return base;
  }

  return undefined;
}

export function resolveFromAcceptLanguage(headerValue?: string | null): LocaleCode | undefined {
  if (!headerValue) {
    return undefined;
  }

  const parts = headerValue
    .split(',')
    .map((part) => part.trim().split(';')[0])
    .filter(Boolean);

  for (const part of parts) {
    const normalized = normalizeLocale(part);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}
