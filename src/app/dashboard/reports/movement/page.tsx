'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  ExportOutlined,
  FileExcelOutlined,
  SearchOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { exportToCSV, exportToExcel } from '@/app/lib/exportUtils';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const MOVEMENT_STORAGE_KEY = 'wms_stock_movements';

type DateRangeValue = [Dayjs | null, Dayjs | null] | null;

interface MovementRecord {
  id?: string;
  movementNo?: string;
  movementType?: string;
  productCode?: string;
  productName?: string;
  batchNo?: string;
  qty?: number;
  uom?: string;
  fromPlant?: string;
  toPlant?: string;
  fromLocation?: string;
  toLocation?: string;
  referenceNo?: string;
  remarks?: string;
  movementDate?: string;
  createdAt?: string;
  createdBy?: string;
}

interface MovementTableRecord extends MovementRecord {
  _rowKey: string;
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function getMovementDateValue(record: MovementRecord) {
  return record.movementDate || record.createdAt || '';
}

function getValidTime(value?: string) {
  if (!value) return 0;

  const parsed = new Date(value).getTime();

  if (Number.isNaN(parsed)) return 0;

  return parsed;
}

function createBaseMovementKey(record: MovementRecord) {
  const directKey = normalizeText(record.id || record.movementNo);

  if (directKey) return directKey;

  const dateValue = getMovementDateValue(record);

  return [
    normalizeText(record.movementType || 'movement'),
    normalizeText(record.productCode || 'product'),
    normalizeText(record.productName || 'name'),
    normalizeText(record.batchNo || 'batch'),
    normalizeText(record.referenceNo || 'ref'),
    normalizeText(record.fromPlant || 'fromPlant'),
    normalizeText(record.fromLocation || 'fromLocation'),
    normalizeText(record.toPlant || 'toPlant'),
    normalizeText(record.toLocation || 'toLocation'),
    normalizeText(record.qty || 0),
    normalizeText(dateValue || 'date'),
  ]
    .join('|')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function normalizeMovementRows(rows: MovementRecord[]): MovementTableRecord[] {
  const keyCounter = new Map<string, number>();

  return rows.map((record) => {
    const baseKey = createBaseMovementKey(record);
    const currentCount = keyCounter.get(baseKey) || 0;

    keyCounter.set(baseKey, currentCount + 1);

    const finalKey = currentCount === 0 ? baseKey : `${baseKey}-${currentCount + 1}`;

    return {
      ...record,
      _rowKey: finalKey,
    };
  });
}

function parseStoredMovementData(raw: string | null): MovementRecord[] {
  if (!raw) return [];

  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && Array.isArray(parsed.data)) {
    return parsed.data;
  }

  if (parsed && Array.isArray(parsed.records)) {
    return parsed.records;
  }

  if (parsed && Array.isArray(parsed.items)) {
    return parsed.items;
  }

  return [];
}

export default function MovementReportPage() {
  const [data, setData] = useState<MovementTableRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);

    try {
      if (typeof window === 'undefined') {
        setData([]);
        return;
      }

      const stored = window.localStorage.getItem(MOVEMENT_STORAGE_KEY);
      const parsedRows = parseStoredMovementData(stored);
      const normalizedRows = normalizeMovementRows(parsedRows);

      setData(normalizedRows);
    } catch (error) {
      console.error('Error loading movements:', error);
      message.error('Failed to load movement data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let filtered = [...data];

    if (searchText.trim()) {
      const search = searchText.toLowerCase();

      filtered = filtered.filter((movement) =>
        [
          movement.movementNo,
          movement.productCode,
          movement.productName,
          movement.batchNo,
          movement.movementType,
          movement.fromPlant,
          movement.toPlant,
          movement.fromLocation,
          movement.toLocation,
          movement.referenceNo,
          movement.remarks,
          movement.createdBy,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search)
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((movement) => movement.movementType === typeFilter);
    }

    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf('day').valueOf();
      const end = dateRange[1].endOf('day').valueOf();

      filtered = filtered.filter((movement) => {
        const movementDate = getMovementDateValue(movement);

        if (!movementDate) return false;

        const date = new Date(movementDate).getTime();

        if (Number.isNaN(date)) return false;

        return date >= start && date <= end;
      });
    }

    return filtered.sort((a, b) => {
      const dateA = getValidTime(getMovementDateValue(a));
      const dateB = getValidTime(getMovementDateValue(b));

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateB - dateA;
    });
  }, [data, searchText, typeFilter, dateRange]);

  const summary = useMemo(() => {
    const totalMovements = filteredData.length;

    const stockIn = filteredData
      .filter((movement) => movement.movementType === 'Stock In')
      .reduce((sum, movement) => sum + Number(movement.qty || 0), 0);

    const stockOut = filteredData
      .filter((movement) => movement.movementType === 'Stock Depletion')
      .reduce((sum, movement) => sum + Number(movement.qty || 0), 0);

    const transfers = filteredData.filter(
      (movement) => movement.movementType === 'Stock Transfer'
    ).length;

    return {
      totalMovements,
      stockIn,
      stockOut,
      transfers,
    };
  }, [filteredData]);

  const movementTypeOptions = useMemo(() => {
    const existingTypes = Array.from(
      new Set(data.map((item) => item.movementType).filter(Boolean) as string[])
    ).sort();

    const defaultTypes = [
      'Stock In',
      'Stock Transfer',
      'Stock Adjustment',
      'Stock Depletion',
    ];

    const mergedTypes = Array.from(new Set([...defaultTypes, ...existingTypes]));

    return [
      {
        value: 'all',
        label: 'All Types',
      },
      ...mergedTypes.map((type) => ({
        value: type,
        label: type,
      })),
    ];
  }, [data]);

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'Stock In':
        return 'green';
      case 'Stock Transfer':
        return 'blue';
      case 'Stock Adjustment':
        return 'orange';
      case 'Stock Depletion':
        return 'red';
      default:
        return 'default';
    }
  };

  const buildExportData = () => {
    return filteredData.map((movement) => ({
      'Movement No.': movement.movementNo || '',
      Type: movement.movementType || '',
      'Product Code': movement.productCode || '',
      'Product Name': movement.productName || '',
      'Batch No.': movement.batchNo || '',
      Qty: movement.qty || 0,
      UOM: movement.uom || '',
      'From Plant': movement.fromPlant || '',
      'To Plant': movement.toPlant || '',
      'From Location': movement.fromLocation || '',
      'To Location': movement.toLocation || '',
      Reference: movement.referenceNo || '',
      Remarks: movement.remarks || '',
      Date: getMovementDateValue(movement),
      'Created By': movement.createdBy || '',
    }));
  };

  const handleExportCSV = () => {
    try {
      if (filteredData.length === 0) {
        message.warning('No movement data to export');
        return;
      }

      exportToCSV(buildExportData(), 'movement_report');
      message.success('Export to CSV successful');
    } catch (error) {
      console.error('Export error:', error);
      message.error('Failed to export CSV');
    }
  };

  const handleExportExcel = () => {
    try {
      if (filteredData.length === 0) {
        message.warning('No movement data to export');
        return;
      }

      exportToExcel(buildExportData(), 'movement_report');
      message.success('Export to Excel successful');
    } catch (error) {
      console.error('Export error:', error);
      message.error('Failed to export Excel');
    }
  };

  const columns: ColumnsType<MovementTableRecord> = [
    {
      title: 'Movement No.',
      dataIndex: 'movementNo',
      key: 'movementNo',
      width: 160,
      render: (text: string) => <Text strong>{text || '-'}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'movementType',
      key: 'movementType',
      width: 160,
      render: (type: string) => <Tag color={getTypeColor(type)}>{type || 'N/A'}</Tag>,
      filters: movementTypeOptions
        .filter((option) => option.value !== 'all')
        .map((option) => ({
          text: option.label,
          value: option.value,
        })),
      onFilter: (value, record) => record.movementType === value,
    },
    {
      title: 'Product',
      key: 'product',
      width: 240,
      render: (_, record) => (
        <div>
          <Text>{record.productName || '-'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.productCode || '-'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Batch No.',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 140,
      render: (batchNo: string) => batchNo || '-',
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      key: 'qty',
      width: 120,
      align: 'right',
      sorter: (a, b) => Number(a.qty || 0) - Number(b.qty || 0),
      render: (qty: number) => <Text strong>{Number(qty || 0).toLocaleString()}</Text>,
    },
    {
      title: 'UOM',
      dataIndex: 'uom',
      key: 'uom',
      width: 100,
      render: (uom: string) => uom || '-',
    },
    {
      title: 'From',
      key: 'from',
      width: 200,
      render: (_, record) => (
        <div>
          <Text>{record.fromPlant || '-'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.fromLocation || '-'}
          </Text>
        </div>
      ),
    },
    {
      title: 'To',
      key: 'to',
      width: 200,
      render: (_, record) => (
        <div>
          <Text>{record.toPlant || '-'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.toLocation || '-'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Reference',
      dataIndex: 'referenceNo',
      key: 'referenceNo',
      width: 160,
      render: (referenceNo: string) => referenceNo || '-',
    },
    {
      title: 'Date',
      dataIndex: 'movementDate',
      key: 'movementDate',
      width: 180,
      sorter: (a, b) => {
        const dateA = getValidTime(getMovementDateValue(a));
        const dateB = getValidTime(getMovementDateValue(b));

        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;

        return dateA - dateB;
      },
      render: (_text: string, record) => {
        const dateValue = getMovementDateValue(record);

        if (!dateValue) return '-';

        const parsed = dayjs(dateValue);

        return parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : dateValue;
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                <SwapOutlined /> Movement History Report
              </Title>
              <Text type="secondary">Track all stock movements across the warehouse</Text>
            </div>
          </Col>

          <Col>
            <Space wrap>
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
        <Row gutter={[16, 16]} style={{ marginTop: 24, marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Movements"
                value={summary.totalMovements}
                styles={{
                  content: { color: '#1677ff' },
                }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Stock In"
                value={summary.stockIn}
                styles={{
                  content: { color: '#3f8600' },
                }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Stock Out"
                value={summary.stockOut}
                styles={{
                  content: { color: '#cf1322' },
                }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Transfers"
                value={summary.transfers}
                styles={{
                  content: { color: '#722ed1' },
                }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search by movement no., product, batch"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              allowClear
            />
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Select
              style={{ width: '100%' }}
              value={typeFilter}
              onChange={setTypeFilter}
              options={movementTypeOptions}
            />
          </Col>

          <Col xs={24} sm={12} md={8}>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={(dates) => setDateRange(dates as DateRangeValue)}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="_rowKey"
          loading={loading}
          scroll={{ x: 1500 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} records`,
          }}
          locale={{
            emptyText: <Empty description="No movement data found" />,
          }}
        />
      </Card>
    </div>
  );
}