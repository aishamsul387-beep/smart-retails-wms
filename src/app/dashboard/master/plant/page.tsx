'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  Table,
  Tag,
  Upload,
  message,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DownloadOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

type PlantStatus = 'Active' | 'Inactive';
type ModalMode = 'create' | 'edit' | 'view';

interface PlantMaster {
  id: string;
  plantCode: string;
  plantName: string;
  plantSize: string;
  plantAddress: string;
  plantPIC: string;
  plantContactNo: string;
  plantEmail: string;
  plantOpeningDate: string;
  plantStatus: PlantStatus;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'wms_plant_master';

const csvHeaders = [
  'Plant Code',
  'Plant Name',
  'Plant Size',
  'Plant Address',
  'Plant PIC',
  'Plant Contact No.',
  'Plant Email',
  'Plant Opening Date',
  'Plant Status',
  'Remark',
];

const defaultPlants: PlantMaster[] = [
  {
    id: 'PLANT-001',
    plantCode: 'PLANT001',
    plantName: 'Main Warehouse',
    plantSize: '20000 sqft',
    plantAddress: 'Lot 123, Industrial Area, Kuala Lumpur',
    plantPIC: 'Ahmad',
    plantContactNo: '0123456789',
    plantEmail: 'warehouse@example.com',
    plantOpeningDate: '2024-01-01',
    plantStatus: 'Active',
    remark: 'Main receiving and storage plant',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const normalizeHeader = (header: string) =>
  header.toLowerCase().replace(/[\s._-]/g, '');

const normalizeText = (value: unknown) => String(value ?? '').trim();

const normalizePlantCode = (value: unknown) =>
  String(value ?? '').trim().toUpperCase();

const normalizePlantStatus = (value: unknown): PlantStatus => {
  const raw = String(value ?? '').trim().toLowerCase();

  if (raw === 'inactive') {
    return 'Inactive';
  }

  return 'Active';
};

const escapeCSV = (value: unknown) => {
  const str = value === null || value === undefined ? '' : String(value);

  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
};

const splitCSVLine = (line: string) => {
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
};

const downloadCSV = (filename: string, rows: string[][]) => {
  if (!rows.length) {
    message.warning('No data to export.');
    return;
  }

  const csvContent = rows
    .map((row) => row.map((cell) => escapeCSV(cell)).join(','))
    .join('\n');

  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.setAttribute('download', filename);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

const migratePlant = (item: Partial<PlantMaster>): PlantMaster => {
  const now = new Date().toISOString();

  return {
    id: item.id || `PLANT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    plantCode: normalizePlantCode(item.plantCode),
    plantName: normalizeText(item.plantName),
    plantSize: normalizeText(item.plantSize),
    plantAddress: normalizeText(item.plantAddress),
    plantPIC: normalizeText(item.plantPIC),
    plantContactNo: normalizeText(item.plantContactNo),
    plantEmail: normalizeText(item.plantEmail),
    plantOpeningDate: normalizeText(item.plantOpeningDate),
    plantStatus: normalizePlantStatus(item.plantStatus),
    remark: normalizeText(item.remark),
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  };
};

export default function PlantMasterPage() {
  const [form] = Form.useForm<PlantMaster>();

  const [plants, setPlants] = useState<PlantMaster[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedPlant, setSelectedPlant] = useState<PlantMaster | null>(null);

  const isViewMode = modalMode === 'view';

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored) as Partial<PlantMaster>[];

        if (Array.isArray(parsed)) {
          const migratedPlants = parsed
            .map(migratePlant)
            .filter((item) => item.plantCode && item.plantName);

          setPlants(migratedPlants.length > 0 ? migratedPlants : defaultPlants);
        } else {
          setPlants(defaultPlants);
        }
      } else {
        setPlants(defaultPlants);
      }
    } catch (error) {
      console.error(error);
      message.error('Failed to load plant master data.');
      setPlants(defaultPlants);
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
  }, [plants, hasLoaded]);

  const filteredPlants = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return plants;

    return plants.filter((plant) => {
      return [
        plant.plantCode,
        plant.plantName,
        plant.plantSize,
        plant.plantAddress,
        plant.plantPIC,
        plant.plantContactNo,
        plant.plantEmail,
        plant.plantOpeningDate,
        plant.plantStatus,
        plant.remark,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [plants, searchText]);

  const totalPlants = plants.length;

  const activePlants = plants.filter(
    (item) => item.plantStatus === 'Active',
  ).length;

  const inactivePlants = plants.filter(
    (item) => item.plantStatus === 'Inactive',
  ).length;

  const closeModal = () => {
    setModalOpen(false);
    form.resetFields();
    setSelectedPlant(null);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedPlant(null);
    form.resetFields();

    form.setFieldsValue({
      plantStatus: 'Active',
    } as PlantMaster);

    setModalOpen(true);
  };

  const openEditModal = (record: PlantMaster) => {
    setModalMode('edit');
    setSelectedPlant(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const openViewModal = (record: PlantMaster) => {
    setModalMode('view');
    setSelectedPlant(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = (record: PlantMaster) => {
    setPlants((prev) => prev.filter((item) => item.id !== record.id));
    message.success('Plant deleted successfully.');
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const cleanedValues = {
        plantCode: normalizePlantCode(values.plantCode),
        plantName: normalizeText(values.plantName),
        plantSize: normalizeText(values.plantSize),
        plantAddress: normalizeText(values.plantAddress),
        plantPIC: normalizeText(values.plantPIC),
        plantContactNo: normalizeText(values.plantContactNo),
        plantEmail: normalizeText(values.plantEmail),
        plantOpeningDate: normalizeText(values.plantOpeningDate),
        plantStatus: normalizePlantStatus(values.plantStatus),
        remark: normalizeText(values.remark),
      };

      const duplicate = plants.find(
        (item) =>
          normalizePlantCode(item.plantCode) === cleanedValues.plantCode &&
          item.id !== selectedPlant?.id,
      );

      if (duplicate) {
        message.error('Plant Code already exists.');
        return;
      }

      if (modalMode === 'create') {
        const now = new Date().toISOString();

        const newPlant: PlantMaster = {
          id: `PLANT-${Date.now()}`,
          ...cleanedValues,
          createdAt: now,
          updatedAt: now,
        };

        setPlants((prev) => [newPlant, ...prev]);
        message.success('Plant created successfully.');
      }

      if (modalMode === 'edit' && selectedPlant) {
        const updatedPlant: PlantMaster = {
          ...selectedPlant,
          ...cleanedValues,
          updatedAt: new Date().toISOString(),
        };

        setPlants((prev) =>
          prev.map((item) => (item.id === selectedPlant.id ? updatedPlant : item)),
        );

        message.success('Plant updated successfully.');
      }

      closeModal();
    } catch {
      message.error('Please check required fields.');
    }
  };

  const handleExportCSV = () => {
    if (filteredPlants.length === 0) {
      message.warning('No plant data to export.');
      return;
    }

    const rows = [
      csvHeaders,
      ...filteredPlants.map((plant) => [
        plant.plantCode,
        plant.plantName,
        plant.plantSize,
        plant.plantAddress,
        plant.plantPIC,
        plant.plantContactNo,
        plant.plantEmail,
        plant.plantOpeningDate,
        plant.plantStatus,
        plant.remark,
      ]),
    ];

    downloadCSV('plant_master.csv', rows);
    message.success('Plant master exported successfully.');
  };

  const handleDownloadTemplate = () => {
    const rows = [
      csvHeaders,
      [
        'PLANT001',
        'Main Warehouse',
        '20000 sqft',
        'Lot 123, Industrial Area, Kuala Lumpur',
        'Ahmad',
        '0123456789',
        'warehouse@example.com',
        '2024-01-01',
        'Active',
        'Main receiving and storage plant',
      ],
    ];

    downloadCSV('plant_master_template.csv', rows);
    message.success('Plant master template downloaded successfully.');
  };

  const handleImportCSV = (file: File) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '');

        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length < 2) {
          message.error('CSV file has no data.');
          return;
        }

        const headers = splitCSVLine(lines[0]).map(normalizeHeader);

        const getValue = (row: string[], possibleHeaders: string[]) => {
          for (const header of possibleHeaders) {
            const index = headers.indexOf(normalizeHeader(header));

            if (index >= 0) {
              return row[index]?.trim() || '';
            }
          }

          return '';
        };

        const importedPlants: PlantMaster[] = [];
        const now = new Date().toISOString();
        const skippedRows: string[] = [];

        for (let i = 1; i < lines.length; i += 1) {
          const row = splitCSVLine(lines[i]);
          const rowNo = i + 1;

          const plantCode = normalizePlantCode(getValue(row, ['Plant Code']));
          const plantName = normalizeText(getValue(row, ['Plant Name']));

          if (!plantCode || !plantName) {
            skippedRows.push(`Row ${rowNo}: Missing Plant Code or Plant Name.`);
            continue;
          }

          const statusRaw = getValue(row, ['Plant Status']);

          importedPlants.push({
            id: `PLANT-${Date.now()}-${i}`,
            plantCode,
            plantName,
            plantSize: normalizeText(getValue(row, ['Plant Size'])),
            plantAddress: normalizeText(getValue(row, ['Plant Address'])),
            plantPIC: normalizeText(getValue(row, ['Plant PIC'])),
            plantContactNo: normalizeText(
              getValue(row, ['Plant Contact No.', 'Plant Contact No']),
            ),
            plantEmail: normalizeText(getValue(row, ['Plant Email'])),
            plantOpeningDate: normalizeText(getValue(row, ['Plant Opening Date'])),
            plantStatus: normalizePlantStatus(statusRaw),
            remark: normalizeText(getValue(row, ['Remark'])),
            createdAt: now,
            updatedAt: now,
          });
        }

        if (importedPlants.length === 0) {
          Modal.error({
            title: 'No valid plant data found',
            content:
              'Plant Code and Plant Name are required. Please check your CSV file.',
          });
          return;
        }

        let addedCount = 0;
        let updatedCount = 0;

        setPlants((prev) => {
          const existingMap = new Map(
            prev.map((item) => [normalizePlantCode(item.plantCode), item]),
          );

          const nextPlants = [...prev];

          importedPlants.forEach((imported) => {
            const existing = existingMap.get(normalizePlantCode(imported.plantCode));

            if (existing) {
              updatedCount += 1;

              const updatedPlant: PlantMaster = {
                ...existing,
                plantName: imported.plantName,
                plantSize: imported.plantSize,
                plantAddress: imported.plantAddress,
                plantPIC: imported.plantPIC,
                plantContactNo: imported.plantContactNo,
                plantEmail: imported.plantEmail,
                plantOpeningDate: imported.plantOpeningDate,
                plantStatus: imported.plantStatus,
                remark: imported.remark,
                updatedAt: now,
              };

              const index = nextPlants.findIndex((item) => item.id === existing.id);

              if (index >= 0) {
                nextPlants[index] = updatedPlant;
              }
            } else {
              addedCount += 1;
              nextPlants.unshift(imported);
            }
          });

          return nextPlants;
        });

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
      }
    };

    reader.readAsText(file);
  };

  const columns: ColumnsType<PlantMaster> = [
    {
      title: 'Plant Code',
      dataIndex: 'plantCode',
      key: 'plantCode',
      sorter: (a, b) => a.plantCode.localeCompare(b.plantCode),
      fixed: 'left',
      width: 140,
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: 'Plant Name',
      dataIndex: 'plantName',
      key: 'plantName',
      sorter: (a, b) => a.plantName.localeCompare(b.plantName),
      width: 180,
    },
    {
      title: 'Plant Size',
      dataIndex: 'plantSize',
      key: 'plantSize',
      width: 140,
      render: (value: string) => value || '-',
    },
    {
      title: 'Plant Address',
      dataIndex: 'plantAddress',
      key: 'plantAddress',
      width: 260,
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: 'Plant PIC',
      dataIndex: 'plantPIC',
      key: 'plantPIC',
      width: 150,
      render: (value: string) => value || '-',
    },
    {
      title: 'Plant Contact No.',
      dataIndex: 'plantContactNo',
      key: 'plantContactNo',
      width: 150,
      render: (value: string) => value || '-',
    },
    {
      title: 'Plant Email',
      dataIndex: 'plantEmail',
      key: 'plantEmail',
      width: 200,
      render: (value: string) => value || '-',
    },
    {
      title: 'Opening Date',
      dataIndex: 'plantOpeningDate',
      key: 'plantOpeningDate',
      width: 140,
      render: (value: string) => value || '-',
    },
    {
      title: 'Status',
      dataIndex: 'plantStatus',
      key: 'plantStatus',
      width: 120,
      filters: [
        { text: 'Active', value: 'Active' },
        { text: 'Inactive', value: 'Inactive' },
      ],
      onFilter: (value, record) => record.plantStatus === String(value),
      render: (status: PlantStatus) => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
      ),
    },
    {
      title: 'Remark',
      dataIndex: 'remark',
      key: 'remark',
      width: 220,
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button size="small" onClick={() => openViewModal(record)}>
            View
          </Button>

          <Button size="small" type="primary" onClick={() => openEditModal(record)}>
            Edit
          </Button>

          <Popconfirm
            title="Delete Plant"
            description="Are you sure you want to delete this plant?"
            okText="Yes"
            cancelText="No"
            onConfirm={() => handleDelete(record)}
          >
            <Button size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          Plant Master
        </Title>

        <Text type="secondary">
          Standardized plant data for inventory, inbound GRN, stock transfer,
          stock adjustment, outbound, and warehouse traceability.
        </Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Text type="secondary">Total Plants</Text>
            <Title level={3} style={{ margin: 0 }}>
              {totalPlants}
            </Title>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Text type="secondary">Active</Text>
            <Title level={3} style={{ margin: 0, color: '#16a34a' }}>
              {activePlants}
            </Title>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Text type="secondary">Inactive</Text>
            <Title level={3} style={{ margin: 0, color: '#dc2626' }}>
              {inactivePlants}
            </Title>
          </Card>
        </Col>
      </Row>

      <Card>
        <Row gutter={[12, 12]} justify="space-between" style={{ marginBottom: 16 }}>
          <Col xs={24} lg={12}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search plant code, name, PIC, contact, email, address..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </Col>

          <Col>
            <Space wrap>
              <Button onClick={handleDownloadTemplate}>Template CSV</Button>

              <Upload
                accept=".csv"
                showUploadList={false}
                beforeUpload={(file) => {
                  handleImportCSV(file);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />}>Import CSV</Button>
              </Upload>

              <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
                Export CSV
              </Button>

              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                Add Plant
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredPlants}
          scroll={{ x: 1800 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total) => `Total ${total} plants`,
          }}
        />
      </Card>

      <Modal
        title={
          modalMode === 'create'
            ? 'Add Plant'
            : modalMode === 'edit'
              ? 'Edit Plant'
              : 'View Plant'
        }
        open={modalOpen}
        onCancel={closeModal}
        onOk={isViewMode ? undefined : handleSubmit}
        footer={
          isViewMode
            ? [
                <Button key="close" onClick={closeModal}>
                  Close
                </Button>,
              ]
            : undefined
        }
        okText={modalMode === 'create' ? 'Create' : 'Save'}
        width={900}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" disabled={isViewMode}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Plant Code"
                name="plantCode"
                rules={[
                  { required: true, message: 'Please enter plant code.' },
                  { max: 50, message: 'Plant code is too long.' },
                  {
                    pattern: /^[A-Za-z0-9-_./]+$/,
                    message:
                      'Plant Code should only contain letters, numbers, dash, underscore, dot or slash.',
                  },
                ]}
              >
                <Input placeholder="e.g. PLANT001" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Plant Name"
                name="plantName"
                rules={[
                  { required: true, message: 'Please enter plant name.' },
                  { max: 150, message: 'Plant name is too long.' },
                ]}
              >
                <Input placeholder="e.g. Main Warehouse" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Plant Size" name="plantSize">
                <Input placeholder="e.g. 20000 sqft / Medium / Large" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Plant Opening Date" name="plantOpeningDate">
                <Input type="date" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Plant Address" name="plantAddress">
                <TextArea rows={3} placeholder="Enter full plant address" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Plant PIC" name="plantPIC">
                <Input placeholder="Person in charge" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Plant Contact No." name="plantContactNo">
                <Input placeholder="e.g. 0123456789" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Plant Email"
                name="plantEmail"
                rules={[
                  {
                    type: 'email',
                    message: 'Please enter a valid email address.',
                  },
                ]}
              >
                <Input placeholder="e.g. warehouse@example.com" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Plant Status"
                name="plantStatus"
                rules={[{ required: true, message: 'Please select plant status.' }]}
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
                <TextArea rows={3} placeholder="Additional notes or remarks" />
              </Form.Item>
            </Col>
          </Row>

          {selectedPlant && (
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Text type="secondary">Created At:</Text>
                <br />
                <Text>
                  {selectedPlant.createdAt
                    ? new Date(selectedPlant.createdAt).toLocaleString()
                    : '-'}
                </Text>
              </Col>

              <Col xs={24} md={12}>
                <Text type="secondary">Updated At:</Text>
                <br />
                <Text>
                  {selectedPlant.updatedAt
                    ? new Date(selectedPlant.updatedAt).toLocaleString()
                    : '-'}
                </Text>
              </Col>
            </Row>
          )}
        </Form>
      </Modal>
    </div>
  );
}