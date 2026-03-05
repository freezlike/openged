import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class SsoAssertionDto {
  @IsIn(['OIDC', 'SAML'])
  provider!: 'OIDC' | 'SAML';

  @IsString()
  externalId!: string;

  @IsString()
  email!: string;

  @IsOptional()
  @IsArray()
  groups?: string[];
}
