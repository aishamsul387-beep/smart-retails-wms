'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
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
  baseUom?: string;
  conversionToBase?: number;
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
  baseUom?: string;
  conversionToBase?: number;
  decimalAllowed: boolean;
  status: StatusType;
  remark?: string;
};

type UnknownRecord = Record<string, unknown>;

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

const csvHeaders = [
  'uomCode',
  'uomName',
  'uomType',
  'baseUom',
  'conversionToBase',
  'decimalAllowed',
  'status',
  'remark',
];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function generateId() {
  return `UOM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s._/-]/g, '');
}

function normalizeCode(value: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeStatus(value: unknown): StatusType {
  const normalized = String(value ?? '').trim().toLowerCase();

  return normalized === 'inactive' ? 'Inactive' : 'Active';
}

function normalizeUomType(value: unknown) {
  const normalized = normalizeText(value);

  return uomTypes.includes(normalized) ? normalized : 'Other';
}

function normalizeNumber(value: unknown, defaultValue = 1) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return defaultValue;
  }

  return numberValue;
}

function normalizeBoolean(value: unknown, defaultValue = false) {
  if (typeof value === 'boolean') return value;

  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();

  if (['true', 'yes', 'y', '1', 'active'].includes(normalized)) {
    return true;
  }

  if (['false', 'no', 'n', '0', 'inactive'].includes(normalized)) {
    return false;
  }

  return defaultValue;
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
  const blob = new Blob([`\uFEFF${content}`], { type: mime });
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

  const headers = parseCSVLine(lines[0]).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    return row;
  });
}

function getCSVValue(row: Record<string, string>, possibleHeaders: string[]) {
  for (const header of possibleHeaders) {
    const normalized = normalizeHeader(header);

    if (row[normalized] !== undefined) {
      return row[normalized];
    }
  }

  return '';
}

function createDefaultUoms(): UomRecord[] {
  const now = new Date().toISOString();

  return [
    {
      id: 'UOM-PCS',
      uomCode: 'PCS',
      uomName: 'Pieces',
      uomType: 'Quantity',
      baseUom: 'PCS',
      conversionToBase: 1,
      decimalAllowed: false,
      status: 'Active',
      remark: 'Default quantity unit.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'UOM-CTN',
      uomCode: 'CTN',
      uomName: 'Carton',
      uomType: 'Package',
      baseUom: 'PCS',
      conversionToBase: 1,
      decimalAllowed: false,
      status: 'Active',
      remark: 'Carton package unit. Update conversion based on operation need.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'UOM-KG',
      uomCode: 'KG',
      uomName: 'Kilogram',
      uomType: 'Weight',
      baseUom: 'KG',
      conversionToBase: 1,
      decimalAllowed: true,
      status: 'Active',
      remark: 'Default weight unit.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'UOM-LTR',
      uomCode: 'LTR',
      uomName: 'Liter',
      uomType: 'Volume',
      baseUom: 'LTR',
      conversionToBase: 1,
      decimalAllowed: true,
      status: 'Active',
      remark: 'Default volume unit.',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function migrateUomRecord(record: unknown): UomRecord {
  const now = new Date().toISOString();
  const source = isRecord(record) ? record : {};

  return {
    id: normalizeText(source.id) || generateId(),
    uomCode: normalizeCode(source.uomCode || source.code),
    uomName: normalizeText(source.uomName || source.name),
    uomType: normalizeUomType(source.uomType || source.type || 'Quantity'),
    baseUom: normalizeCode(source.baseUom),
    conversionToBase: normalizeNumber(source.conversionToBase, 1),
    decimalAllowed: normalizeBoolean(source.decimalAllowed, false),
    status: normalizeStatus(source.status),
    remark: normalizeText(source.remark),
    createdAt: normalizeText(source.createdAt) || now,
    updatedAt: normalizeText(source.updatedAt) || now,
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
            .map((item) => migrateUomRecord(item))
            .filter((item) => item.uomCode && item.uomName);

          saveUoms(migrated.length > 0 ? migrated : createDefaultUoms());

          return;
        }
      }

      saveUoms(createDefaultUoms());
    } catch (error) {
      console.error(error);
      message.error('Failed to load UOM Master data.');
      saveUoms(createDefaultUoms());
    }
  };

  useEffect(() => {
    loadUoms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeUoms = useMemo(() => {
    return uoms.filter((item) => item.status === 'Active');
  }, [uoms]);

  const filteredUoms = useMemo(() => {
    const keyword = searchText.toLowerCase().trim();

    if (!keyword) return uoms;

    return uoms.filter((item) => {
      return [
        item.uomCode,
        item.uomName,
        item.uomType,
        item.baseUom,
        item.conversionToBase,
        item.decimalAllowed ? 'decimal allowed yes' : 'integer no decimal',
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

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();

    form.setFieldsValue({
      uomType: 'Quantity',
      conversionToBase: 1,
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
      baseUom: record.baseUom,
      conversionToBase: record.conversionToBase,
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
        uomType: normalizeUomType(values.uomType),
        baseUom: normalizeCode(values.baseUom),
        conversionToBase: normalizeNumber(values.conversionToBase, 1),
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
      closeModal();
    } catch {
      // Ant Design validation will show field errors automatically.
    }
  };

  const handleTemplateDownload = () => {
    const sampleRows: UomRecord[] = [
      {
        id: '',
        uomCode: 'PCS',
        uomName: 'Pieces',
        uomType: 'Quantity',
        baseUom: 'PCS',
        conversionToBase: 1,
        decimalAllowed: false,
        status: 'Active',
        remark: 'Basic quantity UOM.',
      },
      {
        id: '',
        uomCode: 'CTN',
        uomName: 'Carton',
        uomType: 'Package',
        baseUom: 'PCS',
        conversionToBase: 24,
        decimalAllowed: false,
        status: 'Active',
        remark: 'Example: 1 CTN = 24 PCS.',
      },
      {
        id: '',
        uomCode: 'KG',
        uomName: 'Kilogram',
        uomType: 'Weight',
        baseUom: 'KG',
        conversionToBase: 1,
        decimalAllowed: true,
        status: 'Active',
        remark: 'Weight UOM with decimal allowed.',
      },
    ];

    const csv = convertToCSV(sampleRows);

    downloadFile('uom_master_template.csv', csv);
    message.success('UOM Master template downloaded successfully.');
  };

  const handleExport = () => {
    if (filteredUoms.length === 0) {
      message.warning('No UOM data to export.');
      return;
    }

    const csv = convertToCSV(filteredUoms);

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
      const skippedRows: string[] = [];

      const importedRecords = rows
        .map((row, index) => {
          const rowNo = index + 2;

          const uomCode = normalizeCode(
            getCSVValue(row, ['uomCode', 'UOM Code']),
          );

          const uomName = normalizeText(
            getCSVValue(row, ['uomName', 'UOM Name']),
          );

          const uomType = normalizeUomType(
            getCSVValue(row, ['uomType', 'UOM Type']),
          );

          if (!uomCode || !uomName) {
            skippedRows.push(`Row ${rowNo}: Missing uomCode or uomName.`);
            return null;
          }

          const conversionToBase = normalizeNumber(
            getCSVValue(row, ['conversionToBase', 'Conversion To Base']),
            1,
          );

          const record: UomRecord = {
            id: generateId(),
            uomCode,
            uomName,
            uomType,
            baseUom: normalizeCode(getCSVValue(row, ['baseUom', 'Base UOM'])),
            conversionToBase,
            decimalAllowed: normalizeBoolean(
              getCSVValue(row, [
                'decimalAllowed',
                'Decimal Allowed',
                'Allow Decimal',
              ]),
              false,
            ),
            status: normalizeStatus(getCSVValue(row, ['status', 'Status'])),
            remark: normalizeText(getCSVValue(row, ['remark', 'Remark'])),
            createdAt: now,
            updatedAt: now,
          };

          return record;
        })
        .filter(Boolean) as UomRecord[];

      if (importedRecords.length === 0) {
        Modal.error({
          title: 'No valid UOM records found',
          content:
            'Required fields: uomCode and uomName. Please check your CSV file.',
        });

        return;
      }

      let addedCount = 0;
      let updatedCount = 0;

      const merged = [...uoms];

      importedRecords.forEach((imported) => {
        const existingIndex = merged.findIndex(
          (item) =>
            item.uomCode.toLowerCase() === imported.uomCode.toLowerCase(),
        );

        if (existingIndex >= 0) {
          updatedCount += 1;

          merged[existingIndex] = {
            ...merged[existingIndex],
            ...imported,
            id: merged[existingIndex].id,
            createdAt: merged[existingIndex].createdAt,
            updatedAt: now,
          };
        } else {
          addedCount += 1;
          merged.unshift(imported);
        }
      });

      saveUoms(merged);

      if (skippedRows.length > 0) {
        Modal.warning({
          title: 'CSV imported with warnings',
          content: (
            <div>
              <p>
                Added: {addedCount}, Updated: {updatedCount}, Skipped:{' '}
                {skippedRows.length}
              </p>

              <ul>
                {skippedRows.slice(0, 10).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              {skippedRows.length > 10 && (
                <p>And {skippedRows.length - 10} more skipped row(s).</p>
              )}
            </div>
          ),
        });
      } else {
        message.success(
          `CSV imported successfully. Added: ${addedCount}, Updated: ${updatedCount}`,
        );
      }
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
      title: 'Base UOM',
      dataIndex: 'baseUom',
      key: 'baseUom',
      width: 130,
      render: (value: string) => value || '-',
    },
    {
      title: 'Conversion To Base',
      dataIndex: 'conversionToBase',
      key: 'conversionToBase',
      width: 170,
      align: 'right',
      render: (value: number) => value ?? '-',
    },
    {
      title: 'Decimal Allowed',
      dataIndex: 'decimalAllowed',
      key: 'decimalAllowed',
      width: 150,
      filters: [
        { text: 'Yes', value: true },
        { text: 'No', value: false },
      ],
      onFilter: (value, record) =>
        record.decimalAllowed ===
        (value === true || String(value).toLowerCase() === 'true'),
      render: (value: boolean) =>
        value ? <Tag color="green">Yes</Tag> : <Tag color="orange">No</Tag>,
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
      width: 250,
      render: (value: string) => value || '-',
    },
    {
      title: 'Action',
      key: 'action',
      width: 130,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
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
              placeholder="Search UOM code, name, type, base UOM, status..."
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
          scroll={{ x: 1250 }}
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
        onCancel={closeModal}
        okText={editingRecord ? 'Update' : 'Create'}
        width={800}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            uomType: 'Quantity',
            conversionToBase: 1,
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
                  {
                    max: 30,
                    message: 'UOM code cannot exceed 30 characters.',
                  },
                  {
                    pattern: /^[A-Za-z0-9-_./]+$/,
                    message:
                      'UOM code should only contain letters, numbers, dash, underscore, dot or slash.',
                  },
                ]}
              >
                <Input placeholder="Example: PCS, CTN, KG, LTR" />
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
              <Form.Item label="Base UOM" name="baseUom">
                <Select
                  showSearch
                  allowClear
                  placeholder="Select base UOM"
                  optionFilterProp="label"
                  options={activeUoms.map((uom) => ({
                    label: `${uom.uomCode} - ${uom.uomName}`,
                    value: uom.uomCode,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Conversion To Base"
                name="conversionToBase"
                tooltip="Example: if 1 CTN = 24 PCS, then base UOM is PCS and conversion is 24."
              >
                <InputNumber
                  min={0}
                  precision={4}
                  style={{ width: '100%' }}
                  placeholder="Example: 1 or 24"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Decimal Allowed"
                name="decimalAllowed"
                valuePropName="checked"
              >
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
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

            <Col xs={24}>
              <Form.Item label="Remark" name="remark">
                <Input.TextArea rows={3} placeholder="Optional notes..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}