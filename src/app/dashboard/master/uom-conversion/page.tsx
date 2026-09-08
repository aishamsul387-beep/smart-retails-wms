'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Col,
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
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const STORAGE_KEY = 'wms_uom_master';

type StatusType = 'Active' | 'Inactive';

interface UomRecord {
  id: string;
  uomCode: string;
  uomName: string;
  uomType: string;
  decimalAllowed: boolean;
  status: StatusType;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

type UomFormValues = {
  uomCode: string;
  uomName: string;
  uomType: string;
  decimalAllowed: boolean;
  status: StatusType;
  remark?: string;
};

const uomTypes = [
  'Quantity',
  'Weight',
  'Volume',
  'Length',
  'Area',
  'Package',
  'Time',
  'Other',
];

const defaultCreatedAt = new Date().toISOString();

const defaultUoms: UomRecord[] = [
  {
    id: 'UOM-PCS',
    uomCode: 'PCS',
    uomName: 'Pieces',
    uomType: 'Quantity',
    decimalAllowed: false,
    status: 'Active',
    remark: 'Default quantity unit.',
    createdAt: defaultCreatedAt,
    updatedAt: defaultCreatedAt,
  },
  {
    id: 'UOM-CTN',
    uomCode: 'CTN',
    uomName: 'Carton',
    uomType: 'Package',
    decimalAllowed: false,
    status: 'Active',
    remark:
      'Package unit. Product-specific conversion should be maintained in UOM Conversion Rate Master.',
    createdAt: defaultCreatedAt,
    updatedAt: defaultCreatedAt,
  },
  {
    id: 'UOM-BOX',
    uomCode: 'BOX',
    uomName: 'Box',
    uomType: 'Package',
    decimalAllowed: false,
    status: 'Active',
    remark:
      'Package unit. Conversion should be maintained in UOM Conversion Rate Master.',
    createdAt: defaultCreatedAt,
    updatedAt: defaultCreatedAt,
  },
  {
    id: 'UOM-PACK',
    uomCode: 'PACK',
    uomName: 'Pack',
    uomType: 'Package',
    decimalAllowed: false,
    status: 'Active',
    remark: 'Pack unit.',
    createdAt: defaultCreatedAt,
    updatedAt: defaultCreatedAt,
  },
  {
    id: 'UOM-KG',
    uomCode: 'KG',
    uomName: 'Kilogram',
    uomType: 'Weight',
    decimalAllowed: true,
    status: 'Active',
    remark: 'Default weight unit.',
    createdAt: defaultCreatedAt,
    updatedAt: defaultCreatedAt,
  },
  {
    id: 'UOM-G',
    uomCode: 'G',
    uomName: 'Gram',
    uomType: 'Weight',
    decimalAllowed: true,
    status: 'Active',
    remark: 'Weight unit.',
    createdAt: defaultCreatedAt,
    updatedAt: defaultCreatedAt,
  },
  {
    id: 'UOM-L',
    uomCode: 'L',
    uomName: 'Liter',
    uomType: 'Volume',
    decimalAllowed: true,
    status: 'Active',
    remark: 'Volume unit.',
    createdAt: defaultCreatedAt,
    updatedAt: defaultCreatedAt,
  },
  {
    id: 'UOM-ML',
    uomCode: 'ML',
    uomName: 'Milliliter',
    uomType: 'Volume',
    decimalAllowed: true,
    status: 'Active',
    remark: 'Volume unit.',
    createdAt: defaultCreatedAt,
    updatedAt: defaultCreatedAt,
  },
];

const csvHeaders = [
  'uomCode',
  'uomName',
  'uomType',
  'decimalAllowed',
  'status',
  'remark',
];

function generateId() {
  return `UOM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCode(value?: string) {
  return value?.trim().toUpperCase() || '';
}

function normalizeText(value?: string) {
  return value?.trim() || '';
}

function normalizeBoolean(value: unknown, defaultValue = false) {
  if (typeof value === 'boolean') return value;

  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();

  return ['true', 'yes', 'y', '1'].includes(normalized);
}

function normalizeStatus(value?: string): StatusType {
  return value?.trim() === 'Inactive' ? 'Inactive' : 'Active';
}

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) return '';

  const text = String(value);

  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadFile(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8;',
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function convertToCSV(rows: UomRecord[]) {
  const headerLine = csvHeaders.join(',');

  const dataLines = rows.map((row) =>
    csvHeaders
      .map((header) => {
        if (header === 'decimalAllowed') {
          return escapeCsvValue(row.decimalAllowed ? 'Yes' : 'No');
        }

        return escapeCsvValue(row[header as keyof UomRecord]);
      })
      .join(','),
  );

  return [headerLine, ...dataLines].join('\n');
}

function parseCSVLine(line: string) {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());

  return result;
}

function parseCSV(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    return row;
  });
}

function migrateUomRecord(record: any): UomRecord {
  const now = new Date().toISOString();

  return {
    id: record.id || generateId(),
    uomCode: normalizeCode(record.uomCode),
    uomName: normalizeText(record.uomName),
    uomType: record.uomType || 'Quantity',
    decimalAllowed: normalizeBoolean(record.decimalAllowed, false),
    status: normalizeStatus(record.status),
    remark: normalizeText(record.remark),
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
  };
}

export default function UomMasterPage() {
  const [uoms, setUoms] = useState<UomRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<UomRecord | null>(null);

  const [form] = Form.useForm<UomFormValues>();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const saveUoms = (nextData: UomRecord[]) => {
    setUoms(nextData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
  };

  const loadUoms = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          const migrated = parsed
            .map(migrateUomRecord)
            .filter((item) => item.uomCode && item.uomName);

          saveUoms(migrated.length > 0 ? migrated : defaultUoms);
          return;
        }
      }

      saveUoms(defaultUoms);
    } catch (error) {
      console.error(error);
      message.error('Failed to load UOM Master data.');
      saveUoms(defaultUoms);
    }
  };

  useEffect(() => {
    loadUoms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUoms = useMemo(() => {
    const keyword = searchText.toLowerCase().trim();

    if (!keyword) return uoms;

    return uoms.filter((item) => {
      return [
        item.uomCode,
        item.uomName,
        item.uomType,
        item.decimalAllowed ? 'decimal yes' : 'integer no',
        item.status,
        item.remark,
      ]
        .filter((value) => value !== undefined && value !== null)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [uoms, searchText]);

  const totalUoms = uoms.length;
  const activeCount = uoms.filter((item) => item.status === 'Active').length;
  const inactiveCount = uoms.filter((item) => item.status === 'Inactive').length;
  const decimalAllowedCount = uoms.filter((item) => item.decimalAllowed).length;

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      uomType: 'Quantity',
      decimalAllowed: false,
      status: 'Active',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (record: UomRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      uomCode: record.uomCode,
      uomName: record.uomName,
      uomType: record.uomType,
      decimalAllowed: record.decimalAllowed,
      status: record.status,
      remark: record.remark,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    const nextData = uoms.filter((item) => item.id !== id);

    saveUoms(nextData);
    message.success('UOM deleted successfully.');
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const now = new Date().toISOString();

      const payload: UomRecord = {
        id: editingRecord?.id || generateId(),
        uomCode: normalizeCode(values.uomCode),
        uomName: normalizeText(values.uomName),
        uomType: values.uomType,
        decimalAllowed: Boolean(values.decimalAllowed),
        status: values.status,
        remark: normalizeText(values.remark),
        createdAt: editingRecord?.createdAt || now,
        updatedAt: now,
      };

      const duplicate = uoms.find((item) => {
        return (
          item.uomCode.toLowerCase() === payload.uomCode.toLowerCase() &&
          item.id !== payload.id
        );
      });

      if (duplicate) {
        message.error('UOM Code already exists.');
        return;
      }

      let nextData: UomRecord[];

      if (editingRecord) {
        nextData = uoms.map((item) =>
          item.id === editingRecord.id ? payload : item,
        );
        message.success('UOM updated successfully.');
      } else {
        nextData = [payload, ...uoms];
        message.success('UOM added successfully.');
      }

      saveUoms(nextData);
      setIsModalOpen(false);
      setEditingRecord(null);
      form.resetFields();
    } catch {
      // Ant Design validation will show field errors.
    }
  };

  const handleTemplateDownload = () => {
    const sampleRows: UomRecord[] = [
      {
        id: '',
        uomCode: 'PCS',
        uomName: 'Pieces',
        uomType: 'Quantity',
        decimalAllowed: false,
        status: 'Active',
        remark: 'Stock counting unit.',
      },
      {
        id: '',
        uomCode: 'CTN',
        uomName: 'Carton',
        uomType: 'Package',
        decimalAllowed: false,
        status: 'Active',
        remark:
          'Package unit. Conversion rate should be maintained in UOM Conversion Rate Master.',
      },
      {
        id: '',
        uomCode: 'KG',
        uomName: 'Kilogram',
        uomType: 'Weight',
        decimalAllowed: true,
        status: 'Active',
        remark: 'Weight unit with decimal allowed.',
      },
    ];

    const csv = convertToCSV(sampleRows);

    downloadFile('uom_master_template.csv', csv);
    message.success('UOM template downloaded successfully.');
  };

  const handleExport = () => {
    if (uoms.length === 0) {
      message.warning('No UOM data to export.');
      return;
    }

    const csv = convertToCSV(uoms);

    downloadFile('uom_master_export.csv', csv);
    message.success('UOM Master exported successfully.');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        message.error('CSV file is empty or invalid.');
        return;
      }

      const now = new Date().toISOString();

      const importedRecords = rows
        .map((row) => {
          const uomCode = normalizeCode(row.uomCode);
          const uomName = normalizeText(row.uomName);
          const uomType = normalizeText(row.uomType) || 'Quantity';

          if (!uomCode || !uomName) {
            return null;
          }

          const record: UomRecord = {
            id: generateId(),
            uomCode,
            uomName,
            uomType: uomTypes.includes(uomType) ? uomType : 'Other',
            decimalAllowed: normalizeBoolean(row.decimalAllowed, false),
            status: normalizeStatus(row.status),
            remark: normalizeText(row.remark),
            createdAt: now,
            updatedAt: now,
          };

          return record;
        })
        .filter(Boolean) as UomRecord[];

      if (importedRecords.length === 0) {
        message.error('No valid records found. Required fields: uomCode, uomName.');
        return;
      }

      const merged = [...uoms];

      importedRecords.forEach((imported) => {
        const existingIndex = merged.findIndex(
          (item) =>
            item.uomCode.toLowerCase() === imported.uomCode.toLowerCase(),
        );

        if (existingIndex >= 0) {
          merged[existingIndex] = {
            ...merged[existingIndex],
            ...imported,
            id: merged[existingIndex].id,
            createdAt: merged[existingIndex].createdAt,
            updatedAt: now,
          };
        } else {
          merged.unshift(imported);
        }
      });

      saveUoms(merged);

      message.success(
        `${importedRecords.length} UOM record(s) imported successfully.`,
      );
    } catch (error) {
      console.error(error);
      message.error('Failed to import CSV file.');
    } finally {
      event.target.value = '';
    }
  };

  const columns: ColumnsType<UomRecord> = [
    {
      title: 'UOM Code',
      dataIndex: 'uomCode',
      key: 'uomCode',
      sorter: (a, b) => a.uomCode.localeCompare(b.uomCode),
      width: 130,
      fixed: 'left',
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: 'UOM Name',
      dataIndex: 'uomName',
      key: 'uomName',
      sorter: (a, b) => a.uomName.localeCompare(b.uomName),
      width: 180,
    },
    {
      title: 'UOM Type',
      dataIndex: 'uomType',
      key: 'uomType',
      width: 140,
      filters: uomTypes.map((type) => ({ text: type, value: type })),
      onFilter: (value, record) => record.uomType === String(value),
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: 'Decimal Allowed',
      dataIndex: 'decimalAllowed',
      key: 'decimalAllowed',
      width: 150,
      filters: [
        { text: 'Yes', value: 'true' },
        { text: 'No', value: 'false' },
      ],
      onFilter: (value, record) =>
        String(record.decimalAllowed) === String(value),
      render: (value: boolean) =>
        value ? (
          <Tag color="green">Yes</Tag>
        ) : (
          <Tag color="orange">No</Tag>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      filters: [
        { text: 'Active', value: 'Active' },
        { text: 'Inactive', value: 'Inactive' },
      ],
      onFilter: (value, record) => record.status === String(value),
      render: (status: StatusType) => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
      ),
    },
    {
      title: 'Remark',
      dataIndex: 'remark',
      key: 'remark',
      width: 300,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (value?: string) =>
        value ? new Date(value).toLocaleString() : '-',
    },
    {
      title: 'Updated At',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value?: string) =>
        value ? new Date(value).toLocaleString() : '-',
    },
    {
      title: 'Action',
      key: 'action',
      width: 130,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />

          <Popconfirm
            title="Delete UOM"
            description="Are you sure you want to delete this UOM?"
            okText="Yes"
            cancelText="No"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          UOM Master
        </Title>

        <Text type="secondary">
          Standardized unit of measure data for products, GRN, purchasing,
          inventory, stock movement, outbound, and CSV validation.
        </Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Text type="secondary">Total UOM</Text>
            <Title level={3} style={{ margin: 0 }}>
              {totalUoms}
            </Title>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Text type="secondary">Active</Text>
            <Title level={3} style={{ margin: 0, color: '#16a34a' }}>
              {activeCount}
            </Title>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Text type="secondary">Inactive</Text>
            <Title level={3} style={{ margin: 0, color: '#dc2626' }}>
              {inactiveCount}
            </Title>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Text type="secondary">Decimal Allowed</Text>
            <Title level={3} style={{ margin: 0, color: '#1677ff' }}>
              {decimalAllowedCount}
            </Title>
          </Card>
        </Col>
      </Row>

      <Card>
        <Row
          gutter={[12, 12]}
          justify="space-between"
          align="middle"
          style={{ marginBottom: 16 }}
        >
          <Col xs={24} lg={12}>
            <Input.Search
              allowClear
              placeholder="Search UOM code, name, type, status, remark..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onSearch={setSearchText}
            />
          </Col>

          <Col xs={24} lg={12}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }} wrap>
              <Button onClick={handleTemplateDownload}>Template CSV</Button>

              <Button icon={<UploadOutlined />} onClick={handleImportClick}>
                Import CSV
              </Button>

              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                Export CSV
              </Button>

              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                Add UOM
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
            </Space>
          </Col>
        </Row>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredUoms}
          bordered
          size="small"
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} UOM(s)`,
          }}
        />
      </Card>

      <Modal
        title={editingRecord ? 'Edit UOM' : 'Add UOM'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingRecord(null);
          form.resetFields();
        }}
        okText={editingRecord ? 'Update' : 'Create'}
        width={800}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            uomType: 'Quantity',
            decimalAllowed: false,
            status: 'Active',
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="UOM Code"
                name="uomCode"
                rules={[
                  { required: true, message: 'Please enter UOM code.' },
                  { max: 30, message: 'UOM code cannot exceed 30 characters.' },
                  {
                    pattern: /^[A-Za-z0-9-_./]+$/,
                    message:
                      'UOM code should only contain letters, numbers, dash, underscore, dot or slash.',
                  },
                ]}
              >
                <Input placeholder="Example: PCS, CTN, KG, L, ML" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="UOM Name"
                name="uomName"
                rules={[{ required: true, message: 'Please enter UOM name.' }]}
              >
                <Input placeholder="Example: Pieces, Carton, Kilogram" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="UOM Type"
                name="uomType"
                rules={[{ required: true, message: 'Please select UOM type.' }]}
              >
                <Select
                  placeholder="Select UOM type"
                  options={uomTypes.map((type) => ({
                    label: type,
                    value: type,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Status"
                name="status"
                rules={[{ required: true, message: 'Please select status.' }]}
              >
                <Select
                  options={[
                    { label: 'Active', value: 'Active' },
                    { label: 'Inactive', value: 'Inactive' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Decimal Allowed"
                name="decimalAllowed"
                valuePropName="checked"
                tooltip="Example: KG usually allows decimal, PCS usually does not."
              >
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Remark" name="remark">
                <Input.TextArea
                  rows={3}
                  placeholder="Optional notes. Example: Conversion rate is maintained in UOM Conversion Rate Master."
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}