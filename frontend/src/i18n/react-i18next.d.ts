import 'react-i18next';

import admin from './locales/fr/admin.json';
import audit from './locales/fr/audit.json';
import auth from './locales/fr/auth.json';
import common from './locales/fr/common.json';
import document from './locales/fr/document.json';
import errors from './locales/fr/errors.json';
import installer from './locales/fr/installer.json';
import library from './locales/fr/library.json';
import workflow from './locales/fr/workflow.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      admin: typeof admin;
      audit: typeof audit;
      auth: typeof auth;
      common: typeof common;
      document: typeof document;
      errors: typeof errors;
      installer: typeof installer;
      library: typeof library;
      workflow: typeof workflow;
    };
  }
}
