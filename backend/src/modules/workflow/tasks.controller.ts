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
import { CompleteTaskDto } from './dto/complete-task.dto';
import { QueryMyTasksDto } from './dto/query-my-tasks.dto';
import { WorkflowService } from './workflow.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post(':id/complete')
  async complete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser | undefined,
    @Body() dto: CompleteTaskDto,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.workflowService.completeTask(user.id, id, dto);
  }

  @Get('my')
  async myTasks(
    @CurrentUser() user: RequestUser | undefined,
    @Query() query: QueryMyTasksDto,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.workflowService.myTasks(user.id, query);
  }
}
