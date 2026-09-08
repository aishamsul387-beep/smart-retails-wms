'use client';

import { useEffect, useMemo, useState } from 'react';
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
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  ExportOutlined,
  FileExcelOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';

const { Title, Text } = Typography;

const INVENTORY_STORAGE_KEY = 'wms_inventory';

type InventoryStatus = 'Active' | 'Inactive' | string;

interface RawInventoryRecord {
  [key: string]: any;
}

interface RawBatchRecord {
  [key: string]: any;
}

interface NormalizedInventoryRow {
  _rowKey: string;
  id: string;
  productCode: string;
  productName: string;
  batchNo: string;
  expiryDate: string;
  qty: number;
  uom: string;
  plant: string;
  location: string;
  status: InventoryStatus;
  createdAt: string;
  updatedAt: string;
}

function toText(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value);
}

function toNumber(value: unknown): number {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed;
}

function formatDate(value: string): string {
  if (!value) {
    return '-';
  }

  const parsed = dayjs(value);

  if (parsed.isValid()) {
    return parsed.format('DD/MM/YYYY');
  }

  return value;
}

function normalizeStatus(value: unknown): InventoryStatus {
  const status = toText(value).trim();

  if (!status) {
    return 'Active';
  }

  if (status.toLowerCase() === 'inactive') {
    return 'Inactive';
  }

  if (status.toLowerCase() === 'active') {
    return 'Active';
  }

  return status;
}

function getBatchArray(item: RawInventoryRecord): RawBatchRecord[] {
  if (Array.isArray(item.batches)) {
    return item.batches;
  }

  if (Array.isArray(item.batchList)) {
    return item.batchList;
  }

  if (Array.isArray(item.batchData)) {
    return item.batchData;
  }

  if (Array.isArray(item.batchDetails)) {
    return item.batchDetails;
  }

  return [];
}

function normalizeInventoryData(data: RawInventoryRecord[]): NormalizedInventoryRow[] {
  const rows: NormalizedInventoryRow[] = [];

  data.forEach((item, itemIndex) => {
    const batchArray = getBatchArray(item);

    const baseId = toText(item.id || item.inventoryId || `INV-${itemIndex + 1}`);
    const productCode = toText(item.productCode || item.sku || item.code);
    const productName = toText(item.productName || item.name || item.description);
    const uom = toText(item.uom || item.baseUom || item.unit);
    const status = normalizeStatus(item.status);
    const createdAt = toText(item.createdAt || '');
    const updatedAt = toText(item.updatedAt || '');

    /**
     * New format:
     * Inventory item contains batches array.
     */
    if (batchArray.length > 0) {
      batchArray.forEach((batch, batchIndex) => {
        const batchNo = toText(batch.batchNo || batch.lotNo || batch.lot);
        const plant = toText(batch.plant || batch.plantCode || item.plant || item.plantCode);
        const location = toText(
          batch.location ||
            batch.locationCode ||
            batch.binLocation ||
            item.location ||
            item.locationCode
        );

        rows.push({
          _rowKey: `${baseId}-${productCode}-${batchNo}-${plant}-${location}-${batchIndex}`,
          id: `${baseId}-${batchIndex}`,
          productCode,
          productName,
          batchNo,
          expiryDate: toText(batch.expiryDate || batch.expiredDate || batch.expDate),
          qty: toNumber(batch.qty || batch.quantity || batch.availableQty),
          uom: toText(batch.uom || item.uom || item.baseUom || item.unit),
          plant,
          location,
          status: normalizeStatus(batch.status || status),
          createdAt,
          updatedAt,
        });
      });

      return;
    }

    /**
     * Old flat format:
     * Inventory item is already one row per batch/location.
     */
    rows.push({
      _rowKey: `${baseId}-${productCode}-${toText(item.batchNo)}-${toText(
        item.plant
      )}-${toText(item.location)}-${itemIndex}`,
      id: baseId,
      productCode,
      productName,
      batchNo: toText(item.batchNo || item.lotNo || item.lot),
      expiryDate: toText(item.expiryDate || item.expiredDate || item.expDate),
      qty: toNumber(item.qty || item.quantity || item.availableQty),
      uom,
      plant: toText(item.plant || item.plantCode),
      location: toText(item.location || item.locationCode || item.binLocation),
      status,
      createdAt,
      updatedAt,
    });
  });

  return rows;
}

function getStatusColor(status: InventoryStatus): string {
  if (status === 'Active') {
    return 'green';
  }

  if (status === 'Inactive') {
    return 'default';
  }

  return 'blue';
}

function getExpiryTag(expiryDate: string) {
  if (!expiryDate) {
    return <Text type="secondary">-</Text>;
  }

  const expiry = dayjs(expiryDate);

  if (!expiry.isValid()) {
    return <Text>{expiryDate}</Text>;
  }

  const today = dayjs().startOf('day');
  const daysLeft = expiry.startOf('day').diff(today, 'day');

  if (daysLeft < 0) {
    return <Tag color="red">{expiry.format('DD/MM/YYYY')} / Expired</Tag>;
  }

  if (daysLeft <= 30) {
    return <Tag color="orange">{expiry.format('DD/MM/YYYY')} / Soon</Tag>;
  }

  return <Text>{expiry.format('DD/MM/YYYY')}</Text>;
}

export default function InventoryReportPage() {
  const [rawData, setRawData] = useState<RawInventoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);

    try {
      const stored = localStorage.getItem(INVENTORY_STORAGE_KEY);

      if (!stored) {
        setRawData([]);
        return;
      }

      const parsed = JSON.parse(stored);

      if (Array.isArray(parsed)) {
        setRawData(parsed);
      } else {
        setRawData([]);
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      message.error('Failed to load inventory data');
      setRawData([]);
    } finally {
      setLoading(false);
    }
  };

  const normalizedData = useMemo(() => {
    return normalizeInventoryData(rawData);
  }, [rawData]);

  const filteredData = useMemo(() => {
    let filtered = [...normalizedData];

    if (searchText.trim()) {
      const search = searchText.toLowerCase().trim();

      filtered = filtered.filter((item) => {
        const searchableText = [
          item.productCode,
          item.productName,
          item.batchNo,
          item.plant,
          item.location,
          item.uom,
          item.status,
        ]
          .join(' ')
          .toLowerCase();

        return searchableText.includes(search);
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    return filtered;
  }, [normalizedData, searchText, statusFilter]);

  const summary = useMemo(() => {
    const totalProducts = new Set(
      normalizedData
        .map((item) => item.productCode)
        .filter((productCode) => productCode)
    ).size;

    const totalQty = normalizedData.reduce((sum, item) => sum + item.qty, 0);

    const totalBatches = normalizedData.filter((item) => item.batchNo).length;

    const activeItems = normalizedData.filter(
      (item) => item.status !== 'Inactive'
    ).length;

    return {
      totalProducts,
      totalQty,
      totalBatches,
      activeItems,
    };
  }, [normalizedData]);

  const handleExportCSV = () => {
    try {
      if (filteredData.length === 0) {
        message.warning('No inventory records to export');
        return;
      }

      const exportData = filteredData.map((item) => ({
        'Product Code': item.productCode,
        'Product Name': item.productName,
        'Batch No.': item.batchNo,
        'Expiry Date': item.expiryDate || '',
        Qty: item.qty,
        UOM: item.uom || '',
        Plant: item.plant || '',
        Location: item.location || '',
        Status: item.status || 'Active',
      }));

      exportToCSV(exportData, 'inventory_report');
      message.success('Export to CSV successful');
    } catch (error) {
      console.error('Export error:', error);
      message.error('Failed to export CSV');
    }
  };

  const handleExportExcel = () => {
    try {
      if (filteredData.length === 0) {
        message.warning('No inventory records to export');
        return;
      }

      const exportData = filteredData.map((item) => ({
        'Product Code': item.productCode,
        'Product Name': item.productName,
        'Batch No.': item.batchNo,
        'Expiry Date': item.expiryDate || '',
        Qty: item.qty,
        UOM: item.uom || '',
        Plant: item.plant || '',
        Location: item.location || '',
        Status: item.status || 'Active',
      }));

      exportToExcel(exportData, 'inventory_report');
      message.success('Export to Excel successful');
    } catch (error) {
      console.error('Export error:', error);
      message.error('Failed to export Excel');
    }
  };

  const columns: ColumnsType<NormalizedInventoryRow> = [
    {
      title: 'Product',
      key: 'product',
      width: 260,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.productName || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.productCode || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Batch No.',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 150,
      render: (text: string) => text || '-',
    },
    {
      title: 'Expiry Date',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      width: 180,
      render: (text: string) => getExpiryTag(text),
      sorter: (a, b) => {
        const dateA = a.expiryDate ? dayjs(a.expiryDate).valueOf() : 0;
        const dateB = b.expiryDate ? dayjs(b.expiryDate).valueOf() : 0;

        return dateA - dateB;
      },
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      key: 'qty',
      align: 'right',
      width: 120,
      render: (qty: number) => <Text strong>{qty}</Text>,
      sorter: (a, b) => a.qty - b.qty,
    },
    {
      title: 'UOM',
      dataIndex: 'uom',
      key: 'uom',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: 'Plant',
      dataIndex: 'plant',
      key: 'plant',
      width: 160,
      render: (text: string) => text || '-',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 160,
      render: (text: string) => text || '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: InventoryStatus) => (
        <Tag color={getStatusColor(status)}>{status || 'Active'}</Tag>
      ),
      filters: [
        { text: 'Active', value: 'Active' },
        { text: 'Inactive', value: 'Inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col>
            <Space orientation="vertical" size={0}>
              <Title level={4} style={{ margin: 0 }}>
                <DatabaseOutlined /> Inventory Report
              </Title>
              <Text type="secondary">
                View current inventory levels and batch details
              </Text>
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
              <Statistic title="Total Products" value={summary.totalProducts} />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Total Quantity" value={summary.totalQty} />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Total Batches" value={summary.totalBatches} />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Active Items" value={summary.activeItems} />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search by product, batch, plant, location"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
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
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' },
              ]}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="_rowKey"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} records`,
          }}
          locale={{
            emptyText: <Empty description="No inventory data found" />,
          }}
        />
      </Card>
    </div>
  );
}