import { IsEmail, IsString, MinLength } from 'class-validator';

export class OrganizationSettingsDto {
  @IsString()
  @MinLength(2)
  organizationName!: string;

  @IsString()
  timezone!: string;

  @IsString()
  language!: string;

  @IsEmail()
  technicalEmail!: string;
}
