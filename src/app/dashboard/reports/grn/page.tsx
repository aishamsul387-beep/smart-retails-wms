'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  message,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ExportOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  exportToCSV,
  exportToExcel,
} from '@/lib/exportUtils';

const { Title, Text } = Typography;

const GRN_STORAGE_KEY = 'wms_inbound_receipts';

interface GRNItem {
  id?: string;
  productCode?: string;
  sku?: string;
  productName?: string;
  batchNo?: string;
  plant?: string;
  location?: string;
  expiryDate?: string;
  uom?: string;
  qty?: number;
  remarks?: string;
}

interface GRNRecord {
  id: string;
  grnNo: string;
  supplier?: string;
  supplierName?: string;
  poNo?: string;
  doNo?: string;
  invoiceNo?: string;
  grnDate?: string;
  createdAt?: string;
  updatedAt?: string;
  status: string;
  items: GRNItem[];
}

interface GRNExportRecord {
  [key: string]: unknown;
  'GRN No.': string;
  Supplier: string;
  'Supplier Name': string;
  'PO No.': string;
  'DO No.': string;
  'Invoice No.': string;
  'GRN Date': string;
  Status: string;
  Items: number;
  'Total Qty': number;
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function stringValue(value: unknown): string {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}

function numberValue(
  value: unknown,
  fallback = 0,
): number {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function normalizeGRNItem(
  value: unknown,
): GRNItem {
  if (!isObject(value)) {
    return {};
  }

  return {
    id: stringValue(value.id),
    productCode: stringValue(
      value.productCode,
    ),
    sku: stringValue(value.sku),
    productName: stringValue(
      value.productName,
    ),
    batchNo: stringValue(value.batchNo),
    plant: stringValue(value.plant),
    location: stringValue(value.location),
    expiryDate: stringValue(
      value.expiryDate,
    ),
    uom: stringValue(value.uom),
    qty: numberValue(value.qty),
    remarks: stringValue(value.remarks),
  };
}

function normalizeGRNRecord(
  value: unknown,
  index: number,
): GRNRecord | null {
  if (!isObject(value)) {
    return null;
  }

  const rawItems = Array.isArray(value.items)
    ? value.items
    : [];

  const grnNo =
    stringValue(value.grnNo) ||
    stringValue(value.receiptNo);

  const id =
    stringValue(value.id) ||
    grnNo ||
    `GRN-${index + 1}`;

  return {
    id,
    grnNo,
    supplier: stringValue(value.supplier),
    supplierName: stringValue(
      value.supplierName,
    ),
    poNo: stringValue(value.poNo),
    doNo: stringValue(value.doNo),
    invoiceNo: stringValue(
      value.invoiceNo,
    ),
    grnDate:
      stringValue(value.grnDate) ||
      stringValue(value.receiptDate),
    createdAt: stringValue(value.createdAt),
    updatedAt: stringValue(value.updatedAt),
    status:
      stringValue(value.status) || 'Draft',
    items: rawItems.map(normalizeGRNItem),
  };
}

function parseGRNRecords(
  storedValue: string | null,
): GRNRecord[] {
  if (!storedValue) {
    return [];
  }

  try {
    const parsed: unknown =
      JSON.parse(storedValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeGRNRecord)
      .filter(
        (
          record,
        ): record is GRNRecord =>
          record !== null,
      );
  } catch {
    return [];
  }
}

function calculateTotalQty(
  record: GRNRecord,
): number {
  return record.items.reduce(
    (sum: number, item: GRNItem) =>
      sum + numberValue(item.qty),
    0,
  );
}

function getRecordTimestamp(
  record: GRNRecord,
): number {
  const dateValue =
    record.grnDate ||
    record.createdAt ||
    record.updatedAt;

  if (!dateValue) {
    return 0;
  }

  const timestamp = new Date(
    dateValue,
  ).getTime();

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
}

function getStatusColor(
  status: string,
): string {
  switch (status) {
    case 'Draft':
      return 'default';

    case 'Confirmed':
      return 'blue';

    case 'Received':
      return 'green';

    case 'Cancelled':
      return 'red';

    default:
      return 'default';
  }
}

function formatGRNDate(
  value?: string,
): string {
  if (!value) {
    return '-';
  }

  const parsedDate = dayjs(value);

  return parsedDate.isValid()
    ? parsedDate.format('DD/MM/YYYY')
    : value;
}

export default function GRNReportPage() {
  const [data, setData] = useState<
    GRNRecord[]
  >([]);
  const [loading, setLoading] =
    useState(false);
  const [searchText, setSearchText] =
    useState('');
  const [statusFilter, setStatusFilter] =
    useState<string>('all');

  const loadData = useCallback(() => {
    setLoading(true);

    try {
      const stored =
        window.localStorage.getItem(
          GRN_STORAGE_KEY,
        );

      const records =
        parseGRNRecords(stored);

      setData(records);
    } catch (error: unknown) {
      console.error(
        'Error loading GRN data:',
        error,
      );
      message.error(
        'Failed to load GRN data',
      );
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData();
    }, 0);

    const handleStorageChange = (
      event: StorageEvent,
    ) => {
      if (
        event.key === GRN_STORAGE_KEY ||
        event.key === null
      ) {
        loadData();
      }
    };

    window.addEventListener(
      'storage',
      handleStorageChange,
    );

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(
        'storage',
        handleStorageChange,
      );
    };
  }, [loadData]);

  const filteredData = useMemo(() => {
    let filtered = [...data];

    if (searchText.trim()) {
      const search = searchText
        .trim()
        .toLowerCase();

      filtered = filtered.filter(
        (grn: GRNRecord) => {
          const searchableValues = [
            grn.grnNo,
            grn.supplier,
            grn.supplierName,
            grn.poNo,
            grn.doNo,
            grn.invoiceNo,
          ];

          return searchableValues.some(
            (value) =>
              value
                ?.toLowerCase()
                .includes(search),
          );
        },
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(
        (grn: GRNRecord) =>
          grn.status === statusFilter,
      );
    }

    return filtered.sort(
      (
        a: GRNRecord,
        b: GRNRecord,
      ) =>
        getRecordTimestamp(b) -
        getRecordTimestamp(a),
    );
  }, [
    data,
    searchText,
    statusFilter,
  ]);

  const summary = useMemo(() => {
    const totalGRNs = data.length;

    const totalItems = data.reduce(
      (
        sum: number,
        grn: GRNRecord,
      ) => sum + grn.items.length,
      0,
    );

    const totalQty = data.reduce(
      (
        sum: number,
        grn: GRNRecord,
      ) => sum + calculateTotalQty(grn),
      0,
    );

    const receivedGRNs = data.filter(
      (grn: GRNRecord) =>
        grn.status === 'Received',
    ).length;

    return {
      totalGRNs,
      totalItems,
      totalQty,
      receivedGRNs,
    };
  }, [data]);

  const createExportData =
    useCallback((): GRNExportRecord[] => {
      return filteredData.map(
        (grn: GRNRecord) => ({
          'GRN No.': grn.grnNo,
          Supplier: grn.supplier || '',
          'Supplier Name':
            grn.supplierName || '',
          'PO No.': grn.poNo || '',
          'DO No.': grn.doNo || '',
          'Invoice No.':
            grn.invoiceNo || '',
          'GRN Date': grn.grnDate || '',
          Status: grn.status,
          Items: grn.items.length,
          'Total Qty':
            calculateTotalQty(grn),
        }),
      );
    }, [filteredData]);

  const handleExportCSV = () => {
    try {
      exportToCSV(
        createExportData(),
        'grn_report',
      );

      message.success(
        'Export to CSV successful',
      );
    } catch (error: unknown) {
      console.error(
        'CSV export error:',
        error,
      );
      message.error(
        'Failed to export CSV',
      );
    }
  };

  const handleExportExcel = () => {
    try {
      exportToExcel(
        createExportData(),
        'grn_report',
      );

      message.success(
        'Export to Excel successful',
      );
    } catch (error: unknown) {
      console.error(
        'Excel export error:',
        error,
      );
      message.error(
        'Failed to export Excel',
      );
    }
  };

  const columns: ColumnsType<GRNRecord> = [
    {
      title: 'GRN No.',
      dataIndex: 'grnNo',
      key: 'grnNo',
      render: (value: string) => (
        <Text strong>{value || '-'}</Text>
      ),
    },
    {
      title: 'Supplier',
      key: 'supplier',
      render: (
        _value: unknown,
        record: GRNRecord,
      ) => (
        <Space
          orientation="vertical"
          size={0}
        >
          <Text>
            {record.supplierName ||
              record.supplier ||
              '-'}
          </Text>

          {record.supplierName &&
            record.supplier && (
              <Text
                type="secondary"
                style={{ fontSize: 12 }}
              >
                {record.supplier}
              </Text>
            )}
        </Space>
      ),
    },
    {
      title: 'PO No.',
      dataIndex: 'poNo',
      key: 'poNo',
      render: (value?: string) =>
        value || '-',
    },
    {
      title: 'Invoice No.',
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      render: (value?: string) =>
        value || '-',
    },
    {
      title: 'GRN Date',
      dataIndex: 'grnDate',
      key: 'grnDate',
      render: (value?: string) =>
        formatGRNDate(value),
      sorter: (
        a: GRNRecord,
        b: GRNRecord,
      ) =>
        getRecordTimestamp(a) -
        getRecordTimestamp(b),
    },
    {
      title: 'Items',
      key: 'items',
      render: (
        _value: unknown,
        record: GRNRecord,
      ) => (
        <Tag>
          {record.items.length} items
        </Tag>
      ),
    },
    {
      title: 'Total Qty',
      key: 'totalQty',
      align: 'right',
      render: (
        _value: unknown,
        record: GRNRecord,
      ) => (
        <Text strong>
          {calculateTotalQty(
            record,
          ).toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag
          color={getStatusColor(status)}
        >
          {status || 'Draft'}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Row
          gutter={[16, 16]}
          align="middle"
          justify="space-between"
        >
          <Col>
            <Space
              orientation="vertical"
              size={0}
            >
              <Title
                level={4}
                style={{ margin: 0 }}
              >
                <FileTextOutlined /> GRN
                Report
              </Title>

              <Text type="secondary">
                View all goods received
                notes and receiving history
              </Text>
            </Space>
          </Col>

          <Col>
            <Space wrap>
              <Button
                icon={<ExportOutlined />}
                onClick={handleExportCSV}
              >
                Export CSV
              </Button>

              <Button
                icon={
                  <FileExcelOutlined />
                }
                onClick={
                  handleExportExcel
                }
              >
                Export Excel
              </Button>

              <Button onClick={loadData}>
                Reload
              </Button>
            </Space>
          </Col>
        </Row>

        <Row
          gutter={[16, 16]}
          style={{
            marginTop: 24,
            marginBottom: 24,
          }}
        >
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total GRNs"
                value={summary.totalGRNs}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Items"
                value={summary.totalItems}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Qty"
                value={summary.totalQty}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Received GRNs"
                value={
                  summary.receivedGRNs
                }
                styles={{
                  content: {
                    color: '#3f8600',
                  },
                }}
              />
            </Card>
          </Col>
        </Row>

        <Row
          gutter={[16, 16]}
          style={{ marginBottom: 16 }}
        >
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search by GRN no., supplier, PO, invoice"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(event) =>
                setSearchText(
                  event.target.value,
                )
              }
              allowClear
            />
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Select
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                {
                  value: 'all',
                  label: 'All Status',
                },
                {
                  value: 'Draft',
                  label: 'Draft',
                },
                {
                  value: 'Confirmed',
                  label: 'Confirmed',
                },
                {
                  value: 'Received',
                  label: 'Received',
                },
                {
                  value: 'Cancelled',
                  label: 'Cancelled',
                },
              ]}
            />
          </Col>
        </Row>

        <Table<GRNRecord>
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total: number) =>
              `Total ${total} records`,
          }}
          locale={{
            emptyText: (
              <Empty description="No GRN data found" />
            ),
          }}
        />
      </Card>
    </div>
  );
}