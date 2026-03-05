import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, ObjectType, PrincipalType, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { CreateLibraryDto } from './dto/create-library.dto';
import { CreateSiteDto } from './dto/create-site.dto';
import { QueryLibraryItemsDto } from './dto/query-library-items.dto';

@Injectable()
export class DmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async listSites() {
    return this.prisma.site.findMany({
      include: {
        libraries: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createSite(dto: CreateSiteDto, userId: string) {
    const site = await this.prisma.site.create({
      data: {
        name: dto.name,
        description: dto.description,
        ownerId: userId,
      },
    });

    await this.permissionsService.setAcl({
      objectType: ObjectType.SITE,
      objectId: site.id,
      principalType: PrincipalType.USER,
      principalId: userId,
      roleCode: 'SITE_ADMIN',
      inherited: false,
    });

    await this.auditService.log({
      actorId: userId,
      eventType: 'site.created',
      objectType: 'site',
      objectId: site.id,
      details: { name: dto.name },
    });

    return site;
  }

  async createLibrary(siteId: string, dto: CreateLibraryDto, userId: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    await this.permissionsService.ensureObjectAccess({
      userId,
      objectType: ObjectType.SITE,
      objectId: siteId,
      acceptedRoles: ['SITE_ADMIN', 'GLOBAL_ADMIN', 'SUPER_ADMIN'],
    });

    const library = await this.prisma.library.create({
      data: {
        siteId,
        name: dto.name,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
    });

    await this.auditService.log({
      actorId: userId,
      eventType: 'library.created',
      objectType: 'library',
      objectId: library.id,
      details: { siteId, name: dto.name },
    });

    return library;
  }

  async createFolder(libraryId: string, dto: CreateFolderDto, userId: string) {
    await this.permissionsService.ensureObjectAccess({
      userId,
      objectType: ObjectType.LIBRARY,
      objectId: libraryId,
      acceptedRoles: ['EDITOR', 'SITE_ADMIN', 'GLOBAL_ADMIN', 'SUPER_ADMIN'],
    });

    const parentPath = dto.parentId
      ? (
          await this.prisma.folder.findUnique({
            where: { id: dto.parentId },
            select: { path: true },
          })
        )?.path
      : '';

    const path = `${parentPath}/${dto.name}`.replace(/\/+/g, '/');

    const folder = await this.prisma.folder.create({
      data: {
        libraryId,
        parentId: dto.parentId,
        name: dto.name,
        path,
      },
    });

    await this.auditService.log({
      actorId: userId,
      eventType: 'folder.created',
      objectType: 'folder',
      objectId: folder.id,
      details: { libraryId, path: folder.path },
    });

    return folder;
  }

  async getLibraryItems(libraryId: string, query: QueryLibraryItemsDto, userId: string) {
    await this.permissionsService.ensureObjectAccess({
      userId,
      objectType: ObjectType.LIBRARY,
      objectId: libraryId,
      acceptedRoles: [
        'READER',
        'CONTRIBUTOR',
        'EDITOR',
        'VALIDATOR',
        'SITE_ADMIN',
        'GLOBAL_ADMIN',
        'SUPER_ADMIN',
      ],
    });

    const library = await this.prisma.library.findUnique({
      where: { id: libraryId },
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
    });

    if (!library) {
      throw new NotFoundException('Library not found');
    }

    const folder = query.folderId
      ? await this.prisma.folder.findUnique({
          where: { id: query.folderId },
        })
      : null;

    if (folder && folder.libraryId !== libraryId) {
      throw new NotFoundException('Folder not found');
    }

    const folderTrail = folder ? await this.buildFolderTrail(folder.id) : [];

    const folderItems = await this.prisma.folder.findMany({
      where: {
        libraryId,
        parentId: query.folderId ?? null,
      },
      orderBy: {
        name: 'asc',
      },
    });

    const documentWhere: Prisma.DocumentWhereInput = {
      libraryId,
      folderId: query.folderId ?? null,
      title: query.q
        ? {
            contains: query.q,
            mode: 'insensitive',
          }
        : undefined,
      status: query.status
        ? (query.status as DocumentStatus)
        : {
            not: DocumentStatus.DELETED,
          },
      createdBy: query.ownerId,
      creator: query.author
        ? {
            email: {
              contains: query.author,
              mode: 'insensitive',
            },
          }
        : undefined,
      contentType: query.contentType
        ? {
            name: query.contentType,
          }
        : undefined,
      updatedAt:
        query.modifiedFrom || query.modifiedTo
          ? {
              gte: query.modifiedFrom ? new Date(query.modifiedFrom) : undefined,
              lte: query.modifiedTo ? new Date(query.modifiedTo) : undefined,
            }
          : undefined,
      metadataEntries: query.confidentiality
        ? {
            some: {
              field: { name: 'Confidentiality' },
              value: { equals: query.confidentiality },
            },
          }
        : undefined,
    };

    const [totalDocuments, documents] = await Promise.all([
      this.prisma.document.count({ where: documentWhere }),
      this.prisma.document.findMany({
        where: documentWhere,
        include: {
          creator: {
            select: { id: true, email: true },
          },
          currentVersion: {
            include: {
              creator: {
                select: { id: true, email: true },
              },
            },
          },
          contentType: {
            select: { id: true, name: true },
          },
          metadataEntries: {
            include: {
              field: true,
            },
          },
        },
        orderBy: {
          [query.sortBy]: query.sortDir,
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const documentItems = documents.map((document) => {
      const confidentialityEntry = document.metadataEntries.find(
        (entry) => entry.field.name === 'Confidentiality',
      );

      return {
        kind: 'document',
        id: document.id,
        title: document.title,
        status: document.status,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        createdBy: document.creator,
        modifiedBy: document.currentVersion?.creator ?? document.creator,
        contentType: document.contentType?.name ?? 'Document',
        confidentiality:
          typeof confidentialityEntry?.value === 'string'
            ? confidentialityEntry.value
            : confidentialityEntry?.value ?? null,
        folderId: document.folderId,
        currentVersion: document.currentVersion
          ? `${document.currentVersion.versionMajor}.${document.currentVersion.versionMinor}`
          : null,
      };
    });

    return {
      context: {
        site: library.site,
        library: { id: library.id, name: library.name },
        folder: folder
          ? {
              id: folder.id,
              name: folder.name,
              parentId: folder.parentId,
              path: folder.path,
              trail: folderTrail,
            }
          : null,
      },
      folders: folderItems.map((item) => ({
        kind: 'folder',
        id: item.id,
        name: item.name,
        parentId: item.parentId,
        path: item.path,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      documents: documentItems,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: totalDocuments,
      },
    };
  }

  private async buildFolderTrail(folderId: string): Promise<Array<{ id: string; name: string }>> {
    const trail: Array<{ id: string; name: string }> = [];
    let currentId: string | null = folderId;

    while (currentId) {
      const currentFolder: { id: string; name: string; parentId: string | null } | null =
        await this.prisma.folder.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          name: true,
          parentId: true,
        },
      });

      if (!currentFolder) {
        break;
      }

      trail.unshift({ id: currentFolder.id, name: currentFolder.name });
      currentId = currentFolder.parentId;
    }

    return trail;
  }

  async createDefaultGedSetup(superAdminId: string) {
    const existing = await this.prisma.site.findFirst({ where: { name: 'General' } });

    if (existing) {
      const existingLibrary = await this.prisma.library.findFirst({
        where: { siteId: existing.id, name: 'Documents' },
      });
      return { site: existing, library: existingLibrary };
    }

    const site = await this.prisma.site.create({
      data: {
        name: 'General',
        description: 'Default general site',
        ownerId: superAdminId,
      },
    });

    const library = await this.prisma.library.create({
      data: {
        siteId: site.id,
        name: 'Documents',
      },
    });

    const taxonomies = [
      {
        name: 'Confidentiality',
        values: ['Public', 'Internal', 'Restricted'],
      },
      {
        name: 'Domain',
        values: ['HR', 'Finance', 'Quality', 'IT'],
      },
    ];

    for (const taxonomy of taxonomies) {
      const taxonomyRecord = await this.prisma.taxonomy.create({
        data: {
          name: taxonomy.name,
        },
      });

      for (const value of taxonomy.values) {
        await this.prisma.taxonomyValue.create({
          data: {
            taxonomyId: taxonomyRecord.id,
            label: value,
          },
        });
      }
    }

    const contentTypes = ['Document', 'Procedure', 'Contract', 'Invoice'];

    for (const contentType of contentTypes) {
      await this.prisma.contentType.upsert({
        where: { name: contentType },
        update: {},
        create: { name: contentType },
      });
    }

    await this.permissionsService.setAcl({
      objectType: ObjectType.SITE,
      objectId: site.id,
      principalType: PrincipalType.USER,
      principalId: superAdminId,
      roleCode: 'SITE_ADMIN',
      inherited: false,
    });

    return { site, library };
  }
}
