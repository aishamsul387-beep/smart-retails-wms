'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Card,
  Row,
  Col,
  Statistic,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Tag,
  message,
  Empty,
} from 'antd';
import {
  SearchOutlined,
  ExportOutlined,
  FileExcelOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';

const { Title, Text } = Typography;

const GRN_STORAGE_KEY = 'wms_grn_records';

export default function GRNReportPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem(GRN_STORAGE_KEY);
      if (stored) {
        setData(JSON.parse(stored));
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('Error loading GRN data:', error);
      message.error('Failed to load GRN data');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let filtered = [...data];
    
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (grn) =>
          grn.grnNo?.toLowerCase().includes(search) ||
          grn.supplier?.toLowerCase().includes(search) ||
          grn.supplierName?.toLowerCase().includes(search) ||
          grn.poNo?.toLowerCase().includes(search) ||
          grn.invoiceNo?.toLowerCase().includes(search)
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter((grn) => grn.status === statusFilter);
    }
    
    return filtered.sort((a, b) => new Date(b.grnDate || b.createdAt).getTime() - new Date(a.grnDate || a.createdAt).getTime());
  }, [data, searchText, statusFilter]);

  const summary = useMemo(() => {
    const totalGRNs = data.length;
    const totalItems = data.reduce((sum, grn) => sum + (grn.items?.length || 0), 0);
    const totalQty = data.reduce(
      (sum, grn) => sum + (grn.items?.reduce((itemSum: number, item: any) => itemSum + (item.qty || 0), 0) || 0),
      0
    );
    const receivedGRNs = data.filter((grn) => grn.status === 'Received').length;
    
    return { totalGRNs, totalItems, totalQty, receivedGRNs };
  }, [data]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'default';
      case 'Received':
        return 'green';
      case 'Cancelled':
        return 'red';
      default:
        return 'default';
    }
  };

  const handleExportCSV = () => {
    try {
      const exportData = filteredData.map((grn) => ({
        'GRN No.': grn.grnNo,
        'Supplier': grn.supplier,
        'Supplier Name': grn.supplierName,
        'PO No.': grn.poNo || '',
        'DO No.': grn.doNo || '',
        'Invoice No.': grn.invoiceNo || '',
        'GRN Date': grn.grnDate,
        'Status': grn.status,
        'Items': grn.items?.length || 0,
        'Total Qty': grn.items?.reduce((sum: number, item: any) => sum + (item.qty || 0), 0) || 0,
      }));
      exportToCSV(exportData, 'grn_report');
      message.success('Export to CSV successful');
    } catch (error) {
      console.error('Export error:', error);
      message.error('Failed to export CSV');
    }
  };

  const handleExportExcel = () => {
    try {
      const exportData = filteredData.map((grn) => ({
        'GRN No.': grn.grnNo,
        'Supplier': grn.supplier,
        'Supplier Name': grn.supplierName,
        'PO No.': grn.poNo || '',
        'DO No.': grn.doNo || '',
        'Invoice No.': grn.invoiceNo || '',
        'GRN Date': grn.grnDate,
        'Status': grn.status,
        'Items': grn.items?.length || 0,
        'Total Qty': grn.items?.reduce((sum: number, item: any) => sum + (item.qty || 0), 0) || 0,
      }));
      exportToExcel(exportData, 'grn_report');
      message.success('Export to Excel successful');
    } catch (error) {
      console.error('Export error:', error);
      message.error('Failed to export Excel');
    }
  };

  const columns = [
    {
      title: 'GRN No.',
      dataIndex: 'grnNo',
      key: 'grnNo',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Supplier',
      key: 'supplier',
      render: (_, record: any) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.supplierName || record.supplier}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.supplier}</Text>
        </Space>
      ),
    },
    {
      title: 'PO No.',
      dataIndex: 'poNo',
      key: 'poNo',
      render: (text: string) => text || '-',
    },
    {
      title: 'Invoice No.',
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      render: (text: string) => text || '-',
    },
    {
      title: 'GRN Date',
      dataIndex: 'grnDate',
      key: 'grnDate',
      render: (text: string) => dayjs(text).format('DD/MM/YYYY'),
    },
    {
      title: 'Items',
      key: 'items',
      render: (_, record: any) => <Tag>{record.items?.length || 0} items</Tag>,
    },
    {
      title: 'Total Qty',
      key: 'totalQty',
      render: (_, record: any) => (
        <Text strong>
          {record.items?.reduce((sum: number, item: any) => sum + (item.qty || 0), 0) || 0}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col>
            <Space orientation="vertical" size={0}>
              <Title level={4} style={{ margin: 0 }}>
                <FileTextOutlined /> GRN Report
              </Title>
              <Text type="secondary">View all goods received notes and receiving history</Text>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ExportOutlined />} onClick={handleExportCSV}>
                Export CSV
              </Button>
              <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>
                Export Excel
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Summary Cards */}
        <Row gutter={16} style={{ marginTop: 24, marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Total GRNs" value={summary.totalGRNs} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Total Items" value={summary.totalItems} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Total Qty" value={summary.totalQty} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Received GRNs" value={summary.receivedGRNs} styles={{ content: { color: '#3f8600' } }} />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search by GRN no., supplier, PO, invoice"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'Draft', label: 'Draft' },
                { value: 'Received', label: 'Received' },
                { value: 'Cancelled', label: 'Cancelled' },
              ]}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showTotal: (total) => `Total ${total} records`,
          }}
          locale={{
            emptyText: <Empty description="No GRN data found" />,
          }}
        />
      </Card>
    </div>
  );
}