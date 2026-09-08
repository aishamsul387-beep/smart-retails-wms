'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';

type RecordStatus = 'Active' | 'Inactive';
type MovementDirection = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'NONE';

interface MovementTypeRecord {
  id: string;
  movementCode: string;
  movementName: string;
  category: string;
  direction: MovementDirection;
  affectsStock: boolean;
  requiresSource: boolean;
  requiresDestination: boolean;
  allowNegativeStock: boolean;
  sortOrder: number;
  status: RecordStatus;
  description?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'wms_movement_type_master';

const CATEGORY_OPTIONS = [
  'INBOUND',
  'OUTBOUND',
  'INVENTORY',
  'TRANSFER',
  'ADJUSTMENT',
  'RETURN',
  'DAMAGE',
  'SYSTEM',
];

const DIRECTION_OPTIONS: MovementDirection[] = [
  'IN',
  'OUT',
  'TRANSFER',
  'ADJUSTMENT',
  'NONE',
];

const nowForDefault = new Date().toISOString();

const DEFAULT_MOVEMENT_TYPES: MovementTypeRecord[] = [
  {
    id: 'MOVE-STOCK-IN',
    movementCode: 'STOCK_IN',
    movementName: 'Stock In',
    category: 'INBOUND',
    direction: 'IN',
    affectsStock: true,
    requiresSource: false,
    requiresDestination: true,
    allowNegativeStock: false,
    sortOrder: 10,
    status: 'Active',
    description: 'Increase inventory stock quantity.',
    remark: 'Used for GRN receive or manual stock in.',
    createdAt: nowForDefault,
    updatedAt: nowForDefault,
  },
  {
    id: 'MOVE-STOCK-TRANSFER',
    movementCode: 'STOCK_TRANSFER',
    movementName: 'Stock Transfer',
    category: 'TRANSFER',
    direction: 'TRANSFER',
    affectsStock: true,
    requiresSource: true,
    requiresDestination: true,
    allowNegativeStock: false,
    sortOrder: 20,
    status: 'Active',
    description: 'Transfer stock between plants or locations.',
    remark: 'Used for plant-to-plant and location-to-location transfer.',
    createdAt: nowForDefault,
    updatedAt: nowForDefault,
  },
  {
    id: 'MOVE-STOCK-ADJUSTMENT',
    movementCode: 'STOCK_ADJUSTMENT',
    movementName: 'Stock Adjustment',
    category: 'ADJUSTMENT',
    direction: 'ADJUSTMENT',
    affectsStock: true,
    requiresSource: false,
    requiresDestination: true,
    allowNegativeStock: false,
    sortOrder: 30,
    status: 'Active',
    description: 'Adjust stock quantity due to stock count or correction.',
    remark: 'Used for inventory correction.',
    createdAt: nowForDefault,
    updatedAt: nowForDefault,
  },
  {
    id: 'MOVE-STOCK-DEPLETION',
    movementCode: 'STOCK_DEPLETION',
    movementName: 'Stock Depletion',
    category: 'OUTBOUND',
    direction: 'OUT',
    affectsStock: true,
    requiresSource: true,
    requiresDestination: false,
    allowNegativeStock: false,
    sortOrder: 40,
    status: 'Active',
    description: 'Reduce inventory stock quantity.',
    remark: 'Used for online orders or outbound dispatch.',
    createdAt: nowForDefault,
    updatedAt: nowForDefault,
  },
  {
    id: 'MOVE-GRN-RECEIVE',
    movementCode: 'GRN_RECEIVE',
    movementName: 'GRN Receive',
    category: 'INBOUND',
    direction: 'IN',
    affectsStock: true,
    requiresSource: false,
    requiresDestination: true,
    allowNegativeStock: false,
    sortOrder: 50,
    status: 'Active',
    description: 'Receive goods from GRN and update inventory stock.',
    remark: 'Future integration with Inbound GRN module.',
    createdAt: nowForDefault,
    updatedAt: nowForDefault,
  },
  {
    id: 'MOVE-OUTBOUND-PICK',
    movementCode: 'OUTBOUND_PICK',
    movementName: 'Outbound Pick',
    category: 'OUTBOUND',
    direction: 'OUT',
    affectsStock: true,
    requiresSource: true,
    requiresDestination: false,
    allowNegativeStock: false,
    sortOrder: 60,
    status: 'Active',
    description: 'Pick stock for outbound order.',
    remark: 'Future outbound picking process.',
    createdAt: nowForDefault,
    updatedAt: nowForDefault,
  },
  {
    id: 'MOVE-OUTBOUND-DISPATCH',
    movementCode: 'OUTBOUND_DISPATCH',
    movementName: 'Outbound Dispatch',
    category: 'OUTBOUND',
    direction: 'OUT',
    affectsStock: true,
    requiresSource: true,
    requiresDestination: false,
    allowNegativeStock: false,
    sortOrder: 70,
    status: 'Active',
    description: 'Dispatch stock to customer or sales channel.',
    remark: 'Future outbound dispatch process.',
    createdAt: nowForDefault,
    updatedAt: nowForDefault,
  },
  {
    id: 'MOVE-RETURN-IN',
    movementCode: 'RETURN_IN',
    movementName: 'Return In',
    category: 'RETURN',
    direction: 'IN',
    affectsStock: true,
    requiresSource: false,
    requiresDestination: true,
    allowNegativeStock: false,
    sortOrder: 80,
    status: 'Active',
    description: 'Receive returned goods back into stock.',
    remark: 'Future customer return process.',
    createdAt: nowForDefault,
    updatedAt: nowForDefault,
  },
  {
    id: 'MOVE-DAMAGE',
    movementCode: 'DAMAGE',
    movementName: 'Damage',
    category: 'DAMAGE',
    direction: 'OUT',
    affectsStock: true,
    requiresSource: true,
    requiresDestination: false,
    allowNegativeStock: false,
    sortOrder: 90,
    status: 'Active',
    description: 'Reduce stock due to damaged goods.',
    remark: 'Used for damaged stock write-down.',
    createdAt: nowForDefault,
    updatedAt: nowForDefault,
  },
  {
    id: 'MOVE-WRITE-OFF',
    movementCode: 'WRITE_OFF',
    movementName: 'Write Off',
    category: 'ADJUSTMENT',
    direction: 'OUT',
    affectsStock: true,
    requiresSource: true,
    requiresDestination: false,
    allowNegativeStock: false,
    sortOrder: 100,
    status: 'Active',
    description: 'Write off stock from inventory.',
    remark: 'Used for expired, damaged, or lost stock.',
    createdAt: nowForDefault,
    updatedAt: nowForDefault,
  },
];

function normalizeText(value: any) {
  return String(value ?? '').trim();
}

function normalizeCode(value: any) {
  return normalizeText(value).toUpperCase().replace(/\s+/g, '_');
}

function boolFromUnknown(value: any) {
  const text = String(value ?? '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1'].includes(text);
}

function escapeCsv(value: any) {
  const text = String(value ?? '');

  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadFile(
  filename: string,
  content: string,
  mimeType = 'text/csv;charset=utf-8;',
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function toCsv(records: MovementTypeRecord[]) {
  const headers = [
    'movementCode',
    'movementName',
    'category',
    'direction',
    'affectsStock',
    'requiresSource',
    'requiresDestination',
    'allowNegativeStock',
    'sortOrder',
    'status',
    'description',
    'remark',
  ];

  const rows = records.map((record) =>
    headers.map((key) => escapeCsv((record as any)[key])).join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let insideQuote = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuote && nextChar === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      insideQuote = !insideQuote;
      continue;
    }

    if (char === ',' && !insideQuote) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);

  return result.map((item) => item.trim());
}

function parseCsv(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return [];

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record: any = {};

    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });

    return record;
  });
}

function getDirectionColor(direction: MovementDirection) {
  if (direction === 'IN') return 'green';
  if (direction === 'OUT') return 'red';
  if (direction === 'TRANSFER') return 'blue';
  if (direction === 'ADJUSTMENT') return 'orange';

  return 'default';
}

function getCategoryColor(category: string) {
  const value = normalizeCode(category);

  if (value === 'INBOUND') return 'green';
  if (value === 'OUTBOUND') return 'red';
  if (value === 'TRANSFER') return 'blue';
  if (value === 'ADJUSTMENT') return 'orange';
  if (value === 'RETURN') return 'purple';
  if (value === 'DAMAGE') return 'volcano';
  if (value === 'SYSTEM') return 'default';

  return 'cyan';
}

export default function MovementTypeMasterPage() {
  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [records, setRecords] = useState<MovementTypeRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<MovementTypeRecord | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
      try {
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
          setRecords(parsed);
          return;
        }
      } catch {
        // fallback to default data
      }
    }

    setRecords(DEFAULT_MOVEMENT_TYPES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MOVEMENT_TYPES));
  }, []);

  const saveToStorage = (nextRecords: MovementTypeRecord[]) => {
    setRecords(nextRecords);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
  };

  const filteredRecords = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return records;

    return records.filter((record) => {
      const combined = [
        record.movementCode,
        record.movementName,
        record.category,
        record.direction,
        record.status,
        record.description,
        record.remark,
      ]
        .join(' ')
        .toLowerCase();

      return combined.includes(keyword);
    });
  }, [records, searchText]);

  const summary = useMemo(() => {
    return {
      total: records.length,
      active: records.filter((item) => item.status === 'Active').length,
      stockAffecting: records.filter((item) => item.affectsStock).length,
      transfer: records.filter((item) => item.direction === 'TRANSFER').length,
    };
  }, [records]);

  const openCreateModal = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      category: 'INVENTORY',
      direction: 'IN',
      affectsStock: true,
      requiresSource: false,
      requiresDestination: true,
      allowNegativeStock: false,
      sortOrder: 1,
      status: 'Active',
    });
    setModalOpen(true);
  };

  const openEditModal = (record: MovementTypeRecord) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleCancel = () => {
    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const values = await form.validateFields();

      const movementCode = normalizeCode(values.movementCode);
      const movementName = normalizeText(values.movementName);
      const category = normalizeCode(values.category);
      const direction = values.direction as MovementDirection;

      const duplicate = records.some((item) => {
        const sameCode = normalizeCode(item.movementCode) === movementCode;
        const differentRecord = editingRecord
          ? item.id !== editingRecord.id
          : true;

        return sameCode && differentRecord;
      });

      if (duplicate) {
        message.error('Movement Code already exists.');
        return;
      }

      const now = new Date().toISOString();

      const payload: MovementTypeRecord = {
        id: editingRecord?.id || `MOVE-${Date.now()}`,
        movementCode,
        movementName,
        category,
        direction,
        affectsStock: Boolean(values.affectsStock),
        requiresSource: Boolean(values.requiresSource),
        requiresDestination: Boolean(values.requiresDestination),
        allowNegativeStock: Boolean(values.allowNegativeStock),
        sortOrder: Number(values.sortOrder || 0),
        status: values.status || 'Active',
        description: normalizeText(values.description),
        remark: normalizeText(values.remark),
        createdAt: editingRecord?.createdAt || now,
        updatedAt: now,
      };

      let nextRecords: MovementTypeRecord[];

      if (editingRecord) {
        nextRecords = records.map((item) =>
          item.id === editingRecord.id ? payload : item,
        );
        message.success('Movement Type updated successfully.');
      } else {
        nextRecords = [payload, ...records];
        message.success('Movement Type created successfully.');
      }

      saveToStorage(nextRecords);
      handleCancel();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (record: MovementTypeRecord) => {
    const nextRecords = records.filter((item) => item.id !== record.id);

    saveToStorage(nextRecords);
    message.success('Movement Type deleted successfully.');
  };

  const handleDownloadTemplate = () => {
    const template = [
      'movementCode,movementName,category,direction,affectsStock,requiresSource,requiresDestination,allowNegativeStock,sortOrder,status,description,remark',
      'STOCK_IN,Stock In,INBOUND,IN,true,false,true,false,10,Active,Increase inventory stock quantity,Used for GRN receive or manual stock in',
      'STOCK_TRANSFER,Stock Transfer,TRANSFER,TRANSFER,true,true,true,false,20,Active,Transfer stock between plants or locations,Used for internal transfer',
      'STOCK_DEPLETION,Stock Depletion,OUTBOUND,OUT,true,true,false,false,40,Active,Reduce inventory stock quantity,Used for order depletion',
    ].join('\n');

    downloadFile('movement_type_master_template.csv', template);
    message.success('Movement Type template downloaded.');
  };

  const handleExport = () => {
    downloadFile('movement_type_master.csv', toCsv(filteredRecords));
    message.success('Movement Type Master exported successfully.');
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const content = await file.text();
      const parsedRows = parseCsv(content);

      if (!parsedRows.length) {
        message.warning('CSV file is empty or invalid.');
        return;
      }

      const now = new Date().toISOString();
      const importedRecords: MovementTypeRecord[] = [];

      parsedRows.forEach((row: any, index: number) => {
        const movementCode = normalizeCode(row.movementCode || row.code);
        const movementName = normalizeText(row.movementName || row.name);

        if (!movementCode || !movementName) return;

        const rawDirection = normalizeCode(
          row.direction || 'NONE',
        ) as MovementDirection;

        const direction: MovementDirection = DIRECTION_OPTIONS.includes(
          rawDirection,
        )
          ? rawDirection
          : 'NONE';

        importedRecords.push({
          id: `MOVE-IMPORT-${Date.now()}-${index}`,
          movementCode,
          movementName,
          category: normalizeCode(row.category || 'INVENTORY'),
          direction,
          affectsStock: boolFromUnknown(row.affectsStock),
          requiresSource: boolFromUnknown(row.requiresSource),
          requiresDestination: boolFromUnknown(row.requiresDestination),
          allowNegativeStock: boolFromUnknown(row.allowNegativeStock),
          sortOrder: Number(row.sortOrder || 0),
          status:
            normalizeText(row.status).toLowerCase() === 'inactive'
              ? 'Inactive'
              : 'Active',
          description: normalizeText(row.description),
          remark: normalizeText(row.remark),
          createdAt: now,
          updatedAt: now,
        });
      });

      if (!importedRecords.length) {
        message.warning('No valid movement type records found in CSV.');
        return;
      }

      const merged = [...records];

      importedRecords.forEach((imported) => {
        const existingIndex = merged.findIndex(
          (item) =>
            normalizeCode(item.movementCode) ===
            normalizeCode(imported.movementCode),
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
          merged.push(imported);
        }
      });

      saveToStorage(merged);
      message.success(
        `${importedRecords.length} movement type record(s) imported successfully.`,
      );
    } catch (error) {
      console.error(error);
      message.error('Failed to import CSV file.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const columns: ColumnsType<MovementTypeRecord> = [
    {
      title: 'Movement Code',
      dataIndex: 'movementCode',
      key: 'movementCode',
      sorter: (a, b) => a.movementCode.localeCompare(b.movementCode),
      render: (value) => <strong>{value}</strong>,
    },
    {
      title: 'Movement Name',
      dataIndex: 'movementName',
      key: 'movementName',
      sorter: (a, b) => a.movementName.localeCompare(b.movementName),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      filters: CATEGORY_OPTIONS.map((item) => ({
        text: item,
        value: item,
      })),
      onFilter: (value, record) => record.category === String(value),
      render: (value) => <Tag color={getCategoryColor(value)}>{value}</Tag>,
    },
    {
      title: 'Direction',
      dataIndex: 'direction',
      key: 'direction',
      width: 130,
      filters: DIRECTION_OPTIONS.map((item) => ({
        text: item,
        value: item,
      })),
      onFilter: (value, record) => record.direction === String(value),
      render: (value: MovementDirection) => (
        <Tag color={getDirectionColor(value)}>{value}</Tag>
      ),
    },
    {
      title: 'Affects Stock',
      dataIndex: 'affectsStock',
      key: 'affectsStock',
      width: 120,
      filters: [
        { text: 'Yes', value: 'true' },
        { text: 'No', value: 'false' },
      ],
      onFilter: (value, record) =>
        String(record.affectsStock) === String(value),
      render: (value) =>
        value ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>,
    },
    {
      title: 'Source',
      dataIndex: 'requiresSource',
      key: 'requiresSource',
      width: 100,
      filters: [
        { text: 'Required', value: 'true' },
        { text: 'Not Required', value: 'false' },
      ],
      onFilter: (value, record) =>
        String(record.requiresSource) === String(value),
      render: (value) =>
        value ? <Tag color="blue">Required</Tag> : <Tag>Not Required</Tag>,
    },
    {
      title: 'Destination',
      dataIndex: 'requiresDestination',
      key: 'requiresDestination',
      width: 120,
      filters: [
        { text: 'Required', value: 'true' },
        { text: 'Not Required', value: 'false' },
      ],
      onFilter: (value, record) =>
        String(record.requiresDestination) === String(value),
      render: (value) =>
        value ? <Tag color="blue">Required</Tag> : <Tag>Not Required</Tag>,
    },
    {
      title: 'Allow Negative',
      dataIndex: 'allowNegativeStock',
      key: 'allowNegativeStock',
      width: 130,
      filters: [
        { text: 'Yes', value: 'true' },
        { text: 'No', value: 'false' },
      ],
      onFilter: (value, record) =>
        String(record.allowNegativeStock) === String(value),
      render: (value) =>
        value ? <Tag color="red">Yes</Tag> : <Tag color="green">No</Tag>,
    },
    {
      title: 'Sort',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 80,
      sorter: (a, b) => a.sortOrder - b.sortOrder,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      filters: [
        { text: 'Active', value: 'Active' },
        { text: 'Inactive', value: 'Inactive' },
      ],
      onFilter: (value, record) => record.status === String(value),
      render: (value) =>
        value === 'Active' ? (
          <Tag color="green">Active</Tag>
        ) : (
          <Tag color="red">Inactive</Tag>
        ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Remark',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>

          <Tooltip title="Delete">
            <Popconfirm
              title="Delete this movement type?"
              description="This action cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(record)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 4 }}>Movement Type Master</h1>

        <div style={{ color: '#666' }}>
          Standardized inventory movement types for GRN receive, stock in, stock
          transfer, adjustment, depletion, outbound, return, damage, and write
          off operations.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Card>
          <div style={{ color: '#888' }}>Total Movement Types</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.total}</div>
        </Card>

        <Card>
          <div style={{ color: '#888' }}>Active</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>
            {summary.active}
          </div>
        </Card>

        <Card>
          <div style={{ color: '#888' }}>Affects Stock</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>
            {summary.stockAffecting}
          </div>
        </Card>

        <Card>
          <div style={{ color: '#888' }}>Transfer Type</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#7c3aed' }}>
            {summary.transfer}
          </div>
        </Card>
      </div>

      <Card>
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Input.Search
            allowClear
            placeholder="Search movement code, name, category, direction, description, remark..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            style={{ maxWidth: 650 }}
          />

          <Space wrap>
            <Button onClick={handleDownloadTemplate}>Template CSV</Button>

            <Button
              icon={<UploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
            >
              Import CSV
            </Button>

            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              Export CSV
            </Button>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
            >
              Add Movement Type
            </Button>
          </Space>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRecords}
          bordered
          size="small"
          scroll={{ x: 1700 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} Movement Type(s)`,
          }}
        />
      </Card>

      <Modal
        title={editingRecord ? 'Edit Movement Type' : 'Add Movement Type'}
        open={modalOpen}
        onCancel={handleCancel}
        onOk={handleSave}
        okText={editingRecord ? 'Update' : 'Create'}
        confirmLoading={saving}
        width={850}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            category: 'INVENTORY',
            direction: 'IN',
            affectsStock: true,
            requiresSource: false,
            requiresDestination: true,
            allowNegativeStock: false,
            sortOrder: 1,
            status: 'Active',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
            }}
          >
            <Form.Item
              label="Movement Code"
              name="movementCode"
              rules={[
                { required: true, message: 'Please enter movement code.' },
                {
                  pattern: /^[A-Za-z0-9_-]+$/,
                  message:
                    'Only letters, numbers, underscore and dash are allowed.',
                },
              ]}
            >
              <Input placeholder="Example: STOCK_IN, STOCK_TRANSFER" />
            </Form.Item>

            <Form.Item
              label="Movement Name"
              name="movementName"
              rules={[
                { required: true, message: 'Please enter movement name.' },
              ]}
            >
              <Input placeholder="Example: Stock In, Stock Transfer" />
            </Form.Item>

            <Form.Item
              label="Category"
              name="category"
              rules={[{ required: true, message: 'Please select category.' }]}
            >
              <Select
                showSearch
                placeholder="Select category"
                options={CATEGORY_OPTIONS.map((item) => ({
                  label: item,
                  value: item,
                }))}
              />
            </Form.Item>

            <Form.Item
              label="Direction"
              name="direction"
              rules={[
                { required: true, message: 'Please select direction.' },
              ]}
            >
              <Select
                placeholder="Select movement direction"
                options={DIRECTION_OPTIONS.map((item) => ({
                  label: item,
                  value: item,
                }))}
              />
            </Form.Item>

            <Form.Item
              label="Sort Order"
              name="sortOrder"
              rules={[
                { required: true, message: 'Please enter sort order.' },
              ]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label="Record Status"
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
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 16,
              marginTop: 8,
            }}
          >
            <Form.Item
              label="Affects Stock"
              name="affectsStock"
              valuePropName="checked"
            >
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>

            <Form.Item
              label="Requires Source"
              name="requiresSource"
              valuePropName="checked"
            >
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>

            <Form.Item
              label="Requires Destination"
              name="requiresDestination"
              valuePropName="checked"
            >
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>

            <Form.Item
              label="Allow Negative Stock"
              name="allowNegativeStock"
              valuePropName="checked"
            >
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>
          </div>

          <Form.Item label="Description" name="description">
            <Input.TextArea
              rows={3}
              placeholder="Optional description about this movement type..."
            />
          </Form.Item>

          <Form.Item label="Remark" name="remark">
            <Input.TextArea rows={3} placeholder="Optional remark..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}