import { useAuth } from '@/providers/AuthProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export const checkPermissions = (permissions: string[], action: string | string[]): boolean[] => {
  const permissionSet = new Set(permissions);
  const actions = Array.isArray(action) ? action : [action];

  return actions.map((permission) => {
    // Check exact match
    if (permissionSet.has(permission)) {
      return true;
    }

    // Check wildcard pattern (files.*)
    if (permission.endsWith('.*')) {
      const namespace = permission.slice(0, -2); // Remove ".*"
      return permissions.some((p) => p.startsWith(`${namespace}.`));
    }

    return false;
  });
};

export const useServerPermissionsFor = (permissions: string[] | undefined, action: string | string[]): boolean[] => {
  const { user } = useAuth();

  const serverPermissions = [...(permissions || []), ...(user?.role?.serverPermissions || [])];
  const actionLength = Array.isArray(action) ? action.length : 1;

  if (serverPermissions.includes('*')) {
    return Array(actionLength).fill(true);
  }

  return checkPermissions(serverPermissions, action);
};

export const useServerPermissions = (action: string | string[]): boolean[] => {
  return useServerPermissionsFor(useServerStore((state) => state.server)?.permissions, action);
};

export const useAdminPermissions = (action: string | string[]): boolean[] => {
  const { user } = useAuth();
  const userAdminPermissions = user?.role?.adminPermissions || [];
  const actionLength = Array.isArray(action) ? action.length : 1;

  if (user?.admin) {
    return Array(actionLength).fill(true);
  }

  return checkPermissions(userAdminPermissions, action);
};

export const useCan = (permissionMatrix: boolean[], matchAny: boolean) => {
  return matchAny ? permissionMatrix.some((p) => p) : permissionMatrix.every((p) => p);
};

export const useAdminCan = (action: string | string[], matchAny: boolean = true) => {
  return useCan(useAdminPermissions(action), matchAny);
};

export const useServerCan = (action: string | string[], matchAny: boolean = true) => {
  return useCan(useServerPermissions(action), matchAny);
};

export const useServerCanFor = (
  permissions: string[] | undefined,
  action: string | string[],
  matchAny: boolean = true,
) => {
  return useCan(useServerPermissionsFor(permissions, action), matchAny);
};
