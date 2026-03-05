import { IsOptional, IsString } from 'class-validator';

export class FinalizeInstallDto {
  @IsOptional()
  @IsString()
  appVersion?: string;
}
