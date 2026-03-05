import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryLibraryItemsDto {
  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PENDING_VALIDATION', 'PUBLISHED', 'ARCHIVED', 'DELETED'])
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  confidentiality?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsDateString()
  modifiedFrom?: string;

  @IsOptional()
  @IsDateString()
  modifiedTo?: string;

  @IsOptional()
  @IsIn(['updatedAt', 'createdAt', 'title'])
  sortBy: 'updatedAt' | 'createdAt' | 'title' = 'updatedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(500)
  pageSize = 100;
}
