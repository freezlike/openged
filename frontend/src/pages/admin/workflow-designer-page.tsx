import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  OnSelectionChangeParams,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import { Plus, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  createWorkflowDefinition,
  listWorkflowDefinitions,
  updateWorkflowDefinition,
} from '../../api/workflow';
import { SmartAutocomplete, SmartUserPicker } from '../../components/smart';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../features/auth/auth-context';
import { WorkflowDefinitionJson } from '../../types/domain';
import 'reactflow/dist/style.css';

type NodeType = 'start' | 'state' | 'approval' | 'decision' | 'end';
type WorkflowActionCode =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'request_changes'
  | 'validate'
  | 'publish'
  | 'archive'
  | 'cancel';
type DueDateUnit = 'hours' | 'days' | 'weeks';
type DueDateRuleMode = 'none' | 'relative' | 'fixed';

interface WorkflowDueDateRule {
  mode: DueDateRuleMode;
  amount?: number;
  unit?: DueDateUnit;
  businessDays?: boolean;
  fixedDate?: string;
}

const WORKFLOW_ACTION_CODES: WorkflowActionCode[] = [
  'submit',
  'approve',
  'reject',
  'request_changes',
  'validate',
  'publish',
  'archive',
  'cancel',
];

interface WorkflowNodeData {
  label: string;
  kind?: NodeType;
  actorType?: 'user' | 'group';
  actorId?: string;
  actorLabel?: string;
  dueDateRule?: WorkflowDueDateRule;
  allowedActions?: WorkflowActionCode[];
}

interface WorkflowEdgeData {
  action?: WorkflowActionCode;
  conditions?: string;
}

function isWorkflowActionCode(value: string): value is WorkflowActionCode {
  return WORKFLOW_ACTION_CODES.includes(value as WorkflowActionCode);
}

function parseAllowedActions(value: unknown): WorkflowActionCode[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim().toLowerCase())
      .filter(isWorkflowActionCode);
  }

  if (typeof value === 'string') {
    return value
      .split(/[,\s]+/g)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
      .filter(isWorkflowActionCode);
  }

  return [];
}

function parseDueDateRule(value: unknown): WorkflowDueDateRule {
  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const mode = typeof input.mode === 'string' ? input.mode : 'none';

    if (mode === 'relative') {
      const amount = typeof input.amount === 'number' ? Math.max(1, Math.trunc(input.amount)) : 1;
      const unit = input.unit === 'hours' || input.unit === 'weeks' ? input.unit : 'days';
      return {
        mode: 'relative',
        amount,
        unit,
        businessDays: Boolean(input.businessDays),
      };
    }

    if (mode === 'fixed' && typeof input.fixedDate === 'string') {
      return {
        mode: 'fixed',
        fixedDate: input.fixedDate,
      };
    }
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    const relativeMatch = normalized.match(/^\+(\d+)(bd|d|h|w)$/);
    if (relativeMatch) {
      const amount = Number(relativeMatch[1]);
      const token = relativeMatch[2];
      const unit: DueDateUnit = token === 'h' ? 'hours' : token === 'w' ? 'weeks' : 'days';
      return {
        mode: 'relative',
        amount,
        unit,
        businessDays: token === 'bd',
      };
    }

    const fixedMatch = normalized.match(/^date:(\d{4}-\d{2}-\d{2})$/);
    if (fixedMatch) {
      return {
        mode: 'fixed',
        fixedDate: fixedMatch[1],
      };
    }
  }

  return { mode: 'none' };
}

function serializeDueDateRule(rule?: WorkflowDueDateRule): WorkflowDueDateRule | null {
  if (!rule || rule.mode === 'none') {
    return null;
  }

  if (rule.mode === 'fixed') {
    return {
      mode: 'fixed',
      fixedDate: rule.fixedDate,
    };
  }

  return {
    mode: 'relative',
    amount: rule.amount ?? 1,
    unit: rule.unit ?? 'days',
    businessDays: Boolean(rule.businessDays),
  };
}

function actionLabel(
  code: WorkflowActionCode | undefined,
  translate: (key: string) => string,
) {
  if (!code) {
    return '';
  }

  return translate(`designer.actions.${code}`);
}

function normalizeDefinition(definition?: WorkflowDefinitionJson): {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge<WorkflowEdgeData>[];
} {
  if (!definition?.nodes || !definition?.edges) {
    return {
      nodes: [
        {
          id: 'start',
          type: 'input',
          position: { x: 120, y: 180 },
          data: { label: 'Start', kind: 'start' },
        },
        {
          id: 'end',
          type: 'output',
          position: { x: 700, y: 180 },
          data: { label: 'End', kind: 'end' },
        },
      ],
      edges: [
        {
          id: 'start-end',
          source: 'start',
          target: 'end',
          markerEnd: { type: MarkerType.ArrowClosed },
          animated: true,
        },
      ],
    };
  }

  const nodes = definition.nodes.map((node, index) => {
    const type = (node.type as NodeType) ?? 'state';
    const rawData =
      typeof node.data === 'object' && node.data ? (node.data as Record<string, unknown>) : {};

    return {
      id: node.id,
      type: type === 'start' ? 'input' : type === 'end' ? 'output' : 'default',
      position: node.position ?? { x: 140 + index * 80, y: 160 + (index % 4) * 60 },
      data: {
        label: node.label ?? node.id,
        kind: type,
        actorType: rawData.actorType === 'group' ? 'group' : 'user',
        actorId: typeof rawData.actorId === 'string' ? rawData.actorId : undefined,
        actorLabel: typeof rawData.actorLabel === 'string' ? rawData.actorLabel : undefined,
        dueDateRule: parseDueDateRule(rawData.dueDateRule),
        allowedActions: parseAllowedActions(rawData.allowedActions),
      } as WorkflowNodeData,
    } satisfies Node<WorkflowNodeData>;
  });

  const edges = definition.edges
    .map((edge, index) => {
      const source = edge.from ?? edge.source;
      const target = edge.to ?? edge.target;

      if (!source || !target) {
        return null;
      }

      return {
        id: edge.id ?? `${source}-${target}-${index}`,
        source,
        target,
        label: edge.action ?? '',
        data: {
          action: edge.action && isWorkflowActionCode(edge.action) ? edge.action : undefined,
          conditions: edge.conditions ? JSON.stringify(edge.conditions) : '',
        },
        markerEnd: { type: MarkerType.ArrowClosed },
      } satisfies Edge<WorkflowEdgeData>;
    })
    .filter(Boolean) as Edge<WorkflowEdgeData>[];

  return { nodes, edges };
}

function validateDefinition(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge<WorkflowEdgeData>[],
): 'startRequired' | 'endRequired' | 'disconnected' | null {
  const startNodes = nodes.filter((node) => node.data.kind === 'start' || node.type === 'input');
  const endNodes = nodes.filter((node) => node.data.kind === 'end' || node.type === 'output');

  if (startNodes.length === 0) {
    return 'startRequired';
  }

  if (endNodes.length === 0) {
    return 'endRequired';
  }

  const reachable = new Set<string>();
  const queue = startNodes.map((node) => node.id);
  const bySource = new Map<string, string[]>();

  for (const edge of edges) {
    if (!bySource.has(edge.source)) {
      bySource.set(edge.source, []);
    }
    bySource.get(edge.source)?.push(edge.target);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || reachable.has(current)) {
      continue;
    }

    reachable.add(current);
    for (const next of bySource.get(current) ?? []) {
      if (!reachable.has(next)) {
        queue.push(next);
      }
    }
  }

  if (nodes.some((node) => !reachable.has(node.id))) {
    return 'disconnected';
  }

  return null;
}

function toDefinitionJson(nodes: Node<WorkflowNodeData>[], edges: Edge<WorkflowEdgeData>[]): WorkflowDefinitionJson {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type:
        node.data.kind ??
        (node.type === 'input' ? 'start' : node.type === 'output' ? 'end' : 'state'),
      label: node.data.label,
      position: node.position,
      data: {
        actorType: node.data.actorType,
        actorId: node.data.actorId,
        actorLabel: node.data.actorLabel,
        dueDateRule: serializeDueDateRule(node.data.dueDateRule),
        allowedActions: node.data.allowedActions ?? [],
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      from: edge.source,
      to: edge.target,
      action: edge.data?.action,
      conditions: edge.data?.conditions ? { expression: edge.data.conditions } : null,
    })),
  };
}

export function WorkflowDesignerPage() {
  const { t, i18n } = useTranslation('workflow');
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const isAdmin = useMemo(
    () => Boolean(user?.roles.includes('SUPER_ADMIN') || user?.roles.includes('GLOBAL_ADMIN') || user?.roles.includes('SITE_ADMIN')),
    [user?.roles],
  );

  const definitionsQuery = useQuery({
    queryKey: ['workflow-definitions'],
    queryFn: listWorkflowDefinitions,
  });

  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string>('new');
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdgeData>([]);

  const workflowActionOptions = useMemo(
    () =>
      WORKFLOW_ACTION_CODES.map((code) => ({
        code,
        label: t(`designer.actions.${code}`),
      })),
    [t],
  );

  useEffect(() => {
    if (!definitionsQuery.data || definitionsQuery.data.length === 0) {
      return;
    }

    if (selectedDefinitionId === 'new') {
      const first = definitionsQuery.data[0];
      setSelectedDefinitionId(first.id);
    }
  }, [definitionsQuery.data, selectedDefinitionId]);

  useEffect(() => {
    if (selectedDefinitionId === 'new') {
      const empty = normalizeDefinition(undefined);
      setNodes(empty.nodes);
      setEdges(empty.edges);
      setWorkflowName('');
      setWorkflowDescription('');
      return;
    }

    const selected = definitionsQuery.data?.find((item) => item.id === selectedDefinitionId);
    if (!selected) {
      return;
    }

    const normalized = normalizeDefinition(selected.definitionJson);
    setNodes(normalized.nodes);
    setEdges(normalized.edges);
    setWorkflowName(selected.name);
    setWorkflowDescription(selected.description ?? '');
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [definitionsQuery.data, selectedDefinitionId, setEdges, setNodes]);

  useEffect(() => {
    setEdges((current) =>
      current.map((edge) => ({
        ...edge,
        label: actionLabel(edge.data?.action, (key) => t(key)),
      })),
    );
  }, [i18n.language, selectedDefinitionId, setEdges, t]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!workflowName.trim()) {
        throw new Error(t('designer.validation.nameRequired'));
      }

      const validationError = validateDefinition(nodes, edges);
      if (validationError) {
        throw new Error(t(`designer.validation.${validationError}`));
      }

      const definitionJson = toDefinitionJson(nodes, edges);

      if (selectedDefinitionId === 'new') {
        return createWorkflowDefinition({
          name: workflowName.trim(),
          description: workflowDescription.trim() || undefined,
          definitionJson,
        });
      }

      return updateWorkflowDefinition(selectedDefinitionId, {
        name: workflowName.trim(),
        description: workflowDescription.trim() || undefined,
        definitionJson,
      });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['workflow-definitions'] });
      setSelectedDefinitionId(saved.id);
    },
    onError: (error) => {
      window.alert(error instanceof Error ? error.message : t('designer.validation.saveFailed'));
    },
  });

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            markerEnd: { type: MarkerType.ArrowClosed },
            data: { action: 'approve' },
            label: actionLabel('approve', (key) => t(key)),
          },
          current,
        ),
      );
    },
    [setEdges, t],
  );

  const onSelectionChange = useCallback((selection: OnSelectionChangeParams) => {
    const selectedNode = selection.nodes[0];
    const selectedEdge = selection.edges[0];
    setSelectedNodeId(selectedNode?.id ?? null);
    setSelectedEdgeId(selectedEdge?.id ?? null);
  }, []);

  const addNode = (type: NodeType) => {
    const id = `${type}-${Date.now()}`;

    const mappedType = type === 'start' ? 'input' : type === 'end' ? 'output' : 'default';
    const nextNode: Node<WorkflowNodeData> = {
      id,
      type: mappedType,
      position: { x: 180 + nodes.length * 35, y: 120 + (nodes.length % 6) * 70 },
      data: {
        label: type.charAt(0).toUpperCase() + type.slice(1),
        kind: type,
      },
    };

    setNodes((current) => [...current, nextNode]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  if (!isAdmin) {
    return (
      <Card className="p-6 text-sm text-[#64748b]">
        {t('designer.noAccess')}
      </Card>
    );
  }

  return (
    <Card className="flex h-[calc(100vh-7.5rem)] min-h-[calc(100vh-7.5rem)] min-w-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e2e8f0] px-4 py-3">
        <h1 className="mr-4 text-lg font-semibold text-[#0f172a]">{t('designer.title')}</h1>

        <Select value={selectedDefinitionId} onValueChange={setSelectedDefinitionId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder={t('designer.selectDefinition')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">{t('designer.newWorkflow')}</SelectItem>
            {(definitionsQuery.data ?? []).map((definition) => (
              <SelectItem key={definition.id} value={definition.id}>
                {definition.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={workflowName}
          onChange={(event) => setWorkflowName(event.target.value)}
          placeholder={t('designer.name')}
          className="w-64"
        />

        <Input
          value={workflowDescription}
          onChange={(event) => setWorkflowDescription(event.target.value)}
          placeholder={t('designer.description')}
          className="w-80"
        />

        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setSelectedDefinitionId('new');
          }}
        >
          <Plus className="h-4 w-4" />
          {t('designer.new')}
        </Button>

        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? t('designer.saving') : t('designer.save')}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#e2e8f0] px-4 py-2">
            <Button size="sm" variant="secondary" onClick={() => addNode('start')}>
              {t('designer.addStart')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addNode('state')}>
              {t('designer.addState')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addNode('approval')}>
              {t('designer.addApproval')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addNode('decision')}>
              {t('designer.addDecision')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addNode('end')}>
              {t('designer.addEnd')}
            </Button>
            <p className="text-xs text-[#64748b]">{t('designer.hint')}</p>
          </div>

          <div className="min-h-0 flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              fitView
            >
              <MiniMap />
              <Controls />
              <Background gap={16} size={1} />
            </ReactFlow>
          </div>
        </div>

        <aside className="w-[360px] shrink-0 border-l border-[#e2e8f0] bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-[#0f172a]">{t('designer.configuration')}</h2>

          {selectedNode ? (
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{t('designer.nodeLabel')}</label>
                <Input
                  value={selectedNode.data.label}
                  onChange={(event) =>
                    setNodes((current) =>
                      current.map((node) =>
                        node.id === selectedNode.id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                label: event.target.value,
                              },
                            }
                          : node,
                      ),
                    )
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{t('designer.nodeType')}</label>
                <Select
                  value={
                    selectedNode.data.kind ??
                    (selectedNode.type === 'input'
                      ? 'start'
                      : selectedNode.type === 'output'
                        ? 'end'
                        : 'state')
                  }
                  onValueChange={(value) => {
                    const mappedType = value === 'start' ? 'input' : value === 'end' ? 'output' : 'default';
                    setNodes((current) =>
                      current.map((node) =>
                        node.id === selectedNode.id
                          ? {
                              ...node,
                              type: mappedType,
                              data: {
                                ...node.data,
                                kind: value as NodeType,
                              },
                            }
                          : node,
                      ),
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start">{t('designer.addStart')}</SelectItem>
                    <SelectItem value="state">{t('designer.addState')}</SelectItem>
                    <SelectItem value="approval">{t('designer.addApproval')}</SelectItem>
                    <SelectItem value="decision">{t('designer.addDecision')}</SelectItem>
                    <SelectItem value="end">{t('designer.addEnd')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{t('designer.actorType')}</label>
                <Select
                  value={selectedNode.data.actorType ?? 'user'}
                  onValueChange={(value) =>
                    setNodes((current) =>
                      current.map((node) =>
                        node.id === selectedNode.id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                actorType: value as 'user' | 'group',
                                actorId: undefined,
                                actorLabel: undefined,
                              },
                            }
                          : node,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">{t('designer.user')}</SelectItem>
                    <SelectItem value="group">{t('designer.group')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{t('designer.actor')}</label>
                {(selectedNode.data.actorType ?? 'user') === 'group' ? (
                  <SmartAutocomplete
                    entity="groups"
                    allowCreate={false}
                    value={
                      selectedNode.data.actorId
                        ? {
                            id: selectedNode.data.actorId,
                            label: selectedNode.data.actorLabel ?? selectedNode.data.actorId,
                          }
                        : null
                    }
                    onChange={(selected) =>
                      setNodes((current) =>
                        current.map((node) =>
                          node.id === selectedNode.id
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  actorId: selected?.id,
                                  actorLabel: selected?.label,
                                },
                              }
                            : node,
                        ),
                      )
                    }
                    placeholder={t('designer.selectGroup')}
                  />
                ) : (
                  <SmartUserPicker
                    value={
                      selectedNode.data.actorId
                        ? {
                            id: selectedNode.data.actorId,
                            label: selectedNode.data.actorLabel ?? selectedNode.data.actorId,
                          }
                        : null
                    }
                    onChange={(selected) =>
                      setNodes((current) =>
                        current.map((node) =>
                          node.id === selectedNode.id
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  actorId: selected?.id,
                                  actorLabel: selected?.label,
                                },
                              }
                            : node,
                        ),
                      )
                    }
                    placeholder={t('panel.searchUser')}
                    activeOnly
                  />
                )}
                <p className="text-xs text-[#64748b]">{t('designer.actorSourceHint')}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{t('designer.dueRule')}</label>
                <Select
                  value={selectedNode.data.dueDateRule?.mode ?? 'none'}
                  onValueChange={(value) =>
                    setNodes((current) =>
                      current.map((node) =>
                        node.id === selectedNode.id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                dueDateRule:
                                  value === 'relative'
                                    ? {
                                        mode: 'relative',
                                        amount: 2,
                                        unit: 'days',
                                        businessDays: false,
                                      }
                                    : value === 'fixed'
                                      ? {
                                          mode: 'fixed',
                                          fixedDate: '',
                                        }
                                      : { mode: 'none' },
                              },
                            }
                          : node,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('designer.dueModes.none')}</SelectItem>
                    <SelectItem value="relative">{t('designer.dueModes.relative')}</SelectItem>
                    <SelectItem value="fixed">{t('designer.dueModes.fixed')}</SelectItem>
                  </SelectContent>
                </Select>

                {selectedNode.data.dueDateRule?.mode === 'relative' ? (
                  <div className="grid grid-cols-[96px_1fr] gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={selectedNode.data.dueDateRule.amount ?? 1}
                      onChange={(event) =>
                        setNodes((current) =>
                          current.map((node) =>
                            node.id === selectedNode.id
                              ? {
                                  ...node,
                                  data: {
                                    ...node.data,
                                    dueDateRule: {
                                      mode: 'relative',
                                      amount: Math.max(1, Number(event.target.value) || 1),
                                      unit: node.data.dueDateRule?.unit ?? 'days',
                                      businessDays: Boolean(node.data.dueDateRule?.businessDays),
                                    },
                                  },
                                }
                              : node,
                          ),
                        )
                      }
                    />
                    <Select
                      value={selectedNode.data.dueDateRule.unit ?? 'days'}
                      onValueChange={(value) =>
                        setNodes((current) =>
                          current.map((node) =>
                            node.id === selectedNode.id
                              ? {
                                  ...node,
                                  data: {
                                    ...node.data,
                                    dueDateRule: {
                                      mode: 'relative',
                                      amount: node.data.dueDateRule?.amount ?? 1,
                                      unit: value as DueDateUnit,
                                      businessDays: Boolean(node.data.dueDateRule?.businessDays),
                                    },
                                  },
                                }
                              : node,
                          ),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hours">{t('designer.dueUnits.hours')}</SelectItem>
                        <SelectItem value="days">{t('designer.dueUnits.days')}</SelectItem>
                        <SelectItem value="weeks">{t('designer.dueUnits.weeks')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <label className="col-span-2 flex items-center gap-2 text-xs text-[#475569]">
                      <Checkbox
                        checked={Boolean(selectedNode.data.dueDateRule.businessDays)}
                        onCheckedChange={(checked) =>
                          setNodes((current) =>
                            current.map((node) =>
                              node.id === selectedNode.id
                                ? {
                                    ...node,
                                    data: {
                                      ...node.data,
                                      dueDateRule: {
                                        mode: 'relative',
                                        amount: node.data.dueDateRule?.amount ?? 1,
                                        unit: node.data.dueDateRule?.unit ?? 'days',
                                        businessDays: checked === true,
                                      },
                                    },
                                  }
                                : node,
                            ),
                          )
                        }
                      />
                      {t('designer.businessDays')}
                    </label>
                  </div>
                ) : null}

                {selectedNode.data.dueDateRule?.mode === 'fixed' ? (
                  <Input
                    type="date"
                    value={selectedNode.data.dueDateRule.fixedDate ?? ''}
                    onChange={(event) =>
                      setNodes((current) =>
                        current.map((node) =>
                          node.id === selectedNode.id
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  dueDateRule: {
                                    mode: 'fixed',
                                    fixedDate: event.target.value,
                                  },
                                },
                              }
                            : node,
                        ),
                      )
                    }
                  />
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{t('designer.allowedActions')}</label>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#e2e8f0] p-2">
                  {workflowActionOptions.map((action) => (
                    <label key={action.code} className="flex items-center gap-2 text-xs text-[#334155]">
                      <Checkbox
                        checked={Boolean(selectedNode.data.allowedActions?.includes(action.code))}
                        onCheckedChange={(checked) =>
                          setNodes((current) =>
                            current.map((node) =>
                              node.id === selectedNode.id
                                ? {
                                    ...node,
                                    data: {
                                      ...node.data,
                                      allowedActions:
                                        checked === true
                                          ? Array.from(
                                              new Set([...(node.data.allowedActions ?? []), action.code]),
                                            )
                                          : (node.data.allowedActions ?? []).filter(
                                              (entry) => entry !== action.code,
                                            ),
                                    },
                                  }
                                : node,
                            ),
                          )
                        }
                      />
                      <span>{action.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {selectedEdge ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs font-medium text-[#334155]">
                {t('designer.transition')}: {selectedEdge.source} → {selectedEdge.target}
              </p>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{t('designer.allowedAction')}</label>
                <Select
                  value={
                    selectedEdge.data?.action && isWorkflowActionCode(selectedEdge.data.action)
                      ? selectedEdge.data.action
                      : 'none'
                  }
                  onValueChange={(value) =>
                    setEdges((current) =>
                      current.map((edge) =>
                        edge.id === selectedEdge.id
                          ? {
                              ...edge,
                              label:
                                value === 'none'
                                  ? ''
                                  : actionLabel(value as WorkflowActionCode, (key) => t(key)),
                              data: {
                                ...edge.data,
                                action:
                                  value === 'none'
                                    ? undefined
                                    : (value as WorkflowActionCode),
                              },
                            }
                          : edge,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('designer.none')}</SelectItem>
                    {workflowActionOptions.map((action) => (
                      <SelectItem key={action.code} value={action.code}>
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{t('designer.condition')}</label>
                <Input
                  value={selectedEdge.data?.conditions ?? ''}
                  onChange={(event) =>
                    setEdges((current) =>
                      current.map((edge) =>
                        edge.id === selectedEdge.id
                          ? {
                              ...edge,
                              data: {
                                ...edge.data,
                                conditions: event.target.value,
                              },
                            }
                          : edge,
                      ),
                    )
                  }
                  placeholder="metadata.confidentiality == 'Restricted'"
                />
              </div>
            </div>
          ) : null}

          {!selectedNode && !selectedEdge ? (
            <p className="mt-3 text-xs text-[#64748b]">
              {t('designer.emptyConfig')}
            </p>
          ) : null}
        </aside>
      </div>
    </Card>
  );
}
