import { randomBytes } from 'crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto, context: { ip?: string; userAgent?: string }) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || !user.passwordHash || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = await this.usersService.getUserRoles(user.id);

    if (
      this.config.authMode === 'SSO_ONLY' &&
      !roles.includes('SUPER_ADMIN') &&
      !roles.includes('GLOBAL_ADMIN')
    ) {
      throw new UnauthorizedException('Local login disabled in SSO_ONLY mode');
    }

    const refreshToken = randomBytes(48).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt: refreshExpiresAt,
        ipAddress: context.ip,
        userAgent: context.userAgent,
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      roles,
      sid: session.id,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.jwtSecret,
      expiresIn: this.config.jwtTtl,
    });

    await this.usersService.markLastLogin(user.id);

    await this.auditService.log({
      actorId: user.id,
      eventType: 'login',
      objectType: 'session',
      objectId: session.id,
      details: { authSource: user.authSource },
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

  async refresh(refreshToken: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: true,
      },
    });

    for (const session of sessions) {
      const match = await bcrypt.compare(refreshToken, session.refreshTokenHash);
      if (!match) {
        continue;
      }

      if (session.user.status !== 'ACTIVE') {
        throw new UnauthorizedException('User disabled');
      }

      const roles = await this.usersService.getUserRoles(session.userId);

      const payload = {
        sub: session.user.id,
        email: session.user.email,
        roles,
        sid: session.id,
      };

      const accessToken = await this.jwtService.signAsync(payload, {
        secret: this.config.jwtSecret,
        expiresIn: this.config.jwtTtl,
      });

      return {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: this.config.jwtTtl,
      };
    }

    throw new UnauthorizedException('Invalid refresh token');
  }

  async logout(refreshToken: string): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: {
        revokedAt: null,
      },
    });

    for (const session of sessions) {
      const match = await bcrypt.compare(refreshToken, session.refreshTokenHash);
      if (!match) {
        continue;
      }

      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      return;
    }
  }

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return;
    }

    const rawToken = randomBytes(40).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // This is intentionally surfaced for local/dev setup without SMTP wiring.
    // In production this should only be sent by email.
    await this.auditService.log({
      actorId: user.id,
      eventType: 'password.reset.requested',
      objectType: 'user',
      objectId: user.id,
      details: {
        developmentResetToken: rawToken,
      },
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokens = await this.prisma.passwordResetToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    for (const tokenRecord of tokens) {
      const valid = await bcrypt.compare(dto.token, tokenRecord.tokenHash);
      if (!valid) {
        continue;
      }

      const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);

      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: tokenRecord.userId },
          data: { passwordHash: newPasswordHash },
        }),
        this.prisma.passwordResetToken.update({
          where: { id: tokenRecord.id },
          data: { usedAt: new Date() },
        }),
      ]);

      return;
    }

    throw new BadRequestException('Invalid or expired reset token');
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.passwordHash) {
      throw new NotFoundException('User not found');
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const roles = await this.usersService.getUserRoles(user.id);

    return {
      id: user.id,
      email: user.email,
      authSource: user.authSource,
      roles,
      mfaEnabled: user.mfaEnabled,
      lastLogin: user.lastLogin,
    };
  }
}
