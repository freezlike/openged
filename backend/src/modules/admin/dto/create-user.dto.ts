import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const ALLOWED_ROLES = [
  'READER',
  'CONTRIBUTOR',
  'EDITOR',
  'VALIDATOR',
  'SITE_ADMIN',
  'GLOBAL_ADMIN',
  'SUPER_ADMIN',
] as const;

export class CreateUserDto {
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED', 'PENDING'])
  status?: 'ACTIVE' | 'DISABLED' | 'PENDING';

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(ALLOWED_ROLES, { each: true })
  roles?: string[];
}
