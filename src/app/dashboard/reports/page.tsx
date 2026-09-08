'use client';

import { Card, Row, Col, Typography, Button, Space } from 'antd';
import {
  FileTextOutlined,
  DatabaseOutlined,
  SwapOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

export default function ReportsPage() {
  const router = useRouter();

  const reports = [
    {
      title: 'Inventory Report',
      description: 'View current inventory levels, batch details, and stock values',
      icon: <DatabaseOutlined style={{ fontSize: 32, color: '#1890ff' }} />,
      path: '/dashboard/reports/inventory',
    },
    {
      title: 'Movement History',
      description: 'Track all stock movements including transfers, adjustments, and depletions',
      icon: <SwapOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
      path: '/dashboard/reports/movement',
    },
    {
      title: 'GRN Report',
      description: 'View all goods received notes and receiving history',
      icon: <FileTextOutlined style={{ fontSize: 32, color: '#faad14' }} />,
      path: '/dashboard/reports/grn',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={4}>Reports Center</Title>
        <Text type="secondary">Select a report to view detailed analytics and insights</Text>
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          {reports.map((report) => (
            <Col xs={24} sm={12} lg={8} key={report.path}>
              <Card
                hoverable
                onClick={() => router.push(report.path)}
                style={{ height: '100%' }}
              >
                <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                  {report.icon}
                  <Title level={5} style={{ margin: 0 }}>{report.title}</Title>
                  <Text type="secondary">{report.description}</Text>
                  <Button type="link" style={{ padding: 0 }}>
                    View Report <ArrowRightOutlined />
                  </Button>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}