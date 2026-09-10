/**
 * WMS Role-Based Access Control
 * ----------------------------------------
 * This file contains pure TypeScript helpers and can be used by:
 * - Dashboard layout
 * - Auth context
 * - Permission guards
 * - Transaction pages
 * - User management
 * - Role management
 *
 * Do not access localStorage directly from this file.
 */

export const WMS_ROLE_STORAGE_KEY = 'wms_roles';
export const WMS_USER_STORAGE_KEY = 'wms_users';
export const WMS_CURRENT_USER_STORAGE_KEY = 'wms_current_user';
export const WMS_SECURITY_AUDIT_STORAGE_KEY = 'wms_security_audit_logs';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type UserStatus = 'Active' | 'Inactive' | 'Locked';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'cancel'
  | 'confirm'
  | 'ship'
  | 'receive'
  | 'adjust'
  | 'transfer'
  | 'import'
  | 'export'
  | 'ai_review'
  | 'manage_users'
  | 'manage_roles'
  | 'unlock_user'
  | 'reset_password';

export type WMSModule =
  | 'dashboard'
  | 'product_master'
  | 'customer_master'
  | 'supplier_master'
  | 'plant_master'
  | 'location_master'
  | 'uom_master'
  | 'uom_conversion'
  | 'movement_type_master'
  | 'status_master'
  | 'purchase_orders'
  | 'inbound_receipts'
  | 'inventory'
  | 'inventory_adjustment'
  | 'inventory_transfer'
  | 'outbound_shipments'
  | 'sales_orders'
  | 'stock_movements'
  | 'inventory_reports'
  | 'movement_reports'
  | 'grn_reports'
  | 'user_management'
  | 'role_management'
  | 'security_audit'
  | 'profile'
  | 'settings';

export type PermissionModule = WMSModule | '*';

export interface RolePermission {
  module: PermissionModule;
  actions: PermissionAction[];
}

export interface ApprovalLimits {
  purchaseOrderAmount: number;
  salesOrderAmount: number;
  inventoryAdjustmentValue: number;
  inventoryAdjustmentQty: number;
}

export interface WMSRole {
  id: string;
  code: string;
  name: string;
  description: string;
  section?: string;
  position?: string;

  permissions: RolePermission[];
  approvalLimits: ApprovalLimits;

  isSystemRole: boolean;
  isActive: boolean;

  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface PermissionOverride {
  module: PermissionModule;
  action: PermissionAction;

  /**
   * true  = explicitly grant permission
   * false = explicitly deny permission
   *
   * User-level override takes priority over role permission.
   */
  allowed: boolean;

  reason?: string;
  grantedBy?: string;
  grantedAt?: string;
  expiresAt?: string;
}

export interface WMSUser {
  roleName?: string;

  id: string;
  userId: string;
  employeeId: string;
  fullName: string;

  /**
   * Optional legacy field.
   * Your existing layout currently reads currentUser.name.
   */
  name?: string;

  email: string;
  phone?: string;

  section: string;
  position: string;
  roleId: string;
  roleCode?: string;

  assignedPlants: string[];
  assignedLocations: string[];

  permissionOverrides?: PermissionOverride[];

  status: UserStatus;
  mustChangePassword: boolean;
  failedLoginAttempts: number;

  lastLoginAt?: string;
  passwordChangedAt?: string;

  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  source:
    | 'SYSTEM_ADMIN'
    | 'USER_OVERRIDE'
    | 'ROLE_PERMISSION'
    | 'USER_STATUS'
    | 'PLANT_RESTRICTION'
    | 'LOCATION_RESTRICTION'
    | 'SEGREGATION_OF_DUTIES'
    | 'APPROVAL_LIMIT'
    | 'NO_PERMISSION';
}

export interface RoutePermissionRequirement {
  route: string;
  module: WMSModule;
  action: PermissionAction;
}

/* -------------------------------------------------------------------------- */
/* Sections and positions                                                     */
/* -------------------------------------------------------------------------- */

export const WMS_SECTIONS = [
  'Administration',
  'Sales',
  'Procurement',
  'Inbound',
  'Warehouse Operations',
  'Inventory Control',
  'Outbound',
  'Quality Control',
  'Finance',
  'Management',
  'Audit',
] as const;

export const WMS_POSITIONS = [
  'Administrator',
  'Director',
  'Manager',
  'Supervisor',
  'Executive',
  'Planner',
  'Controller',
  'Storekeeper',
  'Picker/Packer',
  'Receiver',
  'Quality Inspector',
  'Auditor',
  'Viewer',
] as const;

/* -------------------------------------------------------------------------- */
/* Module information                                                         */
/* -------------------------------------------------------------------------- */

export const WMS_MODULE_LABELS: Record<WMSModule, string> = {
  dashboard: 'Dashboard',

  product_master: 'Product Master',
  customer_master: 'Customer Master',
  supplier_master: 'Supplier Master',
  plant_master: 'Plant Master',
  location_master: 'Location Master',
  uom_master: 'UOM Master',
  uom_conversion: 'UOM Conversion',
  movement_type_master: 'Movement Type Master',
  status_master: 'Status Master',

  purchase_orders: 'Purchase Orders',
  inbound_receipts: 'Inbound Receipts',
  inventory: 'Inventory',
  inventory_adjustment: 'Inventory Adjustment',
  inventory_transfer: 'Inventory Transfer',
  outbound_shipments: 'Outbound Shipments',
  sales_orders: 'Sales Orders',
  stock_movements: 'Stock Movement',

  inventory_reports: 'Inventory Report',
  movement_reports: 'Movement History',
  grn_reports: 'GRN Report',

  user_management: 'User Management',
  role_management: 'Role Management',
  security_audit: 'Security Audit',

  profile: 'User Profile',
  settings: 'Settings',
};

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  cancel: 'Cancel',
  confirm: 'Confirm',
  ship: 'Ship',
  receive: 'Receive',
  adjust: 'Adjust',
  transfer: 'Transfer',
  import: 'Import',
  export: 'Export',
  ai_review: 'AI Review',
  manage_users: 'Manage Users',
  manage_roles: 'Manage Roles',
  unlock_user: 'Unlock User',
  reset_password: 'Reset Password',
};

/* -------------------------------------------------------------------------- */
/* Route permission map                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Keep more specific routes before general routes.
 */
export const ROUTE_PERMISSION_MAP: RoutePermissionRequirement[] = [
  {
    route: '/dashboard/master/product',
    module: 'product_master',
    action: 'view',
  },
  {
    route: '/dashboard/master/customer',
    module: 'customer_master',
    action: 'view',
  },
  {
    route: '/dashboard/master/supplier',
    module: 'supplier_master',
    action: 'view',
  },
  {
    route: '/dashboard/master/plant',
    module: 'plant_master',
    action: 'view',
  },
  {
    route: '/dashboard/master/location',
    module: 'location_master',
    action: 'view',
  },
  {
    route: '/dashboard/master/uom-conversion',
    module: 'uom_conversion',
    action: 'view',
  },
  {
    route: '/dashboard/master/uom',
    module: 'uom_master',
    action: 'view',
  },
  {
    route: '/dashboard/master/movement-type',
    module: 'movement_type_master',
    action: 'view',
  },
  {
    route: '/dashboard/master/status',
    module: 'status_master',
    action: 'view',
  },

  {
    route: '/dashboard/purchase-orders',
    module: 'purchase_orders',
    action: 'view',
  },
  {
    route: '/dashboard/purchase',
    module: 'purchase_orders',
    action: 'view',
  },
  {
    route: '/dashboard/inbound',
    module: 'inbound_receipts',
    action: 'view',
  },
  {
    route: '/dashboard/inventory-adjustment',
    module: 'inventory_adjustment',
    action: 'view',
  },
  {
    route: '/dashboard/inventory-transfer',
    module: 'inventory_transfer',
    action: 'view',
  },
  {
    route: '/dashboard/inventory',
    module: 'inventory',
    action: 'view',
  },
  {
    route: '/dashboard/outbound',
    module: 'outbound_shipments',
    action: 'view',
  },
  {
    route: '/dashboard/sales-orders',
    module: 'sales_orders',
    action: 'view',
  },
  {
    route: '/dashboard/stock-movement',
    module: 'stock_movements',
    action: 'view',
  },

  {
    route: '/dashboard/reports/inventory',
    module: 'inventory_reports',
    action: 'view',
  },
  {
    route: '/dashboard/reports/movement',
    module: 'movement_reports',
    action: 'view',
  },
  {
    route: '/dashboard/reports/grn',
    module: 'grn_reports',
    action: 'view',
  },

  {
    route: '/dashboard/users',
    module: 'user_management',
    action: 'view',
  },
  {
    route: '/dashboard/roles',
    module: 'role_management',
    action: 'view',
  },
  {
    route: '/dashboard/security-audit',
    module: 'security_audit',
    action: 'view',
  },

  {
    route: '/dashboard/profile',
    module: 'profile',
    action: 'view',
  },
  {
    route: '/dashboard/settings',
    module: 'settings',
    action: 'view',
  },

  {
    route: '/dashboard',
    module: 'dashboard',
    action: 'view',
  },
];

/* -------------------------------------------------------------------------- */
/* Helper functions                                                           */
/* -------------------------------------------------------------------------- */

export function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isUserActive(user?: WMSUser | null): boolean {
  return normalizeText(user?.status) === 'active';
}

export function isSystemAdministrator(
  user?: WMSUser | null,
  role?: WMSRole | null,
): boolean {
  if (!user) return false;

  const roleCode = normalizeText(role?.code || user.roleCode);
  const position = normalizeText(user.position);

  return (
    roleCode === 'system_admin' ||
    roleCode === 'system-administrator' ||
    roleCode === 'administrator' ||
    position === 'administrator'
  );
}

function isOverrideExpired(override: PermissionOverride): boolean {
  if (!override.expiresAt) return false;

  const expiryTime = new Date(override.expiresAt).getTime();

  if (Number.isNaN(expiryTime)) return false;

  return expiryTime < Date.now();
}

export function findPermissionOverride(
  user: WMSUser,
  module: PermissionModule,
  action: PermissionAction,
): PermissionOverride | undefined {
  return user.permissionOverrides?.find((override) => {
    if (isOverrideExpired(override)) return false;

    const moduleMatches =
      override.module === module || override.module === '*';

    return moduleMatches && override.action === action;
  });
}

export function roleHasPermission(
  role: WMSRole | null | undefined,
  module: PermissionModule,
  action: PermissionAction,
): boolean {
  if (!role || !role.isActive) return false;

  return role.permissions.some((permission) => {
    const moduleMatches =
      permission.module === module || permission.module === '*';

    return moduleMatches && permission.actions.includes(action);
  });
}

/**
 * Returns detailed permission information.
 */
export function checkPermission(
  user: WMSUser | null | undefined,
  role: WMSRole | null | undefined,
  module: PermissionModule,
  action: PermissionAction,
): AccessDecision {
  if (!user) {
    return {
      allowed: false,
      reason: 'No authenticated user was found.',
      source: 'NO_PERMISSION',
    };
  }

  if (!isUserActive(user)) {
    return {
      allowed: false,
      reason: `User account is ${user.status || 'not active'}.`,
      source: 'USER_STATUS',
    };
  }

  if (isSystemAdministrator(user, role)) {
    return {
      allowed: true,
      reason: 'System Administrator has full system access.',
      source: 'SYSTEM_ADMIN',
    };
  }

  const override = findPermissionOverride(user, module, action);

  if (override) {
    return {
      allowed: override.allowed,
      reason:
        override.reason ||
        `Access was ${
          override.allowed ? 'granted' : 'denied'
        } by a user-level permission override.`,
      source: 'USER_OVERRIDE',
    };
  }

  if (roleHasPermission(role, module, action)) {
    return {
      allowed: true,
      reason: 'Access granted by the assigned role.',
      source: 'ROLE_PERMISSION',
    };
  }

  return {
    allowed: false,
    reason: `The assigned role does not allow "${action}" on "${module}".`,
    source: 'NO_PERMISSION',
  };
}

/**
 * Simple boolean helper for menus and buttons.
 */
export function hasPermission(
  user: WMSUser | null | undefined,
  role: WMSRole | null | undefined,
  module: PermissionModule,
  action: PermissionAction,
): boolean {
  return checkPermission(user, role, module, action).allowed;
}

/* -------------------------------------------------------------------------- */
/* Plant and location access                                                  */
/* -------------------------------------------------------------------------- */

function includesWildcard(values?: string[]): boolean {
  return Boolean(values?.some((value) => normalizeText(value) === '*'));
}

export function canAccessPlant(
  user: WMSUser | null | undefined,
  plant: string | null | undefined,
): boolean {
  if (!user || !isUserActive(user)) return false;

  if (isSystemAdministrator(user)) return true;

  if (!plant) return false;

  if (includesWildcard(user.assignedPlants)) return true;

  return (user.assignedPlants || []).some(
    (assignedPlant) =>
      normalizeText(assignedPlant) === normalizeText(plant),
  );
}

export function canAccessLocation(
  user: WMSUser | null | undefined,
  location: string | null | undefined,
): boolean {
  if (!user || !isUserActive(user)) return false;

  if (isSystemAdministrator(user)) return true;

  if (!location) return false;

  if (includesWildcard(user.assignedLocations)) return true;

  return (user.assignedLocations || []).some(
    (assignedLocation) =>
      normalizeText(assignedLocation) === normalizeText(location),
  );
}

export function checkPlantAccess(
  user: WMSUser | null | undefined,
  plant: string | null | undefined,
): AccessDecision {
  if (canAccessPlant(user, plant)) {
    return {
      allowed: true,
      reason: 'User is authorized for the selected plant.',
      source: 'ROLE_PERMISSION',
    };
  }

  return {
    allowed: false,
    reason: `User is not authorized for plant "${plant || 'Unknown'}".`,
    source: 'PLANT_RESTRICTION',
  };
}

export function checkLocationAccess(
  user: WMSUser | null | undefined,
  location: string | null | undefined,
): AccessDecision {
  if (canAccessLocation(user, location)) {
    return {
      allowed: true,
      reason: 'User is authorized for the selected location.',
      source: 'ROLE_PERMISSION',
    };
  }

  return {
    allowed: false,
    reason: `User is not authorized for location "${
      location || 'Unknown'
    }".`,
    source: 'LOCATION_RESTRICTION',
  };
}

/**
 * Filters transaction records according to the user's assigned plants
 * and locations.
 */
export function filterRecordsByUserAccess<
  T extends Record<string, unknown>,
>(
  records: T[],
  user: WMSUser | null | undefined,
  plantFields: string[] = ['plant', 'plantCode', 'plantId'],
  locationFields: string[] = [
    'location',
    'locationCode',
    'warehouseLocation',
  ],
): T[] {
  if (!user || !isUserActive(user)) return [];

  if (isSystemAdministrator(user)) return records;

  return records.filter((record) => {
    const plant = plantFields
      .map((field) => record[field])
      .find((value) => value !== undefined && value !== null);

    const location = locationFields
      .map((field) => record[field])
      .find((value) => value !== undefined && value !== null);

    const plantAllowed =
      plant === undefined ||
      plant === null ||
      String(plant).trim() === '' ||
      canAccessPlant(user, String(plant));

    const locationAllowed =
      location === undefined ||
      location === null ||
      String(location).trim() === '' ||
      canAccessLocation(user, String(location));

    return plantAllowed && locationAllowed;
  });
}

/* -------------------------------------------------------------------------- */
/* Route access                                                               */
/* -------------------------------------------------------------------------- */

export function getRoutePermission(
  pathname: string,
): RoutePermissionRequirement | undefined {
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;

  return ROUTE_PERMISSION_MAP.find(({ route }) => {
    if (route === '/dashboard') {
      return normalizedPath === '/dashboard';
    }

    return (
      normalizedPath === route ||
      normalizedPath.startsWith(`${route}/`)
    );
  });
}

export function canAccessRoute(
  user: WMSUser | null | undefined,
  role: WMSRole | null | undefined,
  pathname: string,
): boolean {
  const requirement = getRoutePermission(pathname);

  if (!requirement) {
    return false;
  }

  return hasPermission(
    user,
    role,
    requirement.module,
    requirement.action,
  );
}

/* -------------------------------------------------------------------------- */
/* Approval and segregation-of-duties checks                                  */
/* -------------------------------------------------------------------------- */

export function canApproveOwnTransaction(
  currentUserId: string | undefined,
  transactionCreatedBy: string | undefined,
): boolean {
  if (!currentUserId || !transactionCreatedBy) return true;

  return normalizeText(currentUserId) !== normalizeText(transactionCreatedBy);
}

export function checkSegregationOfDuties(
  currentUserId: string | undefined,
  transactionCreatedBy: string | undefined,
): AccessDecision {
  if (
    canApproveOwnTransaction(
      currentUserId,
      transactionCreatedBy,
    )
  ) {
    return {
      allowed: true,
      reason: 'Segregation-of-duties check passed.',
      source: 'ROLE_PERMISSION',
    };
  }

  return {
    allowed: false,
    reason: 'The creator cannot approve their own transaction.',
    source: 'SEGREGATION_OF_DUTIES',
  };
}

export function checkApprovalLimit(
  role: WMSRole | null | undefined,
  transactionType:
    | 'purchase_order'
    | 'sales_order'
    | 'inventory_adjustment_value'
    | 'inventory_adjustment_qty',
  amountOrQty: number,
): AccessDecision {
  if (!role) {
    return {
      allowed: false,
      reason: 'No role was found for approval validation.',
      source: 'APPROVAL_LIMIT',
    };
  }

  let limit = 0;

  switch (transactionType) {
    case 'purchase_order':
      limit = role.approvalLimits.purchaseOrderAmount;
      break;

    case 'sales_order':
      limit = role.approvalLimits.salesOrderAmount;
      break;

    case 'inventory_adjustment_value':
      limit = role.approvalLimits.inventoryAdjustmentValue;
      break;

    case 'inventory_adjustment_qty':
      limit = role.approvalLimits.inventoryAdjustmentQty;
      break;
  }

  if (limit === -1) {
    return {
      allowed: true,
      reason: 'Role has an unlimited approval limit.',
      source: 'ROLE_PERMISSION',
    };
  }

  if (amountOrQty <= limit) {
    return {
      allowed: true,
      reason: `Transaction is within the approval limit of ${limit}.`,
      source: 'ROLE_PERMISSION',
    };
  }

  return {
    allowed: false,
    reason: `Transaction value or quantity ${amountOrQty} exceeds the role approval limit of ${limit}.`,
    source: 'APPROVAL_LIMIT',
  };
}

/* -------------------------------------------------------------------------- */
/* Default roles                                                              */
/* -------------------------------------------------------------------------- */

const now = new Date().toISOString();

function permission(
  module: PermissionModule,
  actions: PermissionAction[],
): RolePermission {
  return {
    module,
    actions,
  };
}

const READ_EXPORT_AI: PermissionAction[] = [
  'view',
  'export',
  'ai_review',
];

const STANDARD_MAINTENANCE: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'import',
  'export',
  'ai_review',
];

export const DEFAULT_WMS_ROLES: WMSRole[] = [
  {
    id: 'ROLE-SYSTEM-ADMIN',
    code: 'SYSTEM_ADMIN',
    name: 'System Administrator',
    description:
      'Full system access including users, roles and security controls.',
    section: 'Administration',
    position: 'Administrator',
    permissions: [
      permission('*', [
        'view',
        'create',
        'edit',
        'delete',
        'approve',
        'cancel',
        'confirm',
        'ship',
        'receive',
        'adjust',
        'transfer',
        'import',
        'export',
        'ai_review',
        'manage_users',
        'manage_roles',
        'unlock_user',
        'reset_password',
      ]),
    ],
    approvalLimits: {
      purchaseOrderAmount: -1,
      salesOrderAmount: -1,
      inventoryAdjustmentValue: -1,
      inventoryAdjustmentQty: -1,
    },
    isSystemRole: true,
    isActive: true,
    createdAt: now,
    createdBy: 'SYSTEM',
    updatedAt: now,
    updatedBy: 'SYSTEM',
  },

  {
    id: 'ROLE-WAREHOUSE-MANAGER',
    code: 'WAREHOUSE_MANAGER',
    name: 'Warehouse Manager',
    description:
      'Manages warehouse inventory, inbound, outbound, adjustments and transfers.',
    section: 'Warehouse Operations',
    position: 'Manager',
    permissions: [
      permission('dashboard', ['view']),
      permission('product_master', ['view']),
      permission('plant_master', ['view']),
      permission('location_master', ['view']),
      permission('uom_master', ['view']),

      permission('purchase_orders', READ_EXPORT_AI),
      permission('sales_orders', READ_EXPORT_AI),

      permission('inbound_receipts', [
        'view',
        'create',
        'edit',
        'confirm',
        'receive',
        'cancel',
        'import',
        'export',
        'ai_review',
      ]),
      permission('inventory', READ_EXPORT_AI),
      permission('inventory_adjustment', [
        'view',
        'create',
        'edit',
        'approve',
        'confirm',
        'cancel',
        'adjust',
        'import',
        'export',
        'ai_review',
      ]),
      permission('inventory_transfer', [
        'view',
        'create',
        'edit',
        'approve',
        'confirm',
        'receive',
        'cancel',
        'transfer',
        'import',
        'export',
        'ai_review',
      ]),
      permission('outbound_shipments', [
        'view',
        'create',
        'edit',
        'confirm',
        'ship',
        'cancel',
        'import',
        'export',
        'ai_review',
      ]),
      permission('stock_movements', READ_EXPORT_AI),
      permission('inventory_reports', READ_EXPORT_AI),
      permission('movement_reports', READ_EXPORT_AI),
      permission('grn_reports', READ_EXPORT_AI),
      permission('profile', ['view', 'edit']),
      permission('settings', ['view']),
    ],
    approvalLimits: {
      purchaseOrderAmount: 0,
      salesOrderAmount: 0,
      inventoryAdjustmentValue: 50000,
      inventoryAdjustmentQty: 10000,
    },
    isSystemRole: true,
    isActive: true,
    createdAt: now,
    createdBy: 'SYSTEM',
    updatedAt: now,
    updatedBy: 'SYSTEM',
  },

  {
    id: 'ROLE-INVENTORY-CONTROLLER',
    code: 'INVENTORY_CONTROLLER',
    name: 'Inventory Controller',
    description:
      'Controls inventory balances, stock adjustments, transfers and movement reviews.',
    section: 'Inventory Control',
    position: 'Controller',
    permissions: [
      permission('dashboard', ['view']),
      permission('product_master', ['view']),
      permission('plant_master', ['view']),
      permission('location_master', ['view']),
      permission('uom_master', ['view']),
      permission('movement_type_master', ['view']),

      permission('inventory', READ_EXPORT_AI),
      permission('inventory_adjustment', [
        'view',
        'create',
        'edit',
        'adjust',
        'import',
        'export',
        'ai_review',
      ]),
      permission('inventory_transfer', [
        'view',
        'create',
        'edit',
        'transfer',
        'import',
        'export',
        'ai_review',
      ]),
      permission('stock_movements', READ_EXPORT_AI),
      permission('inventory_reports', READ_EXPORT_AI),
      permission('movement_reports', READ_EXPORT_AI),
      permission('profile', ['view', 'edit']),
    ],
    approvalLimits: {
      purchaseOrderAmount: 0,
      salesOrderAmount: 0,
      inventoryAdjustmentValue: 0,
      inventoryAdjustmentQty: 0,
    },
    isSystemRole: true,
    isActive: true,
    createdAt: now,
    createdBy: 'SYSTEM',
    updatedAt: now,
    updatedBy: 'SYSTEM',
  },

  {
    id: 'ROLE-PROCUREMENT-OFFICER',
    code: 'PROCUREMENT_OFFICER',
    name: 'Procurement Officer',
    description:
      'Creates and maintains purchase orders without self-approval authority.',
    section: 'Procurement',
    position: 'Executive',
    permissions: [
      permission('dashboard', ['view']),
      permission('product_master', ['view']),
      permission('supplier_master', ['view']),
      permission('plant_master', ['view']),
      permission('uom_master', ['view']),
      permission('purchase_orders', STANDARD_MAINTENANCE),
      permission('inbound_receipts', ['view', 'export', 'ai_review']),
      permission('grn_reports', READ_EXPORT_AI),
      permission('profile', ['view', 'edit']),
    ],
    approvalLimits: {
      purchaseOrderAmount: 0,
      salesOrderAmount: 0,
      inventoryAdjustmentValue: 0,
      inventoryAdjustmentQty: 0,
    },
    isSystemRole: true,
    isActive: true,
    createdAt: now,
    createdBy: 'SYSTEM',
    updatedAt: now,
    updatedBy: 'SYSTEM',
  },

  {
    id: 'ROLE-INBOUND-RECEIVER',
    code: 'INBOUND_RECEIVER',
    name: 'Inbound Receiver',
    description:
      'Receives goods against approved purchase orders and inbound receipts.',
    section: 'Inbound',
    position: 'Receiver',
    permissions: [
      permission('dashboard', ['view']),
      permission('product_master', ['view']),
      permission('supplier_master', ['view']),
      permission('plant_master', ['view']),
      permission('location_master', ['view']),
      permission('purchase_orders', ['view']),
      permission('inbound_receipts', [
        'view',
        'create',
        'edit',
        'confirm',
        'receive',
        'export',
        'ai_review',
      ]),
      permission('inventory', ['view']),
      permission('grn_reports', READ_EXPORT_AI),
      permission('profile', ['view', 'edit']),
    ],
    approvalLimits: {
      purchaseOrderAmount: 0,
      salesOrderAmount: 0,
      inventoryAdjustmentValue: 0,
      inventoryAdjustmentQty: 0,
    },
    isSystemRole: true,
    isActive: true,
    createdAt: now,
    createdBy: 'SYSTEM',
    updatedAt: now,
    updatedBy: 'SYSTEM',
  },

  {
    id: 'ROLE-OUTBOUND-OPERATOR',
    code: 'OUTBOUND_OPERATOR',
    name: 'Outbound Operator',
    description:
      'Creates, allocates, picks and prepares outbound shipments.',
    section: 'Outbound',
    position: 'Storekeeper',
    permissions: [
      permission('dashboard', ['view']),
      permission('product_master', ['view']),
      permission('customer_master', ['view']),
      permission('plant_master', ['view']),
      permission('location_master', ['view']),
      permission('sales_orders', ['view']),
      permission('inventory', ['view']),
      permission('outbound_shipments', [
        'view',
        'create',
        'edit',
        'confirm',
        'export',
        'ai_review',
      ]),
      permission('stock_movements', ['view']),
      permission('movement_reports', ['view', 'export']),
      permission('profile', ['view', 'edit']),
    ],
    approvalLimits: {
      purchaseOrderAmount: 0,
      salesOrderAmount: 0,
      inventoryAdjustmentValue: 0,
      inventoryAdjustmentQty: 0,
    },
    isSystemRole: true,
    isActive: true,
    createdAt: now,
    createdBy: 'SYSTEM',
    updatedAt: now,
    updatedBy: 'SYSTEM',
  },

  {
    id: 'ROLE-SALES-OFFICER',
    code: 'SALES_OFFICER',
    name: 'Sales Officer',
    description:
      'Creates and maintains customers and sales orders.',
    section: 'Sales',
    position: 'Executive',
    permissions: [
      permission('dashboard', ['view']),
      permission('product_master', ['view']),
      permission('customer_master', STANDARD_MAINTENANCE),
      permission('sales_orders', STANDARD_MAINTENANCE),
      permission('outbound_shipments', ['view']),
      permission('inventory', ['view']),
      permission('profile', ['view', 'edit']),
    ],
    approvalLimits: {
      purchaseOrderAmount: 0,
      salesOrderAmount: 0,
      inventoryAdjustmentValue: 0,
      inventoryAdjustmentQty: 0,
    },
    isSystemRole: true,
    isActive: true,
    createdAt: now,
    createdBy: 'SYSTEM',
    updatedAt: now,
    updatedBy: 'SYSTEM',
  },

  {
    id: 'ROLE-AUDITOR',
    code: 'AUDITOR',
    name: 'Auditor',
    description:
      'Read-only operational, reporting and security audit access.',
    section: 'Audit',
    position: 'Auditor',
    permissions: [
      permission('dashboard', ['view']),

      permission('product_master', ['view', 'export']),
      permission('customer_master', ['view', 'export']),
      permission('supplier_master', ['view', 'export']),
      permission('plant_master', ['view', 'export']),
      permission('location_master', ['view', 'export']),
      permission('uom_master', ['view', 'export']),
      permission('uom_conversion', ['view', 'export']),
      permission('movement_type_master', ['view', 'export']),
      permission('status_master', ['view', 'export']),

      permission('purchase_orders', READ_EXPORT_AI),
      permission('inbound_receipts', READ_EXPORT_AI),
      permission('inventory', READ_EXPORT_AI),
      permission('inventory_adjustment', READ_EXPORT_AI),
      permission('inventory_transfer', READ_EXPORT_AI),
      permission('outbound_shipments', READ_EXPORT_AI),
      permission('sales_orders', READ_EXPORT_AI),
      permission('stock_movements', READ_EXPORT_AI),

      permission('inventory_reports', READ_EXPORT_AI),
      permission('movement_reports', READ_EXPORT_AI),
      permission('grn_reports', READ_EXPORT_AI),
      permission('security_audit', READ_EXPORT_AI),
      permission('profile', ['view']),
    ],
    approvalLimits: {
      purchaseOrderAmount: 0,
      salesOrderAmount: 0,
      inventoryAdjustmentValue: 0,
      inventoryAdjustmentQty: 0,
    },
    isSystemRole: true,
    isActive: true,
    createdAt: now,
    createdBy: 'SYSTEM',
    updatedAt: now,
    updatedBy: 'SYSTEM',
  },

  {
    id: 'ROLE-MANAGEMENT-VIEWER',
    code: 'MANAGEMENT_VIEWER',
    name: 'Management Viewer',
    description:
      'Read-only dashboard, AI review and report access for management.',
    section: 'Management',
    position: 'Viewer',
    permissions: [
      permission('dashboard', ['view']),
      permission('purchase_orders', READ_EXPORT_AI),
      permission('inbound_receipts', READ_EXPORT_AI),
      permission('inventory', READ_EXPORT_AI),
      permission('inventory_adjustment', READ_EXPORT_AI),
      permission('inventory_transfer', READ_EXPORT_AI),
      permission('outbound_shipments', READ_EXPORT_AI),
      permission('sales_orders', READ_EXPORT_AI),
      permission('stock_movements', READ_EXPORT_AI),
      permission('inventory_reports', READ_EXPORT_AI),
      permission('movement_reports', READ_EXPORT_AI),
      permission('grn_reports', READ_EXPORT_AI),
      permission('profile', ['view']),
    ],
    approvalLimits: {
      purchaseOrderAmount: 0,
      salesOrderAmount: 0,
      inventoryAdjustmentValue: 0,
      inventoryAdjustmentQty: 0,
    },
    isSystemRole: true,
    isActive: true,
    createdAt: now,
    createdBy: 'SYSTEM',
    updatedAt: now,
    updatedBy: 'SYSTEM',
  },
];

/* -------------------------------------------------------------------------- */
/* Default administrator                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Development-only default user.
 *
 * No password is stored here. Authentication/session logic will be added
 * in the next file.
 */
export const DEFAULT_ADMIN_USER: WMSUser = {
  id: 'USER-ADMIN-001',
  userId: 'admin',
  employeeId: 'ADMIN-001',
  fullName: 'System Administrator',
  name: 'System Administrator',
  email: 'admin@wms.local',
  phone: '',

  section: 'Administration',
  position: 'Administrator',

  roleId: 'ROLE-SYSTEM-ADMIN',
  roleCode: 'SYSTEM_ADMIN',

  assignedPlants: ['*'],
  assignedLocations: ['*'],
  permissionOverrides: [],

  status: 'Active',
  mustChangePassword: false,
  failedLoginAttempts: 0,

  createdAt: now,
  createdBy: 'SYSTEM',
  updatedAt: now,
  updatedBy: 'SYSTEM',
};

/* -------------------------------------------------------------------------- */
/* Role lookup helpers                                                        */
/* -------------------------------------------------------------------------- */

export function findUserRole(
  user: WMSUser | null | undefined,
  roles: WMSRole[],
): WMSRole | undefined {
  if (!user) return undefined;

  return roles.find(
    (role) =>
      role.id === user.roleId ||
      normalizeText(role.code) === normalizeText(user.roleCode),
  );
}

export function getAccessibleModules(
  user: WMSUser | null | undefined,
  role: WMSRole | null | undefined,
): WMSModule[] {
  const modules = Object.keys(WMS_MODULE_LABELS) as WMSModule[];

  return modules.filter((module) =>
    hasPermission(user, role, module, 'view'),
  );
}

export function getUserDisplayName(
  user: WMSUser | null | undefined,
): string {
  if (!user) return 'Guest';

  return (
    user.fullName ||
    user.name ||
    user.userId ||
    user.email ||
    'WMS User'
  );
}