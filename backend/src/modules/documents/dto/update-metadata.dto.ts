import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

class MetadataFieldValueDto {
  @IsString()
  @IsNotEmpty()
  fieldId!: string;

  value!: unknown;
}

export class UpdateMetadataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetadataFieldValueDto)
  fields!: MetadataFieldValueDto[];
}
