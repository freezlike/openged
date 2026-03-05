import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { CreateFolderDto } from './dto/create-folder.dto';
import { CreateLibraryDto } from './dto/create-library.dto';
import { CreateSiteDto } from './dto/create-site.dto';
import { QueryLibraryItemsDto } from './dto/query-library-items.dto';
import { DmsService } from './dms.service';

@Controller('dms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DmsController {
  constructor(private readonly dmsService: DmsService) {}

  @Get('sites')
  async listSites() {
    return this.dmsService.listSites();
  }

  @Post('sites')
  @Roles('SITE_ADMIN', 'GLOBAL_ADMIN', 'SUPER_ADMIN')
  async createSite(@Body() dto: CreateSiteDto, @CurrentUser() user: RequestUser | undefined) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.dmsService.createSite(dto, user.id);
  }

  @Post('sites/:siteId/libraries')
  @Roles('SITE_ADMIN', 'GLOBAL_ADMIN', 'SUPER_ADMIN')
  async createLibrary(
    @Param('siteId') siteId: string,
    @Body() dto: CreateLibraryDto,
    @CurrentUser() user: RequestUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.dmsService.createLibrary(siteId, dto, user.id);
  }

  @Post('libraries/:libraryId/folders')
  @Roles('EDITOR', 'SITE_ADMIN', 'GLOBAL_ADMIN', 'SUPER_ADMIN')
  async createFolder(
    @Param('libraryId') libraryId: string,
    @Body() dto: CreateFolderDto,
    @CurrentUser() user: RequestUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.dmsService.createFolder(libraryId, dto, user.id);
  }

  @Get('libraries/:libraryId/items')
  async getLibraryItems(
    @Param('libraryId') libraryId: string,
    @Query() query: QueryLibraryItemsDto,
    @CurrentUser() user: RequestUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.dmsService.getLibraryItems(libraryId, query, user.id);
  }
}
