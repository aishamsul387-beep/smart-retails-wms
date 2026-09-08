'use client';

import {
  type ReactNode,
  useEffect,
} from 'react';
import {
  Button,
  Result,
  Spin,
} from 'antd';
import {
  LockOutlined,
  LoginOutlined,
} from '@ant-design/icons';
import {
  usePathname,
  useRouter,
} from 'next/navigation';

import { useAuth } from '@/contexts/AuthContext';

/**
 * A single module/action permission requirement.
 *
 * Examples:
 * { module: 'inventory', action: 'view' }
 * { module: 'users', action: 'create' }
 * { module: 'sales-orders', action: 'approve' }
 */
export interface PermissionRequirement {
  module: string;
  action: string;
}

export interface PermissionGuardProps {
  children: ReactNode;

  /**
   * Simple permission format.
   *
   * Both module and action must be provided for the permission check
   * to be performed.
   */
  module?: string;
  action?: string;

  /**
   * Use this when checking more than one permission.
   */
  permissions?: PermissionRequirement[];

  /**
   * Determines how multiple permissions are evaluated.
   *
   * "all" = user must have every permission.
   * "any" = user must have at least one permission.
   */
  permissionMode?: 'all' | 'any';

  /**
   * Whether the user must be authenticated.
   *
   * Defaults to true.
   */
  requireAuth?: boolean;

  /**
   * Optional plant restriction.
   */
  plantId?: string;

  /**
   * Optional location restriction.
   */
  locationId?: string;

  /**
   * Login route used when the user is not authenticated.
   */
  loginPath?: string;

  /**
   * Optional route used when the user is authenticated but unauthorized.
   *
   * When omitted, the default access-denied result is displayed.
   */
  unauthorizedRedirect?: string;

  /**
   * Custom content displayed while authentication is loading.
   */
  loadingFallback?: ReactNode;

  /**
   * Custom content displayed when access is denied.
   */
  fallback?: ReactNode;

  /**
   * Hide the default access-denied page and render nothing.
   */
  hideWhenUnauthorized?: boolean;
}

/**
 * AuthContext compatibility shape.
 *
 * This supports common naming variations such as:
 * - user / currentUser
 * - loading / isLoading
 * - hasPlantAccess / canAccessPlant
 *
 * The actual permission source remains AuthContext.
 */
interface AuthContextShape {
  user?: unknown;
  currentUser?: unknown;
  role?: unknown;

  loading?: boolean;
  isLoading?: boolean;
  initialized?: boolean;

  isAuthenticated?: boolean;

  hasPermission?: (
    moduleName: string,
    actionName: string,
  ) => boolean;

  can?: (
    moduleName: string,
    actionName: string,
  ) => boolean;

  hasPlantAccess?: (plantId: string) => boolean;
  canAccessPlant?: (plantId: string) => boolean;

  hasLocationAccess?: (locationId: string) => boolean;
  canAccessLocation?: (locationId: string) => boolean;
}

interface AccessRecord {
  assignedPlants?: string[];
  plants?: string[];

  assignedLocations?: string[];
  locations?: string[];

  isSuperAdmin?: boolean;
  isSystemAdmin?: boolean;

  role?: AccessRecord | string;
  permissions?: unknown[];
}

/**
 * Normalizes IDs before access comparisons.
 */
function normalizeValue(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Checks whether an assigned ID list includes the requested ID.
 *
 * An asterisk allows access to all records.
 */
function includesAssignedValue(
  assignedValues: unknown,
  requestedValue: string,
): boolean {
  if (!Array.isArray(assignedValues)) {
    return false;
  }

  const normalizedRequestedValue = normalizeValue(requestedValue);

  return assignedValues.some((value) => {
    const normalizedAssignedValue = normalizeValue(value);

    return (
      normalizedAssignedValue === '*' ||
      normalizedAssignedValue === 'all' ||
      normalizedAssignedValue === normalizedRequestedValue
    );
  });
}

/**
 * PermissionGuard protects pages, sections, buttons, and other UI elements.
 *
 * Important:
 * This is a client-side user-interface guard. Transaction functions should
 * also validate permissions before changing warehouse data.
 */
export default function PermissionGuard({
  children,
  module,
  action,
  permissions = [],
  permissionMode = 'all',
  requireAuth = true,
  plantId,
  locationId,
  loginPath = '/login',
  unauthorizedRedirect,
  loadingFallback,
  fallback,
  hideWhenUnauthorized = false,
}: PermissionGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  /*
   * The cast makes the guard compatible with common AuthContext naming
   * conventions while keeping all authentication logic inside AuthContext.
   */
  const auth = useAuth() as unknown as AuthContextShape;

  const currentUser = (
    auth.currentUser ??
    auth.user ??
    null
  ) as AccessRecord | null;

  const currentRole = (
    auth.role ??
    (
      currentUser &&
      typeof currentUser.role === 'object'
        ? currentUser.role
        : null
    )
  ) as AccessRecord | null;

  const isLoading =
    auth.loading ??
    auth.isLoading ??
    auth.initialized === false;

  const isAuthenticated =
    auth.isAuthenticated ??
    Boolean(currentUser);

  const requestedPermissions: PermissionRequirement[] = [
    ...(module && action
      ? [
          {
            module,
            action,
          },
        ]
      : []),
    ...permissions,
  ];

  /**
   * AuthContext should be the primary permission authority.
   */
  const checkPermission = (
    requirement: PermissionRequirement,
  ): boolean => {
    if (typeof auth.hasPermission === 'function') {
      return auth.hasPermission(
        requirement.module,
        requirement.action,
      );
    }

    if (typeof auth.can === 'function') {
      return auth.can(
        requirement.module,
        requirement.action,
      );
    }

    /*
     * Fail closed when a permission was requested but AuthContext does not
     * expose a permission-checking function.
     */
    return false;
  };

  const hasRequiredPermissions =
    requestedPermissions.length === 0
      ? true
      : permissionMode === 'any'
        ? requestedPermissions.some(checkPermission)
        : requestedPermissions.every(checkPermission);

  const checkPlantAccess = (): boolean => {
    if (!plantId) {
      return true;
    }

    if (typeof auth.hasPlantAccess === 'function') {
      return auth.hasPlantAccess(plantId);
    }

    if (typeof auth.canAccessPlant === 'function') {
      return auth.canAccessPlant(plantId);
    }

    const assignedPlants =
      currentUser?.assignedPlants ??
      currentUser?.plants ??
      currentRole?.assignedPlants ??
      currentRole?.plants;

    return includesAssignedValue(
      assignedPlants,
      plantId,
    );
  };

  const checkLocationAccess = (): boolean => {
    if (!locationId) {
      return true;
    }

    if (typeof auth.hasLocationAccess === 'function') {
      return auth.hasLocationAccess(locationId);
    }

    if (typeof auth.canAccessLocation === 'function') {
      return auth.canAccessLocation(locationId);
    }

    const assignedLocations =
      currentUser?.assignedLocations ??
      currentUser?.locations ??
      currentRole?.assignedLocations ??
      currentRole?.locations;

    return includesAssignedValue(
      assignedLocations,
      locationId,
    );
  };

  const hasPlantAccess = checkPlantAccess();
  const hasLocationAccess = checkLocationAccess();

  const isAuthorized =
    (!requireAuth || isAuthenticated) &&
    hasRequiredPermissions &&
    hasPlantAccess &&
    hasLocationAccess;

  /**
   * Redirect unauthenticated users to login.
   */
  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (requireAuth && !isAuthenticated) {
      const returnUrl = pathname
        ? `?returnUrl=${encodeURIComponent(pathname)}`
        : '';

      router.replace(`${loginPath}${returnUrl}`);
    }
  }, [
    isAuthenticated,
    isLoading,
    loginPath,
    pathname,
    requireAuth,
    router,
  ]);

  /**
   * Optionally redirect authenticated but unauthorized users.
   */
  useEffect(() => {
    if (
      isLoading ||
      !isAuthenticated ||
      isAuthorized ||
      !unauthorizedRedirect
    ) {
      return;
    }

    router.replace(unauthorizedRedirect);
  }, [
    isAuthenticated,
    isAuthorized,
    isLoading,
    router,
    unauthorizedRedirect,
  ]);

  if (isLoading) {
    if (loadingFallback !== undefined) {
      return <>{loadingFallback}</>;
    }

    return (
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'center',
          minHeight: 240,
          width: '100%',
        }}
      >
        <Spin
          size="large"
          tip="Checking access..."
        >
          <div
            style={{
              minHeight: 80,
              minWidth: 160,
            }}
          />
        </Spin>
      </div>
    );
  }

  /**
   * Show a loading state while the login redirect is occurring.
   */
  if (requireAuth && !isAuthenticated) {
    return (
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'center',
          minHeight: 240,
          width: '100%',
        }}
      >
        <Spin
          size="large"
          tip="Redirecting to login..."
        >
          <div
            style={{
              minHeight: 80,
              minWidth: 180,
            }}
          />
        </Spin>
      </div>
    );
  }

  if (!isAuthorized) {
    if (unauthorizedRedirect) {
      return (
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'center',
            minHeight: 240,
            width: '100%',
          }}
        >
          <Spin
            size="large"
            tip="Redirecting..."
          >
            <div
              style={{
                minHeight: 80,
                minWidth: 160,
              }}
            />
          </Spin>
        </div>
      );
    }

    if (hideWhenUnauthorized) {
      return null;
    }

    if (fallback !== undefined) {
      return <>{fallback}</>;
    }

    return (
      <Result
        status="403"
        icon={<LockOutlined />}
        title="Access Denied"
        subTitle={
          plantId || locationId
            ? 'You do not have permission to access this warehouse plant or location.'
            : 'Your assigned role does not have permission to access this resource.'
        }
        extra={
          <Button
            type="primary"
            icon={<LoginOutlined />}
            onClick={() => router.push('/dashboard')}
          >
            Return to Dashboard
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}