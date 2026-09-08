'use client'

import { useState } from 'react'
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Badge,
  Button,
  theme,
} from 'antd'
import {
  DashboardOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  BarChartOutlined,
  SettingOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BoxPlotOutlined,
} from '@ant-design/icons'
import { useRouter, usePathname } from 'next/navigation'

const { Header, Sider, Content } = Layout

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { token } = theme.useToken()

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/dashboard/inventory', icon: <BoxPlotOutlined />, label: 'Inventory' },
    { key: '/dashboard/inbound', icon: <InboxOutlined />, label: 'Inbound' },
    { key: '/dashboard/outbound', icon: <ShoppingCartOutlined />, label: 'Outbound' },
    { key: '/dashboard/purchase', icon: <ShoppingOutlined />, label: 'Purchase' },
    { key: '/dashboard/reports', icon: <BarChartOutlined />, label: 'Reports' },
    { key: '/dashboard/settings', icon: <SettingOutlined />, label: 'Settings' },
  ]

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: 'My Profile' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
  ]

  const handleUserMenu = ({ key }: { key: string }) => {
    if (key === 'logout') router.push('/')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          background: '#001529',
          boxShadow: '2px 0 8px rgba(0,0,0,0.3)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {collapsed ? (
            <span style={{ color: '#1890ff', fontSize: 24, fontWeight: 'bold' }}>
              W
            </span>
          ) : (
            <span style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
              WMS System
            </span>
          )}
        </div>

        {/* Menu */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname || '']}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
          style={{ marginTop: 8 }}
        />
      </Sider>

      <Layout>
        {/* Header */}
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, width: 64, height: 64 }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={5} size="small">
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: 18 }} />}
                style={{ width: 40, height: 40 }}
              />
            </Badge>

            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: handleUserMenu,
              }}
              placement="bottomRight"
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 8,
                  transition: 'background 0.2s',
                }}
              >
                <Avatar
                  style={{ backgroundColor: '#1890ff' }}
                  icon={<UserOutlined />}
                />
                <span style={{ fontWeight: 500 }}>Admin</span>
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* Main Content */}
        <Content style={{ margin: 24, minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}