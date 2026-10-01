'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import
 {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  BulbOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  ExportOutlined,
  EyeOutlined,
  ImportOutlined,
  InboxOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const INBOUND_STORAGE_KEY = 'wms_inbound_receipts';
const INVENTORY_STORAGE_KEY = 'wms_inventory';
const INVENTORY_COMPAT_STORAGE_KEY = 'wms_inventory_management';
const MOVEMENT_STORAGE_KEY = 'wms_stock_movements';
const MOVEMENT_COMPAT_STORAGE_KEY = 'wms_inventory_movements';

const PRODUCT_MASTER_KEYS = [
  'wms_product_master',
  'wms_products',
  'master_products_v1',
  'products',
  'productData',
];

const LOCATION_MASTER_KEYS = [
  'wms_locations',
  'locations',
  'locationData',
  'wms_location_master',
];

const PURCHASE_ORDER_KEYS = [
  'wms_purchase_orders',
  'wms_purchase',
  'purchaseOrders',
];

type InboundStatus =
  | 'Draft'
  | 'Confirmed'
  | 'Received'
  | 'Cancelled';

type AIStatus = 'Ready' | 'Review' | 'Blocked';

interface InboundItem {
  id: string;
  productCode: string;
  sku: string;
  productName: string;
  batchNo: string;
  plant: string;
  location: string;
  expiryDate: string;
  uom: string;
  qty: number;
  remarks?: string;
}

interface InboundReceipt {
  id: string;
  receiptNo: string;
  supplierName: string;
  poNo: string;
  receiptDate: string;
  status: InboundStatus;
  movementPosted: boolean;
  items: InboundItem[];
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  receivedAt?: string;
  qrGeneratedAt?: string;
  qrPayloads?: string[];

  aiStatus?: AIStatus;
  aiScore?: number;
  aiIssues?: string[];
  aiWarnings?: string[];
  aiRecommendations?: string[];
  aiReviewedAt?: string;
}

interface InboundFormValues {
  receiptNo: string;
  supplierName: string;
  poNo: string;
  receiptDate: string;
  status: InboundStatus;
  remarks?: string;
  items: InboundItem[];
}

interface InventoryItem {
  id: string;
  productCode: string;
  sku: string;
  productName: string;
  batchNo: string;
  plant: string;
  location: string;
  expiryDate: string;
  uom: string;
  batchQty: number;
  availableQty: number;
  status: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductMasterRecord {
  id?: string;
  productCode: string;
  sku: string;
  productName: string;
  uom: string;
  baseUom?: string;
  purchaseUom?: string;
  salesUom?: string;
  batchControlled: boolean;
  expiryControlled: boolean;
  status: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  raw?: any;
}

interface LocationMasterRecord {
  id?: string;
  location: string;
  locationName: string;
  plant: string;
  status: string;
  capacity: number;
  capacityUom?: string;
  locationType?: string;
  zone?: string;
  raw?: any;
}

interface MasterOption {
  value: string;
  label: string;
  raw?: any;
}

interface LocationProjection {
  key: string;
  plant: string;
  location: string;
  currentQty: number;
  incomingQty: number;
  projectedQty: number;
  capacity: number;
  utilization: number | null;
  status: 'Empty' | 'Available' | 'Near Full' | 'Full' | 'Over Capacity';
}

interface AIReview {
  status: AIStatus;
  score: number;
  issues: string[];
  warnings: string[];
  recommendations: string[];
  positives: string[];
  locationProjections: LocationProjection[];
  emptyLocations: string[];
  reviewedAt: string;
}

interface WarehouseRisk {
  lowStockProducts: number;
  highStockProducts: number;
  emptyLocations: number;
  nearFullLocations: number;
  fullLocations: number;
  capacityTrackedLocations: number;
}

type ModalMode = 'create' | 'edit' | 'view';

const STATUS_OPTIONS: InboundStatus[] = [
  'Draft',
  'Confirmed',
  'Received',
  'Cancelled',
];

const CSV_HEADERS = [
  'Receipt No',
  'Supplier Name',
  'PO No',
  'Receipt Date',
  'Status',
  'Product Code',
  'Product Name',
  'Batch No',
  'Plant',
  'Location',
  'Expiry Date',
  'UOM',
  'Qty',
  'Remarks',
];

const canUseStorage = () =>
  typeof window !== 'undefined' && Boolean(window.localStorage);

function getStorageItem(key: string) {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(key);
}

function setStorageItem(key: string, value: string) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, value);
}

function uid(prefix = 'ID') {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

function generateReceiptNo() {
  const ymd = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');

  return `GRN-${ymd}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeText(value: any) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeKey(value: any) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function normalizeDate(value: any) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const direct = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;

  const slash = text.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (slash) return `${slash[1]}-${slash[2]}-${slash[3]}`;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  return date.toISOString().slice(0, 10);
}

function asNumber(value: any, fallback = 0) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return fallback;
  }

  const numberValue = Number(
    String(value).replace(/,/g, '').trim(),
  );

  return Number.isFinite(numberValue)
    ? numberValue
    : fallback;
}

function asBoolean(value: any, fallback = false) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return fallback;
  }

  if (typeof value === 'boolean') return value;

  const text = normalizeText(value);

  if (
    ['true', 'yes', 'y', '1', 'active', 'enabled'].includes(
      text,
    )
  ) {
    return true;
  }

  if (
    [
      'false',
      'no',
      'n',
      '0',
      'inactive',
      'disabled',
    ].includes(text)
  ) {
    return false;
  }

  return fallback;
}

function safeJsonParse<T = any>(
  text: string | null,
  fallback: T,
): T {
  if (!text) return fallback;

  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function readAny(
  obj: any,
  keys: string[],
  fallback: any = '',
) {
  if (!obj || typeof obj !== 'object') return fallback;

  for (const key of keys) {
    if (
      obj[key] !== undefined &&
      obj[key] !== null &&
      obj[key] !== ''
    ) {
      return obj[key];
    }
  }

  const normalizedMap = new Map<string, any>();

  Object.keys(obj).forEach((key) => {
    normalizedMap.set(normalizeKey(key), obj[key]);
  });

  for (const key of keys) {
    const value = normalizedMap.get(normalizeKey(key));

    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      return value;
    }
  }

  return fallback;
}

function csvEscape(value: any) {
  const text = String(value ?? '');

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadFile(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8;',
) {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return;
  }

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

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;
  const cleanText = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < cleanText.length; i += 1) {
    const char = cleanText[i];
    const next = cleanText[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if (
      (char === '\n' || char === '\r') &&
      !inQuotes
    ) {
      if (char === '\r' && next === '\n') i += 1;

      row.push(current);

      if (row.some((cell) => cell.trim() !== '')) {
        rows.push(row);
      }

      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current);

  if (row.some((cell) => cell.trim() !== '')) {
    rows.push(row);
  }

  return rows;
}

function rowsToObjects(rows: string[][]) {
  if (!rows.length) return [];

  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((row) => {
    const obj: any = {};

    headers.forEach((header, index) => {
      obj[header] = row[index]?.trim() ?? '';
    });

    return obj;
  });
}

function statusColor(status: InboundStatus) {
  switch (status) {
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

function aiStatusColor(status?: AIStatus) {
  switch (status) {
    case 'Ready':
      return 'green';
    case 'Review':
      return 'orange';
    case 'Blocked':
      return 'red';
    default:
      return 'default';
  }
}

function getInboundNo(
  receipt: Partial<InboundReceipt>,
) {
  return String(
    receipt.receiptNo || receipt.id || '',
  ).trim();
}

function inventoryIdentityKey(
  item: Partial<InventoryItem | InboundItem>,
) {
  return [
    normalizeText(
      (item as any).productCode ||
        (item as any).sku,
    ),
    normalizeText((item as any).batchNo),
    normalizeText((item as any).plant),
    normalizeText((item as any).location),
    normalizeDate((item as any).expiryDate),
  ].join('|');
}

function locationIdentityKey(
  plant: any,
  location: any,
) {
  return `${normalizeText(plant)}|${normalizeText(
    location,
  )}`;
}

function isAvailableInventoryStatus(status: any) {
  const value = normalizeText(status);

  return ![
    'blocked',
    'deleted',
    'cancelled',
    'quarantine',
    'quality hold',
    'hold',
  ].includes(value);
}

function daysUntil(dateValue: string) {
  const normalized = normalizeDate(dateValue);
  if (!normalized) return null;

  const target = new Date(`${normalized}T00:00:00`);
  const today = new Date(`${todayDate()}T00:00:00`);

  if (
    Number.isNaN(target.getTime()) ||
    Number.isNaN(today.getTime())
  ) {
    return null;
  }

  return Math.ceil(
    (target.getTime() - today.getTime()) /
      86400000,
  );
}

function normalizeProductMaster(
  raw: any,
): ProductMasterRecord {
  const productCode = String(
    readAny(raw, [
      'productCode',
      'Product Code',
      'sku',
      'SKU',
      'itemCode',
      'Item Code',
      'materialCode',
      'Material Code',
      'code',
      'Code',
    ]),
  ).trim();

  const sku =
    String(
      readAny(raw, ['sku', 'SKU'], productCode),
    ).trim() || productCode;

  const productName = String(
    readAny(raw, [
      'productName',
      'Product Name',
      'productDescription',
      'Product Description',
      'description',
      'Description',
      'itemName',
      'Item Name',
      'name',
      'Name',
    ]),
  ).trim();

  const baseUom = String(
    readAny(raw, [
      'baseUom',
      'Base UOM',
      'baseUOM',
    ]),
  ).trim();

  const purchaseUom = String(
    readAny(raw, [
      'purchaseUom',
      'Purchase UOM',
      'purchasingUom',
    ]),
  ).trim();

  const salesUom = String(
    readAny(raw, [
      'salesUom',
      'Sales UOM',
      'sellingUom',
    ]),
  ).trim();

  const uom =
    purchaseUom ||
    baseUom ||
    String(
      readAny(
        raw,
        ['uom', 'UOM', 'unit', 'Unit'],
        'PCS',
      ),
    ).trim() ||
    'PCS';

  const status =
    String(
      readAny(
        raw,
        ['status', 'Status', 'activeStatus'],
        'Active',
      ),
    ).trim() || 'Active';

  return {
    id: String(readAny(raw, ['id', 'ID'], '')).trim(),
    productCode,
    sku,
    productName,
    uom,
    baseUom,
    purchaseUom,
    salesUom,
    batchControlled: asBoolean(
      readAny(raw, [
        'batchControlled',
        'Batch Controlled',
        'isBatchControlled',
        'batchControl',
        'Batch Control',
        'batchTracking',
        'Batch Tracking',
      ]),
      false,
    ),
    expiryControlled: asBoolean(
      readAny(raw, [
        'expiryControlled',
        'Expiry Controlled',
        'isExpiryControlled',
        'expiryControl',
        'Expiry Control',
        'shelfLifeControlled',
        'Shelf Life Controlled',
      ]),
      false,
    ),
    status,
    minStockLevel: asNumber(
      readAny(raw, [
        'minStockLevel',
        'Min Stock Level',
        'minimumStock',
        'minStock',
        'reorderPoint',
        'Reorder Point',
      ]),
      0,
    ),
    maxStockLevel: asNumber(
      readAny(raw, [
        'maxStockLevel',
        'Max Stock Level',
        'maximumStock',
        'maxStock',
      ]),
      0,
    ),
    raw,
  };
}

function normalizeLocationMaster(
  raw: any,
): LocationMasterRecord {
  const location = String(
    readAny(raw, [
      'location',
      'Location',
      'locationCode',
      'Location Code',
      'bin',
      'Bin',
      'binCode',
      'Bin Code',
      'code',
      'Code',
    ]),
  ).trim();

  return {
    id: String(readAny(raw, ['id', 'ID'], '')).trim(),
    location,
    locationName: String(
      readAny(raw, [
        'locationName',
        'Location Name',
        'name',
        'Name',
        'description',
        'Description',
      ]),
    ).trim(),
    plant: String(
      readAny(raw, [
        'plant',
        'Plant',
        'plantCode',
        'Plant Code',
        'warehouse',
        'Warehouse',
      ]),
    ).trim(),
    status:
      String(
        readAny(
          raw,
          ['status', 'Status'],
          'Active',
        ),
      ).trim() || 'Active',
    capacity: asNumber(
      readAny(raw, [
        'capacity',
        'Capacity',
        'maxCapacity',
        'Max Capacity',
        'maximumCapacity',
        'Maximum Capacity',
        'capacityQty',
        'Capacity Qty',
        'maxQty',
        'Max Qty',
      ]),
      0,
    ),
    capacityUom: String(
      readAny(raw, [
        'capacityUom',
        'Capacity UOM',
        'uom',
        'UOM',
      ]),
    ).trim(),
    locationType: String(
      readAny(raw, [
        'locationType',
        'Location Type',
        'type',
        'Type',
      ]),
    ).trim(),
    zone: String(
      readAny(raw, ['zone', 'Zone']),
    ).trim(),
    raw,
  };
}

function isActiveProduct(
  product?: ProductMasterRecord | null,
) {
  if (!product) return true;

  return ![
    'inactive',
    'disabled',
    'blocked',
    'deleted',
    'false',
    '0',
  ].includes(normalizeText(product.status));
}

function isActiveLocation(
  location?: LocationMasterRecord | null,
) {
  if (!location) return true;

  return ![
    'inactive',
    'disabled',
    'blocked',
    'deleted',
    'closed',
    'false',
    '0',
  ].includes(normalizeText(location.status));
}

function normalizeInventoryItem(
  raw: any,
): InventoryItem {
  const productCode = String(
    readAny(raw, [
      'productCode',
      'Product Code',
      'sku',
      'SKU',
      'itemCode',
      'Item Code',
      'materialCode',
      'Material Code',
    ]),
  ).trim();

  const sku =
    String(
      readAny(raw, ['sku', 'SKU'], productCode),
    ).trim() || productCode;

  const productName = String(
    readAny(raw, [
      'productName',
      'Product Name',
      'productDescription',
      'Product Description',
      'description',
      'Description',
      'itemName',
      'Item Name',
    ]),
  ).trim();

  const batchNo = String(
    readAny(raw, [
      'batchNo',
      'Batch No',
      'batchNumber',
      'Batch Number',
      'lotNo',
      'Lot No',
    ]),
  ).trim();

  const plant = String(
    readAny(raw, [
      'plant',
      'Plant',
      'plantCode',
      'Plant Code',
    ]),
  ).trim();

  const location = String(
    readAny(raw, [
      'location',
      'Location',
      'bin',
      'Bin',
      'warehouse',
      'Warehouse',
      'storageLocation',
      'Storage Location',
    ]),
  ).trim();

  const expiryDate = normalizeDate(
    readAny(raw, [
      'expiryDate',
      'Expiry Date',
      'expiry',
      'Expiry',
      'expiredDate',
      'Expired Date',
    ]),
  );

  const uom =
    String(
      readAny(
        raw,
        ['uom', 'UOM', 'unit', 'Unit'],
        'PCS',
      ),
    ).trim() || 'PCS';

  const batchQty = asNumber(
    readAny(raw, [
      'batchQty',
      'Batch Qty',
      'qty',
      'Qty',
      'quantity',
      'Quantity',
      'stockQty',
      'Stock Qty',
      'balanceQty',
      'Balance Qty',
      'onHandQty',
      'On Hand Qty',
    ]),
    0,
  );

  const availableRaw = readAny(raw, [
    'availableQty',
    'Available Qty',
    'available',
    'Available',
    'availableQuantity',
    'Available Quantity',
  ]);

  const availableQty =
    availableRaw === ''
      ? batchQty
      : asNumber(availableRaw, batchQty);

  const now = new Date().toISOString();

  return {
    id: String(
      readAny(raw, ['id', 'ID'], uid('INV')),
    ).trim(),
    productCode,
    sku,
    productName,
    batchNo,
    plant,
    location,
    expiryDate,
    uom,
    batchQty,
    availableQty,
    status:
      String(
        readAny(
          raw,
          ['status', 'Status'],
          'Available',
        ),
      ).trim() || 'Available',
    remarks: String(
      readAny(
        raw,
        ['remarks', 'Remarks', 'remark', 'Remark'],
        '',
      ),
    ).trim(),
    createdAt: String(
      readAny(raw, ['createdAt', 'Created At'], now),
    ),
    updatedAt: String(
      readAny(raw, ['updatedAt', 'Updated At'], now),
    ),
  };
}

function toPersistedInventoryRecord(
  item: InventoryItem,
) {
  return {
    id: item.id,
    productCode: item.productCode,
    sku: item.sku || item.productCode,
    SKU: item.sku || item.productCode,
    'Product Code': item.productCode,
    productName: item.productName,
    productDescription: item.productName,
    'Product Name': item.productName,
    'Product Description': item.productName,
    batchNo: item.batchNo,
    batchNumber: item.batchNo,
    'Batch No': item.batchNo,
    'Batch Number': item.batchNo,
    plant: item.plant,
    Plant: item.plant,
    location: item.location,
    Location: item.location,
    expiryDate: normalizeDate(item.expiryDate),
    'Expiry Date': normalizeDate(item.expiryDate),
    uom: item.uom,
    UOM: item.uom,
    batchQty: item.batchQty,
    'Batch Qty': item.batchQty,
    qty: item.batchQty,
    Qty: item.batchQty,
    quantity: item.batchQty,
    Quantity: item.batchQty,
    availableQty: item.availableQty,
    'Available Qty': item.availableQty,
    available: item.availableQty,
    Available: item.availableQty,
    status: item.status,
    Status: item.status,
    remarks: item.remarks || '',
    Remarks: item.remarks || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function normalizeInboundItem(raw: any): InboundItem {
  const productCode = String(
    readAny(raw, [
      'productCode',
      'Product Code',
      'sku',
      'SKU',
      'itemCode',
      'Item Code',
    ]),
  ).trim();

  return {
    id: String(
      readAny(
        raw,
        ['itemId', 'Item ID', 'id', 'ID'],
        uid('INB-ITEM'),
      ),
    ).trim(),
    productCode,
    sku:
      String(
        readAny(raw, ['sku', 'SKU'], productCode),
      ).trim() || productCode,
    productName: String(
      readAny(raw, [
        'productName',
        'Product Name',
        'productDescription',
        'Product Description',
        'description',
        'Description',
      ]),
    ).trim(),
    batchNo: String(
      readAny(raw, [
        'batchNo',
        'Batch No',
        'batchNumber',
        'Batch Number',
      ]),
    ).trim(),
    plant: String(
      readAny(raw, [
        'plant',
        'Plant',
        'plantCode',
        'Plant Code',
      ]),
    ).trim(),
    location: String(
      readAny(raw, [
        'location',
        'Location',
        'bin',
        'Bin',
      ]),
    ).trim(),
    expiryDate: normalizeDate(
      readAny(raw, [
        'expiryDate',
        'Expiry Date',
        'expiry',
        'Expiry',
      ]),
    ),
    uom:
      String(
        readAny(
          raw,
          ['uom', 'UOM', 'unit', 'Unit'],
          'PCS',
        ),
      ).trim() || 'PCS',
    qty: asNumber(
      readAny(
        raw,
        ['qty', 'Qty', 'quantity', 'Quantity'],
        0,
      ),
      0,
    ),
    remarks: String(
      readAny(
        raw,
        ['remarks', 'Remarks', 'remark', 'Remark'],
        '',
      ),
    ).trim(),
  };
}

function normalizeInboundReceipt(
  raw: any,
): InboundReceipt {
  const now = new Date().toISOString();
  const rawStatus = String(
    readAny(raw, ['status', 'Status'], 'Draft'),
  ).trim() as InboundStatus;

  const status: InboundStatus =
    STATUS_OPTIONS.includes(rawStatus)
      ? rawStatus
      : 'Draft';

  return {
    id: String(
      readAny(raw, ['id', 'ID'], uid('INB')),
    ).trim(),
    receiptNo: String(
      readAny(
        raw,
        ['receiptNo', 'Receipt No', 'grnNo', 'GRN No'],
        generateReceiptNo(),
      ),
    ).trim(),
    supplierName: String(
      readAny(raw, [
        'supplierName',
        'Supplier Name',
        'supplier',
        'Supplier',
      ]),
    ).trim(),
    poNo: String(
      readAny(raw, [
        'poNo',
        'PO No',
        'purchaseOrderNo',
        'Purchase Order No',
      ]),
    ).trim(),
    receiptDate: normalizeDate(
      readAny(
        raw,
        ['receiptDate', 'Receipt Date', 'date', 'Date'],
        todayDate(),
      ),
    ),
    status,
    movementPosted: asBoolean(
      readAny(
        raw,
        ['movementPosted', 'Movement Posted'],
        false,
      ),
      false,
    ),
    items: Array.isArray(raw?.items)
      ? raw.items.map(normalizeInboundItem)
      : [],
    remarks: String(
      readAny(
        raw,
        ['remarks', 'Remarks', 'remark', 'Remark'],
        '',
      ),
    ).trim(),
    createdAt: String(
      readAny(raw, ['createdAt', 'Created At'], now),
    ),
    updatedAt: String(
      readAny(raw, ['updatedAt', 'Updated At'], now),
    ),
    receivedAt: String(
      readAny(raw, ['receivedAt', 'Received At'], ''),
    ),
    aiStatus: ['Ready', 'Review', 'Blocked'].includes(
      String(raw?.aiStatus),
    )
      ? raw.aiStatus
      : undefined,
    aiScore:
      raw?.aiScore === undefined
        ? undefined
        : asNumber(raw.aiScore, 0),
    aiIssues: Array.isArray(raw?.aiIssues)
      ? raw.aiIssues
      : [],
    aiWarnings: Array.isArray(raw?.aiWarnings)
      ? raw.aiWarnings
      : [],
    aiRecommendations: Array.isArray(
      raw?.aiRecommendations,
    )
      ? raw.aiRecommendations
      : [],
    aiReviewedAt: String(raw?.aiReviewedAt || ''),
  };
}

function buildProductLookup(
  products: ProductMasterRecord[],
) {
  const map = new Map<
    string,
    ProductMasterRecord
  >();

  products.forEach((product) => {
    if (product.productCode) {
      map.set(
        normalizeText(product.productCode),
        product,
      );
    }

    if (product.sku) {
      map.set(normalizeText(product.sku), product);
    }
  });

  return map;
}

function buildLocationLookup(
  locations: LocationMasterRecord[],
) {
  const map = new Map<
    string,
    LocationMasterRecord
  >();

  locations.forEach((location) => {
    if (!location.location) return;

    map.set(
      locationIdentityKey(
        location.plant,
        location.location,
      ),
      location,
    );

    if (!location.plant) {
      map.set(
        locationIdentityKey('', location.location),
        location,
      );
    }
  });

  return map;
}

function findLocationMaster(
  locations: LocationMasterRecord[],
  plant: string,
  location: string,
) {
  return (
    locations.find(
      (record) =>
        normalizeText(record.location) ===
          normalizeText(location) &&
        normalizeText(record.plant) ===
          normalizeText(plant),
    ) ||
    locations.find(
      (record) =>
        normalizeText(record.location) ===
          normalizeText(location) &&
        !record.plant,
    )
  );
}

function validateReceipt(
  receipt: InboundReceipt,
  productLookup?: Map<
    string,
    ProductMasterRecord
  >,
) {
  const errors: string[] = [];

  if (!receipt.receiptNo) {
    errors.push('Receipt No is required');
  }

  if (!receipt.receiptDate) {
    errors.push('Receipt Date is required');
  }

  if (!receipt.items.length) {
    errors.push('At least one item is required');
  }

  receipt.items.forEach((item, index) => {
    const row = index + 1;

    const product =
      productLookup?.get(
        normalizeText(item.productCode),
      ) ||
      productLookup?.get(normalizeText(item.sku));

    if (!item.productCode) {
      errors.push(
        `Row ${row}: Product Code / SKU is required`,
      );
    }

    if (product && !isActiveProduct(product)) {
      errors.push(
        `Row ${row}: Product ${item.productCode} is inactive and cannot be received`,
      );
    }

    if (
      !item.batchNo &&
      (!product || product.batchControlled)
    ) {
      errors.push(`Row ${row}: Batch No is required`);
    }

    if (
      product?.expiryControlled &&
      !item.expiryDate
    ) {
      errors.push(
        `Row ${row}: Expiry Date is required because product is expiry controlled`,
      );
    }

    if (!item.plant) {
      errors.push(`Row ${row}: Plant is required`);
    }

    if (!item.uom) {
      errors.push(`Row ${row}: UOM is required`);
    }

    if (
      !Number.isFinite(item.qty) ||
      item.qty <= 0
    ) {
      errors.push(
        `Row ${row}: Qty must be greater than 0`,
      );
    }
  });

  return errors;
}

function buildCsv(receipts: InboundReceipt[]) {
  const lines = [CSV_HEADERS.join(',')];

  receipts.forEach((receipt) => {
    receipt.items.forEach((item) => {
      lines.push(
        [
          receipt.receiptNo,
          receipt.supplierName,
          receipt.poNo,
          receipt.receiptDate,
          receipt.status,
          item.productCode,
          item.productName,
          item.batchNo,
          item.plant,
          item.location,
          item.expiryDate,
          item.uom,
          item.qty,
          item.remarks || receipt.remarks || '',
        ]
          .map(csvEscape)
          .join(','),
      );
    });
  });

  return lines.join('\n');
}

function loadOptionsFromStorage(
  keys: string[],
  codeFields: string[],
  nameFields: string[],
): MasterOption[] {
  const map = new Map<string, MasterOption>();

  keys.forEach((storageKey) => {
    const raw = safeJsonParse<any[]>(
      getStorageItem(storageKey),
      [],
    );

    if (!Array.isArray(raw)) return;

    raw.forEach((item) => {
      const code = String(
        readAny(item, codeFields, ''),
      ).trim();

      const name = String(
        readAny(item, nameFields, ''),
      ).trim();

      if (!code) return;

      const key = normalizeText(code);

      if (!map.has(key)) {
        map.set(key, {
          value: code,
          label: name ? `${code} - ${name}` : code,
          raw: item,
        });
      }
    });
  });

  return Array.from(map.values());
}

function createDemoInboundReceipt(): InboundReceipt[] {
  const now = new Date().toISOString();

  return [
    {
      id: uid('INB'),
      receiptNo: generateReceiptNo(),
      supplierName: 'Demo Supplier',
      poNo: 'PO-DEMO-001',
      receiptDate: todayDate(),
      status: 'Draft',
      movementPosted: false,
      remarks: 'Demo inbound receipt',
      createdAt: now,
      updatedAt: now,
      items: [
        {
          id: uid('INB-ITEM'),
          productCode: 'DEMO-SKU-001',
          sku: 'DEMO-SKU-001',
          productName: 'Demo Product A',
          batchNo: 'BATCH-A001',
          plant: 'PLANT-01',
          location: 'A-01-01',
          expiryDate: '2027-12-31',
          uom: 'PCS',
          qty: 100,
          remarks: '',
        },
      ],
    },
  ];
}

export default function InboundReceivingPage() {
  const [form] = Form.useForm<InboundFormValues>();
  const [messageApi, contextHolder] =
    message.useMessage();

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [receipts, setReceipts] = useState<
    InboundReceipt[]
  >([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] =
    useState<ModalMode>('create');

  const [editingReceipt, setEditingReceipt] =
    useState<InboundReceipt | null>(null);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<string>('All');
  const [plantFilter, setPlantFilter] =
    useState<string>('All');

  const [productMasters, setProductMasters] =
    useState<ProductMasterRecord[]>([]);

  const [locationMasters, setLocationMasters] =
    useState<LocationMasterRecord[]>([]);

  const [uomOptions, setUomOptions] = useState<
    MasterOption[]
  >([]);

  const [plantOptions, setPlantOptions] = useState<
    MasterOption[]
  >([]);

  const [locationOptions, setLocationOptions] =
    useState<MasterOption[]>([]);

  const [aiModalOpen, setAiModalOpen] =
    useState(false);

  const [aiReview, setAiReview] =
    useState<AIReview | null>(null);

  const [aiReceipt, setAiReceipt] =
    useState<InboundReceipt | null>(null);

  const [printOpen, setPrintOpen] =
    useState(false);

  const [qrPrintReceipt, setQrPrintReceipt] =
    useState<InboundReceipt | null>(null);

  const isViewMode = modalMode === 'view';

  useEffect(() => {
    loadReceipts();
    loadMasterOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productLookup = useMemo(
    () => buildProductLookup(productMasters),
    [productMasters],
  );

  function loadReceipts() {
    const raw = safeJsonParse<any[]>(
      getStorageItem(INBOUND_STORAGE_KEY),
      [],
    );

    const normalized = Array.isArray(raw)
      ? raw.map(normalizeInboundReceipt)
      : [];

    setReceipts(normalized);
  }

  function saveReceipts(
    nextReceipts: InboundReceipt[],
  ) {
    setStorageItem(
      INBOUND_STORAGE_KEY,
      JSON.stringify(nextReceipts),
    );

    setReceipts(nextReceipts);
  }

  function loadProductMasters() {
    const map = new Map<
      string,
      ProductMasterRecord
    >();

    PRODUCT_MASTER_KEYS.forEach((storageKey) => {
      const raw = safeJsonParse<any[]>(
        getStorageItem(storageKey),
        [],
      );

      if (!Array.isArray(raw)) return;

      raw.forEach((item) => {
        const product = normalizeProductMaster(item);

        if (!product.productCode && !product.sku) {
          return;
        }

        const key = normalizeText(
          product.productCode || product.sku,
        );

        if (!map.has(key)) {
          map.set(key, product);
        }
      });
    });

    return Array.from(map.values());
  }

  function loadLocationMasters() {
    const map = new Map<
      string,
      LocationMasterRecord
    >();

    LOCATION_MASTER_KEYS.forEach((storageKey) => {
      const raw = safeJsonParse<any[]>(
        getStorageItem(storageKey),
        [],
      );

      if (!Array.isArray(raw)) return;

      raw.forEach((item) => {
        const location =
          normalizeLocationMaster(item);

        if (!location.location) return;

        const key = locationIdentityKey(
          location.plant,
          location.location,
        );

        if (!map.has(key)) {
          map.set(key, location);
        }
      });
    });

    return Array.from(map.values());
  }

  function loadMasterOptions() {
    const products = loadProductMasters();
    const locations = loadLocationMasters();

    setProductMasters(products);
    setLocationMasters(locations);

    setUomOptions(
      loadOptionsFromStorage(
        [
          'wms_uoms',
          'uoms',
          'uomData',
          'wms_uom_master',
        ],
        [
          'uom',
          'UOM',
          'code',
          'Code',
          'unit',
          'Unit',
        ],
        ['name', 'Name', 'description', 'Description'],
      ),
    );

    setPlantOptions(
      loadOptionsFromStorage(
        [
          'wms_plants',
          'plants',
          'plantData',
          'wms_plant_master',
        ],
        [
          'plant',
          'Plant',
          'plantCode',
          'Plant Code',
          'code',
          'Code',
        ],
        [
          'plantName',
          'Plant Name',
          'name',
          'Name',
          'description',
          'Description',
        ],
      ),
    );

    setLocationOptions(
      locations.map((location) => ({
        value: location.location,
        label: location.locationName
          ? `${location.location} - ${location.locationName}`
          : location.location,
        raw: location,
      })),
    );
  }

  function readInventory() {
    const primary = safeJsonParse<any[]>(
      getStorageItem(INVENTORY_STORAGE_KEY),
      [],
    );

    const compat = safeJsonParse<any[]>(
      getStorageItem(
        INVENTORY_COMPAT_STORAGE_KEY,
      ),
      [],
    );

    const map = new Map<string, InventoryItem>();

    [...primary, ...compat].forEach((item: any) => {
      const normalized = normalizeInventoryItem(item);

      const key =
        normalized.id ||
        inventoryIdentityKey(normalized);

      map.set(key, normalized);
    });

    return Array.from(map.values());
  }

  function saveInventory(items: InventoryItem[]) {
    const persisted = items.map(
      toPersistedInventoryRecord,
    );

    setStorageItem(
      INVENTORY_STORAGE_KEY,
      JSON.stringify(persisted),
    );

    setStorageItem(
      INVENTORY_COMPAT_STORAGE_KEY,
      JSON.stringify(persisted),
    );
  }

  function readMovements() {
    const primary = safeJsonParse<any[]>(
      getStorageItem(MOVEMENT_STORAGE_KEY),
      [],
    );

    return Array.isArray(primary) ? primary : [];
  }

  function saveMovements(movements: any[]) {
    setStorageItem(
      MOVEMENT_STORAGE_KEY,
      JSON.stringify(movements),
    );

    setStorageItem(
      MOVEMENT_COMPAT_STORAGE_KEY,
      JSON.stringify(movements),
    );
  }

  function readPurchaseOrders() {
    const map = new Map<string, any>();

    PURCHASE_ORDER_KEYS.forEach((key) => {
      const raw = safeJsonParse<any[]>(
        getStorageItem(key),
        [],
      );

      if (!Array.isArray(raw)) return;

      raw.forEach((po) => {
        const poNo = String(
          readAny(po, [
            'poNo',
            'PO No',
            'purchaseOrderNo',
            'Purchase Order No',
            'orderNo',
          ]),
        ).trim();

        if (poNo && !map.has(normalizeText(poNo))) {
          map.set(normalizeText(poNo), po);
        }
      });
    });

    return Array.from(map.values());
  }

  const allProductOptions = useMemo(() => {
    const activeMasterOptions: MasterOption[] =
      productMasters
        .filter(isActiveProduct)
        .filter(
          (product) =>
            product.productCode || product.sku,
        )
        .map((product) => {
          const code =
            product.productCode || product.sku;

          return {
            value: code,
            label: product.productName
              ? `${code} - ${product.productName}`
              : code,
            raw: product,
          };
        });

    const inventoryOptions: MasterOption[] =
      readInventory()
        .filter((item) => item.productCode)
        .map((item) => ({
          value: item.productCode,
          label: item.productName
            ? `${item.productCode} - ${item.productName}`
            : item.productCode,
          raw: item,
        }));

    const map = new Map<string, MasterOption>();

    [...activeMasterOptions, ...inventoryOptions].forEach(
      (option) => {
        const key = normalizeText(option.value);

        if (!map.has(key)) {
          map.set(key, option);
        }
      },
    );

    return Array.from(map.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productMasters, receipts]);

  const allUomOptions = useMemo(() => {
    const values = new Set<string>();

    uomOptions.forEach((option) =>
      values.add(option.value),
    );

    productMasters.forEach((product) => {
      if (product.uom) values.add(product.uom);
      if (product.baseUom) {
        values.add(product.baseUom);
      }
      if (product.purchaseUom) {
        values.add(product.purchaseUom);
      }
    });

    receipts.forEach((receipt) => {
      receipt.items.forEach((item) => {
        if (item.uom) values.add(item.uom);
      });
    });

    readInventory().forEach((item) => {
      if (item.uom) values.add(item.uom);
    });

    return Array.from(values).map((value) => ({
      value,
      label: value,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uomOptions, productMasters, receipts]);

  const allPlantOptions = useMemo(() => {
    const values = new Set<string>();

    plantOptions.forEach((option) =>
      values.add(option.value),
    );

    locationMasters.forEach((location) => {
      if (location.plant) values.add(location.plant);
    });

    receipts.forEach((receipt) => {
      receipt.items.forEach((item) => {
        if (item.plant) values.add(item.plant);
      });
    });

    readInventory().forEach((item) => {
      if (item.plant) values.add(item.plant);
    });

    return Array.from(values).map((value) => ({
      value,
      label: value,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    plantOptions,
    locationMasters,
    receipts,
  ]);

  const allLocationOptions = useMemo(() => {
    const map = new Map<string, MasterOption>();

    locationOptions.forEach((option) => {
      map.set(normalizeText(option.value), option);
    });

    receipts.forEach((receipt) => {
      receipt.items.forEach((item) => {
        if (!item.location) return;

        const key = normalizeText(item.location);

        if (!map.has(key)) {
          map.set(key, {
            value: item.location,
            label: item.location,
          });
        }
      });
    });

    readInventory().forEach((item) => {
      if (!item.location) return;

      const key = normalizeText(item.location);

      if (!map.has(key)) {
        map.set(key, {
          value: item.location,
          label: item.location,
        });
      }
    });

    return Array.from(map.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationOptions, receipts]);

  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      const haystack = [
        receipt.receiptNo,
        receipt.supplierName,
        receipt.poNo,
        receipt.receiptDate,
        receipt.status,
        receipt.aiStatus,
        receipt.remarks,
        ...receipt.items.flatMap((item) => [
          item.productCode,
          item.productName,
          item.batchNo,
          item.plant,
          item.location,
          item.expiryDate,
          item.uom,
        ]),
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        !searchText ||
        haystack.includes(searchText.toLowerCase());

      const matchesStatus =
        statusFilter === 'All' ||
        receipt.status === statusFilter;

      const matchesPlant =
        plantFilter === 'All' ||
        receipt.items.some(
          (item) => item.plant === plantFilter,
        );

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPlant
      );
    });
  }, [
    receipts,
    searchText,
    statusFilter,
    plantFilter,
  ]);

  const summary = useMemo(() => {
    const totalQty = receipts.reduce(
      (sum, receipt) =>
        sum +
        receipt.items.reduce(
          (itemSum, item) =>
            itemSum + Number(item.qty || 0),
          0,
        ),
      0,
    );

    return {
      totalReceipts: receipts.length,
      draftReceipts: receipts.filter(
        (receipt) => receipt.status === 'Draft',
      ).length,
      confirmedReceipts: receipts.filter(
        (receipt) =>
          receipt.status === 'Confirmed',
      ).length,
      receivedReceipts: receipts.filter(
        (receipt) => receipt.status === 'Received',
      ).length,
      cancelledReceipts: receipts.filter(
        (receipt) =>
          receipt.status === 'Cancelled',
      ).length,
      totalQty,
      unpostedReceived: receipts.filter(
        (receipt) =>
          receipt.status === 'Received' &&
          !receipt.movementPosted,
      ).length,
      aiBlocked: receipts.filter(
        (receipt) =>
          receipt.aiStatus === 'Blocked' &&
          receipt.status !== 'Cancelled' &&
          receipt.status !== 'Received',
      ).length,
      aiReview: receipts.filter(
        (receipt) =>
          receipt.aiStatus === 'Review' &&
          receipt.status !== 'Cancelled' &&
          receipt.status !== 'Received',
      ).length,
    };
  }, [receipts]);

  const warehouseRisk = useMemo<WarehouseRisk>(() => {
    const inventory = readInventory();

    const stockByProduct = new Map<string, number>();

    inventory.forEach((item) => {
      if (!isAvailableInventoryStatus(item.status)) {
        return;
      }

      const key = normalizeText(
        item.productCode || item.sku,
      );

      stockByProduct.set(
        key,
        (stockByProduct.get(key) || 0) +
          Number(item.batchQty || 0),
      );
    });

    let lowStockProducts = 0;
    let highStockProducts = 0;

    productMasters.forEach((product) => {
      const key = normalizeText(
        product.productCode || product.sku,
      );

      const qty = stockByProduct.get(key) || 0;

      if (
        Number(product.minStockLevel || 0) > 0 &&
        qty < Number(product.minStockLevel)
      ) {
        lowStockProducts += 1;
      }

      if (
        Number(product.maxStockLevel || 0) > 0 &&
        qty > Number(product.maxStockLevel)
      ) {
        highStockProducts += 1;
      }
    });

    const locationQty = new Map<string, number>();

    inventory.forEach((item) => {
      const key = locationIdentityKey(
        item.plant,
        item.location,
      );

      locationQty.set(
        key,
        (locationQty.get(key) || 0) +
          Number(item.batchQty || 0),
      );
    });

    let emptyLocations = 0;
    let nearFullLocations = 0;
    let fullLocations = 0;
    let capacityTrackedLocations = 0;

    locationMasters
      .filter(isActiveLocation)
      .forEach((location) => {
        const qty =
          locationQty.get(
            locationIdentityKey(
              location.plant,
              location.location,
            ),
          ) || 0;

        if (qty <= 0) emptyLocations += 1;

        if (location.capacity > 0) {
          capacityTrackedLocations += 1;

          const utilization =
            (qty / location.capacity) * 100;

          if (utilization >= 100) {
            fullLocations += 1;
          } else if (utilization >= 85) {
            nearFullLocations += 1;
          }
        }
      });

    return {
      lowStockProducts,
      highStockProducts,
      emptyLocations,
      nearFullLocations,
      fullLocations,
      capacityTrackedLocations,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    receipts,
    productMasters,
    locationMasters,
  ]);

  function createReceiptFromForm(): InboundReceipt {
    const values = form.getFieldsValue(true);
    const now = new Date().toISOString();

    return {
      id: editingReceipt?.id || uid('INB'),
      receiptNo: String(
        values.receiptNo || '',
      ).trim(),
      supplierName: String(
        values.supplierName || '',
      ).trim(),
      poNo: String(values.poNo || '').trim(),
      receiptDate: normalizeDate(
        values.receiptDate || todayDate(),
      ),
      status: values.status || 'Draft',
      movementPosted:
        editingReceipt?.movementPosted || false,
      items: (values.items || []).map((item: NonNullable<typeof editingReceipt>['items'][number]) => ({
        id: item.id || uid('INB-ITEM'),
        productCode: String(
          item.productCode || '',
        ).trim(),
        sku: String(
          item.sku || item.productCode || '',
        ).trim(),
        productName: String(
          item.productName || '',
        ).trim(),
        batchNo: String(
          item.batchNo || '',
        ).trim(),
        plant: String(item.plant || '').trim(),
        location: String(
          item.location || '',
        ).trim(),
        expiryDate: normalizeDate(item.expiryDate),
        uom:
          String(item.uom || 'PCS').trim() ||
          'PCS',
        qty: asNumber(item.qty, 0),
        remarks: String(
          item.remarks || '',
        ).trim(),
      })),
      remarks: String(values.remarks || '').trim(),
      createdAt: editingReceipt?.createdAt || now,
      updatedAt: now,
      receivedAt:
        editingReceipt?.receivedAt || '',
      aiStatus: editingReceipt?.aiStatus,
      aiScore: editingReceipt?.aiScore,
      aiIssues: editingReceipt?.aiIssues || [],
      aiWarnings:
        editingReceipt?.aiWarnings || [],
      aiRecommendations:
        editingReceipt?.aiRecommendations || [],
      aiReviewedAt:
        editingReceipt?.aiReviewedAt || '',
    };
  }

  function analyzeInboundReceipt(
    receipt: InboundReceipt,
  ): AIReview {
    const inventory = readInventory();
    const purchaseOrders = readPurchaseOrders();

    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const positives: string[] = [];

    validateReceipt(receipt, productLookup).forEach(
      (error) => issues.push(error),
    );

    if (!receipt.supplierName) {
      warnings.push(
        'Supplier Name is blank. Supplier traceability may be incomplete.',
      );
    }

    if (!receipt.poNo) {
      warnings.push(
        'PO No is blank. The receipt cannot be matched against ordered quantity.',
      );
      recommendations.push(
        'Enter a Purchase Order number when this is a supplier receipt.',
      );
    }

    const receiptDateDays =
      daysUntil(receipt.receiptDate);

    if (
      receiptDateDays !== null &&
      receiptDateDays > 1
    ) {
      warnings.push(
        `Receipt Date is ${receiptDateDays} days in the future.`,
      );
    }

    const duplicateReceipt = receipts.find(
      (existing) =>
        existing.id !== receipt.id &&
        normalizeText(existing.receiptNo) ===
          normalizeText(receipt.receiptNo),
    );

    if (duplicateReceipt) {
      issues.push(
        `Receipt No ${receipt.receiptNo} already exists.`,
      );
    }

    const duplicateLineMap = new Map<
      string,
      number[]
    >();

    receipt.items.forEach((item, index) => {
      const key = inventoryIdentityKey(item);
      const lines = duplicateLineMap.get(key) || [];

      lines.push(index + 1);
      duplicateLineMap.set(key, lines);
    });

    duplicateLineMap.forEach((lines) => {
      if (lines.length > 1) {
        warnings.push(
          `Duplicate inventory identity detected on rows ${lines.join(
            ', ',
          )}. Consider combining these quantities.`,
        );
      }
    });

    const currentStockByProduct = new Map<
      string,
      number
    >();

    inventory.forEach((item) => {
      const key = normalizeText(
        item.productCode || item.sku,
      );

      currentStockByProduct.set(
        key,
        (currentStockByProduct.get(key) || 0) +
          Number(item.batchQty || 0),
      );
    });

    const incomingStockByProduct = new Map<
      string,
      number
    >();

    receipt.items.forEach((item) => {
      const key = normalizeText(
        item.productCode || item.sku,
      );

      incomingStockByProduct.set(
        key,
        (incomingStockByProduct.get(key) || 0) +
          Number(item.qty || 0),
      );
    });

    receipt.items.forEach((item, index) => {
      const row = index + 1;

      const product =
        productLookup.get(
          normalizeText(item.productCode),
        ) ||
        productLookup.get(normalizeText(item.sku));

      if (!product) {
        warnings.push(
          `Row ${row}: SKU ${item.productCode || '-'} was not found in Product Master.`,
        );
        recommendations.push(
          `Row ${row}: Create or verify SKU ${item.productCode || '-'} in Product Master before receiving.`,
        );
      } else {
        if (!isActiveProduct(product)) {
          issues.push(
            `Row ${row}: SKU ${item.productCode} is inactive or blocked.`,
          );
        }

        const allowedUoms = [
          product.purchaseUom,
          product.uom,
          product.baseUom,
        ]
          .filter(Boolean)
          .map(normalizeText);

        if (
          item.uom &&
          allowedUoms.length &&
          !allowedUoms.includes(
            normalizeText(item.uom),
          )
        ) {
          warnings.push(
            `Row ${row}: UOM ${item.uom} does not match Product Master purchase/base UOM.`,
          );
        }

        if (
          product.batchControlled &&
          !item.batchNo
        ) {
          issues.push(
            `Row ${row}: Batch No is mandatory for batch-controlled SKU ${item.productCode}.`,
          );
        }

        if (
          !product.batchControlled &&
          item.batchNo
        ) {
          positives.push(
            `Row ${row}: Batch information provides additional traceability.`,
          );
        }

        if (
          product.expiryControlled &&
          !item.expiryDate
        ) {
          issues.push(
            `Row ${row}: Expiry Date is mandatory for expiry-controlled SKU ${item.productCode}.`,
          );
        }

        const currentQty =
          currentStockByProduct.get(
            normalizeText(
              product.productCode || product.sku,
            ),
          ) || 0;

        const incomingQty =
          incomingStockByProduct.get(
            normalizeText(
              product.productCode || product.sku,
            ),
          ) || 0;

        const projectedQty =
          currentQty + incomingQty;

        if (
          Number(product.maxStockLevel || 0) > 0 &&
          projectedQty >
            Number(product.maxStockLevel)
        ) {
          warnings.push(
            `SKU ${item.productCode}: projected stock ${projectedQty.toLocaleString()} exceeds maximum stock ${Number(
              product.maxStockLevel,
            ).toLocaleString()}.`,
          );

          recommendations.push(
            `Review purchase quantity, demand forecast or alternate storage for SKU ${item.productCode}.`,
          );
        } else if (
          Number(product.maxStockLevel || 0) > 0 &&
          projectedQty >=
            Number(product.maxStockLevel) * 0.9
        ) {
          warnings.push(
            `SKU ${item.productCode}: projected stock will reach at least 90% of maximum stock.`,
          );
        }

        if (
          Number(product.minStockLevel || 0) > 0 &&
          currentQty <
            Number(product.minStockLevel) &&
          projectedQty >=
            Number(product.minStockLevel)
        ) {
          positives.push(
            `SKU ${item.productCode}: this receipt resolves the current low-stock condition.`,
          );
        }

        if (
          Number(product.minStockLevel || 0) > 0 &&
          projectedQty <
            Number(product.minStockLevel)
        ) {
          warnings.push(
            `SKU ${item.productCode}: projected stock ${projectedQty.toLocaleString()} remains below minimum stock ${Number(
              product.minStockLevel,
            ).toLocaleString()}.`,
          );
        }
      }

      if (!item.location) {
        warnings.push(
          `Row ${row}: Location is blank. Putaway cannot be controlled accurately.`,
        );
        recommendations.push(
          `Row ${row}: Assign an active empty or available location before receiving.`,
        );
      } else {
        const location = findLocationMaster(
          locationMasters,
          item.plant,
          item.location,
        );

        if (
          locationMasters.length > 0 &&
          !location
        ) {
          warnings.push(
            `Row ${row}: Location ${item.location} was not found in Location Master for plant ${item.plant}.`,
          );
        }

        if (location && !isActiveLocation(location)) {
          issues.push(
            `Row ${row}: Location ${item.location} is inactive, blocked or closed.`,
          );
        }
      }

      if (item.expiryDate) {
        const remainingDays = daysUntil(
          item.expiryDate,
        );

        if (
          remainingDays !== null &&
          remainingDays < 0
        ) {
          issues.push(
            `Row ${row}: Expiry Date ${item.expiryDate} has already passed.`,
          );
        } else if (
          remainingDays !== null &&
          remainingDays <= 30
        ) {
          warnings.push(
            `Row ${row}: Stock expires in ${remainingDays} days. Check supplier shelf-life policy.`,
          );
        } else if (
          remainingDays !== null &&
          remainingDays <= 90
        ) {
          warnings.push(
            `Row ${row}: Stock has only ${remainingDays} days remaining shelf life.`,
          );
        }
      }
    });

    const currentQtyByLocation = new Map<
      string,
      number
    >();

    inventory.forEach((item) => {
      const key = locationIdentityKey(
        item.plant,
        item.location,
      );

      currentQtyByLocation.set(
        key,
        (currentQtyByLocation.get(key) || 0) +
          Number(item.batchQty || 0),
      );
    });

    const incomingQtyByLocation = new Map<
      string,
      number
    >();

    receipt.items.forEach((item) => {
      if (!item.location) return;

      const key = locationIdentityKey(
        item.plant,
        item.location,
      );

      incomingQtyByLocation.set(
        key,
        (incomingQtyByLocation.get(key) || 0) +
          Number(item.qty || 0),
      );
    });

    const locationProjections: LocationProjection[] =
      [];

    incomingQtyByLocation.forEach(
      (incomingQty, key) => {
        const sample = receipt.items.find(
          (item) =>
            locationIdentityKey(
              item.plant,
              item.location,
            ) === key,
        );

        if (!sample) return;

        const currentQty =
          currentQtyByLocation.get(key) || 0;

        const projectedQty =
          currentQty + incomingQty;

        const location = findLocationMaster(
          locationMasters,
          sample.plant,
          sample.location,
        );

        const capacity = Number(
          location?.capacity || 0,
        );

        const utilization =
          capacity > 0
            ? (projectedQty / capacity) * 100
            : null;

        let projectionStatus: LocationProjection['status'] =
          currentQty <= 0
            ? 'Empty'
            : 'Available';

        if (
          utilization !== null &&
          utilization > 100
        ) {
          projectionStatus = 'Over Capacity';

          issues.push(
            `Location ${sample.plant}/${sample.location} will exceed capacity: projected ${projectedQty.toLocaleString()} of ${capacity.toLocaleString()} (${utilization.toFixed(
              1,
            )}%).`,
          );

          recommendations.push(
            `Split the inbound quantity for ${sample.location} across another empty or available location.`,
          );
        } else if (
          utilization !== null &&
          utilization >= 100
        ) {
          projectionStatus = 'Full';

          warnings.push(
            `Location ${sample.plant}/${sample.location} will be full after receipt.`,
          );
        } else if (
          utilization !== null &&
          utilization >= 85
        ) {
          projectionStatus = 'Near Full';

          warnings.push(
            `Location ${sample.plant}/${sample.location} will reach ${utilization.toFixed(
              1,
            )}% utilization.`,
          );
        }

        locationProjections.push({
          key,
          plant: sample.plant,
          location: sample.location,
          currentQty,
          incomingQty,
          projectedQty,
          capacity,
          utilization,
          status: projectionStatus,
        });
      },
    );

    const emptyLocations = locationMasters
      .filter(isActiveLocation)
      .filter((location) => {
        const key = locationIdentityKey(
          location.plant,
          location.location,
        );

        return (
          Number(currentQtyByLocation.get(key) || 0) <=
          0
        );
      })
      .filter((location) => {
        const receiptPlants = new Set(
          receipt.items
            .map((item) => normalizeText(item.plant))
            .filter(Boolean),
        );

        return (
          !location.plant ||
          receiptPlants.size === 0 ||
          receiptPlants.has(
            normalizeText(location.plant),
          )
        );
      })
      .slice(0, 10)
      .map((location) =>
        location.plant
          ? `${location.plant}/${location.location}`
          : location.location,
      );

    if (emptyLocations.length > 0) {
      recommendations.push(
        `Empty locations available for putaway: ${emptyLocations.join(
          ', ',
        )}.`,
      );
    }

    if (
      locationMasters.length > 0 &&
      !locationMasters.some(
        (location) => location.capacity > 0,
      )
    ) {
      recommendations.push(
        'Maintain Max Capacity in Location Master to enable full-location and over-capacity blocking.',
      );
    }

    if (receipt.poNo) {
      const po = purchaseOrders.find(
        (record) =>
          normalizeText(
            readAny(record, [
              'poNo',
              'PO No',
              'purchaseOrderNo',
              'Purchase Order No',
              'orderNo',
            ]),
          ) === normalizeText(receipt.poNo),
      );

      if (!po && purchaseOrders.length > 0) {
        warnings.push(
          `PO ${receipt.poNo} was not found in Purchase Orders.`,
        );
      }

      if (po) {
        const poStatus = normalizeText(
          readAny(po, ['status', 'Status']),
        );

        if (
          ['cancelled', 'closed', 'rejected'].includes(
            poStatus,
          )
        ) {
          issues.push(
            `PO ${receipt.poNo} has status ${readAny(
              po,
              ['status', 'Status'],
            )} and should not be received.`,
          );
        }

        const supplier = String(
          readAny(po, [
            'supplierName',
            'Supplier Name',
            'supplier',
          ]),
        ).trim();

        if (
          supplier &&
          receipt.supplierName &&
          normalizeText(supplier) !==
            normalizeText(receipt.supplierName)
        ) {
          warnings.push(
            `Supplier does not match PO ${receipt.poNo}. PO supplier is ${supplier}.`,
          );
        }

        positives.push(
          `PO ${receipt.poNo} was found for receipt matching.`,
        );
      }
    }

    if (!issues.length) {
      positives.push(
        'No blocking inbound data errors were detected.',
      );
    }

    if (
      !warnings.length &&
      !issues.length
    ) {
      positives.push(
        'Stock, location and master-data checks are ready for receiving.',
      );
    }

    const uniqueIssues = Array.from(
      new Set(issues),
    );

    const uniqueWarnings = Array.from(
      new Set(warnings),
    );

    const uniqueRecommendations = Array.from(
      new Set(recommendations),
    );

    const uniquePositives = Array.from(
      new Set(positives),
    );

    const score = Math.max(
      0,
      Math.min(
        100,
        100 -
          uniqueIssues.length * 18 -
          uniqueWarnings.length * 5,
      ),
    );

    const status: AIStatus =
      uniqueIssues.length > 0
        ? 'Blocked'
        : uniqueWarnings.length > 0
          ? 'Review'
          : 'Ready';

    return {
      status,
      score,
      issues: uniqueIssues,
      warnings: uniqueWarnings,
      recommendations: uniqueRecommendations.length
        ? uniqueRecommendations
        : [
            'Inbound data is ready. Continue with controlled receiving and putaway.',
          ],
      positives: uniquePositives,
      locationProjections,
      emptyLocations,
      reviewedAt: new Date().toISOString(),
    };
  }

  function persistAIReview(
    receipt: InboundReceipt,
    review: AIReview,
  ) {
    const next = receipts.map((existing) =>
      existing.id === receipt.id
        ? {
            ...existing,
            aiStatus: review.status,
            aiScore: review.score,
            aiIssues: review.issues,
            aiWarnings: review.warnings,
            aiRecommendations:
              review.recommendations,
            aiReviewedAt: review.reviewedAt,
            updatedAt: new Date().toISOString(),
          }
        : existing,
    );

    saveReceipts(next);
  }

  function runAIReview(
    receipt: InboundReceipt,
    persist = true,
  ) {
    const review = analyzeInboundReceipt(receipt);

    setAiReceipt(receipt);
    setAiReview(review);
    setAiModalOpen(true);

    if (
      persist &&
      receipts.some(
        (existing) => existing.id === receipt.id,
      )
    ) {
      persistAIReview(receipt, review);
    }

    return review;
  }

  function handleFormAIReview() {
    const receipt = createReceiptFromForm();
    runAIReview(receipt, false);
  }

  function openCreateModal() {
    setModalMode('create');
    setEditingReceipt(null);
    form.resetFields();

    form.setFieldsValue({
      receiptNo: generateReceiptNo(),
      supplierName: '',
      poNo: '',
      receiptDate: todayDate(),
      status: 'Draft',
      remarks: '',
      items: [
        {
          id: uid('INB-ITEM'),
          productCode: '',
          sku: '',
          productName: '',
          batchNo: '',
          plant: '',
          location: '',
          expiryDate: '',
          uom: 'PCS',
          qty: 1,
          remarks: '',
        },
      ],
    });

    setModalOpen(true);
  }

  function setReceiptForm(
    receipt: InboundReceipt,
  ) {
    form.setFieldsValue({
      receiptNo: receipt.receiptNo,
      supplierName: receipt.supplierName,
      poNo: receipt.poNo,
      receiptDate: receipt.receiptDate,
      status: receipt.status,
      remarks: receipt.remarks || '',
      items: receipt.items,
    });
  }

  function openEditModal(receipt: InboundReceipt) {
    setModalMode('edit');
    setEditingReceipt(receipt);
    setReceiptForm(receipt);
    setModalOpen(true);
  }

  function openViewModal(receipt: InboundReceipt) {
    setModalMode('view');
    setEditingReceipt(receipt);
    setReceiptForm(receipt);
    setModalOpen(true);
  }

  function findSelectedProduct(value: string) {
    const fromMaster =
      productMasters.find(
        (product) =>
          normalizeText(product.productCode) ===
          normalizeText(value),
      ) ||
      productMasters.find(
        (product) =>
          normalizeText(product.sku) ===
          normalizeText(value),
      );

    if (fromMaster) return fromMaster;

    const fromInventory = readInventory().find(
      (item) =>
        normalizeText(item.productCode) ===
        normalizeText(value),
    );

    if (!fromInventory) return null;

    return {
      productCode: fromInventory.productCode,
      sku: fromInventory.sku,
      productName: fromInventory.productName,
      uom: fromInventory.uom,
      batchControlled: true,
      expiryControlled: Boolean(
        fromInventory.expiryDate,
      ),
      status: 'Active',
      raw: fromInventory,
    } as ProductMasterRecord;
  }

  function handleProductSelect(
    value: string,
    index: number,
  ) {
    const selected = findSelectedProduct(value);

    if (!selected) return;

    if (!isActiveProduct(selected)) {
      messageApi.warning(
        'Inactive product cannot be selected',
      );
      return;
    }

    const items = form.getFieldValue('items') || [];

    items[index] = {
      ...items[index],
      productCode:
        selected.productCode ||
        selected.sku ||
        value,
      sku:
        selected.sku ||
        selected.productCode ||
        value,
      productName:
        selected.productName ||
        items[index]?.productName ||
        '',
      uom:
        selected.purchaseUom ||
        selected.uom ||
        selected.baseUom ||
        items[index]?.uom ||
        'PCS',
    };

    form.setFieldsValue({ items });
  }

  async function handleSave() {
    if (isViewMode) {
      setModalOpen(false);
      return;
    }

    await form.validateFields();

    const receipt = createReceiptFromForm();
    const validationErrors = validateReceipt(
      receipt,
      productLookup,
    );

    if (validationErrors.length) {
      Modal.error({
        title: 'Inbound receipt validation failed',
        width: 720,
        content: (
          <ul
            style={{
              marginBottom: 0,
              paddingLeft: 20,
            }}
          >
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ),
      });
      return;
    }

    const duplicate = receipts.find(
      (existing) =>
        existing.id !== receipt.id &&
        normalizeText(existing.receiptNo) ===
          normalizeText(receipt.receiptNo),
    );

    if (duplicate) {
      Modal.warning({
        title: 'Duplicate Receipt No',
        content:
          'Another inbound receipt already uses this Receipt No.',
      });
      return;
    }

    const review = analyzeInboundReceipt(receipt);

    const savedReceipt: InboundReceipt = {
      ...receipt,
      aiStatus: review.status,
      aiScore: review.score,
      aiIssues: review.issues,
      aiWarnings: review.warnings,
      aiRecommendations: review.recommendations,
      aiReviewedAt: review.reviewedAt,
    };

    const next =
      modalMode === 'edit'
        ? receipts.map((existing) =>
            existing.id === savedReceipt.id
              ? savedReceipt
              : existing,
          )
        : [savedReceipt, ...receipts];

    saveReceipts(next);
    setModalOpen(false);

    messageApi.success(
      modalMode === 'edit'
        ? 'Inbound receipt updated'
        : 'Inbound receipt created',
    );

    if (review.status === 'Blocked') {
      messageApi.warning(
        'AI found blocking issues. Review before receiving.',
      );
    } else if (review.status === 'Review') {
      messageApi.info(
        'AI saved the receipt with warnings for review.',
      );
    }
  }

  function handleDelete(receipt: InboundReceipt) {
    if (receipt.status === 'Received') {
      messageApi.warning(
        'Received receipt cannot be deleted',
      );
      return;
    }

    saveReceipts(
      receipts.filter(
        (existing) => existing.id !== receipt.id,
      ),
    );

    messageApi.success('Inbound receipt deleted');
  }

  function handleConfirm(receipt: InboundReceipt) {
  if (receipt.status !== 'Draft') {
    messageApi.warning('Only Draft receipt can be confirmed');
    return;
  }
  const review = analyzeInboundReceipt(receipt);
  if (review.status === 'Blocked') {
    setAiReceipt(receipt);
    setAiReview(review);
    setAiModalOpen(true);
    persistAIReview(receipt, review);
    messageApi.error(
      'AI blocked confirmation because critical errors were found.',
    );
    return;
  }

  const now = new Date().toISOString();

  const next = receipts.map((existing) =>
    existing.id === receipt.id
      ? {
          ...existing,
          status: 'Confirmed' as InboundStatus,
          qrGeneratedAt: now,
          qrPayloads: receipt.items.map((item) => getQrPayload(item)),
          aiStatus: review.status,
          aiScore: review.score,
          aiIssues: review.issues,
          aiWarnings: review.warnings,
          aiRecommendations: review.recommendations,
          aiReviewedAt: review.reviewedAt,
          updatedAt: now,
        }
      : existing,
  );
  saveReceipts(next);
  messageApi.success(
    'Inbound receipt confirmed. QR labels are now ready to print.',
  );
}

  function handlePrintQRLabel(receipt: InboundReceipt) {
  if (receipt.status !== 'Confirmed' && receipt.status !== 'Received') {
    messageApi.warning(
      'QR labels can only be printed after the inbound GRN is Confirmed.',
    );
    return;
  }
  setQrPrintReceipt(receipt);
  setPrintOpen(true);
}

  function getQrPayload(
    item: InboundItem,
  ) {
    return JSON.stringify({
      sku: item.sku || item.productCode,
      batchNo: item.batchNo,
      expiryDate: item.expiryDate,
    });
  }

  function getQrImageUrl(payload: string) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(payload)}`;
  }

  function escapeHtml(value: unknown) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function printQRLabels(receipt: InboundReceipt) {
  if (receipt.status !== 'Confirmed' && receipt.status !== 'Received') {
    messageApi.warning(
      'QR labels can only be printed for Confirmed or Received inbound GRNs.',
    );
    return;
  }

    const printWindow = window.open('', '_blank', 'width=900,height=700');

    if (!printWindow) {
      messageApi.error(
        'Unable to open the print window. Please allow pop-ups for this site.',
      );
      return;
    }

    const labels = receipt.items
      .map((item, index) => {
        const sku = item.sku || item.productCode;
        const payload =
          receipt.qrPayloads?.[index] ||
          getQrPayload(item);
        const qrUrl = getQrImageUrl(payload);

        return `
          <section class="label">
            <div class="qr">
              <img src="${qrUrl}" alt="QR Code" />
            </div>
            <div class="details">
              <div class="title">INBOUND STOCK LABEL</div>
              <div class="row"><span>GRN</span><strong>${escapeHtml(receipt.receiptNo)}</strong></div>
              <div class="row"><span>SKU</span><strong>${escapeHtml(sku)}</strong></div>
              <div class="row"><span>BATCH</span><strong>${escapeHtml(item.batchNo)}</strong></div>
              <div class="row"><span>EXPIRY</span><strong>${escapeHtml(item.expiryDate)}</strong></div>
              <div class="row"><span>QTY</span><strong>${escapeHtml(item.qty)} ${escapeHtml(item.uom)}</strong></div>
              <div class="row"><span>PLANT</span><strong>${escapeHtml(item.plant)}</strong></div>
              <div class="row"><span>LOCATION</span><strong>${escapeHtml(item.location)}</strong></div>
              <div class="item">Item ${index + 1} of ${receipt.items.length}</div>
            </div>
          </section>
        `;
      })
      .join('');

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>QR Labels - ${escapeHtml(receipt.receiptNo)}</title>
          <style>
            @page { size: 100mm 70mm; margin: 0; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, sans-serif; }
            .label { width: 100mm; min-height: 70mm; padding: 5mm; display: flex; gap: 5mm; page-break-after: always; align-items: center; }
            .label:last-child { page-break-after: auto; }
            .qr { width: 38mm; flex: 0 0 38mm; text-align: center; }
            .qr img { width: 38mm; height: 38mm; object-fit: contain; }
            .details { flex: 1; min-width: 0; }
            .title { font-size: 12pt; font-weight: 700; margin-bottom: 3mm; border-bottom: 1px solid #000; padding-bottom: 2mm; }
            .row { display: flex; justify-content: space-between; gap: 3mm; font-size: 9pt; line-height: 1.45; }
            .row span { color: #555; }
            .row strong { text-align: right; word-break: break-word; }
            .item { margin-top: 2mm; font-size: 7pt; color: #666; }
          </style>
        </head>
        <body>${labels}
          <script>
            const images = Array.from(document.images);
            Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })))
              .then(() => setTimeout(() => { window.print(); }, 300));
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  }

  function handleCancel(receipt: InboundReceipt) {
    if (receipt.status === 'Received') {
      messageApi.warning('Received receipt cannot be cancelled');
      return;
    }

    if (receipt.status === 'Cancelled') {
      messageApi.info('Inbound receipt is already cancelled');
      return;
    }

    const next = receipts.map((existing) =>
      existing.id === receipt.id
        ? {
            ...existing,
            status: 'Cancelled' as InboundStatus,
            updatedAt: new Date().toISOString(),
          }
        : existing,
    );

    saveReceipts(next);
    messageApi.success('Inbound receipt cancelled');
  }

  function postInboundMovement(
    receipt: InboundReceipt,
    options?: { repairOnly?: boolean },
  ) {
    const repairOnly = Boolean(options?.repairOnly);

    const validationErrors = validateReceipt(
      receipt,
      productLookup,
    );

    if (validationErrors.length) {
      Modal.error({
        title: 'Cannot receive inbound receipt',
        width: 720,
        content: (
          <ul
            style={{
              marginBottom: 0,
              paddingLeft: 20,
            }}
          >
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ),
      });
      return false;
    }

    const receiptNo = getInboundNo(receipt);
    const now = new Date().toISOString();
    let inventory = readInventory();

    if (!repairOnly) {
      const inventoryMap = new Map<
        string,
        InventoryItem
      >();

      inventory.forEach((item) => {
        inventoryMap.set(
          inventoryIdentityKey(item),
          item,
        );
      });

      receipt.items.forEach((item) => {
        const normalizedItem = {
          ...item,
          expiryDate: normalizeDate(
            item.expiryDate,
          ),
        };

        const key =
          inventoryIdentityKey(normalizedItem);

        const existing = inventoryMap.get(key);

        if (existing) {
          inventoryMap.set(key, {
            ...existing,
            productName:
              item.productName ||
              existing.productName,
            uom: item.uom || existing.uom,
            batchQty:
              Number(existing.batchQty || 0) +
              Number(item.qty || 0),
            availableQty:
              Number(existing.availableQty || 0) +
              Number(item.qty || 0),
            status:
              existing.status || 'Available',
            updatedAt: now,
          });
        } else {
          inventoryMap.set(key, {
            id: uid('INV'),
            productCode: item.productCode,
            sku: item.sku || item.productCode,
            productName: item.productName,
            batchNo: item.batchNo,
            plant: item.plant,
            location: item.location,
            expiryDate: normalizeDate(
              item.expiryDate,
            ),
            uom: item.uom || 'PCS',
            batchQty: Number(item.qty || 0),
            availableQty: Number(item.qty || 0),
            status: 'Available',
            remarks: `Created from inbound ${receiptNo}`,
            createdAt: now,
            updatedAt: now,
          });
        }
      });

      inventory = Array.from(
        inventoryMap.values(),
      );

      saveInventory(inventory);
    }

    const existingMovements = readMovements();

      const newMovements = receipt.items.map(
  (item: InboundItem, index: number) => ({
        id: uid('MOV'),
        movementNo: `MOV-${Date.now()}-${index + 1}`,
        type: 'Stock Receipt',
        movementType: 'Stock Receipt',
        direction: 'IN',
        referenceType: 'Inbound Receipt',
        referenceNo: receiptNo,
        sourceModule: 'Inbound Receiving',
        sourceId: receipt.id,
        sourceLineId: item.id,
        productCode: item.productCode,
        sku: item.sku || item.productCode,
        SKU: item.sku || item.productCode,
        productName: item.productName,
        batchNo: item.batchNo,
        'Batch No': item.batchNo,
        plant: item.plant,
        Plant: item.plant,
        location: item.location,
        Location: item.location,
        expiryDate: normalizeDate(
          item.expiryDate,
        ),
        'Expiry Date': normalizeDate(
          item.expiryDate,
        ),
        uom: item.uom,
        UOM: item.uom,
        qty: Number(item.qty || 0),
        quantity: Number(item.qty || 0),
        Quantity: Number(item.qty || 0),
        remarks: repairOnly
          ? `Repair movement log for inbound ${receiptNo}`
          : `Stock received from inbound ${receiptNo}`,
        createdAt: now,
        movementDate: now,
        date: now,
      }),
    );

    const filteredExisting =
      existingMovements.filter((movement) => {
        const sameReference =
          normalizeText(movement.referenceNo) ===
          normalizeText(receiptNo);

        const sameType =
          normalizeText(movement.type) ===
            normalizeText('Stock Receipt') ||
          normalizeText(movement.movementType) ===
            normalizeText('Stock Receipt');

        return !(sameReference && sameType);
      });

    saveMovements([
      ...newMovements,
      ...filteredExisting,
    ]);

    return true;
  }

  function handleReceive(receipt: InboundReceipt) {
    if (receipt.status === 'Cancelled') {
      messageApi.warning(
        'Cancelled receipt cannot be received',
      );
      return;
    }

    if (
      receipt.status === 'Received' &&
      receipt.movementPosted
    ) {
      messageApi.info(
        'This inbound receipt has already been received and posted',
      );
      return;
    }

    const review = analyzeInboundReceipt(receipt);

    if (review.status === 'Blocked') {
      setAiReceipt(receipt);
      setAiReview(review);
      setAiModalOpen(true);
      persistAIReview(receipt, review);

      messageApi.error(
        'AI blocked receiving because critical inbound or capacity errors were found.',
      );
      return;
    }

    Modal.confirm({
      title: 'Receive inbound stock?',
      width: 620,
      content: (
        <Space
          orientation="vertical"
          style={{ width: '100%' }}
        >
          <Text>
            This will increase inventory quantity and
            create Stock Receipt movement logs.
          </Text>

          <Alert
            showIcon
            type={
              review.status === 'Ready'
                ? 'success'
                : 'warning'
            }
            message={`AI readiness: ${review.status} (${review.score}/100)`}
            description={
              review.warnings.length
                ? `${review.warnings.length} warning(s) require operational review.`
                : 'No blocking issues or warnings were detected.'
            }
          />
        </Space>
      ),
      okText: 'Receive',
      onOk: () => {
        const ok = postInboundMovement(receipt);
        if (!ok) return;

        const now = new Date().toISOString();

        const next = receipts.map((existing) =>
          existing.id === receipt.id
            ? {
                ...existing,
                status:
                  'Received' as InboundStatus,
                movementPosted: true,
                receivedAt: now,
                qrGeneratedAt: now,
                qrPayloads: receipt.items.map((item) =>
                  getQrPayload(item),
                ),
                updatedAt: now,
                aiStatus: review.status,
                aiScore: review.score,
                aiIssues: review.issues,
                aiWarnings: review.warnings,
                aiRecommendations:
                  review.recommendations,
                aiReviewedAt: review.reviewedAt,
              }
            : existing,
        );

        saveReceipts(next);

        messageApi.success(
          'Inbound received. Inventory increased and movement logs posted.',
        );
      },
    });
  }

  function handleRepairMovement(
    receipt: InboundReceipt,
  ) {
    if (receipt.status !== 'Received') {
      messageApi.warning(
        'Repair mode is only for Received receipts',
      );
      return;
    }

    Modal.confirm({
      title: 'Repair missing movement logs?',
      content:
        'This recreates Stock Receipt movement logs without increasing inventory.',
      okText: 'Repair',
      onOk: () => {
        const ok = postInboundMovement(receipt, {
          repairOnly: true,
        });

        if (!ok) return;

        const now = new Date().toISOString();

        const next = receipts.map((existing) =>
          existing.id === receipt.id
            ? {
                ...existing,
                movementPosted: true,
                updatedAt: now,
              }
            : existing,
        );

        saveReceipts(next);

        messageApi.success(
          'Movement logs repaired without inventory increase',
        );
      },
    });
  }

  function handleExport() {
    downloadFile(
      `inbound-receipts-${todayDate()}.csv`,
      buildCsv(filteredReceipts),
    );
  }

  function handleDownloadTemplate() {
    const sample = [
      CSV_HEADERS.join(','),
      [
        'GRN-DEMO-001',
        'Demo Supplier',
        'PO-DEMO-001',
        todayDate(),
        'Draft',
        'DEMO-SKU-001',
        'Demo Product A',
        'BATCH-A001',
        'PLANT-01',
        'A-01-01',
        '2027-12-31',
        'PCS',
        '100',
        'Sample row',
      ]
        .map(csvEscape)
        .join(','),
    ].join('\n');

    downloadFile(
      'inbound-import-template.csv',
      sample,
    );
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const objects = rowsToObjects(rows);

      if (!objects.length) {
        messageApi.warning(
          'CSV file has no data rows',
        );
        return;
      }

      const grouped = new Map<
        string,
        InboundReceipt
      >();

      const now = new Date().toISOString();

      objects.forEach((obj) => {
        const receiptNo =
          String(
            readAny(
              obj,
              ['Receipt No', 'receiptNo'],
              '',
            ),
          ).trim() || generateReceiptNo();

        const rawStatus = String(
          readAny(
            obj,
            ['Status', 'status'],
            'Draft',
          ),
        ).trim() as InboundStatus;

        const status: InboundStatus =
          STATUS_OPTIONS.includes(rawStatus)
            ? rawStatus
            : 'Draft';

        if (!grouped.has(receiptNo)) {
          grouped.set(receiptNo, {
            id: uid('INB'),
            receiptNo,
            supplierName: String(
              readAny(obj, [
                'Supplier Name',
                'supplierName',
              ]),
            ).trim(),
            poNo: String(
              readAny(obj, ['PO No', 'poNo']),
            ).trim(),
            receiptDate: normalizeDate(
              readAny(
                obj,
                ['Receipt Date', 'receiptDate'],
                todayDate(),
              ),
            ),
            status,
            movementPosted: false,
            remarks: String(
              readAny(obj, [
                'Remarks',
                'remarks',
              ]),
            ).trim(),
            createdAt: now,
            updatedAt: now,
            items: [],
          });
        }

        grouped
          .get(receiptNo)
          ?.items.push(normalizeInboundItem(obj));
      });

      const imported = Array.from(
        grouped.values(),
      );

      const invalidRows: {
        receiptNo: string;
        errors: string[];
      }[] = [];

      imported.forEach((receipt) => {
        const errors = validateReceipt(
          receipt,
          productLookup,
        );

        if (errors.length) {
          invalidRows.push({
            receiptNo: receipt.receiptNo,
            errors,
          });
        }
      });

      if (invalidRows.length) {
        Modal.error({
          title: 'CSV import validation failed',
          width: 760,
          content: (
            <div>
              <p>
                Fix the following receipt groups and
                import again:
              </p>

              <ul style={{ paddingLeft: 20 }}>
                {invalidRows
                  .slice(0, 20)
                  .map((row) => (
                    <li key={row.receiptNo}>
                      <b>{row.receiptNo}</b>:{' '}
                      {row.errors.join(', ')}
                    </li>
                  ))}
              </ul>

              {invalidRows.length > 20 && (
                <Text type="secondary">
                  Only the first 20 errors are shown.
                </Text>
              )}
            </div>
          ),
        });
        return;
      }

      const map = new Map<
        string,
        InboundReceipt
      >();

      receipts.forEach((receipt) => {
        map.set(
          normalizeText(receipt.receiptNo),
          receipt,
        );
      });

      let inserted = 0;
      let updated = 0;

      imported.forEach((receipt) => {
        const review =
          analyzeInboundReceipt(receipt);

        const reviewedReceipt: InboundReceipt = {
          ...receipt,
          aiStatus: review.status,
          aiScore: review.score,
          aiIssues: review.issues,
          aiWarnings: review.warnings,
          aiRecommendations:
            review.recommendations,
          aiReviewedAt: review.reviewedAt,
        };

        const key = normalizeText(
          receipt.receiptNo,
        );

        const existing = map.get(key);

        if (existing) {
          map.set(key, {
            ...existing,
            ...reviewedReceipt,
            id: existing.id,
            movementPosted:
              existing.movementPosted,
            createdAt: existing.createdAt,
            updatedAt: now,
            receivedAt: existing.receivedAt,
          });
          updated += 1;
        } else {
          map.set(key, reviewedReceipt);
          inserted += 1;
        }
      });

      const next = Array.from(map.values()).sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
      );

      saveReceipts(next);

      messageApi.success(
        `Import completed. Inserted: ${inserted}, Updated: ${updated}`,
      );
    } catch (error: any) {
      console.error(error);

      messageApi.error(
        error?.message || 'Failed to import CSV',
      );
    } finally {
      event.target.value = '';
    }
  }

  function handleLoadDemo() {
    if (receipts.length > 0) {
      messageApi.warning(
        'Demo inbound receipt can only be loaded when list is empty',
      );
      return;
    }

    saveReceipts(createDemoInboundReceipt());
    messageApi.success(
      'Demo inbound receipt loaded',
    );
  }

  function resetFilters() {
    setSearchText('');
    setStatusFilter('All');
    setPlantFilter('All');
  }

  const columns: ColumnsType<InboundReceipt> = [
    {
      title: 'Receipt No',
      dataIndex: 'receiptNo',
      key: 'receiptNo',
      width: 180,
      fixed: 'left',
      render: (value, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text
            type="secondary"
            style={{ fontSize: 12 }}
          >
            {record.poNo || '-'}
          </Text>
        </Space>
      ),
      sorter: (a, b) =>
        a.receiptNo.localeCompare(b.receiptNo),
    },
    {
      title: 'Supplier',
      dataIndex: 'supplierName',
      key: 'supplierName',
      width: 180,
      render: (value) => value || '-',
    },
    {
      title: 'Receipt Date',
      dataIndex: 'receiptDate',
      key: 'receiptDate',
      width: 130,
      sorter: (a, b) =>
        String(a.receiptDate).localeCompare(
          String(b.receiptDate),
        ),
    },
    {
      title: 'Items',
      key: 'items',
      width: 80,
      align: 'right',
      render: (_, record) => record.items.length,
    },
    {
      title: 'Total Qty',
      key: 'totalQty',
      width: 120,
      align: 'right',
      render: (_, record) =>
        record.items
          .reduce(
            (sum, item) =>
              sum + Number(item.qty || 0),
            0,
          )
          .toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: InboundStatus) => (
        <Tag color={statusColor(status)}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'AI Readiness',
      key: 'aiStatus',
      width: 135,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Tag
            color={aiStatusColor(record.aiStatus)}
            icon={<RobotOutlined />}
          >
            {record.aiStatus || 'Not Checked'}
          </Tag>

          {record.aiScore !== undefined && (
            <Text
              type="secondary"
              style={{ fontSize: 12 }}
            >
              Score: {record.aiScore}/100
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Movement',
      dataIndex: 'movementPosted',
      key: 'movementPosted',
      width: 120,
      render: (posted: boolean) =>
        posted ? (
          <Tag color="green">Posted</Tag>
        ) : (
          <Tag color="orange">Not Posted</Tag>
        ),
    },
    {
      title: 'Updated At',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value) =>
        value
          ? new Date(value).toLocaleString()
          : '-',
      sorter: (a, b) =>
        a.updatedAt.localeCompare(b.updatedAt),
    },
    {
      title: 'Action',
      key: 'action',
      width: 315,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openViewModal(record)}
            />
          </Tooltip>

          <Tooltip title="AI Inbound Review">
            <Button
              size="small"
              icon={<RobotOutlined />}
              onClick={() => runAIReview(record)}
            />
          </Tooltip>

          <Tooltip title="Edit">
            <Button
              size="small"
              type="primary"
              icon={<EditOutlined />}
              disabled={
                record.status === 'Received'
              }
              onClick={() => openEditModal(record)}
            />
          </Tooltip>

          <Tooltip title="Confirm">
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              disabled={record.status !== 'Draft'}
              onClick={() => handleConfirm(record)}
            />
          </Tooltip>
                      <Tooltip title="Print QR Label">
  <Button
    size="small"
    icon={<PrinterOutlined />}
    disabled={record.status !== 'Confirmed' && record.status !== 'Received'}
    onClick={() => handlePrintQRLabel(record)}
  />
</Tooltip>

          <Tooltip title="Receive / Post Inventory">
            <Button
              size="small"
              type="primary"
              ghost
              icon={<InboxOutlined />}
              disabled={
                record.status === 'Cancelled' ||
                record.status === 'Received'
              }
              onClick={() => handleReceive(record)}
            />
          </Tooltip>

          <Tooltip title="Repair Movement Logs">
            <Button
              size="small"
              icon={<SyncOutlined />}
              disabled={
                record.status !== 'Received'
              }
              onClick={() =>
                handleRepairMovement(record)
              }
            />
          </Tooltip>

          <Tooltip title="Cancel">
            <Button
              size="small"
              icon={<CloseCircleOutlined />}
              disabled={
                record.status === 'Received' ||
                record.status === 'Cancelled'
              }
              onClick={() => handleCancel(record)}
            />
          </Tooltip>

          <Popconfirm
            title="Delete inbound receipt?"
            description="This action cannot be undone."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record)}
          >
            <Tooltip title="Delete">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={
                  record.status === 'Received'
                }
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}

      <Space
        orientation="vertical"
        size="large"
        style={{ width: '100%' }}
      >
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            📥 Inbound Receiving
          </Title>

          <Text type="secondary">
            AI-assisted supplier receiving, stock
            validation, capacity checking and inventory
            posting.
          </Text>
        </div>

        <Alert
          type="info"
          showIcon
          icon={<RobotOutlined />}
          title="AI Inbound & Putaway Assistant"
          description="AI reviews Product Master rules, PO linkage, batch and expiry data, duplicate lines, stock thresholds, empty locations, full locations and projected capacity before receiving."
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Receipts"
                value={summary.totalReceipts}
                prefix={<InboxOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Received"
                value={summary.receivedReceipts}
                styles={{ content: { color: '#389e0d' } }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Inbound Qty"
                value={summary.totalQty}
                styles={{ content: { color: '#1677ff' } }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Received Not Posted"
                value={summary.unpostedReceived}
                styles={{
                  content: {
                    color: summary.unpostedReceived
                      ? '#fa8c16'
                      : '#389e0d',
                  },
                }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Card
          title={
            <Space>
              <RobotOutlined />
              AI Warehouse Risk Dashboard
            </Space>
          }
        >
          <Row gutter={[16, 16]}>
            <Col xs={12} md={4}>
              <Statistic
                title="AI Blocked"
                value={summary.aiBlocked}
                styles={{ content: { color: '#cf1322' } }}
              />
            </Col>

            <Col xs={12} md={4}>
              <Statistic
                title="Needs Review"
                value={summary.aiReview}
                styles={{ content: { color: '#fa8c16' } }}
              />
            </Col>

            <Col xs={12} md={4}>
              <Statistic
                title="Low Stock"
                value={warehouseRisk.lowStockProducts}
                styles={{ content: { color: '#fa8c16' } }}
              />
            </Col>

            <Col xs={12} md={4}>
              <Statistic
                title="High Stock"
                value={warehouseRisk.highStockProducts}
                styles={{ content: { color: '#cf1322' } }}
              />
            </Col>

            <Col xs={12} md={4}>
              <Statistic
                title="Empty Locations"
                value={warehouseRisk.emptyLocations}
                styles={{ content: { color: '#1677ff' } }}
              />
            </Col>

            <Col xs={12} md={4}>
              <Statistic
                title="Full / Near Full"
                value={
                  warehouseRisk.fullLocations +
                  warehouseRisk.nearFullLocations
                }
                styles={{
                  content: {
                    color:
                      warehouseRisk.fullLocations > 0
                        ? '#cf1322'
                        : '#fa8c16',
                  },
                }}
              />
            </Col>
          </Row>

          {warehouseRisk.capacityTrackedLocations ===
            0 && (
            <Alert
              style={{ marginTop: 16 }}
              type="warning"
              showIcon
              title="Location capacity is not configured"
              description="Add Capacity or Max Capacity to Location Master records to enable accurate full-location and over-capacity checks."
            />
          )}
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">Draft: </Text>
              <Text strong>
                {summary.draftReceipts}
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">
                Confirmed:{' '}
              </Text>
              <Text
                strong
                style={{ color: '#1677ff' }}
              >
                {summary.confirmedReceipts}
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">
                Received:{' '}
              </Text>
              <Text
                strong
                style={{ color: '#389e0d' }}
              >
                {summary.receivedReceipts}
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">
                Cancelled:{' '}
              </Text>
              <Text
                strong
                style={{ color: '#cf1322' }}
              >
                {summary.cancelledReceipts}
              </Text>
            </Card>
          </Col>
        </Row>

        <Card>
          <Space
            orientation="vertical"
            size="middle"
            style={{ width: '100%' }}
          >
            <Row
              gutter={[12, 12]}
              justify="space-between"
            >
              <Col xs={24} lg={14}>
                <Space wrap>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openCreateModal}
                  >
                    New Inbound
                  </Button>

                  <Button
                    icon={<ImportOutlined />}
                    onClick={handleImportClick}
                  >
                    Import CSV
                  </Button>

                  <Button
                    icon={<ExportOutlined />}
                    onClick={handleExport}
                  >
                    Export CSV
                  </Button>

                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadTemplate}
                  >
                    Template
                  </Button>

                  <Button
                    icon={<ReloadOutlined />}
                    onClick={loadMasterOptions}
                  >
                    Reload Masters
                  </Button>

                  {receipts.length === 0 && (
                    <Button
                      icon={<InboxOutlined />}
                      onClick={handleLoadDemo}
                    >
                      Load Demo
                    </Button>
                  )}
                </Space>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={handleImportFile}
                />
              </Col>

              <Col xs={24} lg={10}>
                <Space
                  wrap
                  style={{
                    width: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="Search receipt, supplier, PO, SKU, batch..."
                    value={searchText}
                    onChange={(event) =>
                      setSearchText(event.target.value)
                    }
                    style={{ width: 320 }}
                  />

                  <Button
                    icon={<ReloadOutlined />}
                    onClick={loadReceipts}
                  >
                    Reload
                  </Button>
                </Space>
              </Col>
            </Row>

            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: '100%' }}
                  options={[
                    {
                      value: 'All',
                      label: 'All Status',
                    },
                    ...STATUS_OPTIONS.map((status) => ({
                      value: status,
                      label: status,
                    })),
                  ]}
                />
              </Col>

              <Col xs={24} md={12}>
                <Select
                  showSearch
                  value={plantFilter}
                  onChange={setPlantFilter}
                  style={{ width: '100%' }}
                  optionFilterProp="label"
                  options={[
                    {
                      value: 'All',
                      label: 'All Plants',
                    },
                    ...allPlantOptions,
                  ]}
                />
              </Col>
            </Row>

            <Space>
              <Text type="secondary">
                Showing{' '}
                {filteredReceipts.length.toLocaleString()}{' '}
                of {receipts.length.toLocaleString()}{' '}
                receipts
              </Text>

              {(searchText ||
                statusFilter !== 'All' ||
                plantFilter !== 'All') && (
                <Button
                  type="link"
                  onClick={resetFilters}
                >
                  Clear filters
                </Button>
              )}
            </Space>

            <Table
              rowKey="id"
              columns={columns}
              dataSource={filteredReceipts}
              scroll={{ x: 1750 }}
              expandable={{
                expandedRowRender: (record) => (
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={record.items}
                    columns={[
                      {
                        title: 'SKU',
                        dataIndex: 'productCode',
                      },
                      {
                        title: 'Product Name',
                        dataIndex: 'productName',
                        render: (value) =>
                          value || '-',
                      },
                      {
                        title: 'Batch No',
                        dataIndex: 'batchNo',
                        render: (value) =>
                          value || '-',
                      },
                      {
                        title: 'Plant',
                        dataIndex: 'plant',
                      },
                      {
                        title: 'Location',
                        dataIndex: 'location',
                        render: (value) =>
                          value || (
                            <Tag color="orange">
                              Blank
                            </Tag>
                          ),
                      },
                      {
                        title: 'Expiry Date',
                        dataIndex: 'expiryDate',
                        render: (value) =>
                          value || '-',
                      },
                      {
                        title: 'UOM',
                        dataIndex: 'uom',
                      },
                      {
                        title: 'Qty',
                        dataIndex: 'qty',
                        align: 'right' as const,
                        render: (value) =>
                          Number(
                            value || 0,
                          ).toLocaleString(),
                      },
                    ]}
                  />
                ),
              }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) =>
                  `${total} receipts`,
              }}
              locale={{
                emptyText: (
                  <Empty
                    description="No inbound receipts found"
                    image={
                      Empty.PRESENTED_IMAGE_SIMPLE
                    }
                  />
                ),
              }}
            />
          </Space>
        </Card>
      </Space>

      <Modal
        open={modalOpen}
        destroyOnHidden
        width={1100}
        title={
          <Space>
            <InboxOutlined />
            {modalMode === 'create'
              ? 'New Inbound Receipt'
              : modalMode === 'edit'
                ? 'Edit Inbound Receipt'
                : 'View Inbound Receipt'}
          </Space>
        }
        footer={[
          <Button
            key="ai"
            icon={<RobotOutlined />}
            onClick={handleFormAIReview}
          >
            AI Inbound Check
          </Button>,
          !isViewMode && (
            <Button
              key="cancel"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
          ),
          <Button
            key="ok"
            type="primary"
            onClick={handleSave}
          >
            {isViewMode ? 'Close' : 'Save'}
          </Button>,
        ].filter(Boolean)}
        onCancel={() => setModalOpen(false)}
      >
        <Form
          form={form}
          layout="vertical"
          disabled={isViewMode}
          initialValues={{
            receiptNo: generateReceiptNo(),
            receiptDate: todayDate(),
            status: 'Draft',
            items: [],
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Receipt No"
                name="receiptNo"
                rules={[
                  {
                    required: true,
                    message:
                      'Receipt No is required',
                  },
                ]}
              >
                <Input placeholder="GRN-..." />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Supplier Name"
                name="supplierName"
              >
                <Input placeholder="Supplier name" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="PO No"
                name="poNo"
              >
                <Input placeholder="Purchase order no" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Receipt Date"
                name="receiptDate"
                rules={[
                  {
                    required: true,
                    message:
                      'Receipt Date is required',
                  },
                ]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Status"
                name="status"
                rules={[
                  {
                    required: true,
                    message: 'Status is required',
                  },
                ]}
              >
                <Select
                  disabled={
                    editingReceipt?.status ===
                    'Received'
                  }
                  options={STATUS_OPTIONS.map(
                    (status) => ({
                      value: status,
                      label: status,
                    }),
                  )}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Remarks"
                name="remarks"
              >
                <Input placeholder="Optional remarks" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">
            Inbound Items
          </Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <Space
                orientation="vertical"
                size="middle"
                style={{ width: '100%' }}
              >
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`Item ${index + 1}`}
                    extra={
                      !isViewMode &&
                      fields.length > 1 ? (
                        <Button
                          danger
                          size="small"
                          onClick={() =>
                            remove(field.name)
                          }
                        >
                          Remove
                        </Button>
                      ) : null
                    }
                  >
                    <Row gutter={12}>
                      <Form.Item
                        hidden
                        name={[field.name, 'id']}
                      >
                        <Input />
                      </Form.Item>

                      <Form.Item
                        hidden
                        name={[field.name, 'sku']}
                      >
                        <Input />
                      </Form.Item>

                      <Col xs={24} md={8}>
                        <Form.Item
                          label="Product Code / SKU"
                          name={[
                            field.name,
                            'productCode',
                          ]}
                          rules={[
                            {
                              required: true,
                              message:
                                'SKU is required',
                            },
                          ]}
                        >
                          <AutoComplete
                            allowClear
                            virtual={false}
                            options={
                              allProductOptions
                            }
                            placeholder="Enter or select active SKU"
                            onSelect={(value) =>
                              handleProductSelect(
                                value,
                                index,
                              )
                            }
                            onBlur={() => {
                              const value =
                                form.getFieldValue([
                                  'items',
                                  field.name,
                                  'productCode',
                                ]);

                              if (value) {
                                handleProductSelect(
                                  value,
                                  index,
                                );
                              }
                            }}
                            filterOption={(
                              inputValue,
                              option,
                            ) =>
                              normalizeText(
                                option?.label,
                              ).includes(
                                normalizeText(
                                  inputValue,
                                ),
                              ) ||
                              normalizeText(
                                option?.value,
                              ).includes(
                                normalizeText(
                                  inputValue,
                                ),
                              )
                            }
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          label="Product Name"
                          name={[
                            field.name,
                            'productName',
                          ]}
                        >
                          <Input placeholder="Product description" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          label="Batch No"
                          name={[
                            field.name,
                            'batchNo',
                          ]}
                        >
                          <Input placeholder="Batch no" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item
                          label="Plant"
                          name={[
                            field.name,
                            'plant',
                          ]}
                          rules={[
                            {
                              required: true,
                              message:
                                'Plant is required',
                            },
                          ]}
                        >
                          <AutoComplete
                            allowClear
                            virtual={false}
                            options={allPlantOptions}
                            placeholder="Plant"
                            filterOption={(
                              inputValue,
                              option,
                            ) =>
                              normalizeText(
                                option?.label,
                              ).includes(
                                normalizeText(
                                  inputValue,
                                ),
                              ) ||
                              normalizeText(
                                option?.value,
                              ).includes(
                                normalizeText(
                                  inputValue,
                                ),
                              )
                            }
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item
                          label="Location"
                          name={[
                            field.name,
                            'location',
                          ]}
                        >
                          <AutoComplete
                            allowClear
                            virtual={false}
                            options={
                              allLocationOptions
                            }
                            placeholder="Location"
                            filterOption={(
                              inputValue,
                              option,
                            ) =>
                              normalizeText(
                                option?.label,
                              ).includes(
                                normalizeText(
                                  inputValue,
                                ),
                              ) ||
                              normalizeText(
                                option?.value,
                              ).includes(
                                normalizeText(
                                  inputValue,
                                ),
                              )
                            }
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item
                          label="Expiry Date"
                          name={[
                            field.name,
                            'expiryDate',
                          ]}
                        >
                          <Input type="date" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={3}>
                        <Form.Item
                          label="UOM"
                          name={[
                            field.name,
                            'uom',
                          ]}
                          rules={[
                            {
                              required: true,
                              message:
                                'UOM is required',
                            },
                          ]}
                        >
                          <AutoComplete
                            allowClear
                            virtual={false}
                            options={allUomOptions}
                            placeholder="UOM"
                            filterOption={(
                              inputValue,
                              option,
                            ) =>
                              normalizeText(
                                option?.label,
                              ).includes(
                                normalizeText(
                                  inputValue,
                                ),
                              ) ||
                              normalizeText(
                                option?.value,
                              ).includes(
                                normalizeText(
                                  inputValue,
                                ),
                              )
                            }
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={3}>
                        <Form.Item
                          label="Qty"
                          name={[
                            field.name,
                            'qty',
                          ]}
                          rules={[
                            {
                              required: true,
                              message:
                                'Qty is required',
                            },
                          ]}
                        >
                          <InputNumber
                            min={0.001}
                            precision={3}
                            style={{
                              width: '100%',
                            }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Form.Item
                          label="Item Remarks"
                          name={[
                            field.name,
                            'remarks',
                          ]}
                        >
                          <Input placeholder="Optional item remarks" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}

                {!isViewMode && (
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add({
                        id: uid('INB-ITEM'),
                        productCode: '',
                        sku: '',
                        productName: '',
                        batchNo: '',
                        plant: '',
                        location: '',
                        expiryDate: '',
                        uom: 'PCS',
                        qty: 1,
                        remarks: '',
                      })
                    }
                  >
                    Add Item
                  </Button>
                )}
              </Space>
            )}
          </Form.List>
        </Form>

        {editingReceipt && (
          <>
            <Divider />

            <Descriptions
              bordered
              size="small"
              column={2}
            >
              <Descriptions.Item label="Record ID">
                {editingReceipt.id}
              </Descriptions.Item>

              <Descriptions.Item label="Movement Posted">
                {editingReceipt.movementPosted
                  ? 'Yes'
                  : 'No'}
              </Descriptions.Item>

              <Descriptions.Item label="AI Status">
                <Tag
                  color={aiStatusColor(
                    editingReceipt.aiStatus,
                  )}
                >
                  {editingReceipt.aiStatus ||
                    'Not Checked'}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="AI Score">
                {editingReceipt.aiScore !== undefined
                  ? `${editingReceipt.aiScore}/100`
                  : '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Created At">
                {editingReceipt.createdAt
                  ? new Date(
                      editingReceipt.createdAt,
                    ).toLocaleString()
                  : '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Updated At">
                {editingReceipt.updatedAt
                  ? new Date(
                      editingReceipt.updatedAt,
                    ).toLocaleString()
                  : '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Received At">
                {editingReceipt.receivedAt
                  ? new Date(
                      editingReceipt.receivedAt,
                    ).toLocaleString()
                  : '-'}
              </Descriptions.Item>

              <Descriptions.Item label="AI Reviewed At">
                {editingReceipt.aiReviewedAt
                  ? new Date(
                      editingReceipt.aiReviewedAt,
                    ).toLocaleString()
                  : '-'}
              </Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>

      <Modal
        open={aiModalOpen}
        destroyOnHidden
        width={950}
        title={
          <Space>
            <RobotOutlined />
            AI Inbound & Putaway Assistant
          </Space>
        }
        onCancel={() => setAiModalOpen(false)}
        footer={[
          <Button
            key="close"
            onClick={() => setAiModalOpen(false)}
          >
            Close
          </Button>,
        ]}
      >
        {aiReview ? (
          <Space
            orientation="vertical"
            size="large"
            style={{ width: '100%' }}
          >
            <Card>
              <Row
                gutter={[16, 16]}
                align="middle"
              >
                <Col xs={24} md={8}>
                  <Statistic
                    title="AI Readiness"
                    value={aiReview.status}
                    prefix={<RobotOutlined />}
                    styles={{
                      content: {
                        fontSize: 20,
                        color:
                          aiReview.status === 'Blocked'
                            ? '#cf1322'
                            : aiReview.status ===
                                'Ready'
                              ? '#389e0d'
                              : '#fa8c16',
                      },
                    }}
                  />
                </Col>

                <Col xs={24} md={16}>
                  <Text strong>
                    Inbound Readiness Score
                  </Text>

                  <Progress
                    percent={aiReview.score}
                    status={
                      aiReview.status === 'Blocked'
                        ? 'exception'
                        : aiReview.status ===
                            'Ready'
                          ? 'success'
                          : 'active'
                    }
                  />
                </Col>
              </Row>
            </Card>

            {aiReceipt && (
              <Descriptions
                bordered
                size="small"
                column={2}
              >
                <Descriptions.Item label="Receipt No">
                  {aiReceipt.receiptNo || '-'}
                </Descriptions.Item>

                <Descriptions.Item label="Status">
                  <Tag
                    color={statusColor(
                      aiReceipt.status,
                    )}
                  >
                    {aiReceipt.status}
                  </Tag>
                </Descriptions.Item>

                <Descriptions.Item label="Supplier">
                  {aiReceipt.supplierName || '-'}
                </Descriptions.Item>

                <Descriptions.Item label="PO No">
                  {aiReceipt.poNo || '-'}
                </Descriptions.Item>

                <Descriptions.Item label="Lines">
                  {aiReceipt.items.length}
                </Descriptions.Item>

                <Descriptions.Item label="Total Qty">
                  {aiReceipt.items
                    .reduce(
                      (sum, item) =>
                        sum +
                        Number(item.qty || 0),
                      0,
                    )
                    .toLocaleString()}
                </Descriptions.Item>
              </Descriptions>
            )}

            {aiReview.issues.length > 0 && (
              <Alert
                type="error"
                showIcon
                icon={
                  <ExclamationCircleOutlined />
                }
                title="Blocking Issues"
                description={
                  <ul
                    style={{
                      marginBottom: 0,
                      paddingLeft: 20,
                    }}
                  >
                    {aiReview.issues.map(
                      (issue, index) => (
                        <li
                          key={`${issue}-${index}`}
                        >
                          {issue}
                        </li>
                      ),
                    )}
                  </ul>
                }
              />
            )}

            {aiReview.warnings.length > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                title="Operational Warnings"
                description={
                  <ul
                    style={{
                      marginBottom: 0,
                      paddingLeft: 20,
                    }}
                  >
                    {aiReview.warnings.map(
                      (warning, index) => (
                        <li
                          key={`${warning}-${index}`}
                        >
                          {warning}
                        </li>
                      ),
                    )}
                  </ul>
                }
              />
            )}

            {aiReview.positives.length > 0 && (
              <Alert
                type="success"
                showIcon
                icon={
                  <SafetyCertificateOutlined />
                }
                title="Positive Checks"
                description={
                  <ul
                    style={{
                      marginBottom: 0,
                      paddingLeft: 20,
                    }}
                  >
                    {aiReview.positives.map(
                      (positive, index) => (
                        <li
                          key={`${positive}-${index}`}
                        >
                          {positive}
                        </li>
                      ),
                    )}
                  </ul>
                }
              />
            )}

            {aiReview.locationProjections.length >
              0 && (
              <>
                <Divider direction="left">
                  Location Capacity Projection
                </Divider>

                <Table
                  rowKey="key"
                  size="small"
                  pagination={false}
                  scroll={{ x: 800 }}
                  dataSource={
                    aiReview.locationProjections
                  }
                  columns={[
                    {
                      title: 'Plant',
                      dataIndex: 'plant',
                    },
                    {
                      title: 'Location',
                      dataIndex: 'location',
                    },
                    {
                      title: 'Current',
                      dataIndex: 'currentQty',
                      align: 'right',
                      render: (value) =>
                        Number(
                          value || 0,
                        ).toLocaleString(),
                    },
                    {
                      title: 'Inbound',
                      dataIndex: 'incomingQty',
                      align: 'right',
                      render: (value) =>
                        Number(
                          value || 0,
                        ).toLocaleString(),
                    },
                    {
                      title: 'Projected',
                      dataIndex: 'projectedQty',
                      align: 'right',
                      render: (value) =>
                        Number(
                          value || 0,
                        ).toLocaleString(),
                    },
                    {
                      title: 'Capacity',
                      dataIndex: 'capacity',
                      align: 'right',
                      render: (value) =>
                        Number(value || 0) > 0
                          ? Number(
                              value,
                            ).toLocaleString()
                          : 'Not maintained',
                    },
                    {
                      title: 'Utilization',
                      dataIndex: 'utilization',
                      width: 150,
                      render: (value) =>
                        value === null ? (
                          <Text type="secondary">
                            Unknown
                          </Text>
                        ) : (
                          <Progress
                            size="small"
                            percent={Math.min(
                              100,
                              Number(
                                value.toFixed(1),
                              ),
                            )}
                            status={
                              value > 100
                                ? 'exception'
                                : value >= 85
                                  ? 'active'
                                  : 'normal'
                            }
                          />
                        ),
                    },
                    {
                      title: 'Result',
                      dataIndex: 'status',
                      render: (value) => (
                        <Tag
                          color={
                            value ===
                              'Over Capacity' ||
                            value === 'Full'
                              ? 'red'
                              : value ===
                                  'Near Full'
                                ? 'orange'
                                : value === 'Empty'
                                  ? 'blue'
                                  : 'green'
                          }
                        >
                          {value}
                        </Tag>
                      ),
                    },
                  ]}
                />
              </>
            )}

            {aiReview.emptyLocations.length > 0 && (
              <Alert
                type="info"
                showIcon
                icon={<InboxOutlined />}
                title="Empty Location Availability"
                description={
                  <Space wrap>
                    {aiReview.emptyLocations.map(
                      (location) => (
                        <Tag
                          color="blue"
                          key={location}
                        >
                          {location}
                        </Tag>
                      ),
                    )}
                  </Space>
                }
              />
            )}

            <Alert
              type="info"
              showIcon
              icon={<BulbOutlined />}
              title="AI Recommendations"
              description={
                <ul
                  style={{
                    marginBottom: 0,
                    paddingLeft: 20,
                  }}
                >
                  {aiReview.recommendations.map(
                    (recommendation, index) => (
                      <li
                        key={`${recommendation}-${index}`}
                      >
                        {recommendation}
                      </li>
                    ),
                  )}
                </ul>
              }
            />

            <Paragraph
              type="secondary"
              style={{ marginBottom: 0 }}
            >
              Capacity checks depend on the Capacity or
              Max Capacity value maintained in Location
              Master. Stock threshold checks depend on
              Product Master Min Stock Level and Max
              Stock Level.
            </Paragraph>
          </Space>
        ) : (
          <Empty description="No AI review result" />
        )}
      </Modal>

      <Modal
        open={printOpen}
        onCancel={() => setPrintOpen(false)}
        title={
          <Space>
            <PrinterOutlined />
            QR Label Printing
          </Space>
        }
        width={900}
        footer={[
          <Button
            key="close"
            onClick={() => setPrintOpen(false)}
          >
            Close
          </Button>,
          <Button
  key="print"
  type="primary"
  icon={<PrinterOutlined />}
  disabled={
    !qrPrintReceipt ||
    (qrPrintReceipt.status !== 'Confirmed' &&
      qrPrintReceipt.status !== 'Received')
  }
  onClick={() => {
    if (qrPrintReceipt) {
      printQRLabels(qrPrintReceipt);
    }
  }}
>
  Print QR Labels
</Button>,
        ]}
      >
        {qrPrintReceipt ? (
          <Space
            aria-orientation="vertical"
            size="middle"
            style={{ width: '100%' }}
          >
            <Alert
              type="success"
              showIcon
              title="QR labels are available"
              description="Each label contains Product SKU, Batch No and Expiry Date. The QR code is generated from these three values."
            />

            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={qrPrintReceipt.items}
              columns={[
                {
                  title: 'SKU',
                  key: 'sku',
                  render: (_, item) => item.sku || item.productCode,
                },
                {
                  title: 'Batch No',
                  dataIndex: 'batchNo',
                  key: 'batchNo',
                },
                {
                  title: 'Expiry Date',
                  dataIndex: 'expiryDate',
                  key: 'expiryDate',
                },
                {
                  title: 'Qty',
                  key: 'qty',
                  align: 'right',
                  render: (_, item) => `${item.qty} ${item.uom}`,
                },
                {
                  title: 'Plant / Location',
                  key: 'location',
                  render: (_, item) => `${item.plant || '-'} / ${item.location || '-'}`,
                },
              ]}
            />
          </Space>
        ) : (
          <Empty description="No QR label data selected" />
        )}
      </Modal>
    </div>
  );
}