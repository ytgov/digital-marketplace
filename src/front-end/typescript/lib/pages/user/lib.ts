import { isActive, isPublicSector, KeyCloakIdentityProvider, User, UserStatus, UserType } from 'shared/lib/resources/user';

type DisplayUserType = 'Public Sector Employee' | 'Vendor';

export interface DisplayUser {
  name: string;
  type: DisplayUserType;
  active: boolean;
  admin: boolean;
}

export function userToUserTypeDisplayText(user: User): string {
  return isPublicSector(user.type) ? 'Public Sector Employee' : 'Vendor';
}

export function userToStatusBadgeColor(user: User): string {
  return isActive(user) ? 'badge-success' : 'badge-danger';
}

export function viewStringForUserStatus(type: UserStatus): string {
  switch (type) {
      case UserStatus.InactiveByAdmin:
      case UserStatus.InactiveByUser:
        return 'Inactive';
      case UserStatus.Active:
        return 'Active';
  }
}

export function viewStringForUserType(type: UserType): string {
  switch (type) {
      case UserType.Government:
      case UserType.Admin:
        return 'Public Sector Employee';
      case UserType.Vendor:
        return 'Vendor';
  }
}

export function keycloakIdentityProviderToDisplayText(v: KeyCloakIdentityProvider): string {
  switch (v) {
    case 'github': return 'GitHub';
    case 'idir': return 'IDIR';
  }
}
