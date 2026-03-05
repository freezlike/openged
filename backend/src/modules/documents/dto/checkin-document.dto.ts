import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CheckinDocumentDto {
  @IsIn(['major', 'minor'])
  versionType!: 'major' | 'minor';

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  comment!: string;
}
