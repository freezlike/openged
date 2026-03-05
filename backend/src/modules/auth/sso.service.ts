import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { SsoAssertionDto } from './dto/sso-assertion.dto';

@Injectable()
export class SsoService {
  constructor(
    private readonly config: AppConfigService,
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  listProviders() {
    if (this.config.authMode === 'LOCAL_ONLY') {
      return [];
    }

    return ['oidc', 'saml'];
  }

  oidcStart() {
    if (this.config.authMode === 'LOCAL_ONLY') {
      throw new UnauthorizedException('SSO is disabled');
    }

    return {
      state: randomBytes(12).toString('hex'),
      message: 'OIDC redirect is environment-specific; configure your identity provider and callback.',
    };
  }

  async handleAssertion(dto: SsoAssertionDto, context: { ip?: string; userAgent?: string }) {
    if (this.config.authMode === 'LOCAL_ONLY') {
      throw new UnauthorizedException('SSO is disabled');
    }

    const email = dto.email.toLowerCase();

    const user = await this.prisma.user.upsert({
      where: {
        email,
      },
      update: {
        authSource: dto.provider,
        externalId: dto.externalId,
        status: 'ACTIVE',
      },
      create: {
        email,
        authSource: dto.provider,
        externalId: dto.externalId,
        status: 'ACTIVE',
      },
    });

    await this.mapGroupsToRoles(user.id, dto.groups ?? []);

    const roles = await this.usersService.getUserRoles(user.id);

    if (roles.length === 0) {
      throw new BadRequestException('User has no mapped roles');
    }

    const refreshToken = randomBytes(48).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: context.ip,
        userAgent: context.userAgent,
      },
    });

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        roles,
        sid: session.id,
      },
      {
        secret: this.config.jwtSecret,
        expiresIn: this.config.jwtTtl,
      },
    );

    await this.auditService.log({
      actorId: user.id,
      eventType: 'login.sso',
      objectType: 'session',
      objectId: session.id,
      details: {
        provider: dto.provider,
      },
      ipAddress: context.ip,
      userAgent: context.userAgent,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.jwtTtl,
      user: {
        id: user.id,
        email: user.email,
        roles,
      },
    };
  }

  private async mapGroupsToRoles(userId: string, groups: string[]): Promise<void> {
    const rawMap = process.env.SSO_GROUP_ROLE_MAP;

    if (!rawMap) {
      return;
    }

    let parsed: Record<string, string[]>;
    try {
      parsed = JSON.parse(rawMap) as Record<string, string[]>;
    } catch {
      return;
    }

    const roleCodes = new Set<string>();

    for (const group of groups) {
      const mapped = parsed[group] ?? [];
      for (const roleCode of mapped) {
        roleCodes.add(roleCode);
      }
    }

    for (const code of roleCodes) {
      await this.usersService.assignRole(userId, code);
    }
  }
}
