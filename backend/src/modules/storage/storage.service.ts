import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { SaveFileInput, StoredFile } from './storage.types';

@Injectable()
export class StorageService {
  constructor(
    private readonly config: AppConfigService,
    private readonly localProvider: LocalStorageProvider,
    private readonly s3Provider: S3StorageProvider,
  ) {}

  private get provider() {
    return this.config.storageProvider === 's3' ? this.s3Provider : this.localProvider;
  }

  checkConnectivity() {
    return this.provider.checkConnectivity();
  }

  saveFile(input: SaveFileInput): Promise<StoredFile> {
    return this.provider.saveFile(input);
  }

  getFileStream(objectKey: string) {
    return this.provider.getFileStream(objectKey);
  }

  removeFile(objectKey: string) {
    return this.provider.removeFile(objectKey);
  }
}
