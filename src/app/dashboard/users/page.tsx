'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { getUsers, getRoles } from '@/lib/auth';

const { Title, Text } = Typography;

type UserRecord = {
  id?: string;
  userId: string;
  fullName?: string;
  name?: string;
  email?: string;
  roleId?: string;
  roleName?: string;
  status?: string;
  isActive?: boolean;
  lastLogin?: string;
  createdAt?: string;
};

type RoleRecord = {
  id?: string;
  roleId?: string;
  name?: string;
  roleName?: string;
};

function normalizeStatus(user: UserRecord): string {
  if (typeof user.isActive === 'boolean') {
    return user.isActive ? 'ACTIVE' : 'INACTIVE';
  }

  return String(user.status || 'ACTIVE').toUpperCase();
}

export default function UsersPage() {
  const { message } = App.useApp();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(() => {
    setLoading(true);

    try {
      const storedUsers = getUsers();
      const storedRoles = getRoles();

      setUsers(Array.isArray(storedUsers) ? storedUsers : []);
      setRoles(Array.isArray(storedRoles) ? storedRoles : []);
    } catch (error) {
      console.error('Unable to load users:', error);
      setUsers([]);
      message.error('Unable to load the user list.');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadUsers();

    const handleUsersUpdated = () => {
      loadUsers();
    };

    /*
     * The storage event handles updates from another browser tab.
     * wms:users-updated handles updates in the current tab.
     */
    window.addEventListener('storage', handleUsersUpdated);
    window.addEventListener('wms:users-updated', handleUsersUpdated);

    return () => {
      window.removeEventListener('storage', handleUsersUpdated);
      window.removeEventListener('wms:users-updated', handleUsersUpdated);
    };
  }, [loadUsers]);

  const roleMap = useMemo(() => {
    const map = new Map<string, string>();

    roles.forEach((role) => {
      const roleId = String(role.roleId || role.id || '');
      const roleName = String(role.roleName || role.name || roleId);

      if (roleId) {
        map.set(roleId, roleName);
      }
    });

    return map;
  }, [roles]);

  const filteredUsers = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    if (!search) {
      return users;
    }

    return users.filter((user) => {
      const roleName =
        user.roleName ||
        roleMap.get(String(user.roleId || '')) ||
        user.roleId ||
        '';

      return [
        user.userId,
        user.fullName,
        user.name,
        user.email,
        roleName,
        user.status,
      ].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(search),
      );
    });
  }, [roleMap, searchText, users]);

  const columns: ColumnsType<UserRecord> = [
    {
      title: 'User',
      key: 'user',
      render: (_, user) => {
        const displayName =
          user.fullName || user.name || user.userId || 'Unnamed user';

        return (
          <Space>
            <Avatar icon={<UserOutlined />} />

            <div>
              <Text strong>{displayName}</Text>

              <div>
                <Text type="secondary">
                  {user.userId}
                  {user.email ? ` · ${user.email}` : ''}
                </Text>
              </div>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Role',
      key: 'role',
      render: (_, user) => {
        const roleName =
          user.roleName ||
          roleMap.get(String(user.roleId || '')) ||
          user.roleId ||
          'Not assigned';

        return <Tag color="blue">{roleName}</Tag>;
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 130,
      render: (_, user) => {
        const status = normalizeStatus(user);
        const active = status === 'ACTIVE';

        return (
          <Tag color={active ? 'green' : 'red'}>
            {active ? 'Active' : 'Inactive'}
          </Tag>
        );
      },
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      width: 190,
      render: (value: string | undefined) =>
        value ? new Date(value).toLocaleString() : 'Never',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      render: (_, user) => (
        <Button
          type="link"
          icon={<EditOutlined />}
          onClick={() => {
            /*
             * Connect this button to the existing Add/Edit User modal
             * currently located under Settings.
             */
            console.log('Edit user:', user);
          }}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <main style={{ padding: 24 }}>
      <Card>
        <Space
          orientation="vertical"
          size={20}
          style={{ width: '100%' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <Title level={2} style={{ margin: 0 }}>
                User Management
              </Title>

              <Text type="secondary">
                Manage system users, roles and account access.
              </Text>
            </div>

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
                onClick={() => {
                  /*
                   * Connect this to the existing Add User modal.
                   */
                  console.log('Open Add User modal');
                }}
              >
                Add User
              </Button>
            </Space>
          </div>

          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search User ID, name, email or role"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            style={{ maxWidth: 420 }}
          />

          <Table<UserRecord>
            rowKey={(user) => user.id || user.userId}
            loading={loading}
            columns={columns}
            dataSource={filteredUsers}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `${total} users`,
            }}
            locale={{
              emptyText: (
                <Empty description="No users found in wms_users" />
              ),
            }}
            scroll={{ x: 850 }}
          />
        </Space>
      </Card>
    </main>
  );
}