import { Body, Controller, Get, Post } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { CreateAdminDto } from './dto/create-admin.dto';
import { FinalizeInstallDto } from './dto/finalize-install.dto';
import { InstallerFeaturesDto } from './dto/installer-features.dto';
import { OrganizationSettingsDto } from './dto/organization-settings.dto';
import { InstallerService } from './installer.service';

@Controller('install')
@Public()
export class InstallerController {
  constructor(private readonly installerService: InstallerService) {}

  @Get('status')
  async status() {
    return this.installerService.status();
  }

  @Get('system-checks')
  async systemChecks() {
    return this.installerService.systemChecks();
  }

  @Post('organization')
  async saveOrganization(@Body() dto: OrganizationSettingsDto) {
    return this.installerService.saveOrganizationSettings(dto);
  }

  @Post('admin')
  async createAdmin(@Body() dto: CreateAdminDto) {
    return this.installerService.createSuperAdmin(dto);
  }

  @Post('features')
  async features(@Body() dto: InstallerFeaturesDto) {
    return this.installerService.configureFeatures(dto);
  }

  @Post('bootstrap-ged')
  async bootstrapGed() {
    return this.installerService.bootstrapGed();
  }

  @Post('finalize')
  async finalize(@Body() dto: FinalizeInstallDto) {
    return this.installerService.finalize(dto);
  }
}
