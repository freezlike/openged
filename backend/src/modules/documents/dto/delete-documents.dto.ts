import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID } from 'class-validator';

export class DeleteDocumentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @IsUUID(undefined, { each: true })
  ids!: string[];
}

