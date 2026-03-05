import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

type WorkflowDefinitionNodeDto = {
  id: string;
  type: string;
  label?: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
};

type WorkflowDefinitionEdgeDto = {
  id?: string;
  from?: string;
  to?: string;
  source?: string;
  target?: string;
  action?: string;
  conditions?: Record<string, unknown> | null;
};

export class CreateWorkflowDefinitionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  definitionJson!: {
    nodes: WorkflowDefinitionNodeDto[];
    edges: WorkflowDefinitionEdgeDto[];
  };
}

export class UpdateWorkflowDefinitionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  definitionJson?: {
    nodes: WorkflowDefinitionNodeDto[];
    edges: WorkflowDefinitionEdgeDto[];
  };
}
