import { IsBoolean, IsIn } from 'class-validator';

export class InstallerFeaturesDto {
  @IsBoolean()
  enableSearch!: boolean;

  @IsBoolean()
  enableSso!: boolean;

  @IsBoolean()
  enableEmailNotifications!: boolean;

  @IsIn(['LOCAL_ONLY', 'LOCAL_AND_SSO', 'SSO_ONLY'])
  authMode!: 'LOCAL_ONLY' | 'LOCAL_AND_SSO' | 'SSO_ONLY';
}
