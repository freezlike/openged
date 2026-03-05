import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn } from 'class-validator';

const ALLOWED_ROLES = [
  'READER',
  'CONTRIBUTOR',
  'EDITOR',
  'VALIDATOR',
  'SITE_ADMIN',
  'GLOBAL_ADMIN',
  'SUPER_ADMIN',
] as const;

export class UpdateUserRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(ALLOWED_ROLES, { each: true })
  roles!: string[];
}
