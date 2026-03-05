import { ForbiddenException, Injectable } from '@nestjs/common';
import { ObjectType, PrincipalType } from '@prisma/client';

import { RoleCode } from '../../common/types/role-code.type';
import { PrismaService } from '../../database/prisma.service';

const ADMIN_ROLES: RoleCode[] = ['SUPER_ADMIN', 'GLOBAL_ADMIN'];

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureObjectAccess(params: {
    userId: string;
    objectType: ObjectType;
    objectId: string;
    acceptedRoles: RoleCode[];
  }): Promise<void> {
    const permitted = await this.hasObjectAccess(params);

    if (!permitted) {
      throw new ForbiddenException('You do not have permission for this resource');
    }
  }

  async hasObjectAccess(params: {
    userId: string;
    objectType: ObjectType;
    objectId: string;
    acceptedRoles: RoleCode[];
  }): Promise<boolean> {
    const globalRoles = await this.getGlobalRoles(params.userId);

    if (globalRoles.some((role) => ADMIN_ROLES.includes(role))) {
      return true;
    }

    if (globalRoles.some((role) => params.acceptedRoles.includes(role))) {
      return true;
    }

    const aclRoles = await this.getAclRolesForObjectAndAncestors(
      params.userId,
      params.objectType,
      params.objectId,
    );

    return aclRoles.some((role) => params.acceptedRoles.includes(role));
  }

  async getGlobalRoles(userId: string): Promise<RoleCode[]> {
    const [directRoles, memberships] = await Promise.all([
      this.prisma.userRole.findMany({ where: { userId }, include: { role: true } }),
      this.prisma.userGroup.findMany({
        where: { userId },
        include: {
          group: {
            include: {
              groupRoles: {
                include: { role: true },
              },
            },
          },
        },
      }),
    ]);

    const roleSet = new Set<RoleCode>();

    for (const role of directRoles) {
      roleSet.add(role.role.code as RoleCode);
    }

    for (const membership of memberships) {
      for (const groupRole of membership.group.groupRoles) {
        roleSet.add(groupRole.role.code as RoleCode);
      }
    }

    return Array.from(roleSet);
  }

  async setAcl(params: {
    objectType: ObjectType;
    objectId: string;
    principalType: PrincipalType;
    principalId: string;
    roleCode: string;
    inherited?: boolean;
  }): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { code: params.roleCode } });
    if (!role) {
      throw new ForbiddenException(`Unknown role: ${params.roleCode}`);
    }

    await this.prisma.aclEntry.create({
      data: {
        objectType: params.objectType,
        objectId: params.objectId,
        principalType: params.principalType,
        principalId: params.principalId,
        roleId: role.id,
        inherited: params.inherited ?? false,
      },
    });
  }

  private async getAclRolesForObjectAndAncestors(
    userId: string,
    objectType: ObjectType,
    objectId: string,
  ): Promise<RoleCode[]> {
    const hierarchy = await this.resolveHierarchy(objectType, objectId);

    const groupIds = await this.prisma.userGroup.findMany({
      where: { userId },
      select: { groupId: true },
    });

    const principals = [
      { principalType: PrincipalType.USER, principalId: userId },
      ...groupIds.map((membership) => ({
        principalType: PrincipalType.GROUP,
        principalId: membership.groupId,
      })),
    ];

    const aclEntries = await this.prisma.aclEntry.findMany({
      where: {
        OR: hierarchy.map((item) => ({
          objectType: item.objectType,
          objectId: item.objectId,
        })),
        AND: {
          OR: principals,
        },
      },
      include: {
        role: true,
      },
    });

    const roleSet = new Set<RoleCode>();

    for (const aclEntry of aclEntries) {
      roleSet.add(aclEntry.role.code as RoleCode);
    }

    return Array.from(roleSet);
  }

  private async resolveHierarchy(
    objectType: ObjectType,
    objectId: string,
  ): Promise<Array<{ objectType: ObjectType; objectId: string }>> {
    if (objectType === ObjectType.SITE) {
      return [{ objectType: ObjectType.SITE, objectId }];
    }

    if (objectType === ObjectType.LIBRARY) {
      const library = await this.prisma.library.findUnique({ where: { id: objectId } });
      if (!library) {
        return [{ objectType: ObjectType.LIBRARY, objectId }];
      }

      return [
        { objectType: ObjectType.SITE, objectId: library.siteId },
        { objectType: ObjectType.LIBRARY, objectId: library.id },
      ];
    }

    if (objectType === ObjectType.FOLDER) {
      const folder = await this.prisma.folder.findUnique({ where: { id: objectId } });
      if (!folder) {
        return [{ objectType: ObjectType.FOLDER, objectId }];
      }

      const library = await this.prisma.library.findUnique({ where: { id: folder.libraryId } });

      if (!library) {
        return [
          { objectType: ObjectType.LIBRARY, objectId: folder.libraryId },
          { objectType: ObjectType.FOLDER, objectId: folder.id },
        ];
      }

      return [
        { objectType: ObjectType.SITE, objectId: library.siteId },
        { objectType: ObjectType.LIBRARY, objectId: library.id },
        { objectType: ObjectType.FOLDER, objectId: folder.id },
      ];
    }

    const document = await this.prisma.document.findUnique({ where: { id: objectId } });
    if (!document) {
      return [{ objectType: ObjectType.DOCUMENT, objectId }];
    }

    const library = await this.prisma.library.findUnique({ where: { id: document.libraryId } });

    const base = [{ objectType: ObjectType.DOCUMENT, objectId: document.id }];

    if (!library) {
      return [{ objectType: ObjectType.LIBRARY, objectId: document.libraryId }, ...base];
    }

    if (document.folderId) {
      return [
        { objectType: ObjectType.SITE, objectId: library.siteId },
        { objectType: ObjectType.LIBRARY, objectId: library.id },
        { objectType: ObjectType.FOLDER, objectId: document.folderId },
        ...base,
      ];
    }

    return [
      { objectType: ObjectType.SITE, objectId: library.siteId },
      { objectType: ObjectType.LIBRARY, objectId: library.id },
      ...base,
    ];
  }
}
