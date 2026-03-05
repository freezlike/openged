import { IsDateString, IsOptional, IsString } from 'class-validator';

export class StartWorkflowDto {
  @IsString()
  documentId!: string;

  @IsOptional()
  @IsString()
  workflowDefId?: string;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
