export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
  user: AuthUser;
}

export interface InstallerStatus {
  installed: boolean;
  installerLocked: boolean;
  installedAt?: string;
  authMode: 'LOCAL_ONLY' | 'LOCAL_AND_SSO' | 'SSO_ONLY';
}
