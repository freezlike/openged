import { createHash, randomUUID } from 'crypto';
import { Readable } from 'stream';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IStorageProvider, SaveFileInput, StoredFile } from './storage.types';

@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('storage.s3Bucket', 'openged');

    this.client = new S3Client({
      region: this.configService.get<string>('storage.s3Region', 'us-east-1'),
      endpoint: this.configService.get<string>('storage.s3Endpoint'),
      credentials: {
        accessKeyId: this.configService.get<string>('storage.s3AccessKey', ''),
        secretAccessKey: this.configService.get<string>('storage.s3SecretKey', ''),
      },
      forcePathStyle: this.configService.get<boolean>('storage.s3ForcePathStyle', true),
    });
  }

  async checkConnectivity(): Promise<{ ok: boolean; details?: string }> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: `healthcheck/${Date.now()}.txt`,
          Body: 'ok',
        }),
      );

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        details: error instanceof Error ? error.message : 'S3 connectivity failed',
      };
    }
  }

  async saveFile(input: SaveFileInput): Promise<StoredFile> {
    const objectKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${input.fileName}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: input.buffer,
        ContentType: input.mimeType,
      }),
    );

    const sha256 = createHash('sha256').update(input.buffer).digest('hex');

    return {
      objectKey,
      size: input.buffer.length,
      mimeType: input.mimeType,
      sha256,
      provider: 'S3',
    };
  }

  async getFileStream(objectKey: string): Promise<Readable> {
    const output = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );

    if (!output.Body) {
      throw new Error('Missing object body');
    }

    return output.Body as Readable;
  }

  async removeFile(objectKey: string): Promise<void> {
    // Optional cleanup omitted for now.
    void objectKey;
  }
}
