import { Module } from '@nestjs/common';

import { PermissionsModule } from '../permissions/permissions.module';
import { TasksController } from './tasks.controller';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowsController } from './workflows.controller';

@Module({
  imports: [PermissionsModule],
  providers: [WorkflowService],
  controllers: [WorkflowController, WorkflowsController, TasksController],
  exports: [WorkflowService],
})
export class WorkflowModule {}
