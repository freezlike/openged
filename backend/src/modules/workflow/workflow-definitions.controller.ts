import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import {
  CreateWorkflowDefinitionDto,
  UpdateWorkflowDefinitionDto,
} from './dto/workflow-definition.dto';
import { WorkflowService } from './workflow.service';

@Controller('workflows/definitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkflowDefinitionsController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser | undefined) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.workflowService.listDefinitions();
  }

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user: RequestUser | undefined) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.workflowService.getDefinitionById(id);
  }

  @Post()
  @Roles('SITE_ADMIN', 'GLOBAL_ADMIN', 'SUPER_ADMIN')
  async create(
    @Body() dto: CreateWorkflowDefinitionDto,
    @CurrentUser() user: RequestUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.workflowService.createDefinition(user.id, dto);
  }

  @Put(':id')
  @Roles('SITE_ADMIN', 'GLOBAL_ADMIN', 'SUPER_ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDefinitionDto,
    @CurrentUser() user: RequestUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.workflowService.updateDefinition(user.id, id, dto);
  }
}
