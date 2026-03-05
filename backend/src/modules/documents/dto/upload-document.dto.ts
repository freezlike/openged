import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  libraryId!: string;

  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  contentTypeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
