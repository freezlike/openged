import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentStatus, UserStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';

export interface LookupItem {
  id: string;
  label: string;
}

@Injectable()
export class LookupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async search(entity: string, q?: string, taxonomy?: string, activeOnly?: boolean): Promise<LookupItem[]> {
    const term = (q ?? '').trim();

    switch (entity) {
      case 'users':
        return this.searchUsers(term, activeOnly);
      case 'groups':
        return this.searchGroups(term);
      case 'documents':
        return this.searchDocuments(term);
      case 'taxonomy':
        return this.searchTaxonomy(term, taxonomy);
      case 'tags':
        return this.searchTaxonomy(term, 'Tags');
      case 'departments':
        return this.searchTaxonomy(term, 'Departments');
      default:
        throw new NotFoundException('Lookup entity not supported');
    }
  }

  async create(entity: string, label: string, userId: string, taxonomy?: string): Promise<LookupItem> {
    await this.ensureLookupWriteAccess(userId);

    const normalized = this.normalizeLabel(label);

    switch (entity) {
      case 'groups':
        return this.createGroup(normalized);
      case 'taxonomy':
        return this.createTaxonomyValue(normalized, taxonomy ?? 'General');
      case 'tags':
        return this.createTaxonomyValue(normalized, 'Tags');
      case 'departments':
        return this.createTaxonomyValue(normalized, 'Departments');
      default:
        throw new BadRequestException('Inline creation not supported for this lookup entity');
    }
  }

  private async searchUsers(term: string, activeOnly?: boolean) {
    const users = await this.prisma.user.findMany({
      where: term
        ? {
            email: {
              contains: term,
              mode: 'insensitive',
            },
            status: activeOnly ? UserStatus.ACTIVE : undefined,
          }
        : {
            status: activeOnly ? UserStatus.ACTIVE : undefined,
          },
      select: {
        id: true,
        email: true,
      },
      orderBy: { email: 'asc' },
      take: 20,
    });

    return users.map((user) => ({ id: user.id, label: user.email }));
  }

  private async searchGroups(term: string) {
    const groups = await this.prisma.group.findMany({
      where: term
        ? {
            name: {
              contains: term,
              mode: 'insensitive',
            },
          }
        : undefined,
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
      take: 20,
    });

    return groups.map((group) => ({ id: group.id, label: group.name }));
  }

  private async searchDocuments(term: string) {
    const documents = await this.prisma.document.findMany({
      where: {
        status: {
          not: DocumentStatus.DELETED,
        },
        title: term
          ? {
              contains: term,
              mode: 'insensitive',
            }
          : undefined,
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return documents.map((document) => ({ id: document.id, label: document.title }));
  }

  private async searchTaxonomy(term: string, taxonomyName?: string) {
    const values = await this.prisma.taxonomyValue.findMany({
      where: {
        label: term
          ? {
              contains: term,
              mode: 'insensitive',
            }
          : undefined,
        taxonomy: taxonomyName
          ? {
              name: {
                equals: taxonomyName,
                mode: 'insensitive',
              },
            }
          : undefined,
      },
      include: {
        taxonomy: {
          select: { name: true },
        },
      },
      orderBy: [{ taxonomy: { name: 'asc' } }, { label: 'asc' }],
      take: 30,
    });

    return values.map((value) => ({
      id: value.id,
      label: taxonomyName ? value.label : `${value.taxonomy.name}: ${value.label}`,
    }));
  }

  private async createGroup(normalizedLabel: string): Promise<LookupItem> {
    const existing = await this.prisma.group.findFirst({
      where: {
        name: {
          equals: normalizedLabel,
          mode: 'insensitive',
        },
      },
      select: { id: true, name: true },
    });

    if (existing) {
      return { id: existing.id, label: existing.name };
    }

    const created = await this.prisma.group.create({
      data: {
        name: normalizedLabel,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return { id: created.id, label: created.name };
  }

  private async createTaxonomyValue(normalizedLabel: string, taxonomyName: string): Promise<LookupItem> {
    const taxonomy = await this.prisma.taxonomy.upsert({
      where: { name: taxonomyName },
      update: {},
      create: { name: taxonomyName },
      select: { id: true },
    });

    const existing = await this.prisma.taxonomyValue.findFirst({
      where: {
        taxonomyId: taxonomy.id,
        label: {
          equals: normalizedLabel,
          mode: 'insensitive',
        },
      },
      select: { id: true, label: true },
    });

    if (existing) {
      return { id: existing.id, label: existing.label };
    }

    const created = await this.prisma.taxonomyValue.create({
      data: {
        taxonomyId: taxonomy.id,
        label: normalizedLabel,
      },
      select: {
        id: true,
        label: true,
      },
    });

    return { id: created.id, label: created.label };
  }

  private normalizeLabel(value: string) {
    const normalized = value.replace(/\s+/g, ' ').trim();

    if (!normalized) {
      throw new BadRequestException('Label is required');
    }

    return normalized;
  }

  private async ensureLookupWriteAccess(userId: string) {
    const roles = await this.permissionsService.getGlobalRoles(userId);
    const canWrite = roles.some((role) =>
      ['CONTRIBUTOR', 'EDITOR', 'VALIDATOR', 'SITE_ADMIN', 'GLOBAL_ADMIN', 'SUPER_ADMIN'].includes(role),
    );

    if (!canWrite) {
      throw new ForbiddenException('Not allowed to create lookup values');
    }
  }
}
