'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, Typography, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true)

    // Simulate loading
    setTimeout(() => {
      if (
        values.email === 'aishamsul387@wms.com' &&
        values.password === 'admin123'
      ) {
        message.success('Login successful!')
        router.push('/dashboard')
      } else {
        message.error('Invalid email or password!')
        setLoading(false)
      }
    }, 1000)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #001529 0%, #003366 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card
        style={{
          width: 400,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ margin: 0 }}>
            WMS System
          </Title>
          <Text type="secondary">Warehouse Management System</Text>
        </div>

        {/* Form */}
        <Form
          name="login"
          onFinish={handleLogin}
          layout="vertical"
          initialValues={{
            email: 'aishamsul387@wms.com',
            password: 'admin123',
          }}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, message: 'Please enter your email!' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Enter email"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Please enter your password!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter password"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              style={{ borderRadius: 6 }}
            >
              Sign In
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Default: aishamsul387@wms.com / admin123
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  )
}