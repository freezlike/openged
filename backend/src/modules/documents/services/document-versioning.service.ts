import { Injectable } from '@nestjs/common';

@Injectable()
export class DocumentVersioningService {
  nextVersion(
    current: { versionMajor: number; versionMinor: number } | null,
    versionType: 'major' | 'minor',
  ): { major: number; minor: number } {
    if (!current) {
      return { major: 1, minor: 0 };
    }

    if (versionType === 'major') {
      return {
        major: current.versionMajor + 1,
        minor: 0,
      };
    }

    return {
      major: current.versionMajor,
      minor: current.versionMinor + 1,
    };
  }
}
