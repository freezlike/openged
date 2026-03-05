import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { QueryAuditDto } from '../audit/dto/query-audit.dto';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  @Get('audit')
  @Roles('GLOBAL_ADMIN', 'SUPER_ADMIN')
  async getAudit(@Query() query: QueryAuditDto) {
    return this.auditService.query(query);
  }

  @Get('audit/export')
  @Roles('GLOBAL_ADMIN', 'SUPER_ADMIN')
  @Header('Content-Disposition', 'attachment; filename="audit-export"')
  async exportAudit(@Query() query: QueryAuditDto) {
    const payload = await this.auditService.export(query);

    return {
      format: query.format ?? 'json',
      payload,
    };
  }

  @Get('roles')
  @Roles('GLOBAL_ADMIN', 'SUPER_ADMIN')
  async listRoles() {
    return this.prisma.role.findMany({
      select: {
        code: true,
        name: true,
      },
      orderBy: {
        code: 'asc',
      },
    });
  }

  @Get('users')
  @Roles('GLOBAL_ADMIN', 'SUPER_ADMIN')
  async listUsers(@Query() query: QueryUsersDto) {
    const where = {
      email: query.q
        ? {
            contains: query.q,
            mode: 'insensitive' as const,
          }
        : undefined,
      status: query.status,
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: {
          userRoles: {
            include: {
              role: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: users.map((user) => ({
        id: user.id,
        email: user.email,
        authSource: user.authSource,
        status: user.status,
        preferredLocale: user.preferredLocale,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        roles: user.userRoles.map((userRole) => userRole.role.code),
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
      },
    };
  }

  @Post('users')
  @Roles('GLOBAL_ADMIN', 'SUPER_ADMIN')
  async createUser(@Body() dto: CreateUserDto, @CurrentUser() user: RequestUser | undefined) {
    if (!user) {
      throw new UnauthorizedException();
    }

    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('User already exists');
    }

    const roleCodes = Array.from(new Set(dto.roles?.length ? dto.roles : ['READER']));
    const roles = await this.prisma.role.findMany({
      where: {
        code: {
          in: roleCodes,
        },
      },
    });

    if (roles.length !== roleCodes.length) {
      throw new BadRequestException('Invalid role mapping');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const createdUser = await this.prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          authSource: 'LOCAL',
          status: dto.status ?? 'ACTIVE',
        },
      });

      await tx.userRole.createMany({
        data: roles.map((role) => ({
          userId: nextUser.id,
          roleId: role.id,
        })),
      });

      return nextUser;
    });

    await this.auditService.log({
      actorId: user.id,
      eventType: 'admin.user.created',
      objectType: 'user',
      objectId: createdUser.id,
      details: {
        email: createdUser.email,
        roles: roleCodes,
      },
    });

    return {
      id: createdUser.id,
      email: createdUser.email,
      status: createdUser.status,
      authSource: createdUser.authSource,
      roles: roleCodes,
    };
  }

  @Put('users/:userId/roles')
  @Roles('GLOBAL_ADMIN', 'SUPER_ADMIN')
  async updateUserRoles(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserRolesDto,
    @CurrentUser() user: RequestUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const nextRoleCodes = Array.from(new Set(dto.roles));
    const roles = await this.prisma.role.findMany({
      where: {
        code: {
          in: nextRoleCodes,
        },
      },
    });

    if (roles.length !== nextRoleCodes.length) {
      throw new BadRequestException('Invalid role mapping');
    }

    const currentlySuperAdmin = targetUser.userRoles.some((userRole) => userRole.role.code === 'SUPER_ADMIN');
    const shouldRemainSuperAdmin = nextRoleCodes.includes('SUPER_ADMIN');

    if (currentlySuperAdmin && !shouldRemainSuperAdmin) {
      const superAdminRole = await this.prisma.role.findUnique({
        where: { code: 'SUPER_ADMIN' },
        select: { id: true },
      });

      if (superAdminRole) {
        const superAdminCount = await this.prisma.userRole.count({
          where: { roleId: superAdminRole.id },
        });

        if (superAdminCount <= 1) {
          throw new BadRequestException('At least one SUPER_ADMIN is required');
        }
      }
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({
        where: {
          userId,
        },
      }),
      this.prisma.userRole.createMany({
        data: roles.map((role) => ({
          userId,
          roleId: role.id,
        })),
      }),
    ]);

    await this.auditService.log({
      actorId: user.id,
      eventType: 'admin.user.roles.updated',
      objectType: 'user',
      objectId: userId,
      details: {
        roles: nextRoleCodes,
      },
    });

    return {
      id: userId,
      roles: nextRoleCodes,
    };
  }
}
