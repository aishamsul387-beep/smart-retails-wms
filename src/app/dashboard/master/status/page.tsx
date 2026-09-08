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

interface StatusMasterRecord {
  id: string;
  statusCode: string;
  statusName: string;
  module: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  status: RecordStatus;
  description?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'wms_status_master';

const MODULE_OPTIONS = [
  'GENERAL',
  'PRODUCT',
  'SUPPLIER',
  'PLANT',
  'LOCATION',
  'INVENTORY',
  'BATCH',
  'GRN',
  'PURCHASE',
  'OUTBOUND',
  'STOCK_MOVEMENT',
  'PAYMENT',
];

const COLOR_OPTIONS = [
  'green',
  'blue',
  'red',
  'orange',
  'purple',
  'cyan',
  'gold',
  'lime',
  'magenta',
  'volcano',
  'geekblue',
  'default',
];

const DEFAULT_STATUS_DATA: StatusMasterRecord[] = [
  {
    id: 'STATUS-ACTIVE',
    statusCode: 'ACTIVE',
    statusName: 'Active',
    module: 'GENERAL',
    color: 'green',
    sortOrder: 1,
    isDefault: true,
    status: 'Active',
    description: 'Record is active and available for transaction.',
    remark: 'Default active status.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'STATUS-INACTIVE',
    statusCode: 'INACTIVE',
    statusName: 'Inactive',
    module: 'GENERAL',
    color: 'red',
    sortOrder: 2,
    isDefault: false,
    status: 'Active',
    description: 'Record is inactive and hidden from normal transaction.',
    remark: 'Default inactive status.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'STATUS-DRAFT',
    statusCode: 'DRAFT',
    statusName: 'Draft',
    module: 'GRN',
    color: 'default',
    sortOrder: 10,
    isDefault: true,
    status: 'Active',
    description: 'Draft document status.',
    remark: 'Used for draft GRN / transaction documents.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'STATUS-RECEIVED',
    statusCode: 'RECEIVED',
    statusName: 'Received',
    module: 'GRN',
    color: 'blue',
    sortOrder: 20,
    isDefault: false,
    status: 'Active',
    description: 'Inbound goods have been received.',
    remark: 'Used after GRN receive process.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'STATUS-CANCELLED',
    statusCode: 'CANCELLED',
    statusName: 'Cancelled',
    module: 'GENERAL',
    color: 'red',
    sortOrder: 99,
    isDefault: false,
    status: 'Active',
    description: 'Document or record has been cancelled.',
    remark: 'General cancellation status.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function normalizeText(value: any) {
  return String(value ?? '').trim();
}

function normalizeCode(value: any) {
  return normalizeText(value).toUpperCase();
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

function escapeCsv(value: any) {
  const text = String(value ?? '');

  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toCsv(records: StatusMasterRecord[]) {
  const headers = [
    'statusCode',
    'statusName',
    'module',
    'color',
    'sortOrder',
    'isDefault',
    'status',
    'description',
    'remark',
  ];

  const rows = records.map((item) =>
    headers.map((key) => escapeCsv((item as any)[key])).join(','),
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

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record: any = {};

    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });

    return record;
  });
}

export default function StatusMasterPage() {
  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [records, setRecords] = useState<StatusMasterRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StatusMasterRecord | null>(
    null,
  );
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

    setRecords(DEFAULT_STATUS_DATA);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATUS_DATA));
  }, []);

  const saveToStorage = (nextRecords: StatusMasterRecord[]) => {
    setRecords(nextRecords);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
  };

  const filteredRecords = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return records;

    return records.filter((item) => {
      const combined = [
        item.statusCode,
        item.statusName,
        item.module,
        item.color,
        item.status,
        item.description,
        item.remark,
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
      inactive: records.filter((item) => item.status === 'Inactive').length,
      defaultCount: records.filter((item) => item.isDefault).length,
    };
  }, [records]);

  const openCreateModal = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      module: 'GENERAL',
      color: 'green',
      sortOrder: 1,
      isDefault: false,
      status: 'Active',
    });
    setModalOpen(true);
  };

  const openEditModal = (record: StatusMasterRecord) => {
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

      const statusCode = normalizeCode(values.statusCode);
      const statusName = normalizeText(values.statusName);
      const moduleName = normalizeCode(values.module);

      const duplicate = records.some((item) => {
        const sameCode = normalizeCode(item.statusCode) === statusCode;
        const sameModule = normalizeCode(item.module) === moduleName;
        const differentRecord = editingRecord
          ? item.id !== editingRecord.id
          : true;

        return sameCode && sameModule && differentRecord;
      });

      if (duplicate) {
        message.error('Status Code already exists in the same module.');
        return;
      }

      const now = new Date().toISOString();

      const payload: StatusMasterRecord = {
        id: editingRecord?.id || `STATUS-${Date.now()}`,
        statusCode,
        statusName,
        module: moduleName,
        color: values.color || 'default',
        sortOrder: Number(values.sortOrder || 0),
        isDefault: Boolean(values.isDefault),
        status: values.status || 'Active',
        description: normalizeText(values.description),
        remark: normalizeText(values.remark),
        createdAt: editingRecord?.createdAt || now,
        updatedAt: now,
      };

      let nextRecords: StatusMasterRecord[];

      if (editingRecord) {
        nextRecords = records.map((item) =>
          item.id === editingRecord.id ? payload : item,
        );
        message.success('Status updated successfully.');
      } else {
        nextRecords = [payload, ...records];
        message.success('Status created successfully.');
      }

      saveToStorage(nextRecords);
      handleCancel();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (record: StatusMasterRecord) => {
    const nextRecords = records.filter((item) => item.id !== record.id);

    saveToStorage(nextRecords);
    message.success('Status deleted successfully.');
  };

  const handleExport = () => {
    downloadFile('status_master.csv', toCsv(filteredRecords));
    message.success('Status Master exported successfully.');
  };

  const handleDownloadTemplate = () => {
    const template = [
      'statusCode,statusName,module,color,sortOrder,isDefault,status,description,remark',
      'ACTIVE,Active,GENERAL,green,1,true,Active,Record is active,Default active status',
      'INACTIVE,Inactive,GENERAL,red,2,false,Active,Record is inactive,Default inactive status',
    ].join('\n');

    downloadFile('status_master_template.csv', template);
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

      const importedRecords: StatusMasterRecord[] = [];

      parsedRows.forEach((row: any, index: number) => {
        const statusCode = normalizeCode(row.statusCode || row.code);
        const statusName = normalizeText(row.statusName || row.name);
        const moduleName = normalizeCode(row.module || 'GENERAL');

        if (!statusCode || !statusName) {
          return;
        }

        importedRecords.push({
          id: `STATUS-IMPORT-${Date.now()}-${index}`,
          statusCode,
          statusName,
          module: moduleName,
          color: normalizeText(row.color) || 'default',
          sortOrder: Number(row.sortOrder || 0),
          isDefault: String(row.isDefault || '').toLowerCase() === 'true',
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
        message.warning('No valid status records found in CSV.');
        return;
      }

      const merged = [...records];

      importedRecords.forEach((imported) => {
        const existingIndex = merged.findIndex(
          (item) =>
            normalizeCode(item.statusCode) ===
              normalizeCode(imported.statusCode) &&
            normalizeCode(item.module) === normalizeCode(imported.module),
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
        `${importedRecords.length} status record(s) imported successfully.`,
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

  const columns: ColumnsType<StatusMasterRecord> = [
    {
      title: 'Status Code',
      dataIndex: 'statusCode',
      key: 'statusCode',
      sorter: (a, b) => a.statusCode.localeCompare(b.statusCode),
      render: (value) => <strong>{value}</strong>,
    },
    {
      title: 'Status Name',
      dataIndex: 'statusName',
      key: 'statusName',
      sorter: (a, b) => a.statusName.localeCompare(b.statusName),
    },
    {
      title: 'Module',
      dataIndex: 'module',
      key: 'module',
      filters: MODULE_OPTIONS.map((item) => ({
        text: item,
        value: item,
      })),
      onFilter: (value, record) => record.module === String(value),
      render: (value) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: 'Color',
      dataIndex: 'color',
      key: 'color',
      render: (value, record) => (
        <Tag color={value === 'default' ? undefined : value}>
          {record.statusName}
        </Tag>
      ),
    },
    {
      title: 'Sort',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 80,
      sorter: (a, b) => a.sortOrder - b.sortOrder,
    },
    {
      title: 'Default',
      dataIndex: 'isDefault',
      key: 'isDefault',
      width: 100,
      filters: [
        { text: 'Yes', value: 'true' },
        { text: 'No', value: 'false' },
      ],
      onFilter: (value, record) => record.isDefault === (value === 'true'),
      render: (value) =>
        value ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>,
    },
    {
      title: 'Record Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
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
              title="Delete this status?"
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
        <h1 style={{ marginBottom: 4 }}>Status Master</h1>

        <div style={{ color: '#666' }}>
          Standardized status setup for master data, GRN, inventory, stock
          movement, purchasing, outbound, and future transaction modules.
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
          <div style={{ color: '#888' }}>Total Status</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.total}</div>
        </Card>

        <Card>
          <div style={{ color: '#888' }}>Active</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>
            {summary.active}
          </div>
        </Card>

        <Card>
          <div style={{ color: '#888' }}>Inactive</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>
            {summary.inactive}
          </div>
        </Card>

        <Card>
          <div style={{ color: '#888' }}>Default</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>
            {summary.defaultCount}
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
            placeholder="Search status code, name, module, color, description, remark..."
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
              Add Status
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
          scroll={{ x: 1300 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} Status(es)`,
          }}
        />
      </Card>

      <Modal
        title={editingRecord ? 'Edit Status' : 'Add Status'}
        open={modalOpen}
        onCancel={handleCancel}
        onOk={handleSave}
        okText={editingRecord ? 'Update' : 'Create'}
        confirmLoading={saving}
        width={760}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            module: 'GENERAL',
            color: 'green',
            sortOrder: 1,
            isDefault: false,
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
              label="Status Code"
              name="statusCode"
              rules={[
                { required: true, message: 'Please enter status code.' },
                {
                  pattern: /^[A-Za-z0-9_-]+$/,
                  message:
                    'Only letters, numbers, underscore and dash are allowed.',
                },
              ]}
            >
              <Input placeholder="Example: ACTIVE, DRAFT, RECEIVED" />
            </Form.Item>

            <Form.Item
              label="Status Name"
              name="statusName"
              rules={[
                { required: true, message: 'Please enter status name.' },
              ]}
            >
              <Input placeholder="Example: Active, Draft, Received" />
            </Form.Item>

            <Form.Item
              label="Module"
              name="module"
              rules={[{ required: true, message: 'Please select module.' }]}
            >
              <Select
                showSearch
                placeholder="Select module"
                options={MODULE_OPTIONS.map((item) => ({
                  label: item,
                  value: item,
                }))}
              />
            </Form.Item>

            <Form.Item
              label="Color"
              name="color"
              rules={[{ required: true, message: 'Please select color.' }]}
            >
              <Select
                placeholder="Select tag color"
                options={COLOR_OPTIONS.map((item) => ({
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
              rules={[
                { required: true, message: 'Please select record status.' },
              ]}
            >
              <Select
                options={[
                  { label: 'Active', value: 'Active' },
                  { label: 'Inactive', value: 'Inactive' },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="Default Status"
              name="isDefault"
              valuePropName="checked"
            >
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>
          </div>

          <Form.Item label="Description" name="description">
            <Input.TextArea
              rows={3}
              placeholder="Optional description about this status..."
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