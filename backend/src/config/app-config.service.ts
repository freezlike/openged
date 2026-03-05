import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get authMode(): 'LOCAL_ONLY' | 'LOCAL_AND_SSO' | 'SSO_ONLY' {
    return this.configService.get<'LOCAL_ONLY' | 'LOCAL_AND_SSO' | 'SSO_ONLY'>(
      'app.authMode',
      'LOCAL_ONLY',
    );
  }

  get jwtSecret(): string {
    return this.configService.get<string>('app.jwtSecret', 'changeme-jwt-secret');
  }

  get jwtTtl(): string {
    return this.configService.get<string>('app.jwtTtl', '15m');
  }

  get refreshTokenTtl(): string {
    return this.configService.get<string>('app.refreshTokenTtl', '7d');
  }

  get frontendUrl(): string {
    return this.configService.get<string>('app.frontendUrl', 'http://localhost:5173');
  }

  get masterEncryptionKey(): string {
    return this.configService.get<string>('app.masterEncryptionKey', '');
  }

  get forceHttps(): boolean {
    return this.configService.get<boolean>('app.forceHttps', false);
  }

  get searchEnabled(): boolean {
    return this.configService.get<boolean>('search.enabled', false);
  }

  get storageProvider(): 'local' | 's3' {
    return this.configService.get<'local' | 's3'>('storage.provider', 'local');
  }
}
