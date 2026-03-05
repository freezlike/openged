import { RoleCode } from '../types/role-code.type';

export interface RequestUser {
  id: string;
  email: string;
  authSource: 'LOCAL' | 'OIDC' | 'SAML';
  roles: RoleCode[];
}
