'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  WMS_CURRENT_USER_STORAGE_KEY,
  WMS_ROLE_STORAGE_KEY,
  WMS_USER_STORAGE_KEY,
  normalizeText,
  type WMSRole,
  type WMSUser,
} from '@/lib/permissions';

import {
  WMS_LOGIN_SESSION_STORAGE_KEY,
  expireCurrentSession,
  getActiveLoginSession,
  getCurrentRole,
  getCurrentUser,
  initializeAuthStorage,
  login as authenticateUser,
  logout as logoutUser,
  updateSessionActivity,
  type LoginCredentials,
  type LoginResult,
} from '@/lib/auth';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const SESSION_ACTIVITY_THROTTLE_MS = 30 * 1000;
const SESSION_VALIDATION_INTERVAL_MS = 60 * 1000;
const SESSION_IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

export const AUTH_CHANGED_EVENT = 'wms-auth-changed';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface AuthContextValue {
  currentUser: WMSUser | null;
  currentRole: WMSRole | null;
  loading: boolean;
  isAuthenticated: boolean;

  /**
   * Recommended:
   * login({ loginId, password, rememberMe })
   *
   * Legacy compatibility:
   * login(loginId, password, rememberMe)
   */
  login: (
    credentialsOrLoginId: LoginCredentials | string,
    password?: string,
    rememberMe?: boolean,
  ) => Promise<LoginResult>;

  logout: () => void;
  refreshAuth: () => Promise<void>;

  hasPermission: (
    module: string,
    action?: string,
  ) => boolean;

  hasAnyPermission: (
    module: string,
    actions: string[],
  ) => boolean;

  hasAllPermissions: (
    module: string,
    actions: string[],
  ) => boolean;

  canAccessPlant: (
    plant?: string | null,
  ) => boolean;

  canAccessLocation: (
    location?: string | null,
    plant?: string | null,
  ) => boolean;

  isSystemAdministrator: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

/* -------------------------------------------------------------------------- */
/* Permission helpers                                                         */
/* -------------------------------------------------------------------------- */

function normalizePermissionValue(value: unknown): string {
  return normalizeText(String(value ?? '')).replace(
    /[\s-]+/g,
    '_',
  );
}

function isWildcard(value: unknown): boolean {
  const normalized = normalizePermissionValue(value);

  return [
    '*',
    'all',
    'all_access',
    'full_access',
    'manage',
  ].includes(normalized);
}

function isActiveStatus(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === null || value === undefined || value === '') {
    return true;
  }

  const normalized = normalizePermissionValue(value);

  return [
    'active',
    'enabled',
    'true',
    '1',
    'yes',
  ].includes(normalized);
}

function isAdministratorRole(
  role: WMSRole | null,
): boolean {
  if (!role || !isActiveStatus(role.isActive)) {
    return false;
  }

  const roleValues = [
    role.id,
    role.code,
    role.name,
  ].map(normalizePermissionValue);

  const administratorRoleNames = [
    'system_admin',
    'system_administrator',
    'administrator',
    'admin',
    'super_admin',
    'super_administrator',
  ];

  return roleValues.some((value) =>
    administratorRoleNames.includes(value),
  );
}

function getAssignedValues(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => {
      if (typeof value === 'string') {
        return normalizePermissionValue(value);
      }

      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;

        return normalizePermissionValue(
          record.code ??
            record.id ??
            record.name ??
            record.value,
        );
      }

      return normalizePermissionValue(value);
    })
    .filter(Boolean);
}

function roleHasPermission(
  role: WMSRole | null,
  moduleName: string,
  actionName = 'view',
): boolean {
  if (!role || !isActiveStatus(role.isActive)) {
    return false;
  }

  if (isAdministratorRole(role)) {
    return true;
  }

  const requestedModule =
    normalizePermissionValue(moduleName);

  const requestedAction =
    normalizePermissionValue(actionName);

  if (!requestedModule || !requestedAction) {
    return false;
  }

  const permissions = Array.isArray(role.permissions)
    ? role.permissions
    : [];

  return permissions.some((permission) => {
    const permissionRecord =
      permission as unknown as Record<string, unknown>;

    const permissionModule =
      normalizePermissionValue(
        permissionRecord.module ??
          permissionRecord.moduleId ??
          permissionRecord.moduleCode ??
          permissionRecord.resource,
      );

    if (
      permissionModule !== requestedModule &&
      !isWildcard(permissionModule)
    ) {
      return false;
    }

    const rawActions =
      permissionRecord.actions ??
      permissionRecord.permissions ??
      [];

    const actions = Array.isArray(rawActions)
      ? rawActions.map(normalizePermissionValue)
      : [normalizePermissionValue(rawActions)];

    return actions.some(
      (action) =>
        action === requestedAction ||
        isWildcard(action),
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [currentUser, setCurrentUser] =
    useState<WMSUser | null>(null);

  const [currentRole, setCurrentRole] =
    useState<WMSRole | null>(null);

  const [loading, setLoading] = useState(true);

  /* ------------------------------------------------------------------------ */
  /* Refresh authentication                                                   */
  /* ------------------------------------------------------------------------ */

  const refreshAuth = useCallback(async () => {
    try {
      const storedUser = getCurrentUser();

      if (!storedUser) {
        setCurrentUser(null);
        setCurrentRole(null);
        return;
      }

      if (!isActiveStatus(storedUser.status)) {
        expireCurrentSession();
        setCurrentUser(null);
        setCurrentRole(null);
        return;
      }

      const role = getCurrentRole();

      if (!role || !isActiveStatus(role.isActive)) {
        expireCurrentSession();
        setCurrentUser(null);
        setCurrentRole(null);
        return;
      }

      const activeSession = getActiveLoginSession(
        storedUser.userId,
      );

      /**
       * A valid current user must have an active login session.
       * This prevents stale wms_current_user data from bypassing login.
       */
      if (!activeSession) {
        expireCurrentSession();
        setCurrentUser(null);
        setCurrentRole(null);
        return;
      }

      const lastActivityTime = new Date(
        activeSession.lastActivityAt,
      ).getTime();

      if (!Number.isFinite(lastActivityTime)) {
        expireCurrentSession();
        setCurrentUser(null);
        setCurrentRole(null);
        return;
      }

      const sessionIdleTime =
        Date.now() - lastActivityTime;

      if (sessionIdleTime > SESSION_IDLE_TIMEOUT_MS) {
        expireCurrentSession();
        setCurrentUser(null);
        setCurrentRole(null);
        return;
      }

      setCurrentUser(storedUser);
      setCurrentRole(role);
    } catch (error) {
      console.error(
        'Unable to refresh authentication:',
        error,
      );

      setCurrentUser(null);
      setCurrentRole(null);
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Initialize authentication                                                */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let mounted = true;

    async function initializeAuthentication() {
      try {
        await initializeAuthStorage();

        if (mounted) {
          await refreshAuth();
        }
      } catch (error) {
        console.error(
          'Unable to initialize authentication:',
          error,
        );

        if (mounted) {
          setCurrentUser(null);
          setCurrentRole(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void initializeAuthentication();

    return () => {
      mounted = false;
    };
  }, [refreshAuth]);

  /* ------------------------------------------------------------------------ */
  /* Login                                                                    */
  /* ------------------------------------------------------------------------ */

  const login = useCallback(
    async (
      credentialsOrLoginId: LoginCredentials | string,
      password?: string,
      rememberMe?: boolean,
    ): Promise<LoginResult> => {
      setLoading(true);

      try {
        const credentials: LoginCredentials =
          typeof credentialsOrLoginId === 'string'
            ? {
                loginId: credentialsOrLoginId,
                password: password || '',
                rememberMe,
              }
            : credentialsOrLoginId;

        const result = await authenticateUser(
          credentials,
        );

        if (result.success && result.user) {
          const role =
            result.role || getCurrentRole();

          setCurrentUser(result.user);
          setCurrentRole(role);

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new Event(AUTH_CHANGED_EVENT),
            );
          }
        } else {
          setCurrentUser(null);
          setCurrentRole(null);
        }

        return result;
      } catch (error) {
        console.error('Unable to log in:', error);

        setCurrentUser(null);
        setCurrentRole(null);

        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Unable to sign in. Please try again.',
        };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /* ------------------------------------------------------------------------ */
  /* Logout                                                                   */
  /* ------------------------------------------------------------------------ */

  const logout = useCallback(() => {
    try {
      logoutUser();
    } finally {
      setCurrentUser(null);
      setCurrentRole(null);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new Event(AUTH_CHANGED_EVENT),
        );
      }
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Real user activity tracking                                              */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let lastActivityWrite = 0;

    const recordActivity = () => {
      const now = Date.now();

      if (
        now - lastActivityWrite <
        SESSION_ACTIVITY_THROTTLE_MS
      ) {
        return;
      }

      lastActivityWrite = now;
      updateSessionActivity();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        recordActivity();
        void refreshAuth();
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'focus',
    ];

    recordActivity();

    activityEvents.forEach((eventName) => {
      window.addEventListener(
        eventName,
        recordActivity,
        { passive: true },
      );
    });

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    const validationIntervalId = window.setInterval(
      () => {
        void refreshAuth();
      },
      SESSION_VALIDATION_INTERVAL_MS,
    );

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(
          eventName,
          recordActivity,
        );
      });

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );

      window.clearInterval(validationIntervalId);
    };
  }, [currentUser, refreshAuth]);

  /* ------------------------------------------------------------------------ */
  /* Cross-tab synchronization                                                */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const authStorageKeys = [
      WMS_CURRENT_USER_STORAGE_KEY,
      WMS_USER_STORAGE_KEY,
      WMS_ROLE_STORAGE_KEY,
      WMS_LOGIN_SESSION_STORAGE_KEY,
    ];

    function handleStorageChange(
      event: StorageEvent,
    ) {
      if (
        event.key === null ||
        authStorageKeys.includes(event.key)
      ) {
        void refreshAuth();
      }
    }

    function handleAuthChanged() {
      void refreshAuth();
    }

    window.addEventListener(
      'storage',
      handleStorageChange,
    );

    window.addEventListener(
      AUTH_CHANGED_EVENT,
      handleAuthChanged,
    );

    return () => {
      window.removeEventListener(
        'storage',
        handleStorageChange,
      );

      window.removeEventListener(
        AUTH_CHANGED_EVENT,
        handleAuthChanged,
      );
    };
  }, [refreshAuth]);

  /* ------------------------------------------------------------------------ */
  /* Permission checks                                                        */
  /* ------------------------------------------------------------------------ */

  const isSystemAdministrator = useMemo(
    () => isAdministratorRole(currentRole),
    [currentRole],
  );

  const hasPermission = useCallback(
    (
      moduleName: string,
      actionName = 'view',
    ): boolean => {
      if (
        !currentUser ||
        !isActiveStatus(currentUser.status)
      ) {
        return false;
      }

      return roleHasPermission(
        currentRole,
        moduleName,
        actionName,
      );
    },
    [currentRole, currentUser],
  );

  const hasAnyPermission = useCallback(
    (
      moduleName: string,
      actions: string[],
    ): boolean => {
      if (!actions.length) {
        return hasPermission(moduleName, 'view');
      }

      return actions.some((action) =>
        hasPermission(moduleName, action),
      );
    },
    [hasPermission],
  );

  const hasAllPermissions = useCallback(
    (
      moduleName: string,
      actions: string[],
    ): boolean => {
      if (!actions.length) {
        return hasPermission(moduleName, 'view');
      }

      return actions.every((action) =>
        hasPermission(moduleName, action),
      );
    },
    [hasPermission],
  );

  /* ------------------------------------------------------------------------ */
  /* Plant access                                                             */
  /* ------------------------------------------------------------------------ */

  const canAccessPlant = useCallback(
    (plant?: string | null): boolean => {
      if (!currentUser) {
        return false;
      }

      if (isSystemAdministrator) {
        return true;
      }

      if (!plant) {
        return true;
      }

      const assignedPlants = getAssignedValues(
        currentUser.assignedPlants,
      );

      if (assignedPlants.length === 0) {
        return true;
      }

      if (
        assignedPlants.some((value) =>
          isWildcard(value),
        )
      ) {
        return true;
      }

      const requestedPlant =
        normalizePermissionValue(plant);

      return assignedPlants.includes(
        requestedPlant,
      );
    },
    [currentUser, isSystemAdministrator],
  );

  /* ------------------------------------------------------------------------ */
  /* Location access                                                          */
  /* ------------------------------------------------------------------------ */

  const canAccessLocation = useCallback(
    (
      location?: string | null,
      plant?: string | null,
    ): boolean => {
      if (!currentUser) {
        return false;
      }

      if (isSystemAdministrator) {
        return true;
      }

      if (plant && !canAccessPlant(plant)) {
        return false;
      }

      if (!location) {
        return true;
      }

      const assignedLocations = getAssignedValues(
        currentUser.assignedLocations,
      );

      if (assignedLocations.length === 0) {
        return true;
      }

      if (
        assignedLocations.some((value) =>
          isWildcard(value),
        )
      ) {
        return true;
      }

      const requestedLocation =
        normalizePermissionValue(location);

      return assignedLocations.includes(
        requestedLocation,
      );
    },
    [
      canAccessPlant,
      currentUser,
      isSystemAdministrator,
    ],
  );

  /* ------------------------------------------------------------------------ */
  /* Context value                                                            */
  /* ------------------------------------------------------------------------ */

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      currentRole,
      loading,
      isAuthenticated: Boolean(
        currentUser && currentRole,
      ),
      login,
      logout,
      refreshAuth,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canAccessPlant,
      canAccessLocation,
      isSystemAdministrator,
    }),
    [
      canAccessLocation,
      canAccessPlant,
      currentRole,
      currentUser,
      hasAllPermissions,
      hasAnyPermission,
      hasPermission,
      isSystemAdministrator,
      loading,
      login,
      logout,
      refreshAuth,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside an AuthProvider.',
    );
  }

  return context;
}

export default AuthContext;