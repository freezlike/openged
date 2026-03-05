import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  password!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  mfaEnabled?: boolean;
}
