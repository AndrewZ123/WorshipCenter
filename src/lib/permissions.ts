// Permission types and utilities for WorshipCenter
// Maps UI-level permission checks to user.role and admin_permissions table.

export type PermissionScope =
  | 'manage_services'
  | 'manage_songs'
  | 'manage_team'
  | 'manage_templates'
  | 'manage_settings'
  | 'manage_billing'
  | 'manage_chat'
  | 'manage_admins';

export interface Permissions {
  isAdmin: boolean;
  isVolunteer: boolean;
  can: (scope: PermissionScope) => boolean;
  loading: boolean;
  roleLabel: string;
}
