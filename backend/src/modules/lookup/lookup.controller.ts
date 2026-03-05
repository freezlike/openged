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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { CreateLookupDto } from './dto/create-lookup.dto';
import { QueryLookupDto } from './dto/query-lookup.dto';
import { LookupService } from './lookup.service';

@Controller('lookup')
@UseGuards(JwtAuthGuard)
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  @Get(':entity')
  async search(
    @Param('entity') entity: string,
    @CurrentUser() user: RequestUser | undefined,
    @Query() query: QueryLookupDto,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.lookupService.search(entity, query.q, query.taxonomy, query.activeOnly);
  }

  @Post(':entity')
  async create(
    @Param('entity') entity: string,
    @Body() dto: CreateLookupDto,
    @CurrentUser() user: RequestUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.lookupService.create(entity, dto.label, user.id, dto.taxonomy);
  }
}
