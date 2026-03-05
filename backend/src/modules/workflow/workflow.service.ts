import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, ObjectType, Prisma, WorkflowTaskStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../permissions/permissions.service';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { QueryMyTasksDto } from './dto/query-my-tasks.dto';
import { StartWorkflowDto } from './dto/start-workflow.dto';
import {
  CreateWorkflowDefinitionDto,
  UpdateWorkflowDefinitionDto,
} from './dto/workflow-definition.dto';

type WorkflowDesignerNode = {
  id: string;
  type: string;
  label?: string;
};

type WorkflowDesignerEdge = {
  id?: string;
  from?: string;
  to?: string;
  source?: string;
  target?: string;
  action?: string;
  conditions?: Record<string, unknown> | null;
};

type WorkflowDefinition = {
  nodes: WorkflowDesignerNode[];
  edges: WorkflowDesignerEdge[];
};

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

    const workflowDefinition = await this.resolveWorkflowDefinition(dto);
    const initialState = this.resolveInitialState(workflowDefinition?.definitionJson);
    const assignedUserId = dto.assignedUserId ?? userId;

    const workflow = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.workflowInstance.create({
        data: {
          documentId: dto.documentId,
          workflowDefId: workflowDefinition?.id,
          state: initialState,
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
        workflowDefId: workflowDefinition?.id,
        state: initialState,
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
      const workflowDefinition = task.workflow.workflowDefId
        ? await transaction.workflowDef.findUnique({
            where: { id: task.workflow.workflowDefId },
          })
        : null;

      const stateDecision = this.resolveNextState({
        currentState: task.workflow.state,
        decision: dto.status,
        definitionJson: workflowDefinition?.definitionJson ?? null,
      });

      const updatedTask = await transaction.workflowTask.update({
        where: { id: task.id },
        data: {
          status: dto.status === 'COMPLETED' ? WorkflowTaskStatus.COMPLETED : WorkflowTaskStatus.REJECTED,
          completedAt: new Date(),
          comment: dto.comment ?? task.comment,
        },
      });

      await transaction.workflowInstance.update({
        where: { id: task.workflowId },
        data: {
          state: stateDecision.nextState,
          endedAt: stateDecision.closed ? new Date() : null,
        },
      });

      await transaction.document.update({
        where: { id: task.workflow.document.id },
        data: { status: stateDecision.documentStatus },
      });

      if (!stateDecision.closed) {
        await transaction.workflowTask.create({
          data: {
            workflowId: task.workflowId,
            assignedUserId: stateDecision.nextAssigneeId ?? task.assignedUserId,
            status: WorkflowTaskStatus.OPEN,
            comment: `Task for state ${stateDecision.nextState}`,
          },
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
        previousState: task.workflow.state,
      },
    });

    return result;
  }

  async availableWorkflows(userId: string, libraryId?: string, contentTypeId?: string) {
    void userId;
    void libraryId;
    void contentTypeId;

    const definitions = await this.prisma.workflowDef.findMany({
      orderBy: { name: 'asc' },
    });

    if (definitions.length > 0) {
      return definitions.map((definition) => ({
        id: definition.id,
        name: definition.name,
        description: definition.description,
        definitionJson: definition.definitionJson,
      }));
    }

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

  async listDefinitions() {
    const definitions = await this.prisma.workflowDef.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    return definitions.map((definition) => ({
      id: definition.id,
      name: definition.name,
      description: definition.description,
      definitionJson: definition.definitionJson,
      createdAt: definition.createdAt,
      updatedAt: definition.updatedAt,
    }));
  }

  async getDefinitionById(id: string) {
    const definition = await this.prisma.workflowDef.findUnique({
      where: { id },
    });

    if (!definition) {
      throw new NotFoundException('Workflow definition not found');
    }

    return definition;
  }

  async createDefinition(userId: string, dto: CreateWorkflowDefinitionDto) {
    this.validateDefinition(dto.definitionJson);

    const created = await this.prisma.workflowDef.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        definitionJson: dto.definitionJson as Prisma.InputJsonValue,
      },
    });

    await this.auditService.log({
      actorId: userId,
      eventType: 'workflow.definition.created',
      objectType: 'workflow_def',
      objectId: created.id,
      details: { name: created.name },
    });

    return created;
  }

  async updateDefinition(userId: string, id: string, dto: UpdateWorkflowDefinitionDto) {
    const existing = await this.prisma.workflowDef.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Workflow definition not found');
    }

    if (dto.definitionJson) {
      this.validateDefinition(dto.definitionJson);
    }

    const updated = await this.prisma.workflowDef.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description !== undefined
            ? dto.description.trim() || null
            : undefined,
        definitionJson: dto.definitionJson
          ? (dto.definitionJson as Prisma.InputJsonValue)
          : undefined,
      },
    });

    await this.auditService.log({
      actorId: userId,
      eventType: 'workflow.definition.updated',
      objectType: 'workflow_def',
      objectId: updated.id,
      details: { name: updated.name },
    });

    return updated;
  }

  private async resolveWorkflowDefinition(dto: StartWorkflowDto) {
    if (dto.workflowDefId) {
      const byId = await this.prisma.workflowDef.findUnique({
        where: { id: dto.workflowDefId },
      });

      if (!byId) {
        throw new NotFoundException('Workflow definition not found');
      }

      return byId;
    }

    if (dto.templateName) {
      return this.prisma.workflowDef.findFirst({
        where: {
          name: dto.templateName,
        },
      });
    }

    return this.prisma.workflowDef.findFirst({
      orderBy: { createdAt: 'asc' },
    });
  }

  private resolveInitialState(definitionJson?: Prisma.JsonValue | null) {
    const fallback = 'Submitted';
    const definition = definitionJson as WorkflowDefinition | null;

    if (!definition || !Array.isArray(definition.nodes) || !Array.isArray(definition.edges)) {
      return fallback;
    }

    const startNode = definition.nodes.find((node) => node.type === 'start');
    if (!startNode) {
      return fallback;
    }

    const firstEdge = definition.edges.find(
      (edge) =>
        (edge.from ?? edge.source) === startNode.id &&
        Boolean(edge.to ?? edge.target),
    );

    if (!firstEdge) {
      return fallback;
    }

    const nextNodeId = firstEdge.to ?? firstEdge.target;
    if (!nextNodeId) {
      return fallback;
    }

    const nextNode = definition.nodes.find((node) => node.id === nextNodeId);
    return nextNode?.label?.trim() || fallback;
  }

  private resolveNextState(params: {
    currentState: string;
    decision: 'COMPLETED' | 'REJECTED';
    definitionJson?: Prisma.JsonValue | null;
  }): {
    nextState: string;
    closed: boolean;
    documentStatus: DocumentStatus;
    nextAssigneeId?: string;
  } {
    const fallbackState = params.decision === 'COMPLETED' ? 'Published' : 'Draft';

    const definition = params.definitionJson as WorkflowDefinition | null;

    if (!definition || !Array.isArray(definition.nodes) || !Array.isArray(definition.edges)) {
      return this.mapStateToDocumentStatus(fallbackState, true);
    }

    const sourceNode = definition.nodes.find(
      (node) => node.label?.trim().toLowerCase() === params.currentState.trim().toLowerCase(),
    );

    if (!sourceNode) {
      return this.mapStateToDocumentStatus(fallbackState, true);
    }

    const action = params.decision === 'COMPLETED' ? 'approve' : 'reject';
    const outgoing = definition.edges.filter(
      (edge) => (edge.from ?? edge.source) === sourceNode.id,
    );

    const matching =
      outgoing.find(
        (edge) =>
          edge.action?.trim().toLowerCase() === action,
      ) ??
      (params.decision === 'COMPLETED'
        ? outgoing.find((edge) => (edge.action ?? '').trim().toLowerCase() !== 'reject')
        : undefined) ??
      outgoing[0];

    if (!matching) {
      return this.mapStateToDocumentStatus(fallbackState, true);
    }

    const targetNodeId = matching.to ?? matching.target;
    const targetNode = definition.nodes.find((node) => node.id === targetNodeId);

    if (!targetNode) {
      return this.mapStateToDocumentStatus(fallbackState, true);
    }

    const nextState = targetNode.label?.trim() || fallbackState;
    const closed = targetNode.type === 'end' || ['published', 'draft', 'archived'].includes(nextState.toLowerCase());
    const nodeData = (targetNode as { data?: { actorType?: string; actorId?: string } }).data;
    const nextAssigneeId =
      nodeData?.actorType === 'user' && nodeData.actorId
        ? nodeData.actorId
        : undefined;

    return this.mapStateToDocumentStatus(nextState, closed, nextAssigneeId);
  }

  private mapStateToDocumentStatus(state: string, closed: boolean, nextAssigneeId?: string) {
    const normalized = state.trim().toLowerCase();

    if (normalized.includes('publish')) {
      return {
        nextState: state,
        closed,
        documentStatus: DocumentStatus.PUBLISHED,
        nextAssigneeId,
      };
    }

    if (normalized.includes('archive')) {
      return {
        nextState: state,
        closed,
        documentStatus: DocumentStatus.ARCHIVED,
        nextAssigneeId,
      };
    }

    if (normalized.includes('draft')) {
      return {
        nextState: state,
        closed,
        documentStatus: DocumentStatus.DRAFT,
        nextAssigneeId,
      };
    }

    return {
      nextState: state,
      closed,
      documentStatus: DocumentStatus.PENDING_VALIDATION,
      nextAssigneeId,
    };
  }

  private validateDefinition(definition: WorkflowDefinition) {
    if (!definition || !Array.isArray(definition.nodes) || !Array.isArray(definition.edges)) {
      throw new BadRequestException('Workflow definition must contain nodes and edges');
    }

    const startNodes = definition.nodes.filter((node) => node.type === 'start');
    const endNodes = definition.nodes.filter((node) => node.type === 'end');

    if (startNodes.length === 0) {
      throw new BadRequestException('Workflow definition must contain a start node');
    }

    if (endNodes.length === 0) {
      throw new BadRequestException('Workflow definition must contain an end node');
    }

    const nodeIds = new Set(definition.nodes.map((node) => node.id));
    const outgoing = new Map<string, string[]>();

    for (const edge of definition.edges) {
      const from = edge.from ?? edge.source;
      const to = edge.to ?? edge.target;

      if (!from || !to || !nodeIds.has(from) || !nodeIds.has(to)) {
        throw new BadRequestException('Workflow contains disconnected edges');
      }

      const current = outgoing.get(from) ?? [];
      current.push(to);
      outgoing.set(from, current);
    }

    const reachable = new Set<string>();
    const queue: string[] = startNodes.map((node) => node.id);

    while (queue.length > 0) {
      const current = queue.shift();

      if (!current || reachable.has(current)) {
        continue;
      }

      reachable.add(current);

      for (const next of outgoing.get(current) ?? []) {
        if (!reachable.has(next)) {
          queue.push(next);
        }
      }
    }

    const disconnected = definition.nodes.filter((node) => !reachable.has(node.id));
    if (disconnected.length > 0) {
      throw new BadRequestException('Workflow has disconnected nodes');
    }
  }
}
