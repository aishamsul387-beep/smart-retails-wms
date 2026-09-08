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

const STORAGE_KEY = 'wms_location_master';
const PLANT_STORAGE_KEY = 'wms_plant_master';

type StatusType = 'Active' | 'Inactive';

interface LocationRecord {
  id: string;
  locationCode: string;
  locationName: string;
  plantCode: string;
  plantName?: string;
  locationType: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  bin?: string;
  capacity?: number;
  isReceivable: boolean;
  isPickable: boolean;
  status: StatusType;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PlantOption {
  plantCode: string;
  plantName: string;
  status?: StatusType;
}

type LocationFormValues = {
  locationCode: string;
  locationName: string;
  plantCode: string;
  locationType: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  bin?: string;
  capacity?: number;
  isReceivable: boolean;
  isPickable: boolean;
  status: StatusType;
  remark?: string;
};

type UnknownRecord = Record<string, unknown>;

const locationTypes = [
  'RECEIVING',
  'STORAGE',
  'PICKING',
  'PACKING',
  'STAGING',
  'DISPATCH',
  'RETURN',
  'DAMAGED',
  'QUARANTINE',
  'VIRTUAL',
  'OTHER',
];

const csvHeaders = [
  'locationCode',
  'locationName',
  'plantCode',
  'locationType',
  'zone',
  'aisle',
  'rack',
  'bin',
  'capacity',
  'isReceivable',
  'isPickable',
  'status',
  'remark',
];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function generateId() {
  return `LOC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s._/-]/g, '');
}

function normalizeCode(value?: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeText(value?: unknown) {
  return String(value ?? '').trim();
}

function normalizeStatus(value?: unknown): StatusType {
  const normalized = String(value ?? '').trim().toLowerCase();

  return normalized === 'inactive' ? 'Inactive' : 'Active';
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

function convertToCSV(rows: LocationRecord[]) {
  const headerLine = csvHeaders.join(',');

  const dataLines = rows.map((row) =>
    csvHeaders
      .map((header) => {
        if (header === 'isReceivable') {
          return escapeCsvValue(row.isReceivable ? 'Yes' : 'No');
        }

        if (header === 'isPickable') {
          return escapeCsvValue(row.isPickable ? 'Yes' : 'No');
        }

        return escapeCsvValue(row[header as keyof LocationRecord]);
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

function getPlantCodeFromUnknown(record: unknown) {
  if (!isRecord(record)) return '';

  return normalizeCode(
    record.plantCode ||
      record.code ||
      record.plantId ||
      record.id ||
      record.name,
  );
}

function getPlantNameFromUnknown(record: unknown) {
  if (!isRecord(record)) return '';

  return normalizeText(
    record.plantName ||
      record.name ||
      record.description ||
      record.plantDescription ||
      record.plantCode ||
      record.code,
  );
}

function getPlantStatusFromUnknown(record: unknown): StatusType {
  if (!isRecord(record)) return 'Active';

  return normalizeStatus(record.plantStatus || record.status);
}

function createDefaultLocations(plantOptions: PlantOption[]): LocationRecord[] {
  const now = new Date().toISOString();

  const firstActivePlant =
    plantOptions.find((plant) => plant.status !== 'Inactive') || plantOptions[0];

  const plantCode = firstActivePlant?.plantCode || 'PLANT001';
  const plantName = firstActivePlant?.plantName || 'Main Warehouse';

  return [
    {
      id: `LOC-${plantCode}-RECEIVING`,
      locationCode: 'RECEIVING',
      locationName: 'Receiving Area',
      plantCode,
      plantName,
      locationType: 'RECEIVING',
      zone: 'INBOUND',
      aisle: '',
      rack: '',
      bin: '',
      capacity: 0,
      isReceivable: true,
      isPickable: false,
      status: 'Active',
      remark: 'Default inbound receiving location.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `LOC-${plantCode}-STORAGE`,
      locationCode: 'STORAGE',
      locationName: 'Main Storage',
      plantCode,
      plantName,
      locationType: 'STORAGE',
      zone: 'MAIN',
      aisle: '',
      rack: '',
      bin: '',
      capacity: 0,
      isReceivable: false,
      isPickable: false,
      status: 'Active',
      remark: 'Default stock storage location.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `LOC-${plantCode}-PICKING`,
      locationCode: 'PICKING',
      locationName: 'Picking Area',
      plantCode,
      plantName,
      locationType: 'PICKING',
      zone: 'OUTBOUND',
      aisle: '',
      rack: '',
      bin: '',
      capacity: 0,
      isReceivable: false,
      isPickable: true,
      status: 'Active',
      remark: 'Default picking location for outbound operation.',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function migrateLocationRecord(
  record: unknown,
  plants: PlantOption[],
): LocationRecord {
  const now = new Date().toISOString();
  const source = isRecord(record) ? record : {};

  const plantCode = normalizeCode(source.plantCode);
  const matchedPlant = plants.find((plant) => plant.plantCode === plantCode);

  const locationType = normalizeCode(source.locationType) || 'STORAGE';

  return {
    id: normalizeText(source.id) || generateId(),
    locationCode: normalizeCode(source.locationCode),
    locationName: normalizeText(source.locationName),
    plantCode,
    plantName: matchedPlant?.plantName || normalizeText(source.plantName),
    locationType: locationTypes.includes(locationType) ? locationType : 'OTHER',
    zone: normalizeCode(source.zone),
    aisle: normalizeCode(source.aisle),
    rack: normalizeCode(source.rack),
    bin: normalizeCode(source.bin),
    capacity:
      source.capacity !== undefined && source.capacity !== ''
        ? Number(source.capacity)
        : 0,
    isReceivable: normalizeBoolean(source.isReceivable, false),
    isPickable: normalizeBoolean(source.isPickable, false),
    status: normalizeStatus(source.status),
    remark: normalizeText(source.remark),
    createdAt: normalizeText(source.createdAt) || now,
    updatedAt: normalizeText(source.updatedAt) || now,
  };
}

export default function LocationMasterPage() {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LocationRecord | null>(null);

  const [form] = Form.useForm<LocationFormValues>();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const saveLocations = (nextData: LocationRecord[]) => {
    setLocations(nextData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
  };

  const loadPlants = () => {
    try {
      const saved = localStorage.getItem(PLANT_STORAGE_KEY);

      if (!saved) {
        setPlants([]);
        return [];
      }

      const parsed = JSON.parse(saved);

      if (!Array.isArray(parsed)) {
        setPlants([]);
        return [];
      }

      const mappedPlants: PlantOption[] = parsed
        .map((item: unknown) => {
          const plantCode = getPlantCodeFromUnknown(item);
          const plantName = getPlantNameFromUnknown(item);
          const status = getPlantStatusFromUnknown(item);

          if (!plantCode) return null;

          return {
            plantCode,
            plantName: plantName || plantCode,
            status,
          };
        })
        .filter(Boolean) as PlantOption[];

      setPlants(mappedPlants);

      return mappedPlants;
    } catch (error) {
      console.error(error);
      message.error('Failed to load Plant Master data.');
      setPlants([]);
      return [];
    }
  };

  const loadLocations = (plantOptions: PlantOption[]) => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          const migrated = parsed
            .map((item) => migrateLocationRecord(item, plantOptions))
            .filter((item) => item.locationCode && item.locationName);

          saveLocations(
            migrated.length > 0
              ? migrated
              : createDefaultLocations(plantOptions),
          );

          return;
        }
      }

      saveLocations(createDefaultLocations(plantOptions));
    } catch (error) {
      console.error(error);
      message.error('Failed to load Location Master data.');
      saveLocations(createDefaultLocations(plantOptions));
    }
  };

  useEffect(() => {
    const loadedPlants = loadPlants();
    loadLocations(loadedPlants);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activePlants = useMemo(() => {
    return plants.filter((plant) => plant.status !== 'Inactive');
  }, [plants]);

  const filteredLocations = useMemo(() => {
    const keyword = searchText.toLowerCase().trim();

    if (!keyword) return locations;

    return locations.filter((item) => {
      return [
        item.locationCode,
        item.locationName,
        item.plantCode,
        item.plantName,
        item.locationType,
        item.zone,
        item.aisle,
        item.rack,
        item.bin,
        item.capacity,
        item.isReceivable ? 'receivable yes inbound' : 'not receivable no',
        item.isPickable ? 'pickable yes outbound' : 'not pickable no',
        item.status,
        item.remark,
      ]
        .filter((value) => value !== undefined && value !== null)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [locations, searchText]);

  const totalLocations = locations.length;

  const activeCount = locations.filter((item) => item.status === 'Active').length;

  const inactiveCount = locations.filter(
    (item) => item.status === 'Inactive',
  ).length;

  const receivableCount = locations.filter((item) => item.isReceivable).length;

  const pickableCount = locations.filter((item) => item.isPickable).length;

  const getPlantNameByCode = (plantCode: string) => {
    const found = plants.find(
      (plant) => plant.plantCode === normalizeCode(plantCode),
    );

    return found?.plantName || '';
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();

    form.setFieldsValue({
      plantCode: activePlants[0]?.plantCode,
      locationType: 'STORAGE',
      isReceivable: false,
      isPickable: false,
      status: 'Active',
      capacity: 0,
    });

    setIsModalOpen(true);
  };

  const handleEdit = (record: LocationRecord) => {
    setEditingRecord(record);

    form.setFieldsValue({
      locationCode: record.locationCode,
      locationName: record.locationName,
      plantCode: record.plantCode,
      locationType: record.locationType,
      zone: record.zone,
      aisle: record.aisle,
      rack: record.rack,
      bin: record.bin,
      capacity: record.capacity,
      isReceivable: record.isReceivable,
      isPickable: record.isPickable,
      status: record.status,
      remark: record.remark,
    });

    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    const nextData = locations.filter((item) => item.id !== id);

    saveLocations(nextData);
    message.success('Location deleted successfully.');
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const now = new Date().toISOString();

      const plantCode = normalizeCode(values.plantCode);
      const plantName = getPlantNameByCode(plantCode);
      const locationType = normalizeCode(values.locationType) || 'STORAGE';

      const payload: LocationRecord = {
        id: editingRecord?.id || generateId(),
        locationCode: normalizeCode(values.locationCode),
        locationName: normalizeText(values.locationName),
        plantCode,
        plantName,
        locationType: locationTypes.includes(locationType)
          ? locationType
          : 'OTHER',
        zone: normalizeCode(values.zone),
        aisle: normalizeCode(values.aisle),
        rack: normalizeCode(values.rack),
        bin: normalizeCode(values.bin),
        capacity: Number(values.capacity ?? 0),
        isReceivable: Boolean(values.isReceivable),
        isPickable: Boolean(values.isPickable),
        status: values.status,
        remark: normalizeText(values.remark),
        createdAt: editingRecord?.createdAt || now,
        updatedAt: now,
      };

      const duplicate = locations.find((item) => {
        return (
          item.plantCode.toLowerCase() === payload.plantCode.toLowerCase() &&
          item.locationCode.toLowerCase() ===
            payload.locationCode.toLowerCase() &&
          item.id !== payload.id
        );
      });

      if (duplicate) {
        message.error('Location Code already exists under the selected Plant.');
        return;
      }

      let nextData: LocationRecord[];

      if (editingRecord) {
        nextData = locations.map((item) =>
          item.id === editingRecord.id ? payload : item,
        );

        message.success('Location updated successfully.');
      } else {
        nextData = [payload, ...locations];

        message.success('Location added successfully.');
      }

      saveLocations(nextData);
      closeModal();
    } catch {
      // Ant Design validation will show field errors automatically.
    }
  };

  const handleTemplateDownload = () => {
    const samplePlantCode = activePlants[0]?.plantCode || 'PLANT001';
    const samplePlantName = activePlants[0]?.plantName || 'Main Warehouse';

    const sampleRows: LocationRecord[] = [
      {
        id: '',
        locationCode: 'RECEIVING',
        locationName: 'Receiving Area',
        plantCode: samplePlantCode,
        plantName: samplePlantName,
        locationType: 'RECEIVING',
        zone: 'INBOUND',
        aisle: '',
        rack: '',
        bin: '',
        capacity: 0,
        isReceivable: true,
        isPickable: false,
        status: 'Active',
        remark: 'Inbound receiving location.',
      },
      {
        id: '',
        locationCode: 'A01-R01-B01',
        locationName: 'Aisle 01 Rack 01 Bin 01',
        plantCode: samplePlantCode,
        plantName: samplePlantName,
        locationType: 'STORAGE',
        zone: 'A',
        aisle: 'A01',
        rack: 'R01',
        bin: 'B01',
        capacity: 1000,
        isReceivable: false,
        isPickable: false,
        status: 'Active',
        remark: 'Storage bin.',
      },
      {
        id: '',
        locationCode: 'PICKING',
        locationName: 'Picking Area',
        plantCode: samplePlantCode,
        plantName: samplePlantName,
        locationType: 'PICKING',
        zone: 'OUTBOUND',
        aisle: '',
        rack: '',
        bin: '',
        capacity: 0,
        isReceivable: false,
        isPickable: true,
        status: 'Active',
        remark: 'Outbound picking location.',
      },
    ];

    const csv = convertToCSV(sampleRows);

    downloadFile('location_master_template.csv', csv);
    message.success('Location Master template downloaded successfully.');
  };

  const handleExport = () => {
    if (filteredLocations.length === 0) {
      message.warning('No Location data to export.');
      return;
    }

    const csv = convertToCSV(filteredLocations);

    downloadFile('location_master_export.csv', csv);
    message.success('Location Master exported successfully.');
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

          const locationCode = normalizeCode(
            getCSVValue(row, ['locationCode', 'Location Code']),
          );

          const locationName = normalizeText(
            getCSVValue(row, ['locationName', 'Location Name']),
          );

          const plantCode = normalizeCode(
            getCSVValue(row, ['plantCode', 'Plant Code']),
          );

          const locationTypeRaw = normalizeCode(
            getCSVValue(row, ['locationType', 'Location Type']),
          );

          const locationType = locationTypeRaw || 'STORAGE';

          if (!locationCode || !locationName || !plantCode) {
            skippedRows.push(
              `Row ${rowNo}: Missing locationCode, locationName, or plantCode.`,
            );
            return null;
          }

          const matchedPlant = plants.find(
            (plant) => plant.plantCode === plantCode,
          );

          if (plants.length > 0 && !matchedPlant) {
            skippedRows.push(
              `Row ${rowNo}: Plant Code "${plantCode}" does not exist in Plant Master.`,
            );
            return null;
          }

          if (matchedPlant?.status === 'Inactive') {
            skippedRows.push(
              `Row ${rowNo}: Plant Code "${plantCode}" is inactive.`,
            );
            return null;
          }

          const record: LocationRecord = {
            id: generateId(),
            locationCode,
            locationName,
            plantCode,
            plantName: matchedPlant?.plantName || '',
            locationType: locationTypes.includes(locationType)
              ? locationType
              : 'OTHER',
            zone: normalizeCode(getCSVValue(row, ['zone', 'Zone'])),
            aisle: normalizeCode(getCSVValue(row, ['aisle', 'Aisle'])),
            rack: normalizeCode(getCSVValue(row, ['rack', 'Rack'])),
            bin: normalizeCode(getCSVValue(row, ['bin', 'Bin'])),
            capacity: Number(getCSVValue(row, ['capacity', 'Capacity']) || 0),
            isReceivable: normalizeBoolean(
              getCSVValue(row, ['isReceivable', 'Receivable', 'Is Receivable']),
              false,
            ),
            isPickable: normalizeBoolean(
              getCSVValue(row, ['isPickable', 'Pickable', 'Is Pickable']),
              false,
            ),
            status: normalizeStatus(getCSVValue(row, ['status', 'Status'])),
            remark: normalizeText(getCSVValue(row, ['remark', 'Remark'])),
            createdAt: now,
            updatedAt: now,
          };

          return record;
        })
        .filter(Boolean) as LocationRecord[];

      if (importedRecords.length === 0) {
        Modal.error({
          title: 'No valid Location records found',
          content:
            'Required fields: locationCode, locationName, plantCode. Please check your CSV file and Plant Master data.',
        });

        return;
      }

      let addedCount = 0;
      let updatedCount = 0;

      const merged = [...locations];

      importedRecords.forEach((imported) => {
        const existingIndex = merged.findIndex((item) => {
          return (
            item.plantCode.toLowerCase() === imported.plantCode.toLowerCase() &&
            item.locationCode.toLowerCase() ===
              imported.locationCode.toLowerCase()
          );
        });

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

      saveLocations(merged);

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

  const columns: ColumnsType<LocationRecord> = [
    {
      title: 'Plant',
      dataIndex: 'plantCode',
      key: 'plantCode',
      width: 150,
      fixed: 'left',
      sorter: (a, b) => a.plantCode.localeCompare(b.plantCode),
      render: (_, record) => (
        <div>
          <Text strong>{record.plantCode}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.plantName || '-'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Location Code',
      dataIndex: 'locationCode',
      key: 'locationCode',
      width: 160,
      fixed: 'left',
      sorter: (a, b) => a.locationCode.localeCompare(b.locationCode),
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: 'Location Name',
      dataIndex: 'locationName',
      key: 'locationName',
      width: 220,
      sorter: (a, b) => a.locationName.localeCompare(b.locationName),
    },
    {
      title: 'Type',
      dataIndex: 'locationType',
      key: 'locationType',
      width: 140,
      filters: locationTypes.map((type) => ({ text: type, value: type })),
      onFilter: (value, record) => record.locationType === String(value),
      render: (value: string) => {
        let color = 'blue';

        if (value === 'RECEIVING') color = 'green';
        if (value === 'PICKING' || value === 'PACKING') color = 'purple';
        if (value === 'DAMAGED' || value === 'QUARANTINE') color = 'red';
        if (value === 'DISPATCH') color = 'orange';

        return <Tag color={color}>{value}</Tag>;
      },
    },
    {
      title: 'Zone',
      dataIndex: 'zone',
      key: 'zone',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: 'Aisle',
      dataIndex: 'aisle',
      key: 'aisle',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: 'Rack',
      dataIndex: 'rack',
      key: 'rack',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: 'Bin',
      dataIndex: 'bin',
      key: 'bin',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: 'Capacity',
      dataIndex: 'capacity',
      key: 'capacity',
      width: 110,
      align: 'right',
      render: (value) => value ?? 0,
    },
    {
      title: 'Receivable',
      dataIndex: 'isReceivable',
      key: 'isReceivable',
      width: 120,
      filters: [
        { text: 'Yes', value: true },
        { text: 'No', value: false },
      ],
      onFilter: (value, record) => record.isReceivable === (value === true),
      render: (value: boolean) =>
        value ? <Tag color="green">Yes</Tag> : <Tag color="default">No</Tag>,
    },
    {
      title: 'Pickable',
      dataIndex: 'isPickable',
      key: 'isPickable',
      width: 110,
      filters: [
        { text: 'Yes', value: true },
        { text: 'No', value: false },
      ],
      onFilter: (value, record) => record.isPickable === (value === true),
      render: (value: boolean) =>
        value ? <Tag color="purple">Yes</Tag> : <Tag color="default">No</Tag>,
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
      render: (status: StatusType) => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
      ),
    },
    {
      title: 'Remark',
      dataIndex: 'remark',
      key: 'remark',
      width: 260,
      render: (value) => value || '-',
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
            title="Delete Location"
            description="Are you sure you want to delete this location?"
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
          Location Master
        </Title>

        <Text type="secondary">
          Standardized warehouse location data by plant for GRN, inventory,
          stock transfer, stock adjustment, picking, dispatch, and CSV
          validation.
        </Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Text type="secondary">Total Locations</Text>
            <Title level={3} style={{ margin: 0 }}>
              {totalLocations}
            </Title>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Text type="secondary">Active / Inactive</Text>
            <Title level={3} style={{ margin: 0, color: '#16a34a' }}>
              {activeCount}
              <Text style={{ fontSize: 16, color: '#dc2626' }}>
                {' '}
                / {inactiveCount}
              </Text>
            </Title>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Text type="secondary">Receivable</Text>
            <Title level={3} style={{ margin: 0, color: '#1677ff' }}>
              {receivableCount}
            </Title>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Text type="secondary">Pickable</Text>
            <Title level={3} style={{ margin: 0, color: '#722ed1' }}>
              {pickableCount}
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
              placeholder="Search plant, location, type, zone, aisle, rack, bin, status..."
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
                Add Location
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

        {activePlants.length === 0 && (
          <Card
            size="small"
            style={{
              marginBottom: 16,
              background: '#fff7e6',
              borderColor: '#ffd591',
            }}
          >
            <Text type="warning">
              No active Plant Master data found. Please create Plant Master
              records first so Location Master can link each location to a
              plant.
            </Text>
          </Card>
        )}

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredLocations}
          bordered
          size="small"
          scroll={{ x: 1700 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} Location(s)`,
          }}
        />
      </Card>

      <Modal
        title={editingRecord ? 'Edit Location' : 'Add Location'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={closeModal}
        okText={editingRecord ? 'Update' : 'Create'}
        width={900}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            locationType: 'STORAGE',
            capacity: 0,
            isReceivable: false,
            isPickable: false,
            status: 'Active',
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Plant"
                name="plantCode"
                rules={[{ required: true, message: 'Please select plant.' }]}
              >
                <Select
                  showSearch
                  placeholder="Select plant"
                  optionFilterProp="label"
                  options={activePlants.map((plant) => ({
                    label: `${plant.plantCode} - ${plant.plantName}`,
                    value: plant.plantCode,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Location Code"
                name="locationCode"
                rules={[
                  { required: true, message: 'Please enter location code.' },
                  {
                    max: 50,
                    message: 'Location code cannot exceed 50 characters.',
                  },
                  {
                    pattern: /^[A-Za-z0-9-_./]+$/,
                    message:
                      'Location code should only contain letters, numbers, dash, underscore, dot or slash.',
                  },
                ]}
              >
                <Input placeholder="Example: RECEIVING, STORAGE, A01-R01-B01" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Location Name"
                name="locationName"
                rules={[
                  { required: true, message: 'Please enter location name.' },
                ]}
              >
                <Input placeholder="Example: Receiving Area, Main Storage" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Location Type"
                name="locationType"
                rules={[
                  { required: true, message: 'Please select location type.' },
                ]}
              >
                <Select
                  placeholder="Select location type"
                  options={locationTypes.map((type) => ({
                    label: type,
                    value: type,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Zone" name="zone">
                <Input placeholder="Example: A, INBOUND" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Aisle" name="aisle">
                <Input placeholder="Example: A01" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Rack" name="rack">
                <Input placeholder="Example: R01" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Bin" name="bin">
                <Input placeholder="Example: B01" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Capacity" name="capacity">
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder="Optional capacity"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Receivable"
                name="isReceivable"
                valuePropName="checked"
                tooltip="Enable if this location can be used for GRN / inbound receiving."
              >
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Pickable"
                name="isPickable"
                valuePropName="checked"
                tooltip="Enable if this location can be used for outbound picking."
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
                <Input.TextArea
                  rows={3}
                  placeholder="Optional notes about this location..."
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}