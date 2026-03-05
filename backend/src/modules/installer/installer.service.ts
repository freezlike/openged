import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DmsService } from '../dms/dms.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { FinalizeInstallDto } from './dto/finalize-install.dto';
import { InstallerFeaturesDto } from './dto/installer-features.dto';
import { OrganizationSettingsDto } from './dto/organization-settings.dto';

@Injectable()
export class InstallerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
    private readonly dmsService: DmsService,
    private readonly auditService: AuditService,
  ) {}

  async status() {
    await this.ensureBaseData();

    const state = await this.prisma.systemState.findUnique({ where: { id: 1 } });

    return {
      installed: state?.status === 'INSTALLED',
      installerLocked: state?.installerLocked ?? false,
      installedAt: state?.installedAt,
      authMode: state?.authMode ?? 'LOCAL_ONLY',
    };
  }

  async systemChecks() {
    await this.ensureBaseData();

    const dbCheck = await this.checkDatabase();
    const storageCheck = await this.storageService.checkConnectivity();
    const searchCheck = await this.checkSearch();

    return {
      database: dbCheck,
      storage: storageCheck,
      masterEncryptionKeyPresent: this.config.masterEncryptionKey.length >= 32,
      httpsWarning: !this.config.forceHttps,
      search: searchCheck,
    };
  }

  async saveOrganizationSettings(dto: OrganizationSettingsDto) {
    await this.ensureInstallerOpen();

    const settings = await this.prisma.orgSettings.upsert({
      where: { id: 1 },
      update: {
        orgName: dto.organizationName,
        timezone: dto.timezone,
        language: dto.language,
        technicalEmail: dto.technicalEmail,
      },
      create: {
        id: 1,
        orgName: dto.organizationName,
        timezone: dto.timezone,
        language: dto.language,
        technicalEmail: dto.technicalEmail,
      },
    });

    await this.auditService.log({
      eventType: 'install.organization.configured',
      objectType: 'org_settings',
      objectId: String(settings.id),
    });

    return settings;
  }

  async createSuperAdmin(dto: CreateAdminDto) {
    await this.ensureInstallerOpen();

    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('Admin email already exists');
    }

    const hash = await bcrypt.hash(dto.password, 12);

    const user = await this.usersService.createLocalUser({
      email: dto.email,
      passwordHash: hash,
      mfaEnabled: dto.mfaEnabled,
      status: 'ACTIVE',
    });

    await this.usersService.assignRole(user.id, 'SUPER_ADMIN', true);

    await this.auditService.log({
      actorId: user.id,
      eventType: 'install.admin.created',
      objectType: 'user',
      objectId: user.id,
      details: { email: dto.email.toLowerCase() },
    });

    return {
      id: user.id,
      email: user.email,
      role: 'SUPER_ADMIN',
    };
  }

  async configureFeatures(dto: InstallerFeaturesDto) {
    await this.ensureInstallerOpen();

    const state = await this.prisma.systemState.upsert({
      where: { id: 1 },
      update: {
        searchEnabled: dto.enableSearch,
        ssoEnabled: dto.enableSso,
        emailEnabled: dto.enableEmailNotifications,
        authMode: dto.authMode,
      },
      create: {
        id: 1,
        searchEnabled: dto.enableSearch,
        ssoEnabled: dto.enableSso,
        emailEnabled: dto.enableEmailNotifications,
        authMode: dto.authMode,
      },
    });

    return state;
  }

  async bootstrapGed() {
    await this.ensureInstallerOpen();

    const admin = await this.findSuperAdmin();

    const setup = await this.dmsService.createDefaultGedSetup(admin.id);

    await this.auditService.log({
      actorId: admin.id,
      eventType: 'install.ged.bootstrap',
      objectType: 'site',
      objectId: setup.site.id,
    });

    return setup;
  }

  async finalize(dto: FinalizeInstallDto) {
    await this.ensureInstallerOpen();

    const admin = await this.findSuperAdmin();

    const state = await this.prisma.systemState.upsert({
      where: { id: 1 },
      update: {
        status: 'INSTALLED',
        installedAt: new Date(),
        installedBy: admin.id,
        appVersion: dto.appVersion ?? '1.0.0',
        installerLocked: true,
      },
      create: {
        id: 1,
        status: 'INSTALLED',
        installedAt: new Date(),
        installedBy: admin.id,
        appVersion: dto.appVersion ?? '1.0.0',
        installerLocked: true,
      },
    });

    return {
      installed: true,
      installedAt: state.installedAt,
      redirectTo: '/login',
    };
  }

  private async ensureInstallerOpen(): Promise<void> {
    await this.ensureBaseData();

    const state = await this.prisma.systemState.findUnique({ where: { id: 1 } });

    if (state?.installerLocked || state?.status === 'INSTALLED') {
      throw new BadRequestException('Installer is disabled');
    }
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        details: error instanceof Error ? error.message : 'Database unavailable',
      };
    }
  }

  private async checkSearch() {
    if (!this.config.searchEnabled) {
      return { ok: true, details: 'Search disabled' };
    }

    return { ok: false, details: 'Search adapter not configured in this baseline build' };
  }

  private async findSuperAdmin() {
    const role = await this.prisma.role.findUnique({ where: { code: 'SUPER_ADMIN' } });

    if (!role) {
      throw new BadRequestException('SUPER_ADMIN role missing');
    }

    const userRole = await this.prisma.userRole.findFirst({
      where: { roleId: role.id },
      include: { user: true },
    });

    if (!userRole) {
      throw new BadRequestException('No SUPER_ADMIN account found');
    }

    return userRole.user;
  }

  private async ensureBaseData(): Promise<void> {
    const baseRoles = [
      { code: 'READER', name: 'Reader' },
      { code: 'CONTRIBUTOR', name: 'Contributor' },
      { code: 'EDITOR', name: 'Editor' },
      { code: 'VALIDATOR', name: 'Validator' },
      { code: 'SITE_ADMIN', name: 'Site Admin' },
      { code: 'GLOBAL_ADMIN', name: 'Global Admin' },
      { code: 'SUPER_ADMIN', name: 'Super Admin' },
    ];

    for (const role of baseRoles) {
      await this.prisma.role.upsert({
        where: { code: role.code },
        update: {},
        create: role,
      });
    }

    await this.prisma.systemState.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        status: 'NOT_INSTALLED',
        installerLocked: false,
      },
    });
  }
}
