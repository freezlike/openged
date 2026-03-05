import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { SearchDocumentsDto } from './dto/search-documents.dto';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchDocumentsDto) {
    const where: Prisma.DocumentWhereInput = {
      title: dto.q
        ? {
            contains: dto.q,
            mode: 'insensitive',
          }
        : undefined,
      libraryId: dto.library,
      createdBy: dto.author,
      createdAt:
        dto.from || dto.to
          ? {
              gte: dto.from ? new Date(dto.from) : undefined,
              lte: dto.to ? new Date(dto.to) : undefined,
            }
          : undefined,
      contentType: dto.documentType
        ? {
            name: dto.documentType,
          }
        : undefined,
      library: dto.site
        ? {
            siteId: dto.site,
          }
        : undefined,
      metadataEntries: dto.classification
        ? {
            some: {
              field: { name: 'Confidentiality' },
              value: { equals: dto.classification },
            },
          }
        : undefined,
    };

    const documents = await this.prisma.document.findMany({
      where,
      include: {
        creator: {
          select: { id: true, email: true },
        },
        library: {
          select: { id: true, name: true, siteId: true },
        },
        contentType: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: dto.mode === 'advanced' ? 200 : 50,
    });

    const facets =
      dto.mode === 'advanced'
        ? {
            byLibrary: await this.prisma.document.groupBy({
              by: ['libraryId'],
              where,
              _count: { libraryId: true },
            }),
            byStatus: await this.prisma.document.groupBy({
              by: ['status'],
              where,
              _count: { status: true },
            }),
            byContentType: await this.prisma.document.groupBy({
              by: ['contentTypeId'],
              where,
              _count: { contentTypeId: true },
            }),
          }
        : undefined;

    return {
      total: documents.length,
      items: documents,
      facets,
      mode: dto.mode,
    };
  }
}
