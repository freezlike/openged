import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, ObjectType, WorkflowTaskStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../permissions/permissions.service';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { QueryMyTasksDto } from './dto/query-my-tasks.dto';
import { StartWorkflowDto } from './dto/start-workflow.dto';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async startWorkflow(userId: string, dto: StartWorkflowDto) {
    const document = await this.prisma.document.findUnique({ where: { id: dto.documentId } });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.permissionsService.ensureObjectAccess({
      userId,
      objectType: ObjectType.DOCUMENT,
      objectId: dto.documentId,
      acceptedRoles: ['EDITOR', 'VALIDATOR', 'SITE_ADMIN', 'GLOBAL_ADMIN', 'SUPER_ADMIN'],
    });

    const existingOpen = await this.prisma.workflowInstance.findFirst({
      where: {
        documentId: dto.documentId,
        endedAt: null,
      },
    });

    if (existingOpen) {
      throw new BadRequestException('Document already has an active workflow');
    }

    const assignedUserId = dto.assignedUserId ?? userId;

    const workflow = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.workflowInstance.create({
        data: {
          documentId: dto.documentId,
          state: 'Submitted',
          startedBy: userId,
        },
      });

      await transaction.workflowTask.create({
        data: {
          workflowId: created.id,
          assignedUserId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          status: WorkflowTaskStatus.OPEN,
          comment: 'Validation task',
        },
      });

      await transaction.document.update({
        where: { id: dto.documentId },
        data: { status: DocumentStatus.PENDING_VALIDATION },
      });

      return created;
    });

    await this.auditService.log({
      actorId: userId,
      eventType: 'workflow.started',
      objectType: 'workflow',
      objectId: workflow.id,
      details: {
        documentId: dto.documentId,
        state: 'Submitted',
      },
    });

    return workflow;
  }

  async completeTask(userId: string, taskId: string, dto: CompleteTaskDto) {
    const task = await this.prisma.workflowTask.findUnique({
      where: { id: taskId },
      include: {
        workflow: {
          include: {
            document: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const globalRoles = await this.permissionsService.getGlobalRoles(userId);
    const canOverride = globalRoles.includes('SUPER_ADMIN') || globalRoles.includes('GLOBAL_ADMIN');

    if (task.assignedUserId !== userId && !canOverride) {
      throw new ForbiddenException('Only assignee can complete this task');
    }

    if (task.status !== WorkflowTaskStatus.OPEN) {
      throw new BadRequestException('Task already completed');
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      const updatedTask = await transaction.workflowTask.update({
        where: { id: task.id },
        data: {
          status: dto.status === 'COMPLETED' ? WorkflowTaskStatus.COMPLETED : WorkflowTaskStatus.REJECTED,
          completedAt: new Date(),
          comment: dto.comment ?? task.comment,
        },
      });

      if (dto.status === 'COMPLETED') {
        await transaction.workflowInstance.update({
          where: { id: task.workflowId },
          data: {
            state: 'Published',
            endedAt: new Date(),
          },
        });

        await transaction.document.update({
          where: { id: task.workflow.document.id },
          data: { status: DocumentStatus.PUBLISHED },
        });
      } else {
        await transaction.workflowInstance.update({
          where: { id: task.workflowId },
          data: {
            state: 'Draft',
            endedAt: new Date(),
          },
        });

        await transaction.document.update({
          where: { id: task.workflow.document.id },
          data: { status: DocumentStatus.DRAFT },
        });
      }

      return updatedTask;
    });

    await this.auditService.log({
      actorId: userId,
      eventType: 'workflow.task.completed',
      objectType: 'workflow_task',
      objectId: task.id,
      details: {
        workflowId: task.workflowId,
        status: dto.status,
      },
    });

    return result;
  }

  async availableWorkflows(_userId: string, _libraryId?: string, _contentTypeId?: string) {
    const templates = await this.prisma.workflowTemplate.findMany({
      orderBy: { name: 'asc' },
    });

    return templates.map((template) => ({
      id: template.id,
      name: template.name,
      states: template.states,
      transitions: template.transitions,
    }));
  }

  async myTasks(userId: string, query: QueryMyTasksDto) {
    const now = new Date();

    const tasks = await this.prisma.workflowTask.findMany({
      where: {
        assignedUserId: userId,
        status: query.status,
      },
      include: {
        workflow: {
          include: {
            document: {
              include: {
                library: {
                  include: {
                    site: true,
                  },
                },
                contentType: true,
              },
            },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });

    return tasks
      .filter((task) => {
        if (!query.preset) {
          return true;
        }

        if (query.preset === 'dueSoon') {
          if (!task.dueDate) {
            return false;
          }
          const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
          return task.dueDate > now && task.dueDate <= twoDaysFromNow && task.status === 'OPEN';
        }

        if (query.preset === 'overdue') {
          return Boolean(task.dueDate && task.dueDate < now && task.status === 'OPEN');
        }

        if (query.preset === 'completed') {
          return task.status === 'COMPLETED';
        }

        return true;
      })
      .map((task) => ({
        id: task.id,
        status: task.status,
        dueDate: task.dueDate,
        comment: task.comment,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        workflow: {
          id: task.workflow.id,
          state: task.workflow.state,
        },
        document: {
          id: task.workflow.document.id,
          title: task.workflow.document.title,
          status: task.workflow.document.status,
          site: {
            id: task.workflow.document.library.site.id,
            name: task.workflow.document.library.site.name,
          },
          library: {
            id: task.workflow.document.library.id,
            name: task.workflow.document.library.name,
          },
          contentType: task.workflow.document.contentType?.name ?? 'Document',
        },
      }));
  }
}
