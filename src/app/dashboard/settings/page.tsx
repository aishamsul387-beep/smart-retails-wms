'use client';

import {
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  BellOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  GlobalOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  changePassword,
  createUser,
  deleteUser,
  getActiveRoles,
  getCurrentRole,
  getCurrentUser,
  getUsers,
  initializeAuthStorage,
  updateUser,
} from '@/lib/auth';

import type { WMSRole, WMSUser } from '@/lib/permissions';

const { Title, Text } = Typography;

const WAREHOUSE_SETTINGS_KEY = 'wms_warehouse_settings';
const NOTIFICATION_SETTINGS_KEY = 'wms_notification_settings';

interface UserFormValues {
  userId: string;
  fullName: string;
  email?: string;
  phone?: string;
  roleId: string;
  section?: string;
  position?: string;
  assignedPlants?: string[];
  assignedLocations?: string[];
  status: string;
  password?: string;
  confirmPassword?: string;
}

interface ProfileFormValues {
  fullName: string;
  email?: string;
  phone?: string;
}

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface WarehouseFormValues {
  warehouseName: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  currency: string;
  timezone: string;
}

interface NotificationSettings {
  email: boolean;
  stock: boolean;
  order: boolean;
  report: boolean;
}

function readObject<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return {
      ...fallback,
      ...(JSON.parse(value) as Partial<T>),
    };
  } catch {
    return fallback;
  }
}

function formatDate(value?: string): string {
  if (!value) {
    return 'Never';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function isActiveUser(user: WMSUser): boolean {
  if (typeof user.isActive === 'boolean') {
    return user.isActive;
  }

  const status = String(user.status || 'Active').toLowerCase();

  return ['active', 'enabled', 'true', '1'].includes(status);
}

function getRoleValue(role: WMSRole): string {
  return String(role.id || role.code || '');
}

export default function SettingsPage() {
  const [profileForm] = Form.useForm<ProfileFormValues>();
  const [warehouseForm] = Form.useForm<WarehouseFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [userForm] = Form.useForm<UserFormValues>();

  const [users, setUsers] = useState<WMSUser[]>([]);
  const [roles, setRoles] = useState<WMSRole[]>([]);
  const [currentUser, setCurrentUserState] = useState<WMSUser | null>(
    null,
  );
  const [currentRoleName, setCurrentRoleName] =
    useState('Not assigned');

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<WMSUser | null>(
    null,
  );

  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>({
      email: true,
      stock: true,
      order: false,
      report: true,
    });

  const loadUsers = useCallback(() => {
    setLoadingUsers(true);

    try {
      setUsers(getUsers());
      setRoles(getActiveRoles());

      const authenticatedUser = getCurrentUser();
      const authenticatedRole = getCurrentRole();

      setCurrentUserState(authenticatedUser);
      setCurrentRoleName(
        authenticatedRole?.name ||
          authenticatedUser?.roleName ||
          authenticatedUser?.roleCode ||
          'Not assigned',
      );

      if (authenticatedUser) {
        profileForm.setFieldsValue({
          fullName:
            authenticatedUser.fullName ||
            authenticatedUser.name ||
            authenticatedUser.userId,
          email: authenticatedUser.email || '',
          phone: authenticatedUser.phone || '',
        });
      }
    } catch (error) {
      console.error('Unable to load users:', error);
      message.error('Unable to load the user list.');
    } finally {
      setLoadingUsers(false);
    }
  }, [profileForm]);

  useEffect(() => {
    const initialize = async () => {
      await initializeAuthStorage();

      const savedWarehouse = readObject<WarehouseFormValues>(
        WAREHOUSE_SETTINGS_KEY,
        {
          warehouseName: 'WMS Central Warehouse',
          address: 'No. 12, Jalan Industri 3, Shah Alam',
          city: 'Shah Alam',
          state: 'Selangor',
          postcode: '40150',
          currency: 'MYR',
          timezone: 'Asia/Kuala_Lumpur',
        },
      );

      const savedNotifications = readObject<NotificationSettings>(
        NOTIFICATION_SETTINGS_KEY,
        {
          email: true,
          stock: true,
          order: false,
          report: true,
        },
      );

      warehouseForm.setFieldsValue(savedWarehouse);
      setNotificationSettings(savedNotifications);
      loadUsers();
    };

    void initialize();

    const handleUsersUpdated = () => {
      loadUsers();
    };

    window.addEventListener('wms:users-updated', handleUsersUpdated);
    window.addEventListener('storage', handleUsersUpdated);

    return () => {
      window.removeEventListener(
        'wms:users-updated',
        handleUsersUpdated,
      );
      window.removeEventListener('storage', handleUsersUpdated);
    };
  }, [loadUsers, warehouseForm]);

  const roleMap = useMemo(() => {
    const map = new Map<string, string>();

    roles.forEach((role) => {
      if (role.id) {
        map.set(String(role.id), role.name);
      }

      if (role.code) {
        map.set(String(role.code), role.name);
      }
    });

    return map;
  }, [roles]);

  const openAddUserModal = () => {
    setEditingUser(null);
    userForm.resetFields();

    userForm.setFieldsValue({
      status: 'Active',
      assignedPlants: [],
      assignedLocations: [],
    });

    setUserModalOpen(true);
  };

  const openEditUserModal = (user: WMSUser) => {
    setEditingUser(user);

    userForm.setFieldsValue({
      userId: user.userId,
      fullName: user.fullName || user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      roleId: user.roleId || user.roleCode || '',
      section: user.section || '',
      position: user.position || '',
      assignedPlants: user.assignedPlants || [],
      assignedLocations: user.assignedLocations || [],
      status: isActiveUser(user) ? 'Active' : 'Inactive',
      password: undefined,
      confirmPassword: undefined,
    });

    setUserModalOpen(true);
  };

  const handleUserModalCancel = () => {
    if (savingUser) {
      return;
    }

    setUserModalOpen(false);
    setEditingUser(null);
    userForm.resetFields();
  };

  const handleSaveUser = async () => {
    try {
      const values = await userForm.validateFields();
      setSavingUser(true);

      if (editingUser) {
        const result = updateUser(
          editingUser.id || editingUser.userId,
          {
            userId: values.userId.trim(),
            fullName: values.fullName.trim(),
            name: values.fullName.trim(),
            email: values.email?.trim() || '',
            phone: values.phone?.trim() || '',
            roleId: values.roleId,
            section: values.section?.trim() || '',
            position: values.position?.trim() || '',
            assignedPlants: values.assignedPlants || [],
            assignedLocations: values.assignedLocations || [],
            status: values.status,
          },
          currentUser,
        );

        if (!result.success) {
          message.error(result.message);
          return;
        }

        message.success(result.message);
      } else {
        const result = await createUser(
          {
            userId: values.userId.trim(),
            fullName: values.fullName.trim(),
            name: values.fullName.trim(),
            email: values.email?.trim() || '',
            phone: values.phone?.trim() || '',
            roleId: values.roleId,
            section: values.section?.trim() || '',
            position: values.position?.trim() || '',
            assignedPlants: values.assignedPlants || [],
            assignedLocations: values.assignedLocations || [],
            status: values.status,
            password: values.password || '',
            mustChangePassword: true,
          },
          currentUser,
        );

        if (!result.success) {
          message.error(result.message);
          return;
        }

        message.success(result.message);
      }

      setUserModalOpen(false);
      setEditingUser(null);
      userForm.resetFields();
      loadUsers();
    } catch (error) {
      const formError = error as {
        errorFields?: unknown[];
      };

      if (!formError?.errorFields) {
        console.error('Save user error:', error);
        message.error('Unable to save the user.');
      }
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = (user: WMSUser) => {
    const result = deleteUser(
      user.id || user.userId,
      currentUser,
    );

    if (!result.success) {
      message.error(result.message);
      return;
    }

    message.success(result.message);
    loadUsers();
  };

  const handleSaveProfile = async () => {
    if (!currentUser) {
      message.error('No authenticated user was found.');
      return;
    }

    try {
      const values = await profileForm.validateFields();
      setSavingProfile(true);

      const result = updateUser(
        currentUser.id || currentUser.userId,
        {
          fullName: values.fullName.trim(),
          name: values.fullName.trim(),
          email: values.email?.trim() || '',
          phone: values.phone?.trim() || '',
        },
        currentUser,
      );

      if (!result.success) {
        message.error(result.message);
        return;
      }

      message.success('Profile settings saved successfully.');
      loadUsers();
    } catch (error) {
      const formError = error as {
        errorFields?: unknown[];
      };

      if (!formError?.errorFields) {
        console.error('Profile update error:', error);
        message.error('Unable to update the profile.');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveWarehouse = async () => {
    try {
      const values = await warehouseForm.validateFields();

      window.localStorage.setItem(
        WAREHOUSE_SETTINGS_KEY,
        JSON.stringify(values),
      );

      message.success('Warehouse settings saved successfully.');
    } catch {
      // Ant Design displays validation errors.
    }
  };

  const handleSaveNotifications = () => {
    window.localStorage.setItem(
      NOTIFICATION_SETTINGS_KEY,
      JSON.stringify(notificationSettings),
    );

    message.success('Notification preferences saved.');
  };

  const handleSavePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      setSavingPassword(true);

      const result = await changePassword(
        values.currentPassword,
        values.newPassword,
      );

      if (!result.success) {
        message.error(result.message);
        return;
      }

      passwordForm.resetFields();
      message.success(result.message);
    } catch (error) {
      const formError = error as {
        errorFields?: unknown[];
      };

      if (!formError?.errorFields) {
        console.error('Password update error:', error);
        message.error('Unable to update the password.');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const userColumns: ColumnsType<WMSUser> = [
    {
      title: 'User',
      key: 'user',
      render: (_, user) => (
        <Space>
          <Avatar
            style={{ backgroundColor: '#1677ff' }}
            icon={<UserOutlined />}
          />

          <div>
            <Text strong>
              {user.fullName || user.name || user.userId}
            </Text>

            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {user.userId}
                {user.email ? ` · ${user.email}` : ''}
              </Text>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      key: 'role',
      render: (_, user) => {
        const roleName =
          user.roleName ||
          roleMap.get(String(user.roleId || '')) ||
          roleMap.get(String(user.roleCode || '')) ||
          user.roleCode ||
          user.roleId ||
          'Not assigned';

        return <Tag color="blue">{roleName}</Tag>;
      },
    },
    {
      title: 'Section / Position',
      key: 'assignment',
      responsive: ['lg'],
      render: (_, user) => (
        <div>
          <div>{user.section || 'Not assigned'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {user.position || 'No position'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, user) => {
        const active = isActiveUser(user);

        return (
          <Tag color={active ? 'green' : 'red'}>
            {active ? 'Active' : 'Inactive'}
          </Tag>
        );
      },
    },
    {
      title: 'Last Login',
      key: 'lastLoginAt',
      width: 180,
      responsive: ['md'],
      render: (_, user) => (
        <Text type="secondary">
          {formatDate(user.lastLoginAt)}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 190,
      render: (_, user) => {
        const isCurrentUser =
          currentUser &&
          String(currentUser.id || currentUser.userId) ===
            String(user.id || user.userId);

        return (
          <Space size={4}>
            <Button
              size="small"
              type="link"
              icon={<EditOutlined />}
              onClick={() => openEditUserModal(user)}
            >
              Edit
            </Button>

            <Popconfirm
              title="Delete user"
              description={`Delete ${user.fullName || user.userId}?`}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              disabled={Boolean(isCurrentUser)}
              onConfirm={() => handleDeleteUser(user)}
            >
              <Button
                size="small"
                type="link"
                danger
                disabled={Boolean(isCurrentUser)}
                icon={<DeleteOutlined />}
              >
                Remove
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          ⚙️ System Settings
        </Title>

        <Text type="secondary">
          Manage WMS configuration, preferences and system users.
        </Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} xl={12}>
          <Card title={<><UserOutlined /> Profile Settings</>}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Avatar
                size={80}
                style={{
                  backgroundColor: '#1677ff',
                  fontSize: 32,
                }}
                icon={<UserOutlined />}
              />

              <div style={{ marginTop: 8 }}>
                <Text strong>
                  {currentUser?.fullName ||
                    currentUser?.name ||
                    currentUser?.userId ||
                    'User'}
                </Text>

                <br />

                <Tag color="blue">{currentRoleName}</Tag>
              </div>
            </div>

            <Form
              form={profileForm}
              layout="vertical"
              onFinish={handleSaveProfile}
            >
              <Form.Item
                label="Full Name"
                name="fullName"
                rules={[
                  {
                    required: true,
                    message: 'Full name is required.',
                  },
                ]}
              >
                <Input prefix={<UserOutlined />} />
              </Form.Item>

              <Form.Item
                label="Email Address"
                name="email"
                rules={[
                  {
                    type: 'email',
                    message: 'Enter a valid email address.',
                  },
                ]}
              >
                <Input prefix={<GlobalOutlined />} />
              </Form.Item>

              <Form.Item label="Phone Number" name="phone">
                <Input />
              </Form.Item>

              <Form.Item label="Role">
                <Input value={currentRoleName} disabled />
              </Form.Item>

              <Button
                type="primary"
                icon={<SaveOutlined />}
                block
                htmlType="submit"
                loading={savingProfile}
              >
                Save Profile
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            title={
              <>
                <GlobalOutlined /> Warehouse Configuration
              </>
            }
          >
            <Form
              form={warehouseForm}
              layout="vertical"
              onFinish={handleSaveWarehouse}
            >
              <Form.Item
                label="Warehouse Name"
                name="warehouseName"
                rules={[
                  {
                    required: true,
                    message: 'Warehouse name is required.',
                  },
                ]}
              >
                <Input />
              </Form.Item>

              <Form.Item label="Address" name="address">
                <Input />
              </Form.Item>

              <Row gutter={12}>
                <Col span={16}>
                  <Form.Item label="City" name="city">
                    <Input />
                  </Form.Item>
                </Col>

                <Col span={8}>
                  <Form.Item label="Postcode" name="postcode">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="State" name="state">
                <Select
                  options={[
                    { value: 'Selangor', label: 'Selangor' },
                    { value: 'KL', label: 'Kuala Lumpur' },
                    { value: 'Johor', label: 'Johor' },
                    { value: 'Penang', label: 'Penang' },
                  ]}
                />
              </Form.Item>

              <Form.Item label="Currency" name="currency">
                <Select
                  options={[
                    {
                      value: 'MYR',
                      label: '🇲🇾 MYR - Malaysian Ringgit',
                    },
                    {
                      value: 'USD',
                      label: '🇺🇸 USD - US Dollar',
                    },
                    {
                      value: 'SGD',
                      label: '🇸🇬 SGD - Singapore Dollar',
                    },
                  ]}
                />
              </Form.Item>

              <Form.Item label="Timezone" name="timezone">
                <Select
                  options={[
                    {
                      value: 'Asia/Kuala_Lumpur',
                      label: 'Asia/Kuala_Lumpur (GMT+8)',
                    },
                    {
                      value: 'Asia/Singapore',
                      label: 'Asia/Singapore (GMT+8)',
                    },
                  ]}
                />
              </Form.Item>

              <Button
                type="primary"
                icon={<SaveOutlined />}
                block
                htmlType="submit"
                style={{
                  background: '#52c41a',
                  borderColor: '#52c41a',
                }}
              >
                Save Warehouse Config
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} xl={12}>
          <Card
            title={
              <>
                <BellOutlined /> Notification Settings
              </>
            }
          >
            <Space
              orientation="vertical"
              size={18}
              style={{ width: '100%' }}
            >
              <SettingSwitch
                title="📧 Email Notifications"
                description="Receive alerts via email"
                checked={notificationSettings.email}
                onChange={(checked) =>
                  setNotificationSettings((current) => ({
                    ...current,
                    email: checked,
                  }))
                }
              />

              <Divider style={{ margin: 0 }} />

              <SettingSwitch
                title="📦 Low Stock Alerts"
                description="Alert when stock is below minimum"
                checked={notificationSettings.stock}
                onChange={(checked) =>
                  setNotificationSettings((current) => ({
                    ...current,
                    stock: checked,
                  }))
                }
              />

              <Divider style={{ margin: 0 }} />

              <SettingSwitch
                title="🛒 New Order Notifications"
                description="Alert on new purchase orders"
                checked={notificationSettings.order}
                onChange={(checked) =>
                  setNotificationSettings((current) => ({
                    ...current,
                    order: checked,
                  }))
                }
              />

              <Divider style={{ margin: 0 }} />

              <SettingSwitch
                title="📊 Weekly Reports"
                description="Automatically send a weekly summary"
                checked={notificationSettings.report}
                onChange={(checked) =>
                  setNotificationSettings((current) => ({
                    ...current,
                    report: checked,
                  }))
                }
              />

              <Button
                type="primary"
                icon={<SaveOutlined />}
                block
                onClick={handleSaveNotifications}
              >
                Save Notifications
              </Button>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            title={
              <>
                <LockOutlined /> Security & Password
              </>
            }
          >
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handleSavePassword}
            >
              <Form.Item
                label="Current Password"
                name="currentPassword"
                rules={[
                  {
                    required: true,
                    message: 'Current password is required.',
                  },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Enter current password"
                />
              </Form.Item>

              <Form.Item
                label="New Password"
                name="newPassword"
                rules={[
                  {
                    required: true,
                    message: 'New password is required.',
                  },
                  {
                    min: 8,
                    message:
                      'Password must contain at least 8 characters.',
                  },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Enter new password"
                />
              </Form.Item>

              <Form.Item
                label="Confirm New Password"
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                  {
                    required: true,
                    message: 'Please confirm the new password.',
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (
                        !value ||
                        getFieldValue('newPassword') === value
                      ) {
                        return Promise.resolve();
                      }

                      return Promise.reject(
                        new Error('The passwords do not match.'),
                      );
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Confirm new password"
                />
              </Form.Item>

              <Divider />

              <Space
                orientation="vertical"
                size={16}
                style={{ width: '100%' }}
              >
                <SettingSwitch
                  title="Two-Factor Authentication"
                  description="Extra security layer"
                  checked={false}
                  onChange={() =>
                    message.info(
                      'Two-factor authentication requires a server-side authentication service.',
                    )
                  }
                />

                <SettingSwitch
                  title="Auto Logout (30 min)"
                  description="Automatically end inactive sessions"
                  checked
                  onChange={() =>
                    message.info(
                      'Session timeout can be connected to AuthContext.',
                    )
                  }
                />
              </Space>

              <Button
                type="primary"
                icon={<SaveOutlined />}
                block
                danger
                htmlType="submit"
                loading={savingPassword}
                style={{ marginTop: 20 }}
              >
                Update Password
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <>
            <TeamOutlined /> User Management
          </>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadUsers}
            >
              Refresh
            </Button>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openAddUserModal}
            >
              Add User
            </Button>
          </Space>
        }
      >
        <Table<WMSUser>
          rowKey={(user) => user.id || user.userId}
          columns={userColumns}
          dataSource={users}
          loading={loadingUsers}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${total} users`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Card
        style={{
          marginTop: 16,
          background: '#f6ffed',
          borderColor: '#b7eb8f',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 8]}>
          <Col>
            <Text strong>🖥️ System Information</Text>

            <br />

            <Text type="secondary">
              WMS System v1.0.0 | Next.js + Ant Design
            </Text>
          </Col>

          <Col>
            <Tag
              color="green"
              icon={<CheckCircleOutlined />}
              style={{ fontSize: 14, padding: '4px 12px' }}
            >
              System Online
            </Tag>
          </Col>
        </Row>
      </Card>

      <Modal
        title={
          editingUser ? (
            <>
              <EditOutlined /> Edit User
            </>
          ) : (
            <>
              <PlusOutlined /> Add New User
            </>
          )
        }
        open={userModalOpen}
        onOk={() => void handleSaveUser()}
        onCancel={handleUserModalCancel}
        okText={editingUser ? 'Save Changes' : 'Add User'}
        confirmLoading={savingUser}
        destroyOnHidden
        width={720}
      >
        <Form
          form={userForm}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="User ID"
                name="userId"
                rules={[
                  {
                    required: true,
                    message: 'User ID is required.',
                  },
                  {
                    pattern: /^[A-Za-z0-9._-]+$/,
                    message:
                      'Use letters, numbers, dots, underscores or hyphens only.',
                  },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="Example: john.warehouse"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Full Name"
                name="fullName"
                rules={[
                  {
                    required: true,
                    message: 'Full name is required.',
                  },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="Enter full name"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Email Address"
                name="email"
                rules={[
                  {
                    type: 'email',
                    message: 'Enter a valid email address.',
                  },
                ]}
              >
                <Input
                  prefix={<GlobalOutlined />}
                  placeholder="user@wms.com"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Phone Number" name="phone">
                <Input placeholder="+60 12-345 6789" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Role"
                name="roleId"
                rules={[
                  {
                    required: true,
                    message: 'Please select a role.',
                  },
                ]}
              >
                <Select
                  placeholder="Select role"
                  options={roles.map((role) => ({
                    value: getRoleValue(role),
                    label: role.name,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Status"
                name="status"
                rules={[
                  {
                    required: true,
                    message: 'Please select a status.',
                  },
                ]}
              >
                <Select
                  options={[
                    {
                      value: 'Active',
                      label: 'Active',
                    },
                    {
                      value: 'Inactive',
                      label: 'Inactive',
                    },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Section" name="section">
                <Input placeholder="Example: Warehouse Operations" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Position" name="position">
                <Input placeholder="Example: Inventory Controller" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Assigned Plants"
                name="assignedPlants"
              >
                <Select
                  mode="tags"
                  tokenSeparators={[',']}
                  placeholder="Enter plant codes"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Assigned Locations"
                name="assignedLocations"
              >
                <Select
                  mode="tags"
                  tokenSeparators={[',']}
                  placeholder="Enter location codes"
                />
              </Form.Item>
            </Col>
          </Row>

          {!editingUser && (
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Temporary Password"
                  name="password"
                  rules={[
                    {
                      required: true,
                      message:
                        'Temporary password is required.',
                    },
                    {
                      min: 8,
                      message:
                        'Password must contain at least 8 characters.',
                    },
                  ]}
                  extra="Must include uppercase, lowercase, number and special character."
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Set temporary password"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label="Confirm Password"
                  name="confirmPassword"
                  dependencies={['password']}
                  rules={[
                    {
                      required: true,
                      message: 'Please confirm the password.',
                    },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (
                          !value ||
                          getFieldValue('password') === value
                        ) {
                          return Promise.resolve();
                        }

                        return Promise.reject(
                          new Error(
                            'The passwords do not match.',
                          ),
                        );
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Confirm temporary password"
                  />
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form>
      </Modal>
    </div>
  );
}

interface SettingSwitchProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SettingSwitch({
  title,
  description,
  checked,
  onChange,
}: SettingSwitchProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <Text type="secondary">{description}</Text>
      </div>

      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}