import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';

import { PrismaService } from '../../database/prisma.service';
import { LocalizedRequest } from '../interfaces/localized-request.interface';
import {
  LocaleCode,
  LOCALE_CODE_BY_ENUM,
  resolveFromAcceptLanguage,
} from '../i18n/locale';

@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  private cachedDefaultLocale: LocaleCode = 'fr';
  private lastLoadedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async use(request: LocalizedRequest, _response: Response, next: NextFunction) {
    const headerLocale = resolveFromAcceptLanguage(request.headers['accept-language']);
    const defaultLocale = await this.loadDefaultLocale();

    request.locale = headerLocale ?? defaultLocale;

    next();
  }

  private async loadDefaultLocale() {
    const now = Date.now();

    if (now - this.lastLoadedAt < 60_000) {
      return this.cachedDefaultLocale;
    }

    const settings = await this.prisma.orgSettings.findUnique({
      where: { id: 1 },
      select: { defaultLocale: true },
    });

    if (settings?.defaultLocale) {
      this.cachedDefaultLocale = LOCALE_CODE_BY_ENUM[settings.defaultLocale as 'FR' | 'EN' | 'AR'];
    }

    this.lastLoadedAt = now;
    return this.cachedDefaultLocale;
  }
}
