'use client';

import type { ReactNode } from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  ConfigProvider,
  Dropdown,
  Grid,
  Layout,
  Menu,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  BankOutlined,
  BarcodeOutlined,
  BellOutlined,
  ContainerOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  EnvironmentOutlined,
  ExperimentOutlined,
  ExportOutlined,
  FileTextOutlined,
  InboxOutlined,
  LockOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PercentageOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  TagsOutlined,
  TeamOutlined,
  TransactionOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  usePathname,
  useRouter,
} from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const {
  Header,
  Sider,
  Content,
} = Layout;

const { Text } = Typography;

type AntMenuItem = Required<MenuProps>['items'][number];

interface DashboardLayoutProps {
  children: ReactNode;
}

interface RoleLike {
  id?: string;
  roleId?: string;
  name?: string;
  roleName?: string;
  code?: string;
}

interface UserLike {
  id?: string;
  userId?: string;
  username?: string;
  name?: string;
  fullName?: string;
  displayName?: string;
  email?: string;
  role?: string | RoleLike;
  roleId?: string;
  roleName?: string;
  isAdmin?: boolean;
  status?: string;
}

interface DashboardAuthContext {
  currentUser?: UserLike | null;
  user?: UserLike | null;
  loading?: boolean;
  isLoading?: boolean;
  initialized?: boolean;
  isAuthenticated?: boolean;
  logout: () => void | Promise<void>;

  /**
   * Supported permission patterns:
   *
   * hasPermission('inventory', 'view')
   * hasPermission('inventory.view')
   * hasPermission('inventory')
   */
  hasPermission?: (
    moduleOrPermission: string,
    action?: string,
  ) => boolean;

  /**
   * Alternative method name supported by this layout.
   */
  can?: (
    moduleOrPermission: string,
    action?: string,
  ) => boolean;
}

interface AppMenuItem {
  key: string;
  icon?: ReactNode;
  label: string;
  permissionModules?: string[];
  publicForAuthenticatedUsers?: boolean;
  children?: AppMenuItem[];
}

const SIDEBAR_BLUE = '#0f3d75';
const SIDEBAR_SUBMENU_BLUE = '#0a2c57';
const SIDEBAR_HOVER_BLUE = '#1559a6';
const SIDEBAR_SELECTED_BLUE = '#1677ff';
const PAGE_BACKGROUND = '#ffffff';

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  master: 'Master Data',
  product: 'Product Master',
  customer: 'Customer Master',
  supplier: 'Supplier Master',
  plant: 'Plant Master',
  location: 'Location Master',
  uom: 'UOM Master',
  'uom-conversion': 'UOM Conversion',
  'movement-type': 'Movement Type',
  status: 'Status Master',
  'purchase-orders': 'Purchase Orders',
  purchase: 'Purchase Orders',
  inbound: 'Inbound / GRN',
  inventory: 'Inventory',
  'inventory-adjustment': 'Inventory Adjustment',
  'inventory-transfer': 'Inventory Transfer',
  outbound: 'Outbound Shipment',
  'sales-orders': 'Sales Orders',
  'stock-movement': 'Stock Movement',
  reports: 'Reports',
  movement: 'Movement History',
  grn: 'GRN Report',
  users: 'User Management',
  roles: 'Role Management',
  security: 'Security',
  audit: 'Audit Log',
  profile: 'Profile',
  settings: 'Settings',
};

/**
 * Permission module aliases provide compatibility with common naming
 * conventions in permissions.ts.
 *
 * You can remove aliases once the exact module IDs are standardized.
 */
const MENU_DEFINITIONS: AppMenuItem[] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
    publicForAuthenticatedUsers: true,
  },
  {
    key: '/dashboard/master',
    icon: <DatabaseOutlined />,
    label: 'Master Data (MD)',
    permissionModules: [
      'master',
      'master_data',
    ],
    children: [
      {
        key: '/dashboard/master/product',
        icon: <BarcodeOutlined />,
        label: 'Product Master',
        permissionModules: [
          'product',
          'products',
          'product_master',
          'master_data',
        ],
      },
      {
        key: '/dashboard/master/customer',
        icon: <UserOutlined />,
        label: 'Customer Master',
        permissionModules: [
          'customer',
          'customers',
          'customer_master',
          'master_data',
        ],
      },
      {
        key: '/dashboard/master/supplier',
        icon: <BankOutlined />,
        label: 'Supplier Master',
        permissionModules: [
          'supplier',
          'suppliers',
          'supplier_master',
          'master_data',
        ],
      },
      {
        key: '/dashboard/master/plant',
        icon: <EnvironmentOutlined />,
        label: 'Plant Master',
        permissionModules: [
          'plant',
          'plants',
          'plant_master',
          'master_data',
        ],
      },
      {
        key: '/dashboard/master/location',
        icon: <ContainerOutlined />,
        label: 'Location Master',
        permissionModules: [
          'location',
          'locations',
          'location_master',
          'master_data',
        ],
      },
      {
        key: '/dashboard/master/uom',
        icon: <PercentageOutlined />,
        label: 'UOM Master',
        permissionModules: [
          'uom',
          'uom_master',
          'master_data',
        ],
      },
      {
        key: '/dashboard/master/uom-conversion',
        icon: <SwapOutlined />,
        label: 'UOM Conversion',
        permissionModules: [
          'uom_conversion',
          'uom-conversion',
          'master_data',
        ],
      },
      {
        key: '/dashboard/master/movement-type',
        icon: <TransactionOutlined />,
        label: 'Movement Type',
        permissionModules: [
          'movement_type',
          'movement-type',
          'master_data',
        ],
      },
      {
        key: '/dashboard/master/status',
        icon: <TagsOutlined />,
        label: 'Status Master',
        permissionModules: [
          'status',
          'status_master',
          'master_data',
        ],
      },
    ],
  },
  {
    key: '/dashboard/purchase-orders',
    icon: <ShoppingCartOutlined />,
    label: 'Purchase Order (PO)',
    permissionModules: [
      'purchase_order',
      'purchase_orders',
      'purchase',
      'procurement',
    ],
  },
  {
    key: '/dashboard/inbound',
    icon: <InboxOutlined />,
    label: 'Inbound (GRN)',
    permissionModules: [
      'inbound',
      'inbound_receipt',
      'inbound_receipts',
      'grn',
    ],
  },
  {
    key: '/dashboard/inventory',
    icon: <DatabaseOutlined />,
    label: 'Inventory (IR)',
    permissionModules: [
      'inventory',
      'inventory_management',
      'inventory_report',
    ],
  },
  {
    key: '/dashboard/inventory-adjustment',
    icon: <ExperimentOutlined />,
    label: 'Inventory Adjustment (ADJ)',
    permissionModules: [
      'inventory_adjustment',
      'inventory-adjustment',
      'adjustment',
    ],
  },
  {
    key: '/dashboard/inventory-transfer',
    icon: <SwapOutlined />,
    label: 'Inventory Transfer',
    permissionModules: [
      'inventory_transfer',
      'inventory-transfer',
      'transfer',
    ],
  },
  {
    key: '/dashboard/outbound',
    icon: <ExportOutlined />,
    label: 'Outbound (DO)',
    permissionModules: [
      'outbound',
      'outbound_shipment',
      'outbound_shipments',
      'delivery_order',
    ],
  },
  {
    key: '/dashboard/sales-orders',
    icon: <FileTextOutlined />,
    label: 'Sales Orders (SO)',
    permissionModules: [
      'sales_order',
      'sales_orders',
      'sales',
    ],
  },
  {
    key: '/dashboard/stock-movement',
    icon: <SwapOutlined />,
    label: 'Stock Movement (IM)',
    permissionModules: [
      'stock_movement',
      'stock-movement',
      'inventory_movement',
      'inventory_movements',
    ],
  },
  {
    key: '/dashboard/reports',
    icon: <FileTextOutlined />,
    label: 'Reports (R)',
    permissionModules: [
      'report',
      'reports',
    ],
    children: [
      {
        key: '/dashboard/reports/inventory',
        label: 'Inventory Report',
        permissionModules: [
          'inventory_report',
          'reports',
        ],
      },
      {
        key: '/dashboard/reports/movement',
        label: 'Movement History',
        permissionModules: [
          'movement_report',
          'movement_history',
          'reports',
        ],
      },
      {
        key: '/dashboard/reports/grn',
        label: 'GRN Report',
        permissionModules: [
          'grn_report',
          'inbound_report',
          'reports',
        ],
      },
    ],
  },
  {
    key: '/dashboard/users',
    icon: <TeamOutlined />,
    label: 'User Management',
    permissionModules: [
      'user',
      'users',
      'user_management',
      'security_admin',
    ],
  },
];

function normalizeText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function isSystemAdministrator(
  user: UserLike | null,
): boolean {
  if (!user) {
    return false;
  }

  if (user.isAdmin === true) {
    return true;
  }

  const role =
    typeof user.role === 'string'
      ? user.role
      : user.role?.name ||
        user.role?.roleName ||
        user.role?.code ||
        user.role?.id ||
        user.role?.roleId ||
        user.roleName ||
        user.roleId ||
        '';

  const normalizedRole = role
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  return [
    'admin',
    'administrator',
    'systemadmin',
    'systemadministrator',
    'superadmin',
  ].includes(normalizedRole);
}

function getUserDisplayName(
  user: UserLike | null,
): string {
  if (!user) {
    return 'User';
  }

  return (
    normalizeText(user.displayName) ||
    normalizeText(user.fullName) ||
    normalizeText(user.name) ||
    normalizeText(user.username) ||
    normalizeText(user.userId) ||
    normalizeText(user.email) ||
    'User'
  );
}

function getUserRoleName(
  user: UserLike | null,
): string {
  if (!user) {
    return '';
  }

  if (typeof user.role === 'string') {
    return user.role;
  }

  return (
    normalizeText(user.role?.name) ||
    normalizeText(user.role?.roleName) ||
    normalizeText(user.role?.code) ||
    normalizeText(user.roleName) ||
    normalizeText(user.roleId)
  );
}

function getInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return 'U';
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function formatBreadcrumbLabel(
  segment: string,
): string {
  if (BREADCRUMB_LABELS[segment]) {
    return BREADCRUMB_LABELS[segment];
  }

  return decodeURIComponent(segment)
    .replace(/[-_]+/g, ' ')
    .replace(
      /\b\w/g,
      (character) => character.toUpperCase(),
    );
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const screens = Grid.useBreakpoint();

  const auth =
    useAuth() as unknown as DashboardAuthContext;

  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  const currentUser =
    auth.currentUser ??
    auth.user ??
    null;

  const authLoading =
    auth.loading ??
    auth.isLoading ??
    auth.initialized === false;

  const isAuthenticated =
    auth.isAuthenticated ??
    Boolean(currentUser);

  const isMobile = mounted && !screens.md;

  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * Collapse the sidebar automatically on smaller screens.
   */
  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (isMobile) {
      setCollapsed(true);
    }
  }, [
    isMobile,
    mounted,
  ]);

  /**
   * Redirect unauthenticated users to login while preserving
   * their intended destination.
   */
  useEffect(() => {
    if (
      !mounted ||
      authLoading ||
      isAuthenticated
    ) {
      return;
    }

    const returnUrl =
      pathname && pathname.startsWith('/dashboard')
        ? pathname
        : '/dashboard';

    router.replace(
      `/login?returnUrl=${encodeURIComponent(returnUrl)}`,
    );
  }, [
    authLoading,
    isAuthenticated,
    mounted,
    pathname,
    router,
  ]);

  const userIsAdministrator = useMemo(
    () => isSystemAdministrator(currentUser),
    [currentUser],
  );

  /**
   * Checks a permission using supported AuthContext signatures.
   *
   * Access is denied by default if no permission checker exists.
   * System administrators receive full access.
   */
  const canViewModule = useCallback(
    (moduleNames?: string[]): boolean => {
      if (userIsAdministrator) {
        return true;
      }

      if (!moduleNames?.length) {
        return false;
      }

      const permissionChecker =
        auth.hasPermission ??
        auth.can;

      if (typeof permissionChecker !== 'function') {
        return false;
      }

      return moduleNames.some((moduleName) => {
        try {
          return Boolean(
            permissionChecker(moduleName, 'view') ||
            permissionChecker(moduleName, 'read') ||
            permissionChecker(`${moduleName}.view`) ||
            permissionChecker(`${moduleName}.read`) ||
            permissionChecker(moduleName),
          );
        } catch {
          return false;
        }
      });
    },
    [
      auth.can,
      auth.hasPermission,
      userIsAdministrator,
    ],
  );

  /**
   * Recursively filters sidebar entries.
   *
   * A parent menu remains visible when at least one child is visible.
   */
  const visibleMenuDefinitions = useMemo(() => {
    const filterItems = (
      items: AppMenuItem[],
    ): AppMenuItem[] =>
      items.reduce<AppMenuItem[]>(
        (result, item) => {
          const visibleChildren = item.children
            ? filterItems(item.children)
            : undefined;

          const hasVisibleChildren =
            Boolean(visibleChildren?.length);

          const hasDirectPermission =
            item.publicForAuthenticatedUsers === true ||
            canViewModule(item.permissionModules);

          if (
            !hasDirectPermission &&
            !hasVisibleChildren
          ) {
            return result;
          }

          result.push({
            ...item,
            children: hasVisibleChildren
              ? visibleChildren
              : undefined,
          });

          return result;
        },
        [],
      );

    return filterItems(MENU_DEFINITIONS);
  }, [canViewModule]);

  const menuItems = useMemo<AntMenuItem[]>(() => {
    const convertItems = (
      items: AppMenuItem[],
    ): AntMenuItem[] =>
      items.map((item) => ({
        key: item.key,
        icon: item.icon,
        label: item.label,
        children: item.children
          ? convertItems(item.children)
          : undefined,
      })) as AntMenuItem[];

    return convertItems(visibleMenuDefinitions);
  }, [visibleMenuDefinitions]);

  /**
   * Select the closest matching menu route.
   *
   * Example:
   * /dashboard/inventory/INV-001
   * selects /dashboard/inventory.
   */
  const selectedMenuKey = useMemo(() => {
    const collectKeys = (
      items: AppMenuItem[],
    ): string[] =>
      items.flatMap((item) => [
        item.key,
        ...(item.children
          ? collectKeys(item.children)
          : []),
      ]);

    const menuKeys = collectKeys(
      visibleMenuDefinitions,
    ).sort(
      (first, second) =>
        second.length - first.length,
    );

    const exactMatch = menuKeys.find(
      (key) => pathname === key,
    );

    if (exactMatch) {
      return exactMatch;
    }

    const nestedMatch = menuKeys.find(
      (key) =>
        key !== '/dashboard' &&
        pathname.startsWith(`${key}/`),
    );

    return nestedMatch || '/dashboard';
  }, [
    pathname,
    visibleMenuDefinitions,
  ]);

  const defaultOpenKeys = useMemo(() => {
    const openKeys: string[] = [];

    if (pathname.startsWith('/dashboard/master/')) {
      openKeys.push('/dashboard/master');
    }

    if (pathname.startsWith('/dashboard/reports/')) {
      openKeys.push('/dashboard/reports');
    }

    return openKeys;
  }, [pathname]);

  const breadcrumbItems = useMemo(() => {
    const segments = pathname
      .split('/')
      .filter(Boolean);

    return segments.map((segment, index) => {
      const href = `/${segments
        .slice(0, index + 1)
        .join('/')}`;

      const isLast =
        index === segments.length - 1;

      return {
        title: isLast ? (
          formatBreadcrumbLabel(segment)
        ) : (
          <button
            type="button"
            onClick={() => router.push(href)}
            style={{
              background: 'transparent',
              border: 0,
              color: '#1677ff',
              cursor: 'pointer',
              margin: 0,
              padding: 0,
            }}
          >
            {formatBreadcrumbLabel(segment)}
          </button>
        ),
      };
    });
  }, [
    pathname,
    router,
  ]);

  const handleMenuClick: MenuProps['onClick'] = ({
    key,
  }) => {
    if (
      typeof key !== 'string' ||
      key === pathname
    ) {
      return;
    }

    router.push(key);

    if (isMobile) {
      setCollapsed(true);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await auth.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      router.replace('/login');
      router.refresh();
      setLoggingOut(false);
    }
  };

  const handleUserMenuClick: MenuProps['onClick'] = ({
    key,
  }) => {
    switch (key) {
      case 'profile':
        router.push('/dashboard/profile');
        break;

      case 'settings':
        router.push('/dashboard/settings');
        break;

      case 'users':
        router.push('/dashboard/users');
        break;

      case 'logout':
        void handleLogout();
        break;

      default:
        break;
    }
  };

  const userMenuItems = useMemo<
    MenuProps['items']
  >(() => {
    const items: MenuProps['items'] = [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: 'My Profile',
      },
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: 'Settings',
      },
    ];

    if (
      userIsAdministrator ||
      canViewModule([
        'user',
        'users',
        'user_management',
        'security_admin',
      ])
    ) {
      items.push({
        type: 'divider',
      });

      items.push({
        key: 'users',
        icon: <TeamOutlined />,
        label: 'User Management',
      });
    }

    items.push({
      type: 'divider',
    });

    items.push({
      key: 'logout',
      icon: <LogoutOutlined />,
      label: loggingOut
        ? 'Signing out...'
        : 'Logout',
      danger: true,
      disabled: loggingOut,
    });

    return items;
  }, [
    canViewModule,
    loggingOut,
    userIsAdministrator,
  ]);

  const displayName =
    getUserDisplayName(currentUser);

  const roleName =
    getUserRoleName(currentUser);

  /**
   * Wait until the client and AuthContext are initialized.
   *
   * Spin is used in nested mode to avoid the Ant Design
   * warning about tip usage.
   */
  if (
    !mounted ||
    authLoading ||
    (!isAuthenticated && currentUser)
  ) {
    return (
      <main
        style={{
          alignItems: 'center',
          background: PAGE_BACKGROUND,
          display: 'flex',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Spin
          size="large"
          description="Loading your WMS session..."
        >
          <div
            style={{
              height: 120,
              width: 260,
            }}
          />
        </Spin>
      </main>
    );
  }

  /**
   * Do not render protected dashboard content while redirecting.
   */
  if (!isAuthenticated) {
    return (
      <main
        style={{
          alignItems: 'center',
          background: PAGE_BACKGROUND,
          display: 'flex',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Spin
          size="large"
          description="Redirecting to login..."
        >
          <div
            style={{
              height: 120,
              width: 260,
            }}
          />
        </Spin>
      </main>
    );
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: SIDEBAR_SELECTED_BLUE,
          colorBgLayout: PAGE_BACKGROUND,
          colorBgContainer: PAGE_BACKGROUND,
        },
        components: {
          Layout: {
            bodyBg: PAGE_BACKGROUND,
            headerBg: PAGE_BACKGROUND,
            siderBg: SIDEBAR_BLUE,
            triggerBg: SIDEBAR_SUBMENU_BLUE,
            triggerColor: '#ffffff',
          },
          Menu: {
            darkItemBg: SIDEBAR_BLUE,
            darkSubMenuItemBg: SIDEBAR_SUBMENU_BLUE,
            darkItemColor: '#dbeafe',
            darkItemHoverBg: SIDEBAR_HOVER_BLUE,
            darkItemHoverColor: '#ffffff',
            darkItemSelectedBg: SIDEBAR_SELECTED_BLUE,
            darkItemSelectedColor: '#ffffff',
            darkItemDisabledColor:
              'rgba(255, 255, 255, 0.35)',
          },
        },
      }}
    >
      <Layout
        style={{
          background: PAGE_BACKGROUND,
          minHeight: '100vh',
        }}
      >
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          collapsedWidth={isMobile ? 0 : 80}
          width={260}
          breakpoint="lg"
          style={{
            background: SIDEBAR_BLUE,
            boxShadow:
              '2px 0 10px rgba(15, 61, 117, 0.20)',
            height: '100vh',
            left: 0,
            overflow: 'auto',
            position: 'sticky',
            top: 0,
            zIndex: 200,
          }}
        >
          <div
            style={{
              alignItems: 'center',
              background: SIDEBAR_BLUE,
              borderBottom:
                '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              display: 'flex',
              fontSize: collapsed ? 14 : 18,
              fontWeight: 700,
              gap: 10,
              height: 64,
              justifyContent: 'center',
              overflow: 'hidden',
              padding: '0 16px',
              whiteSpace: 'nowrap',
            }}
          >
            <DatabaseOutlined
              style={{
                color: '#69b1ff',
                fontSize: collapsed ? 22 : 24,
              }}
            />

            {!collapsed && (
              <span>WMS System</span>
            )}
          </div>

          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedMenuKey]}
            defaultOpenKeys={defaultOpenKeys}
            items={menuItems}
            onClick={handleMenuClick}
            style={{
              background: SIDEBAR_BLUE,
              borderInlineEnd: 0,
              paddingBottom: 24,
            }}
          />
        </Sider>

        <Layout
          style={{
            background: PAGE_BACKGROUND,
            minWidth: 0,
          }}
        >
          <Header
            style={{
              alignItems: 'center',
              background: PAGE_BACKGROUND,
              borderBottom: '1px solid #f0f0f0',
              boxShadow:
                '0 2px 8px rgba(0, 0, 0, 0.06)',
              display: 'flex',
              height: 64,
              justifyContent: 'space-between',
              padding: isMobile
                ? '0 12px'
                : '0 24px',
              position: 'sticky',
              top: 0,
              zIndex: 100,
            }}
          >
            <Space
              size={isMobile ? 4 : 12}
              style={{
                minWidth: 0,
              }}
            >
              <Tooltip
                title={
                  collapsed
                    ? 'Open menu'
                    : 'Collapse menu'
                }
              >
                <Button
                  type="text"
                  aria-label={
                    collapsed
                      ? 'Open navigation menu'
                      : 'Collapse navigation menu'
                  }
                  icon={
                    collapsed ? (
                      <MenuUnfoldOutlined />
                    ) : (
                      <MenuFoldOutlined />
                    )
                  }
                  onClick={() =>
                    setCollapsed(
                      (current) => !current,
                    )
                  }
                  style={{
                    fontSize: 16,
                    height: 48,
                    width: 48,
                  }}
                />
              </Tooltip>

              {!isMobile && (
                <Breadcrumb
                  items={breadcrumbItems}
                  style={{
                    whiteSpace: 'nowrap',
                  }}
                />
              )}
            </Space>

            <Space size={isMobile ? 6 : 16}>
              <Tooltip title="Notifications">
                <Badge
                  count={0}
                  size="small"
                  overflowCount={99}
                >
                  <Button
                    type="text"
                    aria-label="Notifications"
                    icon={<BellOutlined />}
                  />
                </Badge>
              </Tooltip>

              <Dropdown
                trigger={['click']}
                menu={{
                  items: userMenuItems,
                  onClick: handleUserMenuClick,
                }}
                placement="bottomRight"
              >
                <Space
                  style={{
                    cursor: 'pointer',
                    maxWidth: isMobile
                      ? 130
                      : 260,
                    userSelect: 'none',
                  }}
                >
                  <Avatar
                    style={{
                      backgroundColor:
                        SIDEBAR_SELECTED_BLUE,
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(displayName)}
                  </Avatar>

                  {!isMobile && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        lineHeight: 1.2,
                        minWidth: 0,
                      }}
                    >
                      <Text
                        strong
                        ellipsis
                        style={{
                          maxWidth: 180,
                        }}
                      >
                        {displayName}
                      </Text>

                      {roleName && (
                        <Text
                          type="secondary"
                          ellipsis
                          style={{
                            fontSize: 12,
                            maxWidth: 180,
                          }}
                        >
                          {roleName}
                        </Text>
                      )}
                    </div>
                  )}

                  {userIsAdministrator &&
                    !isMobile && (
                      <Tag
                        color="blue"
                        icon={<LockOutlined />}
                        style={{
                          marginInlineEnd: 0,
                        }}
                      >
                        Admin
                      </Tag>
                    )}
                </Space>
              </Dropdown>
            </Space>
          </Header>

          <Content
            style={{
              background: PAGE_BACKGROUND,
              borderRadius: 8,
              margin: isMobile ? 12 : 24,
              minHeight:
                'calc(100vh - 112px)',
              overflow: 'auto',
              padding: isMobile ? 12 : 24,
            }}
          >
            {children}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}