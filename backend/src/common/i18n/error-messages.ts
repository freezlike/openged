import { LocaleCode } from './locale';

type MessageDictionary = Record<string, string>;

const messages: Record<LocaleCode, MessageDictionary> = {
  fr: {
    INTERNAL_ERROR: 'Une erreur interne est survenue.',
    BAD_REQUEST: 'Requete invalide.',
    VALIDATION_ERROR: 'Validation echouee.',
    UNAUTHORIZED: 'Authentification requise.',
    INVALID_CREDENTIALS: 'Identifiants invalides.',
    PERMISSION_DENIED: 'Vous n\'avez pas les permissions necessaires.',
    NOT_FOUND: 'Ressource introuvable.',
    CONFLICT: 'Conflit detecte.',
    RATE_LIMITED: 'Trop de requetes. Reessayez plus tard.',
    INSTALLER_DISABLED: 'L\'assistant d\'installation est desactive.',
    DOC_NOT_FOUND: 'Document introuvable.',
    USER_NOT_FOUND: 'Utilisateur introuvable.',
    INVALID_RESET_TOKEN: 'Le jeton de reinitialisation est invalide ou expire.',
    LOCAL_LOGIN_DISABLED: 'La connexion locale est desactivee en mode SSO_ONLY.',
    TASK_ALREADY_COMPLETED: 'Cette tache a deja ete traitee.',
  },
  en: {
    INTERNAL_ERROR: 'An internal error occurred.',
    BAD_REQUEST: 'Invalid request.',
    VALIDATION_ERROR: 'Validation failed.',
    UNAUTHORIZED: 'Authentication required.',
    INVALID_CREDENTIALS: 'Invalid credentials.',
    PERMISSION_DENIED: 'You do not have permission to perform this action.',
    NOT_FOUND: 'Resource not found.',
    CONFLICT: 'Conflict detected.',
    RATE_LIMITED: 'Too many requests. Please try again later.',
    INSTALLER_DISABLED: 'Installer is disabled.',
    DOC_NOT_FOUND: 'Document not found.',
    USER_NOT_FOUND: 'User not found.',
    INVALID_RESET_TOKEN: 'Reset token is invalid or expired.',
    LOCAL_LOGIN_DISABLED: 'Local login is disabled in SSO_ONLY mode.',
    TASK_ALREADY_COMPLETED: 'This task has already been processed.',
  },
  ar: {
    INTERNAL_ERROR: 'حدث خطا داخلي.',
    BAD_REQUEST: 'الطلب غير صالح.',
    VALIDATION_ERROR: 'فشل التحقق من البيانات.',
    UNAUTHORIZED: 'المصادقة مطلوبة.',
    INVALID_CREDENTIALS: 'بيانات الاعتماد غير صحيحة.',
    PERMISSION_DENIED: 'ليست لديك صلاحية لتنفيذ هذا الاجراء.',
    NOT_FOUND: 'المورد غير موجود.',
    CONFLICT: 'تم اكتشاف تعارض.',
    RATE_LIMITED: 'عدد كبير جدا من الطلبات. حاول مرة اخرى لاحقا.',
    INSTALLER_DISABLED: 'معالج التثبيت معطل.',
    DOC_NOT_FOUND: 'المستند غير موجود.',
    USER_NOT_FOUND: 'المستخدم غير موجود.',
    INVALID_RESET_TOKEN: 'رمز اعادة التعيين غير صالح او منتهي الصلاحية.',
    LOCAL_LOGIN_DISABLED: 'تم تعطيل تسجيل الدخول المحلي في وضع SSO_ONLY.',
    TASK_ALREADY_COMPLETED: 'تمت معالجة هذه المهمة بالفعل.',
  },
};

const FALLBACK_CODE = 'INTERNAL_ERROR';

export function translateErrorCode(
  code: string,
  locale: LocaleCode,
  params?: Record<string, string | number | boolean | null | undefined>,
): string {
  const template = messages[locale][code] ?? messages[locale][FALLBACK_CODE] ?? messages.fr[FALLBACK_CODE];

  if (!params) {
    return template;
  }

  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value ?? ''));
  }, template);
}
