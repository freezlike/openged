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

import {
  createWorkflowDefinition,
  listWorkflowDefinitions,
  updateWorkflowDefinition,
} from '../../api/workflow';
import { SmartAutocomplete, SmartUserPicker } from '../../components/smart';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../features/auth/auth-context';
import { WorkflowDefinitionJson } from '../../types/domain';
import 'reactflow/dist/style.css';

type NodeType = 'start' | 'state' | 'approval' | 'decision' | 'end';

interface WorkflowNodeData {
  label: string;
  kind?: NodeType;
  actorType?: 'user' | 'group';
  actorId?: string;
  actorLabel?: string;
  dueDateRule?: string;
  allowedActions?: string;
}

interface WorkflowEdgeData {
  action?: string;
  conditions?: string;
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
    return {
      id: node.id,
      type: type === 'start' ? 'input' : type === 'end' ? 'output' : 'default',
      position: node.position ?? { x: 140 + index * 80, y: 160 + (index % 4) * 60 },
      data: {
        label: node.label ?? node.id,
        kind: type,
        ...(typeof node.data === 'object' && node.data ? (node.data as Record<string, unknown>) : {}),
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
          action: edge.action,
          conditions: edge.conditions ? JSON.stringify(edge.conditions) : '',
        },
        markerEnd: { type: MarkerType.ArrowClosed },
      } satisfies Edge<WorkflowEdgeData>;
    })
    .filter(Boolean) as Edge<WorkflowEdgeData>[];

  return { nodes, edges };
}

function validateDefinition(nodes: Node<WorkflowNodeData>[], edges: Edge<WorkflowEdgeData>[]) {
  const startNodes = nodes.filter((node) => node.data.kind === 'start' || node.type === 'input');
  const endNodes = nodes.filter((node) => node.data.kind === 'end' || node.type === 'output');

  if (startNodes.length === 0) {
    return 'Workflow must contain a start node.';
  }

  if (endNodes.length === 0) {
    return 'Workflow must contain an end node.';
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
    return 'Workflow contains disconnected nodes.';
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
        dueDateRule: node.data.dueDateRule,
        allowedActions: node.data.allowedActions,
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      from: edge.source,
      to: edge.target,
      action: edge.data?.action ?? (typeof edge.label === 'string' ? edge.label : undefined),
      conditions: edge.data?.conditions ? { expression: edge.data.conditions } : null,
    })),
  };
}

export function WorkflowDesignerPage() {
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

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!workflowName.trim()) {
        throw new Error('Workflow name is required.');
      }

      const validationError = validateDefinition(nodes, edges);
      if (validationError) {
        throw new Error(validationError);
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
      window.alert(error instanceof Error ? error.message : 'Unable to save workflow definition');
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
            label: 'approve',
          },
          current,
        ),
      );
    },
    [setEdges],
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
        You do not have access to the workflow designer.
      </Card>
    );
  }

  return (
    <Card className="flex h-[calc(100vh-7.5rem)] min-h-[calc(100vh-7.5rem)] min-w-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e2e8f0] px-4 py-3">
        <h1 className="mr-4 text-lg font-semibold text-[#0f172a]">Workflow designer</h1>

        <Select value={selectedDefinitionId} onValueChange={setSelectedDefinitionId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select workflow definition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">+ New workflow</SelectItem>
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
          placeholder="Workflow name"
          className="w-64"
        />

        <Input
          value={workflowDescription}
          onChange={(event) => setWorkflowDescription(event.target.value)}
          placeholder="Description (optional)"
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
          New
        </Button>

        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save workflow'}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#e2e8f0] px-4 py-2">
            <Button size="sm" variant="secondary" onClick={() => addNode('start')}>
              Add Start
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addNode('state')}>
              Add State
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addNode('approval')}>
              Add Approval
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addNode('decision')}>
              Add Decision
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addNode('end')}>
              Add End
            </Button>
            <p className="text-xs text-[#64748b]">Drag nodes, connect with handles, then configure on the right.</p>
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
          <h2 className="text-sm font-semibold text-[#0f172a]">Configuration</h2>

          {selectedNode ? (
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Node label</label>
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
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Node type</label>
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
                    <SelectItem value="start">Start</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                    <SelectItem value="approval">Approval</SelectItem>
                    <SelectItem value="decision">Decision</SelectItem>
                    <SelectItem value="end">End</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Actor type</label>
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
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Assigned actor</label>
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
                    placeholder="Select group..."
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
                    placeholder="Select user..."
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Due date rule</label>
                <Input
                  value={selectedNode.data.dueDateRule ?? ''}
                  onChange={(event) =>
                    setNodes((current) =>
                      current.map((node) =>
                        node.id === selectedNode.id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                dueDateRule: event.target.value,
                              },
                            }
                          : node,
                      ),
                    )
                  }
                  placeholder="e.g. +2d business days"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Allowed actions</label>
                <Input
                  value={selectedNode.data.allowedActions ?? ''}
                  onChange={(event) =>
                    setNodes((current) =>
                      current.map((node) =>
                        node.id === selectedNode.id
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                allowedActions: event.target.value,
                              },
                            }
                          : node,
                      ),
                    )
                  }
                  placeholder="approve,reject,request_changes"
                />
              </div>
            </div>
          ) : null}

          {selectedEdge ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs font-medium text-[#334155]">
                Transition: {selectedEdge.source} → {selectedEdge.target}
              </p>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Allowed action</label>
                <Input
                  value={selectedEdge.data?.action ?? ''}
                  onChange={(event) =>
                    setEdges((current) =>
                      current.map((edge) =>
                        edge.id === selectedEdge.id
                          ? {
                              ...edge,
                              label: event.target.value,
                              data: {
                                ...edge.data,
                                action: event.target.value,
                              },
                            }
                          : edge,
                      ),
                    )
                  }
                  placeholder="approve / reject / request_changes"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Condition expression</label>
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
              Select a node or transition to configure actors, due date rules, actions and conditions.
            </p>
          ) : null}
        </aside>
      </div>
    </Card>
  );
}
