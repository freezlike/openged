import { Controller, Get, Query, UnauthorizedException, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { WorkflowService } from './workflow.service';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('available')
  async available(
    @CurrentUser() user: RequestUser | undefined,
    @Query('libraryId') libraryId?: string,
    @Query('contentTypeId') contentTypeId?: string,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.workflowService.availableWorkflows(user.id, libraryId, contentTypeId);
  }
}
