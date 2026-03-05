import { Body, Controller, Post, UnauthorizedException, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { StartWorkflowDto } from './dto/start-workflow.dto';
import { WorkflowService } from './workflow.service';

@Controller('workflow')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post('start')
  async start(@CurrentUser() user: RequestUser | undefined, @Body() dto: StartWorkflowDto) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.workflowService.startWorkflow(user.id, dto);
  }
}
