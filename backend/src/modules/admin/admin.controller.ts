import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { QueryAuditDto } from '../audit/dto/query-audit.dto';
import { AuditService } from '../audit/audit.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly auditService: AuditService) {}

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
}
