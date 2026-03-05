import { IsIn, IsOptional } from 'class-validator';

export class QueryMyTasksDto {
  @IsOptional()
  @IsIn(['OPEN', 'COMPLETED', 'REJECTED', 'CANCELED'])
  status?: 'OPEN' | 'COMPLETED' | 'REJECTED' | 'CANCELED';

  @IsOptional()
  @IsIn(['dueSoon', 'overdue', 'completed'])
  preset?: 'dueSoon' | 'overdue' | 'completed';
}
