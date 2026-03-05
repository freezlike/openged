import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { Readable } from 'stream';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IStorageProvider, SaveFileInput, StoredFile } from './storage.types';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly root: string;

  constructor(private readonly configService: ConfigService) {
    this.root = this.configService.get<string>('storage.localRoot', './storage');
  }

  async checkConnectivity(): Promise<{ ok: boolean; details?: string }> {
    try {
      await mkdir(this.root, { recursive: true });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        details: error instanceof Error ? error.message : 'Unknown storage error',
      };
    }
  }

  async saveFile(input: SaveFileInput): Promise<StoredFile> {
    await mkdir(this.root, { recursive: true });

    const objectKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${input.fileName}`;
    const path = join(this.root, objectKey);

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.buffer);

    const sha256 = createHash('sha256').update(input.buffer).digest('hex');

    return {
      objectKey,
      size: input.buffer.length,
      mimeType: input.mimeType,
      sha256,
      provider: 'LOCAL',
    };
  }

  async getFileStream(objectKey: string): Promise<Readable> {
    const path = join(this.root, objectKey);
    return createReadStream(path);
  }

  async removeFile(objectKey: string): Promise<void> {
    const path = join(this.root, objectKey);

    try {
      await unlink(path);
    } catch {
      // Ignore missing files during cleanup.
    }
  }
}
