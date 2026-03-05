import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteTaskDto {
  @IsIn(['COMPLETED', 'REJECTED'])
  status!: 'COMPLETED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
