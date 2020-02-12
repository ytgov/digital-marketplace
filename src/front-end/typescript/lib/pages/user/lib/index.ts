import { DEFAULT_USER_AVATAR_IMAGE_PATH } from 'front-end/config';
import { ThemeColor } from 'front-end/lib/types';
import { fileBlobPath } from 'shared/lib/resources/file';
import { KeyCloakIdentityProvider, User, UserStatus, UserType, userTypeToKeycloakIdentityProvider } from 'shared/lib/resources/user';

export function isPublic(user: User | undefined): boolean {
  const result = (user !== undefined) && (user.type === UserType.Government || user.type === UserType.Admin);
  return result;
}

type DisplayUserType = 'Public Sector Employee' | 'Vendor';

export interface DisplayUser {
  name: string;
  type: DisplayUserType;
  active: boolean;
  admin: boolean;
}

export function getBadgeColor(isActive: boolean): string {
  return isActive ? 'badge-success' : 'badge-danger';
}

export function toDisplayUser(user: User): DisplayUser {
  return ({
    name: user.name,
    type: user.type === UserType.Vendor ? 'Vendor' : 'Public Sector Employee',
    admin: user.type === UserType.Admin ? true : false,
    active: user.status === UserStatus.Active ? true : false
  });
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

// Dhruv below:

export function userAvatarPath(user?: User): string {
  return user && user.avatarImageFile
    ? fileBlobPath(user.avatarImageFile)
    : DEFAULT_USER_AVATAR_IMAGE_PATH;
}

export function keyCloakIdentityProviderToTitleCase(v: KeyCloakIdentityProvider): string {
  switch (v) {
    case 'github': return 'GitHub';
    case 'idir': return 'IDIR';
  }
}

export function userToKeyClockIdentityProviderTitleCase(user: User): string {
  return keyCloakIdentityProviderToTitleCase(userTypeToKeycloakIdentityProvider(user.type));
}

export function userTypeToTitleCase(v: UserType): string {
  switch (v) {
      case UserType.Government:
      case UserType.Admin:
        return 'Public Sector Employee';
      case UserType.Vendor:
        return 'Vendor';
  }
}

export function userTypeToPermissions(v: UserType): string[] {
  switch (v) {
      case UserType.Admin:
        return ['Admin'];
      case UserType.Government:
      case UserType.Vendor:
        return [];
  }
}

export function userStatusToTitleCase(v: UserStatus): string {
  switch (v) {
      case UserStatus.InactiveByAdmin:
      case UserStatus.InactiveByUser:
        return 'Inactive';
      case UserStatus.Active:
        return 'Active';
  }
}

export function userStatusToColor(v: UserStatus): ThemeColor {
  switch (v) {
      case UserStatus.InactiveByAdmin:
      case UserStatus.InactiveByUser:
        return 'danger';
      case UserStatus.Active:
        return 'success';
  }
}
