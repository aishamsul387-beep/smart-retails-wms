import {
  DEFAULT_ADMIN_USER,
  DEFAULT_WMS_ROLES,
  WMS_CURRENT_USER_STORAGE_KEY,
  WMS_ROLE_STORAGE_KEY,
  WMS_SECURITY_AUDIT_STORAGE_KEY,
  WMS_USER_STORAGE_KEY,
  findUserRole,
  normalizeText,
  type WMSRole,
  type WMSUser,
} from './permissions';

/* -------------------------------------------------------------------------- */
/* Storage keys */
/* -------------------------------------------------------------------------- */

export const WMS_LOGIN_SESSION_STORAGE_KEY = 'wms_login_sessions';
export const DEFAULT_ADMIN_PASSWORD = 'Admin@123';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const MAX_SECURITY_AUDIT_LOGS = 5000;

/* -------------------------------------------------------------------------- */
/* Types */
/* -------------------------------------------------------------------------- */

export type LoginSessionStatus = 'Active' | 'Logged Out' | 'Expired';

export type SecurityAuditSeverity =
  | 'Info'
  | 'Low'
  | 'Medium'
  | 'High'
  | 'Critical';

export type SecurityAuditResult = 'Success' | 'Failed';

export type SecurityAuditAction =
  | 'AUTH_INITIALIZED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'SESSION_EXPIRED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED'
  | 'USER_LOCKED'
  | 'USER_UNLOCKED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  | 'ROLE_CREATED'
  | 'ROLE_UPDATED'
  | 'ROLE_DELETED'
  | 'ROLE_ASSIGNED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_DENIED'
  | 'ACCESS_DENIED'
  | 'CSV_IMPORTED'
  | 'CSV_EXPORTED'
  | 'AI_ACCESS_REVIEW'
  | 'DATA_VIEWED'
  | 'DATA_CREATED'
  | 'DATA_UPDATED'
  | 'DATA_DELETED'
  | 'TRANSACTION_APPROVED'
  | 'TRANSACTION_REJECTED'
  | 'OTHER';

export interface StoredWMSUser extends WMSUser {
  /**
   * Development-only browser password hash.
   * Production authentication must be implemented server-side.
   */
  passwordHash?: string;
}

export interface LoginSession {
  id: string;
  userId: string;
  employeeId?: string;
  userName: string;
  email?: string;
  loginAt: string;
  lastActivityAt: string;
  logoutAt?: string;
  status: LoginSessionStatus;
  rememberMe?: boolean;
  userAgent?: string;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: SecurityAuditAction;
  module: string;
  entityType?: string;
  entityId?: string;
  result: SecurityAuditResult;
  severity: SecurityAuditSeverity;
  description: string;
  details?: Record<string, unknown>;
  plant?: string;
  location?: string;
  sessionId?: string;
  userAgent?: string;
}

export interface CreateAuditLogInput {
  userId?: string;
  userName?: string;
  action: SecurityAuditAction;
  module: string;
  entityType?: string;
  entityId?: string;
  result?: SecurityAuditResult;
  severity?: SecurityAuditSeverity;
  description: string;
  details?: Record<string, unknown>;
  plant?: string;
  location?: string;
  sessionId?: string;
}

export interface LoginCredentials {
  loginId: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResult {
  success: boolean;
  message: string;
  user?: WMSUser;
  role?: WMSRole;
  session?: LoginSession;
  remainingAttempts?: number;
}

export interface OperationResult {
  success: boolean;
  message: string;
  user?: WMSUser;
}

export interface PasswordResult {
  success: boolean;
  message: string;
}

export interface CreateUserInput {
  userId: string;
  employeeId?: string;
  fullName: string;
  name?: string;
  email?: string;
  phone?: string;
  roleId: string;
  roleCode?: string;
  section?: string;
  position?: string;
  assignedPlants?: string[];
  assignedLocations?: string[];
  status?: string;
  password: string;
  mustChangePassword?: boolean;
}

export interface UpdateUserInput {
  userId?: string;
  employeeId?: string;
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  roleId?: string;
  roleCode?: string;
  section?: string;
  position?: string;
  assignedPlants?: string[];
  assignedLocations?: string[];
  status?: string;
  mustChangePassword?: boolean;
}

/* -------------------------------------------------------------------------- */
/* General helpers */
/* -------------------------------------------------------------------------- */

/**
 * Safely checks whether the browser environment and localStorage
 * are actually usable. Returns false instead of throwing when storage
 * access is blocked (private mode, in-app browsers, strict privacy
 * settings, etc).
 */
function isBrowser(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const testKey = '__wms_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function createId(prefix: string): string {
  const randomValue =
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return `${prefix}-${randomValue}`;
}

function getNow(): string {
  return new Date().toISOString();
}

function isActiveValue(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === null || value === undefined || value === '') {
    return true;
  }
  return ['active', 'enabled', 'true', '1', 'yes'].includes(
    normalizeText(String(value)),
  );
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(value) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function readStorageArray<T>(key: string): T[] {
  if (!isBrowser()) {
    return [];
  }
  try {
    const result = safeJsonParse<unknown>(
      window.localStorage.getItem(key),
      [],
    );
    return Array.isArray(result) ? (result as T[]) : [];
  } catch {
    return [];
  }
}

function writeStorageArray<T>(key: string, values: T[]): void {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Storage write blocked (private mode / quota / security policy).
    // Fail silently so the app does not crash.
  }
}

function notifyUsersUpdated(): void {
  if (!isBrowser()) {
    return;
  }
  try {
    window.dispatchEvent(new Event('wms:users-updated'));
  } catch {
    // Ignore if dispatch fails for any reason.
  }
}

function getActor(
  performedBy?: WMSUser | string | null,
): {
  userId: string;
  userName: string;
} {
  if (typeof performedBy === 'string') {
    return {
      userId: performedBy,
      userName: performedBy,
    };
  }
  const actor = performedBy || getCurrentUser();
  return {
    userId: actor?.userId || 'SYSTEM',
    userName:
      actor?.fullName ||
      actor?.name ||
      actor?.userId ||
      'System',
  };
}

function validateEmail(email?: string): boolean {
  if (!email) {
    return true;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function roleIdentifier(role: WMSRole): string {
  return String(role.id || role.code || '');
}

/**
 * Removes password data before returning a user to UI state.
 */
export function sanitizeUser(
  user: StoredWMSUser | WMSUser,
): WMSUser {
  const {
    passwordHash: _passwordHash,
    ...safeUser
  } = user as StoredWMSUser;
  return safeUser as WMSUser;
}

/* -------------------------------------------------------------------------- */
/* Password helpers */
/* -------------------------------------------------------------------------- */

/**
 * Development-only SHA-256 hashing.
 *
 * Production must use server-side authentication with Argon2/bcrypt and
 * secure, HttpOnly cookies.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    return '';
  }
  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof TextEncoder !== 'undefined'
  ) {
    const encodedPassword = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest(
      'SHA-256',
      encodedPassword,
    );
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  /**
   * Development fallback only.
   * This is not cryptographically secure.
   */
  let hash = 0;
  for (let index = 0; index < password.length; index += 1) {
    hash = (hash << 5) - hash + password.charCodeAt(index);
    hash |= 0;
  }
  return `fallback-${Math.abs(hash).toString(16)}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (!password || !storedHash) {
    return false;
  }
  return (await hashPassword(password)) === storedHash;
}

function validateNewPassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must contain at least 8 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one special character.';
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Role storage */
/* -------------------------------------------------------------------------- */

export function getRoles(): WMSRole[] {
  return readStorageArray<WMSRole>(WMS_ROLE_STORAGE_KEY);
}

export function saveRoles(roles: WMSRole[]): void {
  writeStorageArray(WMS_ROLE_STORAGE_KEY, roles);
}

export function getRoleById(
  roleId: string | null | undefined,
): WMSRole | undefined {
  if (!roleId) {
    return undefined;
  }
  const target = normalizeText(roleId);
  return getRoles().find(
    (role) =>
      normalizeText(role.id) === target ||
      normalizeText(role.code) === target,
  );
}

export function getActiveRoles(): WMSRole[] {
  return getRoles().filter((role) => isActiveValue(role.isActive));
}

function cloneRole(role: WMSRole): WMSRole {
  return {
    ...role,
    permissions: Array.isArray(role.permissions)
      ? role.permissions.map((permission) => ({
          ...permission,
          actions: Array.isArray(permission.actions)
            ? [...permission.actions]
            : [],
        }))
      : [],
    approvalLimits: {
      ...(role.approvalLimits || {}),
    },
  };
}

/**
 * Adds missing default roles without replacing customized roles.
 */
function initializeRoles(): WMSRole[] {
  const existingRoles = getRoles();
  if (existingRoles.length === 0) {
    const defaultRoles = DEFAULT_WMS_ROLES.map(cloneRole);
    saveRoles(defaultRoles);
    return defaultRoles;
  }

  const mergedRoles = [...existingRoles];
  DEFAULT_WMS_ROLES.forEach((defaultRole) => {
    const exists = mergedRoles.some(
      (role) =>
        normalizeText(role.id) === normalizeText(defaultRole.id) ||
        normalizeText(role.code) === normalizeText(defaultRole.code),
    );
    if (!exists) {
      mergedRoles.push(cloneRole(defaultRole));
    }
  });

  saveRoles(mergedRoles);
  return mergedRoles;
}

/* -------------------------------------------------------------------------- */
/* User storage */
/* -------------------------------------------------------------------------- */

export function getStoredUsers(): StoredWMSUser[] {
  return readStorageArray<StoredWMSUser>(WMS_USER_STORAGE_KEY);
}

export function getUsers(): WMSUser[] {
  return getStoredUsers().map(sanitizeUser);
}

export function saveStoredUsers(users: StoredWMSUser[]): void {
  writeStorageArray(WMS_USER_STORAGE_KEY, users);
  notifyUsersUpdated();
}

export function getStoredUserById(
  userId: string | null | undefined,
): StoredWMSUser | undefined {
  if (!userId) {
    return undefined;
  }
  const target = normalizeText(userId);
  return getStoredUsers().find(
    (user) =>
      normalizeText(user.id) === target ||
      normalizeText(user.userId) === target ||
      normalizeText(user.employeeId) === target ||
      normalizeText(user.email) === target,
  );
}

export function getUserById(
  userId: string | null | undefined,
): WMSUser | undefined {
  const user = getStoredUserById(userId);
  return user ? sanitizeUser(user) : undefined;
}

export function isLoginIdAvailable(
  loginId: string,
  excludedUserId?: string,
): boolean {
  const target = normalizeText(loginId);
  const excluded = normalizeText(excludedUserId);
  if (!target) {
    return false;
  }
  return !getStoredUsers().some((user) => {
    if (
      excluded &&
      (normalizeText(user.id) === excluded ||
        normalizeText(user.userId) === excluded)
    ) {
      return false;
    }
    return (
      normalizeText(user.userId) === target ||
      normalizeText(user.employeeId) === target ||
      normalizeText(user.email) === target
    );
  });
}

export function saveUser(user: StoredWMSUser): StoredWMSUser {
  const users = getStoredUsers();
  const existingIndex = users.findIndex(
    (item) =>
      normalizeText(item.id) === normalizeText(user.id) ||
      normalizeText(item.userId) === normalizeText(user.userId),
  );
  const existingUser =
    existingIndex >= 0 ? users[existingIndex] : undefined;

  const savedUser = {
    ...existingUser,
    ...user,
    passwordHash: user.passwordHash || existingUser?.passwordHash,
    updatedAt: getNow(),
  } as StoredWMSUser;

  if (existingIndex >= 0) {
    users[existingIndex] = savedUser;
  } else {
    users.unshift(savedUser);
  }

  saveStoredUsers(users);
  return savedUser;
}

/* -------------------------------------------------------------------------- */
/* User CRUD */
/* -------------------------------------------------------------------------- */

export async function createUser(
  input: CreateUserInput,
  performedBy?: WMSUser | string | null,
): Promise<OperationResult> {
  await initializeAuthStorage();

  const userId = input.userId.trim();
  const fullName = input.fullName.trim();
  const email = input.email?.trim() || '';
  const employeeId = input.employeeId?.trim() || '';

  if (!userId) {
    return {
      success: false,
      message: 'User ID is required.',
    };
  }
  if (!fullName) {
    return {
      success: false,
      message: 'Full name is required.',
    };
  }
  if (!input.roleId) {
    return {
      success: false,
      message: 'A role must be assigned.',
    };
  }
  if (!validateEmail(email)) {
    return {
      success: false,
      message: 'Please enter a valid email address.',
    };
  }

  const passwordError = validateNewPassword(input.password);
  if (passwordError) {
    return {
      success: false,
      message: passwordError,
    };
  }

  if (!isLoginIdAvailable(userId)) {
    return {
      success: false,
      message: 'The User ID is already in use.',
    };
  }
  if (employeeId && !isLoginIdAvailable(employeeId)) {
    return {
      success: false,
      message: 'The employee ID is already in use.',
    };
  }
  if (email && !isLoginIdAvailable(email)) {
    return {
      success: false,
      message: 'The email address is already in use.',
    };
  }

  const role = getRoleById(input.roleId);
  if (!role) {
    return {
      success: false,
      message: 'The selected role could not be found.',
    };
  }
  if (!isActiveValue(role.isActive)) {
    return {
      success: false,
      message: 'The selected role is inactive.',
    };
  }

  const actor = getActor(performedBy);
  const now = getNow();

  const newUser = {
    id: createId('USER'),
    userId,
    employeeId: employeeId || undefined,
    fullName,
    name: input.name?.trim() || fullName,
    email: email || undefined,
    phone: input.phone?.trim() || undefined,
    roleId: roleIdentifier(role),
    roleCode: role.code,
    roleName: role.name,
    section: input.section?.trim() || '',
    position: input.position?.trim() || '',
    assignedPlants: Array.isArray(input.assignedPlants)
      ? input.assignedPlants
      : [],
    assignedLocations: Array.isArray(input.assignedLocations)
      ? input.assignedLocations
      : [],
    status: input.status || 'Active',
    isActive: isActiveValue(input.status || 'Active'),
    mustChangePassword: input.mustChangePassword ?? true,
    failedLoginAttempts: 0,
    passwordHash: await hashPassword(input.password),
    createdAt: now,
    createdBy: actor.userId,
    updatedAt: now,
    updatedBy: actor.userId,
  } as unknown as StoredWMSUser;

  const users = getStoredUsers();
  users.unshift(newUser);
  saveStoredUsers(users);

  addSecurityAuditLog({
    userId: actor.userId,
    userName: actor.userName,
    action: 'USER_CREATED',
    module: 'user_management',
    entityType: 'User',
    entityId: newUser.id,
    result: 'Success',
    severity: 'Medium',
    description: `User ${newUser.userId} was created.`,
    details: {
      targetUserId: newUser.userId,
      roleId: newUser.roleId,
      roleCode: newUser.roleCode,
    },
  });

  return {
    success: true,
    message: 'User created successfully.',
    user: sanitizeUser(newUser),
  };
}

export function updateUser(
  targetUserId: string,
  input: UpdateUserInput,
  performedBy?: WMSUser | string | null,
): OperationResult {
  const users = getStoredUsers();
  const userIndex = users.findIndex(
    (user) =>
      normalizeText(user.id) === normalizeText(targetUserId) ||
      normalizeText(user.userId) === normalizeText(targetUserId),
  );

  if (userIndex < 0) {
    return {
      success: false,
      message: 'User account was not found.',
    };
  }

  const existingUser = users[userIndex];
  const nextUserId = input.userId?.trim() || existingUser.userId;
  const nextEmail =
    input.email !== undefined
      ? input.email.trim()
      : existingUser.email || '';

  if (!nextUserId) {
    return {
      success: false,
      message: 'User ID is required.',
    };
  }
  if (!validateEmail(nextEmail)) {
    return {
      success: false,
      message: 'Please enter a valid email address.',
    };
  }
  if (!isLoginIdAvailable(nextUserId, existingUser.id)) {
    return {
      success: false,
      message: 'The User ID is already in use.',
    };
  }
  if (
    nextEmail &&
    !isLoginIdAvailable(nextEmail, existingUser.id)
  ) {
    return {
      success: false,
      message: 'The email address is already in use.',
    };
  }

  let roleId = existingUser.roleId;
  let roleCode = existingUser.roleCode;
  let roleName = existingUser.roleName;

  if (input.roleId) {
    const role = getRoleById(input.roleId);
    if (!role) {
      return {
        success: false,
        message: 'The selected role could not be found.',
      };
    }
    roleId = roleIdentifier(role);
    roleCode = role.code;
    roleName = role.name;
  }

  const actor = getActor(performedBy);

  const updatedUser = {
    ...existingUser,
    ...input,
    userId: nextUserId,
    fullName:
      input.fullName?.trim() ||
      existingUser.fullName ||
      existingUser.name ||
      nextUserId,
    name:
      input.name?.trim() ||
      input.fullName?.trim() ||
      existingUser.name ||
      existingUser.fullName ||
      nextUserId,
    email: nextEmail || undefined,
    phone:
      input.phone !== undefined
        ? input.phone.trim() || undefined
        : existingUser.phone,
    roleId,
    roleCode,
    roleName,
    assignedPlants: Array.isArray(input.assignedPlants)
      ? input.assignedPlants
      : existingUser.assignedPlants || [],
    assignedLocations: Array.isArray(input.assignedLocations)
      ? input.assignedLocations
      : existingUser.assignedLocations || [],
    status: input.status || existingUser.status,
    isActive: isActiveValue(input.status || existingUser.status),
    updatedAt: getNow(),
    updatedBy: actor.userId,
  } as StoredWMSUser;

  users[userIndex] = updatedUser;
  saveStoredUsers(users);

  const currentUser = getCurrentUser();
  if (
    currentUser &&
    normalizeText(currentUser.id) === normalizeText(updatedUser.id)
  ) {
    setCurrentUser(updatedUser);
  }

  addSecurityAuditLog({
    userId: actor.userId,
    userName: actor.userName,
    action: 'USER_UPDATED',
    module: 'user_management',
    entityType: 'User',
    entityId: updatedUser.id,
    result: 'Success',
    severity: 'Medium',
    description: `User ${updatedUser.userId} was updated.`,
  });

  return {
    success: true,
    message: 'User updated successfully.',
    user: sanitizeUser(updatedUser),
  };
}

export function deleteUser(
  targetUserId: string,
  performedBy?: WMSUser | string | null,
): OperationResult {
  const users = getStoredUsers();
  const targetUser = users.find(
    (user) =>
      normalizeText(user.id) === normalizeText(targetUserId) ||
      normalizeText(user.userId) === normalizeText(targetUserId),
  );

  if (!targetUser) {
    return {
      success: false,
      message: 'User account was not found.',
    };
  }

  const actorUser =
    typeof performedBy === 'object' && performedBy
      ? performedBy
      : getCurrentUser();

  if (
    actorUser &&
    normalizeText(actorUser.id) === normalizeText(targetUser.id)
  ) {
    return {
      success: false,
      message: 'You cannot delete your own account.',
    };
  }

  if (
    normalizeText(targetUser.userId) ===
    normalizeText(DEFAULT_ADMIN_USER.userId)
  ) {
    return {
      success: false,
      message: 'The default administrator cannot be deleted.',
    };
  }

  const actor = getActor(performedBy);

  saveStoredUsers(
    users.filter(
      (user) =>
        normalizeText(user.id) !== normalizeText(targetUser.id),
    ),
  );

  const now = getNow();
  saveLoginSessions(
    getLoginSessions().map((session) =>
      session.status === 'Active' &&
      normalizeText(session.userId) ===
        normalizeText(targetUser.userId)
        ? {
            ...session,
            status: 'Expired' as LoginSessionStatus,
            logoutAt: now,
            lastActivityAt: now,
          }
        : session,
    ),
  );

  addSecurityAuditLog({
    userId: actor.userId,
    userName: actor.userName,
    action: 'USER_DELETED',
    module: 'user_management',
    entityType: 'User',
    entityId: targetUser.id,
    result: 'Success',
    severity: 'High',
    description: `User ${targetUser.userId} was deleted.`,
  });

  return {
    success: true,
    message: 'User deleted successfully.',
  };
}

/* -------------------------------------------------------------------------- */
/* Current user */
/* -------------------------------------------------------------------------- */

export function getCurrentUser(): WMSUser | null {
  if (!isBrowser()) {
    return null;
  }
  try {
    const storedValue = window.localStorage.getItem(
      WMS_CURRENT_USER_STORAGE_KEY,
    );
    const parsedUser = safeJsonParse<WMSUser | null>(
      storedValue,
      null,
    );
    if (!parsedUser) {
      return null;
    }
    const latestUser = getStoredUserById(
      parsedUser.id || parsedUser.userId,
    );
    return latestUser ? sanitizeUser(latestUser) : parsedUser;
  } catch {
    return null;
  }
}

export function setCurrentUser(
  user: StoredWMSUser | WMSUser,
): WMSUser {
  const safeUser = sanitizeUser(user);
  if (isBrowser()) {
    try {
      window.localStorage.setItem(
        WMS_CURRENT_USER_STORAGE_KEY,
        JSON.stringify(safeUser),
      );
    } catch {
      // Ignore storage write failure (private mode / blocked storage).
    }
  }
  return safeUser;
}

export function clearCurrentUser(): void {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.removeItem(WMS_CURRENT_USER_STORAGE_KEY);
  } catch {
    // Ignore storage removal failure.
  }
}

export function getCurrentRole(): WMSRole | null {
  const user = getCurrentUser();
  if (!user) {
    return null;
  }
  return findUserRole(user, getRoles()) || null;
}

/* -------------------------------------------------------------------------- */
/* Login sessions */
/* -------------------------------------------------------------------------- */

export function getLoginSessions(): LoginSession[] {
  return readStorageArray<LoginSession>(
    WMS_LOGIN_SESSION_STORAGE_KEY,
  );
}

export function saveLoginSessions(sessions: LoginSession[]): void {
  writeStorageArray(WMS_LOGIN_SESSION_STORAGE_KEY, sessions);
}

export function getActiveLoginSession(
  userId?: string,
): LoginSession | null {
  const currentUser = getCurrentUser();
  const targetUserId = userId || currentUser?.userId;
  if (!targetUserId) {
    return null;
  }
  return (
    getLoginSessions().find(
      (session) =>
        session.status === 'Active' &&
        normalizeText(session.userId) ===
          normalizeText(targetUserId),
    ) || null
  );
}

export function createLoginSession(
  user: WMSUser,
  rememberMe = false,
): LoginSession {
  const sessions = getLoginSessions();
  const now = getNow();

  const updatedSessions = sessions.map((session) => {
    if (
      session.status === 'Active' &&
      normalizeText(session.userId) ===
        normalizeText(user.userId)
    ) {
      return {
        ...session,
        status: 'Expired' as LoginSessionStatus,
        logoutAt: now,
        lastActivityAt: now,
      };
    }
    return session;
  });

  const newSession: LoginSession = {
    id: createId('SESSION'),
    userId: user.userId,
    employeeId: user.employeeId,
    userName: user.fullName || user.name || user.userId,
    email: user.email,
    loginAt: now,
    lastActivityAt: now,
    status: 'Active',
    rememberMe,
    userAgent:
      typeof navigator !== 'undefined'
        ? navigator.userAgent
        : undefined,
  };

  updatedSessions.unshift(newSession);
  saveLoginSessions(updatedSessions);
  return newSession;
}

export function updateSessionActivity(sessionId?: string): void {
  const sessions = getLoginSessions();
  const activeSession = sessionId
    ? sessions.find(
        (session) =>
          session.id === sessionId &&
          session.status === 'Active',
      )
    : getActiveLoginSession();

  if (!activeSession) {
    return;
  }

  saveLoginSessions(
    sessions.map((session) =>
      session.id === activeSession.id
        ? {
            ...session,
            lastActivityAt: getNow(),
          }
        : session,
    ),
  );
}

function closeLoginSession(
  sessionId: string | undefined,
  status: LoginSessionStatus,
): LoginSession | null {
  const sessions = getLoginSessions();
  const targetSession = sessionId
    ? sessions.find((session) => session.id === sessionId)
    : getActiveLoginSession();

  if (!targetSession) {
    return null;
  }

  const now = getNow();
  const closedSession: LoginSession = {
    ...targetSession,
    status,
    logoutAt: now,
    lastActivityAt: now,
  };

  saveLoginSessions(
    sessions.map((session) =>
      session.id === targetSession.id ? closedSession : session,
    ),
  );

  return closedSession;
}

/* -------------------------------------------------------------------------- */
/* Security audit */
/* -------------------------------------------------------------------------- */

export function getSecurityAuditLogs(): SecurityAuditLog[] {
  return readStorageArray<SecurityAuditLog>(
    WMS_SECURITY_AUDIT_STORAGE_KEY,
  );
}

export function saveSecurityAuditLogs(
  logs: SecurityAuditLog[],
): void {
  writeStorageArray(WMS_SECURITY_AUDIT_STORAGE_KEY, logs);
}

export function addSecurityAuditLog(
  input: CreateAuditLogInput,
): SecurityAuditLog {
  const currentUser = getCurrentUser();
  const activeSession = getActiveLoginSession(
    input.userId || currentUser?.userId,
  );

  const log: SecurityAuditLog = {
    id: createId('AUDIT'),
    timestamp: getNow(),
    userId: input.userId || currentUser?.userId || 'ANONYMOUS',
    userName:
      input.userName ||
      currentUser?.fullName ||
      currentUser?.name ||
      'Anonymous User',
    action: input.action,
    module: input.module,
    entityType: input.entityType,
    entityId: input.entityId,
    result: input.result || 'Success',
    severity: input.severity || 'Info',
    description: input.description,
    details: input.details,
    plant: input.plant,
    location: input.location,
    sessionId: input.sessionId || activeSession?.id,
    userAgent:
      typeof navigator !== 'undefined'
        ? navigator.userAgent
        : undefined,
  };

  const logs = getSecurityAuditLogs();
  logs.unshift(log);
  saveSecurityAuditLogs(logs.slice(0, MAX_SECURITY_AUDIT_LOGS));

  return log;
}

/* -------------------------------------------------------------------------- */
/* Initialization */
/* -------------------------------------------------------------------------- */

export async function initializeAuthStorage(): Promise<void> {
  if (!isBrowser()) {
    return;
  }

  initializeRoles();

  const users = getStoredUsers();
  const defaultAdminHash = await hashPassword(
    DEFAULT_ADMIN_PASSWORD,
  );

  if (users.length === 0) {
    const defaultAdmin = {
      ...DEFAULT_ADMIN_USER,
      passwordHash: defaultAdminHash,
      createdAt: getNow(),
      updatedAt: getNow(),
    } as StoredWMSUser;

    saveStoredUsers([defaultAdmin]);

    addSecurityAuditLog({
      userId: 'SYSTEM',
      userName: 'System',
      action: 'AUTH_INITIALIZED',
      module: 'authentication',
      entityType: 'System',
      entityId: 'WMS-AUTH',
      result: 'Success',
      severity: 'Info',
      description:
        'WMS authentication storage and default administrator were initialized.',
    });
    return;
  }

  const adminIndex = users.findIndex(
    (user) =>
      normalizeText(user.userId) ===
        normalizeText(DEFAULT_ADMIN_USER.userId) ||
      normalizeText(user.roleCode) === 'system_admin' ||
      normalizeText(user.roleId) ===
        normalizeText(DEFAULT_ADMIN_USER.roleId),
  );

  if (adminIndex >= 0 && !users[adminIndex].passwordHash) {
    users[adminIndex] = {
      ...users[adminIndex],
      passwordHash: defaultAdminHash,
      updatedAt: getNow(),
      updatedBy: 'SYSTEM',
    } as StoredWMSUser;
    saveStoredUsers(users);
  }

  if (adminIndex < 0) {
    users.unshift({
      ...DEFAULT_ADMIN_USER,
      passwordHash: defaultAdminHash,
      createdAt: getNow(),
      updatedAt: getNow(),
    } as StoredWMSUser);
    saveStoredUsers(users);
  }
}

/* -------------------------------------------------------------------------- */
/* Authentication */
/* -------------------------------------------------------------------------- */

function normalizeLoginCredentials(
  credentialsOrLoginId:
    | LoginCredentials
    | string
    | Record<string, unknown>,
  password?: string,
  rememberMe?: boolean,
): LoginCredentials {
  if (typeof credentialsOrLoginId === 'string') {
    return {
      loginId: credentialsOrLoginId,
      password: password || '',
      rememberMe,
    };
  }

  const record =
    credentialsOrLoginId &&
    typeof credentialsOrLoginId === 'object'
      ? (credentialsOrLoginId as Record<string, unknown>)
      : {};

  return {
    loginId: String(
      record.loginId ?? record.userId ?? record.email ?? '',
    ),
    password: String(record.password ?? ''),
    rememberMe: Boolean(record.rememberMe),
  };
}

export async function login(
  credentials: LoginCredentials,
): Promise<LoginResult>;
export async function login(
  loginId: string,
  password: string,
  rememberMe?: boolean,
): Promise<LoginResult>;
export async function login(
  credentialsOrLoginId:
    | LoginCredentials
    | string
    | Record<string, unknown>,
  legacyPassword?: string,
  legacyRememberMe?: boolean,
): Promise<LoginResult> {
  if (!isBrowser()) {
    return {
      success: false,
      message: 'Login is only available in the browser.',
    };
  }

  await initializeAuthStorage();

  const credentials = normalizeLoginCredentials(
    credentialsOrLoginId,
    legacyPassword,
    legacyRememberMe,
  );

  const loginId = normalizeText(credentials.loginId);
  const password = credentials.password || '';

  if (!loginId || !password) {
    return {
      success: false,
      message: 'User ID and password are required.',
    };
  }

  const users = getStoredUsers();
  const userIndex = users.findIndex(
    (user) =>
      normalizeText(user.userId) === loginId ||
      normalizeText(user.employeeId) === loginId ||
      normalizeText(user.email) === loginId,
  );

  if (userIndex < 0) {
    addSecurityAuditLog({
      userId: credentials.loginId,
      userName: credentials.loginId,
      action: 'LOGIN_FAILED',
      module: 'authentication',
      result: 'Failed',
      severity: 'Medium',
      description: 'Login failed because the user was not found.',
    });
    return {
      success: false,
      message: 'Invalid user ID or password.',
    };
  }

  const user = users[userIndex];
  const normalizedStatus = normalizeText(String(user.status || ''));

  if (normalizedStatus === 'locked') {
    return {
      success: false,
      message:
        'This account is locked. Please contact a system administrator.',
    };
  }

  if (!isActiveValue(user.status)) {
    return {
      success: false,
      message:
        'This account is inactive. Please contact a system administrator.',
    };
  }

  const passwordValid = await verifyPassword(
    password,
    user.passwordHash || '',
  );

  if (!passwordValid) {
    const failedAttempts = Number(user.failedLoginAttempts || 0) + 1;
    const shouldLock =
      failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

    users[userIndex] = {
      ...user,
      failedLoginAttempts: failedAttempts,
      status: shouldLock ? 'Locked' : user.status,
      updatedAt: getNow(),
      updatedBy: 'SYSTEM',
    } as StoredWMSUser;
    saveStoredUsers(users);

    addSecurityAuditLog({
      userId: user.userId,
      userName: user.fullName || user.name || user.userId,
      action: shouldLock ? 'USER_LOCKED' : 'LOGIN_FAILED',
      module: 'authentication',
      entityType: 'User',
      entityId: user.id,
      result: 'Failed',
      severity: shouldLock ? 'High' : 'Medium',
      description: shouldLock
        ? 'User account was locked after repeated failed login attempts.'
        : 'Login failed because the password was incorrect.',
      details: {
        failedAttempts,
        maximumAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
      },
    });

    return {
      success: false,
      message: shouldLock
        ? 'Your account has been locked after too many failed login attempts.'
        : 'Invalid user ID or password.',
      remainingAttempts: Math.max(
        0,
        MAX_FAILED_LOGIN_ATTEMPTS - failedAttempts,
      ),
    };
  }

  const safeCandidate = sanitizeUser(user);
  const role =
    findUserRole(safeCandidate, getRoles()) || undefined;

  if (!role || !isActiveValue(role.isActive)) {
    return {
      success: false,
      message:
        'Your assigned role is missing or inactive. Please contact a system administrator.',
    };
  }

  const now = getNow();
  const authenticatedUser = {
    ...user,
    failedLoginAttempts: 0,
    lastLoginAt: now,
    updatedAt: now,
    updatedBy: user.userId,
  } as StoredWMSUser;

  users[userIndex] = authenticatedUser;
  saveStoredUsers(users);

  const safeUser = setCurrentUser(authenticatedUser);
  const session = createLoginSession(
    safeUser,
    Boolean(credentials.rememberMe),
  );

  addSecurityAuditLog({
    userId: safeUser.userId,
    userName:
      safeUser.fullName || safeUser.name || safeUser.userId,
    action: 'LOGIN_SUCCESS',
    module: 'authentication',
    entityType: 'User',
    entityId: safeUser.id,
    result: 'Success',
    severity: 'Info',
    description: 'User logged in successfully.',
    sessionId: session.id,
  });

  return {
    success: true,
    message: safeUser.mustChangePassword
      ? 'Login successful. You must change your password.'
      : 'Login successful.',
    user: safeUser,
    role,
    session,
  };
}

export function logout(): void {
  const currentUser = getCurrentUser();
  const activeSession = getActiveLoginSession(
    currentUser?.userId,
  );

  if (currentUser) {
    addSecurityAuditLog({
      userId: currentUser.userId,
      userName:
        currentUser.fullName ||
        currentUser.name ||
        currentUser.userId,
      action: 'LOGOUT',
      module: 'authentication',
      entityType: 'User',
      entityId: currentUser.id,
      result: 'Success',
      severity: 'Info',
      description: 'User logged out successfully.',
      sessionId: activeSession?.id,
    });
  }

  closeLoginSession(activeSession?.id, 'Logged Out');
  clearCurrentUser();
}

export function expireCurrentSession(): void {
  const currentUser = getCurrentUser();
  const activeSession = getActiveLoginSession(
    currentUser?.userId,
  );

  if (currentUser) {
    addSecurityAuditLog({
      userId: currentUser.userId,
      userName:
        currentUser.fullName ||
        currentUser.name ||
        currentUser.userId,
      action: 'SESSION_EXPIRED',
      module: 'authentication',
      entityType: 'User',
      entityId: currentUser.id,
      result: 'Success',
      severity: 'Low',
      description: 'The user session expired.',
      sessionId: activeSession?.id,
    });
  }

  closeLoginSession(activeSession?.id, 'Expired');
  clearCurrentUser();
}

/* -------------------------------------------------------------------------- */
/* Password management */
/* -------------------------------------------------------------------------- */

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<PasswordResult> {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return {
      success: false,
      message: 'No authenticated user was found.',
    };
  }

  const passwordError = validateNewPassword(newPassword);
  if (passwordError) {
    return {
      success: false,
      message: passwordError,
    };
  }

  const users = getStoredUsers();
  const userIndex = users.findIndex(
    (user) =>
      normalizeText(user.id) === normalizeText(currentUser.id),
  );

  if (userIndex < 0) {
    return {
      success: false,
      message: 'The current user account was not found.',
    };
  }

  const existingUser = users[userIndex];
  const currentPasswordValid = await verifyPassword(
    currentPassword,
    existingUser.passwordHash || '',
  );

  if (!currentPasswordValid) {
    return {
      success: false,
      message: 'The current password is incorrect.',
    };
  }

  const samePassword = await verifyPassword(
    newPassword,
    existingUser.passwordHash || '',
  );

  if (samePassword) {
    return {
      success: false,
      message:
        'The new password must be different from the current password.',
    };
  }

  users[userIndex] = {
    ...existingUser,
    passwordHash: await hashPassword(newPassword),
    mustChangePassword: false,
    passwordChangedAt: getNow(),
    failedLoginAttempts: 0,
    updatedAt: getNow(),
    updatedBy: currentUser.userId,
  } as StoredWMSUser;

  saveStoredUsers(users);
  setCurrentUser(users[userIndex]);

  addSecurityAuditLog({
    action: 'PASSWORD_CHANGED',
    module: 'authentication',
    entityType: 'User',
    entityId: existingUser.id,
    result: 'Success',
    severity: 'Info',
    description: 'The user changed their password successfully.',
  });

  return {
    success: true,
    message: 'Password changed successfully.',
  };
}

export async function resetUserPassword(
  targetUserId: string,
  temporaryPassword: string,
  performedBy?: WMSUser | string | null,
): Promise<PasswordResult> {
  const passwordError = validateNewPassword(temporaryPassword);
  if (passwordError) {
    return {
      success: false,
      message: passwordError,
    };
  }

  const users = getStoredUsers();
  const userIndex = users.findIndex(
    (user) =>
      normalizeText(user.id) === normalizeText(targetUserId) ||
      normalizeText(user.userId) === normalizeText(targetUserId),
  );

  if (userIndex < 0) {
    return {
      success: false,
      message: 'User account was not found.',
    };
  }

  const actor = getActor(performedBy);
  const targetUser = users[userIndex];

  users[userIndex] = {
    ...targetUser,
    passwordHash: await hashPassword(temporaryPassword),
    mustChangePassword: true,
    failedLoginAttempts: 0,
    status:
      normalizeText(String(targetUser.status)) === 'locked'
        ? 'Active'
        : targetUser.status,
    passwordChangedAt: getNow(),
    updatedAt: getNow(),
    updatedBy: actor.userId,
  } as StoredWMSUser;

  saveStoredUsers(users);

  addSecurityAuditLog({
    userId: actor.userId,
    userName: actor.userName,
    action: 'PASSWORD_RESET',
    module: 'user_management',
    entityType: 'User',
    entityId: targetUser.id,
    result: 'Success',
    severity: 'Medium',
    description: `Password was reset for user ${targetUser.userId}.`,
  });

  return {
    success: true,
    message:
      'Password reset successfully. The user must change it after login.',
  };
}

/* -------------------------------------------------------------------------- */
/* Account status management */
/* -------------------------------------------------------------------------- */

export function activateUser(
  targetUserId: string,
  performedBy?: WMSUser | string | null,
): OperationResult {
  const users = getStoredUsers();
  const userIndex = users.findIndex(
    (user) =>
      normalizeText(user.id) === normalizeText(targetUserId) ||
      normalizeText(user.userId) === normalizeText(targetUserId),
  );

  if (userIndex < 0) {
    return {
      success: false,
      message: 'User account was not found.',
    };
  }

  const actor = getActor(performedBy);
  const targetUser = users[userIndex];

  users[userIndex] = {
    ...targetUser,
    status: 'Active',
    isActive: true,
    failedLoginAttempts: 0,
    updatedAt: getNow(),
    updatedBy: actor.userId,
  } as StoredWMSUser;

  saveStoredUsers(users);

  addSecurityAuditLog({
    userId: actor.userId,
    userName: actor.userName,
    action: 'USER_ACTIVATED',
    module: 'user_management',
    entityType: 'User',
    entityId: targetUser.id,
    result: 'Success',
    severity: 'Medium',
    description: `User ${targetUser.userId} was activated.`,
  });

  return {
    success: true,
    message: 'User account activated successfully.',
    user: sanitizeUser(users[userIndex]),
  };
}

export function unlockUser(
  targetUserId: string,
  performedBy?: WMSUser | string | null,
): PasswordResult {
  const users = getStoredUsers();
  const userIndex = users.findIndex(
    (user) =>
      normalizeText(user.id) === normalizeText(targetUserId) ||
      normalizeText(user.userId) === normalizeText(targetUserId),
  );

  if (userIndex < 0) {
    return {
      success: false,
      message: 'User account was not found.',
    };
  }

  const targetUser = users[userIndex];
  const actor = getActor(performedBy);

  users[userIndex] = {
    ...targetUser,
    status: 'Active',
    isActive: true,
    failedLoginAttempts: 0,
    updatedAt: getNow(),
    updatedBy: actor.userId,
  } as StoredWMSUser;

  saveStoredUsers(users);

  addSecurityAuditLog({
    userId: actor.userId,
    userName: actor.userName,
    action: 'USER_UNLOCKED',
    module: 'user_management',
    entityType: 'User',
    entityId: targetUser.id,
    result: 'Success',
    severity: 'Medium',
    description: `User account ${targetUser.userId} was unlocked.`,
  });

  return {
    success: true,
    message: 'User account unlocked successfully.',
  };
}

export function deactivateUser(
  targetUserId: string,
  performedBy?: WMSUser | string | null,
): PasswordResult {
  const users = getStoredUsers();
  const userIndex = users.findIndex(
    (user) =>
      normalizeText(user.id) === normalizeText(targetUserId) ||
      normalizeText(user.userId) === normalizeText(targetUserId),
  );

  if (userIndex < 0) {
    return {
      success: false,
      message: 'User account was not found.',
    };
  }

  const targetUser = users[userIndex];
  const actorUser =
    typeof performedBy === 'object' && performedBy
      ? performedBy
      : getCurrentUser();

  if (
    actorUser &&
    normalizeText(actorUser.id) === normalizeText(targetUser.id)
  ) {
    return {
      success: false,
      message: 'You cannot deactivate your own account.',
    };
  }

  const actor = getActor(performedBy);
  const now = getNow();

  users[userIndex] = {
    ...targetUser,
    status: 'Inactive',
    isActive: false,
    updatedAt: now,
    updatedBy: actor.userId,
  } as StoredWMSUser;

  saveStoredUsers(users);

  saveLoginSessions(
    getLoginSessions().map((session) =>
      session.status === 'Active' &&
      normalizeText(session.userId) ===
        normalizeText(targetUser.userId)
        ? {
            ...session,
            status: 'Expired' as LoginSessionStatus,
            logoutAt: now,
            lastActivityAt: now,
          }
        : session,
    ),
  );

  addSecurityAuditLog({
    userId: actor.userId,
    userName: actor.userName,
    action: 'USER_DEACTIVATED',
    module: 'user_management',
    entityType: 'User',
    entityId: targetUser.id,
    result: 'Success',
    severity: 'High',
    description: `User account ${targetUser.userId} was deactivated.`,
  });

  return {
    success: true,
    message: 'User account deactivated successfully.',
  };
}