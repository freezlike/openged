import { Request } from 'express';

import { LocaleCode } from '../i18n/locale';
import { RequestUser } from './request-user.interface';

export interface LocalizedRequest extends Request {
  locale?: LocaleCode;
  user?: RequestUser;
}
