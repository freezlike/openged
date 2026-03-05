import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class SearchDocumentsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['basic', 'advanced'])
  mode: 'basic' | 'advanced' = 'basic';

  @IsOptional()
  @IsString()
  site?: string;

  @IsOptional()
  @IsString()
  library?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  classification?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
