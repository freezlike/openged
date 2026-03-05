import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';

import { RoleCode } from '../../common/types/role-code.type';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async getUserRoles(userId: string): Promise<RoleCode[]> {
    const [directRoles, groupRoles] = await Promise.all([
      this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      }),
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

    for (const userRole of directRoles) {
      roleSet.add(userRole.role.code as RoleCode);
    }

    for (const membership of groupRoles) {
      for (const groupRole of membership.group.groupRoles) {
        roleSet.add(groupRole.role.code as RoleCode);
      }
    }

    return Array.from(roleSet);
  }

  async createLocalUser(params: {
    email: string;
    passwordHash: string;
    status?: 'ACTIVE' | 'PENDING' | 'DISABLED';
    mfaEnabled?: boolean;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: params.email.toLowerCase(),
        passwordHash: params.passwordHash,
        authSource: 'LOCAL',
        status: params.status ?? 'ACTIVE',
        mfaEnabled: params.mfaEnabled ?? false,
      },
    });
  }

  async assignRole(userId: string, roleCode: string, strict = false): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });

    if (!role) {
      if (strict) {
        throw new NotFoundException(`Role ${roleCode} not found`);
      }
      return;
    }

    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId,
        roleId: role.id,
      },
    });
  }

  async markLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
    });
  }
}
