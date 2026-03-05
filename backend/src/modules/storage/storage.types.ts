import { Readable } from 'stream';

export interface StoredFile {
  objectKey: string;
  size: number;
  mimeType: string;
  sha256: string;
  provider: 'LOCAL' | 'S3';
}

export interface SaveFileInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface IStorageProvider {
  checkConnectivity(): Promise<{ ok: boolean; details?: string }>;
  saveFile(input: SaveFileInput): Promise<StoredFile>;
  getFileStream(objectKey: string): Promise<Readable>;
  removeFile(objectKey: string): Promise<void>;
}
