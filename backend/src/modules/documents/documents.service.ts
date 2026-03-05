import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, ObjectType, VersionType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { Readable } from 'stream';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../permissions/permissions.service';
import { StorageService } from '../storage/storage.service';
import { CheckinDocumentDto } from './dto/checkin-document.dto';
import { UpdateMetadataDto } from './dto/update-metadata.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentVersioningService } from './services/document-versioning.service';

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly permissionsService: PermissionsService,
    private readonly versioningService: DocumentVersioningService,
    private readonly auditService: AuditService,
  ) {}

  async upload(
    userId: string,
    dto: UploadDocumentDto,
    file: Express.Multer.File,
  ): Promise<{ id: string; version: string }> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File too large');
    }

    if (!file.mimetype) {
      throw new BadRequestException('MIME type missing');
    }

    await this.permissionsService.ensureObjectAccess({
      userId,
      objectType: ObjectType.LIBRARY,
      objectId: dto.libraryId,
      acceptedRoles: ['CONTRIBUTOR', 'EDITOR', 'SITE_ADMIN', 'GLOBAL_ADMIN', 'SUPER_ADMIN'],
    });

    const persisted = await this.storageService.saveFile({
      fileName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });

    const document = await this.prisma.$transaction(async (transaction) => {
      const fileObject = await transaction.fileObject.create({
        data: {
          storageProvider: persisted.provider,
          objectKey: persisted.objectKey,
          size: BigInt(persisted.size),
          mimeType: persisted.mimeType,
          sha256: persisted.sha256,
        },
      });

      const doc = await transaction.document.create({
        data: {
          libraryId: dto.libraryId,
          folderId: dto.folderId,
          title: dto.title ?? file.originalname,
          status: DocumentStatus.DRAFT,
          createdBy: userId,
          contentTypeId: dto.contentTypeId,
        },
      });

      const version = await transaction.documentVersion.create({
        data: {
          documentId: doc.id,
          versionMajor: 1,
          versionMinor: 0,
          versionType: VersionType.MAJOR,
          fileId: fileObject.id,
          createdBy: userId,
          comment: dto.comment ?? 'Initial upload',
        },
      });

      await transaction.document.update({
        where: { id: doc.id },
        data: {
          currentVersionId: version.id,
        },
      });

      return {
        id: doc.id,
        currentVersion: version,
      };
    });

    await this.auditService.log({
      actorId: userId,
      eventType: 'document.upload',
      objectType: 'document',
      objectId: document.id,
      details: {
        libraryId: dto.libraryId,
        fileName: file.originalname,
      },
    });

    return {
      id: document.id,
      version: `${document.currentVersion.versionMajor}.${document.currentVersion.versionMinor}`,
    };
  }

  async download(
    userId: string,
    documentId: string,
  ): Promise<{ stream: Readable; fileName: string; mimeType: string }> {
    await this.permissionsService.ensureObjectAccess({
      userId,
      objectType: ObjectType.DOCUMENT,
      objectId: documentId,
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

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        currentVersion: {
          include: {
            file: true,
          },
        },
      },
    });

    if (!document || !document.currentVersion) {
      throw new NotFoundException('Document not found');
    }

    const stream = await this.storageService.getFileStream(document.currentVersion.file.objectKey);

    await this.auditService.log({
      actorId: userId,
      eventType: 'document.download',
      objectType: 'document',
      objectId: documentId,
      details: {
        version: `${document.currentVersion.versionMajor}.${document.currentVersion.versionMinor}`,
      },
    });

    return {
      stream,
      fileName: document.title,
      mimeType: document.currentVersion.file.mimeType,
    };
  }

  async updateMetadata(userId: string, documentId: string, dto: UpdateMetadataDto) {
    await this.permissionsService.ensureObjectAccess({
      userId,
      objectType: ObjectType.DOCUMENT,
      objectId: documentId,
      acceptedRoles: ['EDITOR', 'VALIDATOR', 'SITE_ADMIN', 'GLOBAL_ADMIN', 'SUPER_ADMIN'],
    });

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { library: true },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const fields = await this.prisma.fieldDef.findMany({
      where: { libraryId: document.libraryId },
    });

    const fieldMap = new Map(fields.map((field) => [field.id, field]));

    for (const item of dto.fields) {
      const definition = fieldMap.get(item.fieldId);

      if (!definition) {
        throw new BadRequestException(`Unknown field: ${item.fieldId}`);
      }

      const serialized = item.value as Prisma.InputJsonValue;
      const validation = definition.validation as Record<string, string> | null;

      if (definition.required && (item.value === null || item.value === undefined || item.value === '')) {
        throw new BadRequestException(`Field ${definition.name} is required`);
      }

      if (validation?.regex && typeof item.value === 'string') {
        const regex = new RegExp(validation.regex);
        if (!regex.test(item.value)) {
          throw new BadRequestException(`Field ${definition.name} does not match expected format`);
        }
      }

      if (definition.uniqueValues) {
        const duplicate = await this.prisma.documentMetadata.findFirst({
          where: {
            fieldId: item.fieldId,
            value: { equals: serialized },
            documentId: { not: documentId },
          },
        });

        if (duplicate) {
          throw new BadRequestException(`Field ${definition.name} must be unique`);
        }
      }

      await this.prisma.documentMetadata.upsert({
        where: {
          documentId_fieldId: {
            documentId,
            fieldId: item.fieldId,
          },
        },
        update: {
          value: serialized,
        },
        create: {
          documentId,
          fieldId: item.fieldId,
          value: serialized,
        },
      });
    }

    await this.auditService.log({
      actorId: userId,
      eventType: 'document.metadata.updated',
      objectType: 'document',
      objectId: documentId,
      details: { fields: dto.fields.map((field) => field.fieldId) },
    });

    return this.prisma.documentMetadata.findMany({
      where: { documentId },
      include: { field: true },
    });
  }

  async checkout(userId: string, documentId: string) {
    await this.permissionsService.ensureObjectAccess({
      userId,
      objectType: ObjectType.DOCUMENT,
      objectId: documentId,
      acceptedRoles: ['EDITOR', 'SITE_ADMIN', 'GLOBAL_ADMIN', 'SUPER_ADMIN'],
    });

    const document = await this.prisma.document.findUnique({ where: { id: documentId } });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.checkedOutById && document.checkedOutById !== userId) {
      throw new BadRequestException('Document already checked out by another user');
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        checkedOutById: userId,
        checkedOutAt: new Date(),
      },
    });

    await this.auditService.log({
      actorId: userId,
      eventType: 'document.checkout',
      objectType: 'document',
      objectId: documentId,
    });

    return {
      id: updated.id,
      checkedOutById: updated.checkedOutById,
      checkedOutAt: updated.checkedOutAt,
    };
  }

  async checkin(
    userId: string,
    documentId: string,
    dto: CheckinDocumentDto,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required for check-in');
    }

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        currentVersion: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (!document.checkedOutById) {
      throw new BadRequestException('Document is not checked out');
    }

    if (document.checkedOutById !== userId) {
      throw new BadRequestException('Document is checked out by another user');
    }

    const next = this.versioningService.nextVersion(document.currentVersion, dto.versionType);

    const persisted = await this.storageService.saveFile({
      fileName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });

    const version = await this.prisma.$transaction(async (transaction) => {
      const fileObject = await transaction.fileObject.create({
        data: {
          storageProvider: persisted.provider,
          objectKey: persisted.objectKey,
          size: BigInt(persisted.size),
          mimeType: persisted.mimeType,
          sha256: persisted.sha256,
        },
      });

      const createdVersion = await transaction.documentVersion.create({
        data: {
          documentId,
          versionMajor: next.major,
          versionMinor: next.minor,
          versionType: dto.versionType === 'major' ? VersionType.MAJOR : VersionType.MINOR,
          fileId: fileObject.id,
          createdBy: userId,
          comment: dto.comment,
        },
      });

      await transaction.document.update({
        where: { id: documentId },
        data: {
          currentVersionId: createdVersion.id,
          checkedOutById: null,
          checkedOutAt: null,
        },
      });

      return createdVersion;
    });

    await this.auditService.log({
      actorId: userId,
      eventType: 'document.checkin',
      objectType: 'document',
      objectId: documentId,
      details: {
        version: `${version.versionMajor}.${version.versionMinor}`,
      },
    });

    return {
      documentId,
      version: `${version.versionMajor}.${version.versionMinor}`,
    };
  }

  async versions(userId: string, documentId: string) {
    await this.ensureDocumentReadable(userId, documentId);

    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId },
      include: {
        creator: {
          select: { id: true, email: true },
        },
      },
      orderBy: [{ versionMajor: 'desc' }, { versionMinor: 'desc' }],
    });

    return versions.map((version) => ({
      id: version.id,
      version: `${version.versionMajor}.${version.versionMinor}`,
      type: version.versionType,
      comment: version.comment,
      createdAt: version.createdAt,
      createdBy: version.creator,
    }));
  }

  async details(userId: string, documentId: string) {
    await this.ensureDocumentReadable(userId, documentId);

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        library: {
          include: {
            site: {
              select: { id: true, name: true },
            },
          },
        },
        folder: {
          select: { id: true, name: true, path: true },
        },
        creator: {
          select: { id: true, email: true },
        },
        contentType: true,
        currentVersion: {
          include: {
            creator: {
              select: { id: true, email: true },
            },
            file: true,
          },
        },
        metadataEntries: {
          include: {
            field: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const metadata = document.metadataEntries.map((entry) => ({
      id: entry.id,
      fieldId: entry.fieldId,
      fieldName: entry.field.name,
      value: entry.value,
      required: entry.field.required,
      type: entry.field.dataType,
      updatedAt: entry.updatedAt,
    }));

    const availableFields = await this.prisma.fieldDef.findMany({
      where: { libraryId: document.libraryId },
      orderBy: { name: 'asc' },
    });

    return {
      id: document.id,
      title: document.title,
      status: document.status,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      createdBy: document.creator,
      site: document.library.site,
      library: { id: document.library.id, name: document.library.name },
      folder: document.folder,
      contentType: document.contentType?.name ?? 'Document',
      currentVersion: document.currentVersion
        ? {
            id: document.currentVersion.id,
            version: `${document.currentVersion.versionMajor}.${document.currentVersion.versionMinor}`,
            comment: document.currentVersion.comment,
            mimeType: document.currentVersion.file.mimeType,
            size: document.currentVersion.file.size.toString(),
            modifiedBy: document.currentVersion.creator,
          }
        : null,
      metadata,
      availableFields,
    };
  }

  async activity(userId: string, documentId: string) {
    await this.ensureDocumentReadable(userId, documentId);

    const workflows = await this.prisma.workflowInstance.findMany({
      where: { documentId },
      include: {
        tasks: {
          select: { id: true },
        },
      },
    });

    const workflowIds = workflows.map((workflow) => workflow.id);
    const taskIds = workflows.flatMap((workflow) => workflow.tasks.map((task) => task.id));

    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { objectType: 'document', objectId: documentId },
          workflowIds.length > 0 ? { objectType: 'workflow', objectId: { in: workflowIds } } : undefined,
          taskIds.length > 0 ? { objectType: 'workflow_task', objectId: { in: taskIds } } : undefined,
        ].filter(Boolean) as Prisma.AuditLogWhereInput[],
      },
      include: {
        actor: {
          select: { id: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
  }

  async workflowHistory(userId: string, documentId: string) {
    await this.ensureDocumentReadable(userId, documentId);

    const workflows = await this.prisma.workflowInstance.findMany({
      where: { documentId },
      include: {
        starter: {
          select: { id: true, email: true },
        },
        tasks: {
          include: {
            assignedUser: {
              select: { id: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    return workflows.map((workflow) => ({
      id: workflow.id,
      state: workflow.state,
      startedAt: workflow.startedAt,
      endedAt: workflow.endedAt,
      startedBy: workflow.starter,
      tasks: workflow.tasks.map((task) => ({
        id: task.id,
        status: task.status,
        assignedUser: task.assignedUser,
        dueDate: task.dueDate,
        comment: task.comment,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
      })),
    }));
  }

  async bulkDelete(userId: string, documentIds: string[]) {
    const uniqueIds = Array.from(new Set(documentIds));

    let deleted = 0;
    const skipped: string[] = [];

    for (const documentId of uniqueIds) {
      const done = await this.deleteDocument(userId, documentId);

      if (done) {
        deleted += 1;
      } else {
        skipped.push(documentId);
      }
    }

    return {
      requested: uniqueIds.length,
      deleted,
      skipped,
    };
  }

  private async deleteDocument(userId: string, documentId: string): Promise<boolean> {
    await this.permissionsService.ensureObjectAccess({
      userId,
      objectType: ObjectType.DOCUMENT,
      objectId: documentId,
      acceptedRoles: ['EDITOR', 'SITE_ADMIN', 'GLOBAL_ADMIN', 'SUPER_ADMIN'],
    });

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!document) {
      return false;
    }

    if (document.status === DocumentStatus.DELETED) {
      return false;
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.DELETED,
      },
    });

    await this.auditService.log({
      actorId: userId,
      eventType: 'document.deleted',
      objectType: 'document',
      objectId: documentId,
      details: {
        mode: 'soft-delete',
      },
    });

    return true;
  }

  private async ensureDocumentReadable(userId: string, documentId: string) {
    await this.permissionsService.ensureObjectAccess({
      userId,
      objectType: ObjectType.DOCUMENT,
      objectId: documentId,
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
  }
}
