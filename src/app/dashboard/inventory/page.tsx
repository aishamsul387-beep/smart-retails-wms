'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Switch,
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
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  ExportOutlined,
  EyeOutlined,
  ImportOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const INVENTORY_STORAGE_KEY = 'wms_inventory';
const INVENTORY_COMPAT_STORAGE_KEY = 'wms_inventory_management';
const PRODUCT_MASTER_KEYS = ['wms_product_master', 'wms_products', 'master_products_v1'];

type InventoryStatus =
  | 'Available'
  | 'Hold'
  | 'Damaged'
  | 'Expired'
  | 'In Transit'
  | 'Blocked'
  | 'Quarantine'
  | 'Reserved';

type ModalMode = 'create' | 'edit' | 'view';
type AiSeverity = 'success' | 'info' | 'warning' | 'error';

interface InventoryItem {
  id: string;
  productCode: string;
  sku: string;
  productName: string;
  category?: string;
  storageType?: string;
  batchControlled?: boolean;
  expiryControlled?: boolean;
  batchNo: string;
  plant: string;
  location: string;
  expiryDate: string;
  uom: string;
  batchQty: number;
  availableQty: number;
  status: InventoryStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  raw?: any;
}

interface InventoryFormValues {
  productCode: string;
  productName: string;
  category?: string;
  storageType?: string;
  batchControlled?: boolean;
  expiryControlled?: boolean;
  batchNo: string;
  plant: string;
  location: string;
  expiryDate: string;
  uom: string;
  batchQty: number;
  availableQty: number;
  status: InventoryStatus;
  remarks?: string;
}

interface MasterOption {
  value: string;
  label: string;
  raw?: any;
}

interface ProductMasterItem {
  id?: string;
  productCode: string;
  sku: string;
  productName: string;
  uom: string;
  category?: string;
  storageType?: string;
  batchControlled?: boolean;
  expiryControlled?: boolean;
  status?: string;
  active?: boolean;
  raw?: any;
}

interface AiFinding {
  severity: AiSeverity;
  title: string;
  detail: string;
  recommendation: string;
}

interface AiInventoryReview {
  score: number;
  status: 'Healthy' | 'Monitor' | 'Warning' | 'Critical';
  color: string;
  findings: AiFinding[];
}

const STATUS_OPTIONS: InventoryStatus[] = [
  'Available',
  'Hold',
  'Damaged',
  'Expired',
  'In Transit',
  'Blocked',
  'Quarantine',
  'Reserved',
];

const CSV_HEADERS = [
  'Product Code',
  'Product Name',
  'Category',
  'Storage Type',
  'Batch Controlled',
  'Expiry Controlled',
  'Batch No',
  'Plant',
  'Location',
  'Expiry Date',
  'UOM',
  'Batch Qty',
  'Available Qty',
  'Status',
  'Remarks',
];

/* ============================================================================
 * Generic helpers
 * ========================================================================== */

function uid(prefix = 'INV') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function normalizeText(value: any) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeUpper(value: any) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeKey(value: any) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeCode(value: any) {
  return String(value ?? '').trim().toUpperCase();
}

function asNumber(value: any, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function asBoolean(value: any, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const text = String(value).trim().toLowerCase();

  if (['true', 'yes', 'y', '1', 'controlled', 'required', 'active'].includes(text)) return true;
  if (['false', 'no', 'n', '0', 'not controlled', 'optional', 'inactive'].includes(text)) return false;

  return fallback;
}

function safeJsonParse<T = any>(text: string | null, fallback: T): T {
  if (!text) return fallback;

  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function findArrayDeep<T = any>(value: any, depth = 0): T[] {
  if (!value || depth > 6) return [];

  if (Array.isArray(value)) return value as T[];

  if (typeof value === 'object') {
    const preferredKeys = [
      'data',
      'items',
      'rows',
      'records',
      'list',
      'inventory',
      'inventories',
      'inventoryData',
      'inventoryItems',
      'stock',
      'stocks',
      'stockBalance',
      'stockBalances',
      'products',
      'productMaster',
    ];

    for (const key of preferredKeys) {
      const found = findArrayDeep<T>(value[key], depth + 1);
      if (found.length) return found;
    }

    for (const key of Object.keys(value)) {
      const found = findArrayDeep<T>(value[key], depth + 1);
      if (found.length) return found;
    }
  }

  return [];
}

function readStorageArray<T = any>(key: string): T[] {
  if (typeof window === 'undefined') return [];

  const parsed = safeJsonParse<any>(localStorage.getItem(key), []);
  return findArrayDeep<T>(parsed);
}

function readAny(obj: any, keys: string[], fallback: any = '') {
  if (!obj || typeof obj !== 'object') return fallback;

  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      return obj[key];
    }
  }

  const normalizedMap = new Map<string, any>();

  Object.keys(obj).forEach((key) => {
    normalizedMap.set(normalizeKey(key), obj[key]);
  });

  for (const key of keys) {
    const value = normalizedMap.get(normalizeKey(key));

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return fallback;
}

function normalizeDateForInput(value: any) {
  const text = String(value ?? '').trim();

  if (!text) return '';

  const parsed = new Date(text);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return text;
}

function isExpired(expiryDate?: string) {
  if (!expiryDate) return false;

  const normalized = normalizeDateForInput(expiryDate);
  const exp = new Date(normalized);

  if (Number.isNaN(exp.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);

  return exp < today;
}

function daysUntilExpiry(expiryDate?: string) {
  if (!expiryDate) return null;

  const normalized = normalizeDateForInput(expiryDate);
  const exp = new Date(normalized);

  if (Number.isNaN(exp.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);

  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getEffectiveStatus(item: InventoryItem): InventoryStatus {
  if (item.status === 'Expired') return 'Expired';
  if (isExpired(item.expiryDate)) return 'Expired';
  return item.status || 'Available';
}

function statusColor(status: InventoryStatus) {
  switch (status) {
    case 'Available':
      return 'green';
    case 'Hold':
      return 'orange';
    case 'Damaged':
      return 'red';
    case 'Expired':
      return 'volcano';
    case 'In Transit':
      return 'blue';
    case 'Blocked':
      return 'red';
    case 'Quarantine':
      return 'gold';
    case 'Reserved':
      return 'purple';
    default:
      return 'default';
  }
}

function aiSeverityColor(severity: AiSeverity) {
  switch (severity) {
    case 'success':
      return 'green';
    case 'info':
      return 'blue';
    case 'warning':
      return 'orange';
    case 'error':
      return 'red';
    default:
      return 'default';
  }
}

function aiSeverityIcon(severity: AiSeverity) {
  switch (severity) {
    case 'success':
      return <CheckCircleOutlined />;
    case 'info':
      return <BulbOutlined />;
    case 'warning':
      return <WarningOutlined />;
    case 'error':
      return <ExclamationCircleOutlined />;
    default:
      return <BulbOutlined />;
  }
}

function inventoryIdentityKey(item: Partial<InventoryItem>) {
  return [
    normalizeText(item.productCode || item.sku),
    normalizeText(item.batchNo),
    normalizeText(item.plant),
    normalizeText(item.location),
    normalizeDateForInput(item.expiryDate),
    normalizeText(item.uom),
    normalizeText(item.status || 'Available'),
  ].join('|');
}

/* ============================================================================
 * Product Master helpers
 * ========================================================================== */

function normalizeProductMasterItem(raw: any): ProductMasterItem | null {
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

  if (!productCode) return null;

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
      'materialName',
      'Material Name',
      'name',
      'Name',
    ]),
  ).trim();

  const uom =
    String(readAny(raw, ['uom', 'UOM', 'baseUom', 'Base UOM', 'unit', 'Unit', 'unitOfMeasure'], 'PCS')).trim() ||
    'PCS';

  const category = String(
    readAny(raw, ['category', 'Category', 'productCategory', 'Product Category', 'group', 'Group'], ''),
  ).trim();

  const storageType = String(
    readAny(raw, ['storageType', 'Storage Type', 'storageCondition', 'Storage Condition'], ''),
  ).trim();

  const status = String(readAny(raw, ['status', 'Status', 'activeStatus', 'Active Status'], 'Active')).trim();

  const batchControlled = asBoolean(
    readAny(raw, ['batchControlled', 'Batch Controlled', 'isBatchControlled', 'Is Batch Controlled', 'batchControl']),
    false,
  );

  const expiryControlled = asBoolean(
    readAny(raw, [
      'expiryControlled',
      'Expiry Controlled',
      'isExpiryControlled',
      'Is Expiry Controlled',
      'expiryControl',
      'shelfLifeControlled',
    ]),
    false,
  );

  return {
    id: String(readAny(raw, ['id', 'ID'], '')).trim(),
    productCode,
    sku: productCode,
    productName,
    uom,
    category,
    storageType,
    batchControlled,
    expiryControlled,
    status,
    active: asBoolean(readAny(raw, ['active', 'Active'], true), true),
    raw,
  };
}

function isProductActive(product: ProductMasterItem) {
  if (product.active === false) return false;

  const status = normalizeText(product.status || 'Active');

  return !['inactive', 'disabled', 'blocked', 'deleted', 'discontinued'].includes(status);
}

/* ============================================================================
 * Inventory normalization / persistence
 * ========================================================================== */

function normalizeInventoryStatus(value: any): InventoryStatus {
  const raw = String(value ?? '').trim();
  const upper = normalizeUpper(raw);

  if (!upper) return 'Available';
  if (upper === 'AVAILABLE' || upper === 'UNRESTRICTED' || upper === 'GOOD') return 'Available';
  if (upper === 'HOLD' || upper === 'ON HOLD' || upper === 'QUALITY HOLD' || upper === 'QC HOLD') return 'Hold';
  if (upper === 'DAMAGED' || upper === 'DAMAGE') return 'Damaged';
  if (upper === 'EXPIRED' || upper === 'EXPIRY') return 'Expired';
  if (upper === 'IN TRANSIT' || upper === 'IN-TRANSIT' || upper === 'TRANSIT') return 'In Transit';
  if (upper === 'BLOCKED') return 'Blocked';
  if (upper === 'QUARANTINE' || upper === 'QA HOLD') return 'Quarantine';
  if (upper === 'RESERVED' || upper === 'ALLOCATED') return 'Reserved';

  return STATUS_OPTIONS.includes(raw as InventoryStatus) ? (raw as InventoryStatus) : 'Available';
}

function normalizeInventoryItem(raw: any): InventoryItem {
  const productCode = String(
    readAny(raw, [
      'productCode',
      'Product Code',
      'SKU',
      'sku',
      'skuCode',
      'SKU Code',
      'itemCode',
      'Item Code',
      'materialCode',
      'Material Code',
      'code',
      'Code',
    ]),
  ).trim();

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
      'materialName',
      'Material Name',
      'name',
      'Name',
    ]),
  ).trim();

  const category = String(readAny(raw, ['category', 'Category', 'productCategory', 'Product Category'], '')).trim();

  const storageType = String(
    readAny(raw, ['storageType', 'Storage Type', 'storageCondition', 'Storage Condition'], ''),
  ).trim();

  const batchControlled = asBoolean(
    readAny(raw, ['batchControlled', 'Batch Controlled', 'isBatchControlled', 'Is Batch Controlled']),
    false,
  );

  const expiryControlled = asBoolean(
    readAny(raw, ['expiryControlled', 'Expiry Controlled', 'isExpiryControlled', 'Is Expiry Controlled']),
    false,
  );

  const batchNo = String(
    readAny(raw, ['batchNo', 'Batch No', 'batchNumber', 'Batch Number', 'batch', 'lotNo', 'Lot No', 'lot']),
  ).trim();

  const plant = String(
    readAny(raw, [
      'plant',
      'Plant',
      'plantCode',
      'Plant Code',
      'warehouse',
      'Warehouse',
      'warehouseCode',
      'site',
      'siteCode',
    ]),
  ).trim();

  const location = String(
    readAny(raw, [
      'location',
      'Location',
      'stockLocation',
      'Stock Location',
      'storageLocation',
      'Storage Location',
      'storageLoc',
      'bin',
      'Bin',
      'binLocation',
      'rackLocation',
      'locator',
    ]),
  ).trim();

  const expiryDate = normalizeDateForInput(
    readAny(raw, [
      'expiryDate',
      'Expiry Date',
      'expiry',
      'Expiry',
      'expirationDate',
      'Expiration Date',
      'expiredDate',
      'expireDate',
      'expDate',
    ]),
  );

  const uom =
    String(readAny(raw, ['uom', 'UOM', 'unit', 'Unit', 'baseUom', 'unitOfMeasure', 'Unit Of Measure'], 'PCS')).trim() ||
    'PCS';

  const batchQty = asNumber(
    readAny(raw, [
      'batchQty',
      'Batch Qty',
      'onHandQty',
      'On Hand Qty',
      'onHand',
      'stockOnHand',
      'qty',
      'Qty',
      'quantity',
      'Quantity',
      'stockQty',
      'Stock Qty',
      'balanceQty',
      'Balance Qty',
      'balance',
      'stockBalance',
      'currentQty',
      'currentStock',
      'closingBalance',
      'endingBalance',
      'physicalQty',
      'systemQty',
    ]),
    0,
  );

  const availableRaw = readAny(raw, [
    'availableQty',
    'Available Qty',
    'available',
    'Available',
    'availableBalance',
    'Available Balance',
    'availableStock',
    'unrestrictedQty',
    'goodQty',
    'qtyAvailable',
    'Qty Available',
    'availableQuantity',
    'Available Quantity',
    'balanceQty',
    'Balance Qty',
  ]);

  const availableQty = availableRaw === '' ? batchQty : asNumber(availableRaw, batchQty);

  const status = normalizeInventoryStatus(readAny(raw, ['status', 'Status', 'stockStatus', 'inventoryStatus'], 'Available'));

  const now = new Date().toISOString();

  return {
    id: String(readAny(raw, ['id', 'ID', 'key', 'Key', 'inventoryId', 'stockId'], uid())).trim(),
    productCode,
    sku: productCode,
    productName,
    category,
    storageType,
    batchControlled,
    expiryControlled,
    batchNo,
    plant,
    location,
    expiryDate,
    uom,
    batchQty,
    availableQty,
    status,
    remarks: String(readAny(raw, ['remarks', 'Remarks', 'remark', 'Remark', 'notes', 'Notes'], '')).trim(),
    createdAt: String(readAny(raw, ['createdAt', 'Created At'], now)),
    updatedAt: String(readAny(raw, ['updatedAt', 'Updated At'], now)),
    raw,
  };
}

function toPersistedInventoryRecord(item: InventoryItem) {
  return {
    ...(item.raw && typeof item.raw === 'object' ? item.raw : {}),

    id: item.id,
    key: item.id,
    inventoryId: item.id,
    stockId: item.id,

    productCode: item.productCode,
    sku: item.productCode,
    SKU: item.productCode,
    'Product Code': item.productCode,

    productName: item.productName,
    'Product Name': item.productName,
    productDescription: item.productName,
    'Product Description': item.productName,
    description: item.productName,

    category: item.category || '',
    Category: item.category || '',
    productCategory: item.category || '',
    'Product Category': item.category || '',

    storageType: item.storageType || '',
    'Storage Type': item.storageType || '',
    storageCondition: item.storageType || '',
    'Storage Condition': item.storageType || '',

    batchControlled: !!item.batchControlled,
    'Batch Controlled': !!item.batchControlled,
    isBatchControlled: !!item.batchControlled,
    'Is Batch Controlled': !!item.batchControlled,

    expiryControlled: !!item.expiryControlled,
    'Expiry Controlled': !!item.expiryControlled,
    isExpiryControlled: !!item.expiryControlled,
    'Is Expiry Controlled': !!item.expiryControlled,

    batchNo: item.batchNo,
    batch: item.batchNo,
    'Batch No': item.batchNo,
    batchNumber: item.batchNo,
    'Batch Number': item.batchNo,
    lotNo: item.batchNo,

    plant: item.plant,
    Plant: item.plant,
    plantCode: item.plant,

    location: item.location,
    Location: item.location,
    stockLocation: item.location,
    storageLocation: item.location,
    'Storage Location': item.location,
    bin: item.location,

    expiryDate: item.expiryDate,
    'Expiry Date': item.expiryDate,
    expirationDate: item.expiryDate,
    expireDate: item.expiryDate,
    expDate: item.expiryDate,

    uom: item.uom,
    UOM: item.uom,
    unit: item.uom,
    baseUom: item.uom,
    unitOfMeasure: item.uom,

    batchQty: item.batchQty,
    'Batch Qty': item.batchQty,
    onHandQty: item.batchQty,
    onHand: item.batchQty,
    stockOnHand: item.batchQty,
    qty: item.batchQty,
    Qty: item.batchQty,
    quantity: item.batchQty,
    Quantity: item.batchQty,
    stockQty: item.batchQty,
    currentQty: item.batchQty,
    currentStock: item.batchQty,
    closingBalance: item.batchQty,
    endingBalance: item.batchQty,
    physicalQty: item.batchQty,
    systemQty: item.batchQty,

    availableQty: item.availableQty,
    'Available Qty': item.availableQty,
    available: item.availableQty,
    Available: item.availableQty,
    availableBalance: item.availableQty,
    'Available Balance': item.availableQty,
    availableStock: item.availableQty,
    unrestrictedQty: item.availableQty,
    goodQty: item.availableQty,
    balanceQty: item.batchQty,
    'Balance Qty': item.batchQty,
    balance: item.batchQty,
    stockBalance: item.batchQty,
    qtyAvailable: item.availableQty,
    'Qty Available': item.availableQty,
    availableQuantity: item.availableQty,
    'Available Quantity': item.availableQty,

    status: item.status,
    Status: item.status,
    stockStatus: item.status,
    inventoryStatus: item.status,

    remarks: item.remarks || '',
    Remarks: item.remarks || '',

    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/* ============================================================================
 * CSV helpers
 * ========================================================================== */

function csvEscape(value: any) {
  const text = String(value ?? '');

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
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

    if ((char === '\n' || char === '\r') && !inQuotes) {
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

function buildCsv(items: InventoryItem[]) {
  const lines = [
    CSV_HEADERS.join(','),
    ...items.map((item) =>
      [
        item.productCode,
        item.productName,
        item.category || '',
        item.storageType || '',
        item.batchControlled ? 'Yes' : 'No',
        item.expiryControlled ? 'Yes' : 'No',
        item.batchNo,
        item.plant,
        item.location,
        item.expiryDate,
        item.uom,
        item.batchQty,
        item.availableQty,
        item.status,
        item.remarks || '',
      ]
        .map(csvEscape)
        .join(','),
    ),
  ];

  return lines.join('\n');
}

/* ============================================================================
 * Validation / AI
 * ========================================================================== */

function validateInventoryItem(item: InventoryItem, productMaster?: ProductMasterItem | null) {
  const errors: string[] = [];

  if (!item.productCode) errors.push('Product Code / SKU is required.');

  /**
   * Required because Outbound / Adjustment / Transfer matching depends on:
   * SKU + Batch No + Plant.
   */
  if (!item.batchNo) errors.push('Batch No is required.');
  if (!item.plant) errors.push('Plant is required.');
  if (!item.uom) errors.push('UOM is required.');

  if (!Number.isFinite(item.batchQty) || item.batchQty < 0) {
    errors.push('Batch Qty must be 0 or above.');
  }

  if (!Number.isFinite(item.availableQty) || item.availableQty < 0) {
    errors.push('Available Qty must be 0 or above.');
  }

  if (item.availableQty > item.batchQty) {
    errors.push('Available Qty cannot be greater than Batch Qty.');
  }

  const batchControlled = productMaster?.batchControlled || item.batchControlled;
  const expiryControlled = productMaster?.expiryControlled || item.expiryControlled;

  if (batchControlled && !item.batchNo) {
    errors.push('Batch No is required because this SKU is batch-controlled.');
  }

  if (expiryControlled && !item.expiryDate) {
    errors.push('Expiry Date is required because this SKU is expiry-controlled.');
  }

  return errors;
}

function analyzeInventoryItem(
  item: InventoryItem,
  product: ProductMasterItem | null,
  allInventory: InventoryItem[],
): AiInventoryReview {
  const findings: AiFinding[] = [];
  let score = 100;

  const addFinding = (finding: AiFinding, deduction = 0) => {
    findings.push(finding);
    score -= deduction;
  };

  const effectiveStatus = getEffectiveStatus(item);
  const expiryDays = daysUntilExpiry(item.expiryDate);

  const duplicateCount = allInventory.filter(
    (existing) => existing.id !== item.id && inventoryIdentityKey(existing) === inventoryIdentityKey(item),
  ).length;

  if (!item.productCode) {
    addFinding(
      {
        severity: 'error',
        title: 'Missing SKU / Product Code',
        detail: 'This inventory record does not have a Product Code / SKU.',
        recommendation: 'Enter a valid SKU that exists in Product / SKU Master.',
      },
      25,
    );
  }

  if (!product) {
    addFinding(
      {
        severity: 'warning',
        title: 'SKU not found in Product Master',
        detail: 'AI cannot fully validate product name, UOM, batch control, expiry control, or product status.',
        recommendation: 'Create or update this SKU in Product / SKU Master.',
      },
      12,
    );
  }

  if (product && !isProductActive(product)) {
    addFinding(
      {
        severity: 'error',
        title: 'Inactive product has inventory',
        detail: `Product ${product.productCode} appears inactive, blocked, or discontinued but still has stock.`,
        recommendation: 'Review whether this stock should be blocked, quarantined, written off, or product status should be updated.',
      },
      22,
    );
  }

  if (product && product.uom && item.uom && normalizeCode(product.uom) !== normalizeCode(item.uom)) {
    addFinding(
      {
        severity: 'warning',
        title: 'UOM mismatch with Product Master',
        detail: `Inventory UOM is ${item.uom}, but Product Master UOM is ${product.uom}.`,
        recommendation: 'Confirm conversion factor or update inventory UOM to match the base UOM.',
      },
      10,
    );
  }

  const batchControlled = product?.batchControlled || item.batchControlled;
  const expiryControlled = product?.expiryControlled || item.expiryControlled;

  if (batchControlled && !item.batchNo) {
    addFinding(
      {
        severity: 'error',
        title: 'Missing batch number',
        detail: 'This SKU is batch controlled, but Batch No is blank.',
        recommendation: 'Enter a valid batch / lot number before using this stock for outbound allocation.',
      },
      25,
    );
  }

  if (expiryControlled && !item.expiryDate) {
    addFinding(
      {
        severity: 'error',
        title: 'Missing expiry date',
        detail: 'This SKU is expiry controlled, but Expiry Date is blank.',
        recommendation: 'Enter Expiry Date to support FEFO, expiry validation, and outbound compliance.',
      },
      25,
    );
  }

  if (!item.plant) {
    addFinding(
      {
        severity: 'error',
        title: 'Missing plant',
        detail: 'Plant is required for outbound, inventory adjustment, and inventory transfer matching.',
        recommendation: 'Assign the correct plant code to this inventory record.',
      },
      20,
    );
  }

  if (!item.location) {
    addFinding(
      {
        severity: 'info',
        title: 'Blank location',
        detail: 'Location is blank. Some modules can treat blank location as flexible, but warehouse traceability is weaker.',
        recommendation: 'Assign a bin / warehouse location if this is physical stock.',
      },
      4,
    );
  }

  if (!Number.isFinite(item.batchQty) || item.batchQty < 0) {
    addFinding(
      {
        severity: 'error',
        title: 'Invalid batch quantity',
        detail: 'Batch Qty is negative or invalid.',
        recommendation: 'Correct Batch Qty before inventory is used by downstream modules.',
      },
      30,
    );
  }

  if (!Number.isFinite(item.availableQty) || item.availableQty < 0) {
    addFinding(
      {
        severity: 'error',
        title: 'Invalid available quantity',
        detail: 'Available Qty is negative or invalid.',
        recommendation: 'Correct Available Qty immediately to avoid allocation failure.',
      },
      30,
    );
  }

  if (item.availableQty > item.batchQty) {
    addFinding(
      {
        severity: 'error',
        title: 'Available Qty exceeds Batch Qty',
        detail: `Available Qty (${item.availableQty}) is greater than Batch Qty (${item.batchQty}).`,
        recommendation: 'Review movement history or perform inventory adjustment.',
      },
      25,
    );
  }

  if (item.batchQty > 0 && item.availableQty === 0 && effectiveStatus === 'Available') {
    addFinding(
      {
        severity: 'info',
        title: 'Zero available stock',
        detail: 'Batch exists and status is Available, but Available Qty is zero.',
        recommendation: 'Confirm whether stock is fully allocated, consumed, or should be closed.',
      },
      5,
    );
  }

  if (item.batchQty > 0 && item.availableQty > 0 && item.availableQty <= Math.max(5, item.batchQty * 0.1)) {
    addFinding(
      {
        severity: 'warning',
        title: 'Low available stock',
        detail: 'Available Qty is at or below 10% of Batch Qty.',
        recommendation: 'Review replenishment, transfer, or allocation priority.',
      },
      8,
    );
  }

  if (effectiveStatus === 'Expired') {
    addFinding(
      {
        severity: 'error',
        title: 'Expired stock',
        detail: item.expiryDate ? `Expiry Date is ${item.expiryDate}.` : 'Inventory status is marked as Expired.',
        recommendation: 'Block this stock from outbound allocation and process disposal, return, or write-off.',
      },
      30,
    );
  } else if (expiryDays !== null && expiryDays <= 30) {
    addFinding(
      {
        severity: 'warning',
        title: 'Near-expiry stock',
        detail: `This batch expires in ${expiryDays} day(s).`,
        recommendation: 'Prioritize FEFO picking, promotion, transfer, or customer approval if needed.',
      },
      12,
    );
  } else if (expiryDays !== null && expiryDays <= 90) {
    addFinding(
      {
        severity: 'info',
        title: 'Expiry monitoring required',
        detail: `This batch expires in ${expiryDays} day(s).`,
        recommendation: 'Monitor this batch and prioritize earlier allocation where possible.',
      },
      4,
    );
  }

  if (effectiveStatus === 'Hold') {
    addFinding(
      {
        severity: 'warning',
        title: 'Stock on hold',
        detail: 'This inventory is not freely available for outbound use.',
        recommendation: 'Review quality, compliance, or warehouse hold reason before release.',
      },
      14,
    );
  }

  if (effectiveStatus === 'Damaged') {
    addFinding(
      {
        severity: 'error',
        title: 'Damaged stock',
        detail: 'This stock is marked as damaged.',
        recommendation: 'Prevent outbound allocation and process damage disposition.',
      },
      25,
    );
  }

  if (effectiveStatus === 'In Transit') {
    addFinding(
      {
        severity: 'info',
        title: 'Stock in transit',
        detail: 'This stock is currently in transit and should not be treated as normal available stock.',
        recommendation: 'Confirm goods receipt in Inventory Transfer before making it available.',
      },
      6,
    );
  }

  if (['Hold', 'Damaged', 'Expired', 'Blocked', 'Quarantine'].includes(effectiveStatus) && item.availableQty > 0) {
    addFinding(
      {
        severity: 'warning',
        title: 'Non-available status has available quantity',
        detail: `Status is ${effectiveStatus}, but Available Qty is ${item.availableQty}.`,
        recommendation: 'If stock should be blocked, set Available Qty to 0 or change status to Available if it is usable.',
      },
      10,
    );
  }

  if (['Hold', 'Damaged', 'Expired', 'Blocked', 'Quarantine'].includes(effectiveStatus) && !item.remarks) {
    addFinding(
      {
        severity: 'info',
        title: 'Missing remarks for abnormal stock',
        detail: `Status is ${effectiveStatus}, but no remarks are provided.`,
        recommendation: 'Add reason / reference note for audit trail.',
      },
      3,
    );
  }

  if (duplicateCount > 0) {
    addFinding(
      {
        severity: 'warning',
        title: 'Duplicate inventory identity detected',
        detail: 'Another record has the same Product Code, Batch No, Plant, Location, Expiry Date, UOM, and Status.',
        recommendation: 'Consolidate duplicate records or verify they represent separate physical stock correctly.',
      },
      15,
    );
  }

  if (!findings.length) {
    addFinding({
      severity: 'success',
      title: 'Inventory record looks healthy',
      detail: 'AI did not detect major stock, master data, expiry, status, or quantity risks.',
      recommendation: 'No immediate action required. Continue normal monitoring.',
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let status: AiInventoryReview['status'] = 'Healthy';
  let color = 'green';

  if (score < 50 || findings.some((finding) => finding.severity === 'error')) {
    status = 'Critical';
    color = 'red';
  } else if (score < 75 || findings.some((finding) => finding.severity === 'warning')) {
    status = 'Warning';
    color = 'orange';
  } else if (score < 90 || findings.some((finding) => finding.severity === 'info')) {
    status = 'Monitor';
    color = 'blue';
  }

  return {
    score,
    status,
    color,
    findings,
  };
}

/* ============================================================================
 * Demo
 * ========================================================================== */

function createDemoInventory(): InventoryItem[] {
  const now = new Date().toISOString();

  return [
    {
      id: uid(),
      productCode: 'SKU-030',
      sku: 'SKU-030',
      productName: 'Demo Product SKU-030',
      category: 'Finished Goods',
      storageType: 'Ambient',
      batchControlled: true,
      expiryControlled: true,
      batchNo: 'BATCH-001',
      plant: 'PLANT-01',
      location: 'A-01-01',
      expiryDate: '2027-12-31',
      uom: 'PCS',
      batchQty: 500,
      availableQty: 500,
      status: 'Available',
      remarks: 'Demo inventory for outbound / adjustment testing.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uid(),
      productCode: 'DEMO-SKU-002',
      sku: 'DEMO-SKU-002',
      productName: 'Demo Product B',
      category: 'Finished Goods',
      storageType: 'Ambient',
      batchControlled: true,
      expiryControlled: true,
      batchNo: 'BATCH-B001',
      plant: 'PLANT-01',
      location: 'A-02-01',
      expiryDate: '2027-10-31',
      uom: 'CTN',
      batchQty: 120,
      availableQty: 120,
      status: 'Available',
      remarks: 'Demo inventory item.',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/* ============================================================================
 * Main Page
 * ========================================================================== */

export default function InventoryManagementPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<InventoryFormValues>();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [plantFilter, setPlantFilter] = useState<string>('All');
  const [locationFilter, setLocationFilter] = useState<string>('All');

  const [productMaster, setProductMaster] = useState<ProductMasterItem[]>([]);
  const [productOptions, setProductOptions] = useState<MasterOption[]>([]);
  const [uomOptions, setUomOptions] = useState<MasterOption[]>([]);
  const [plantOptions, setPlantOptions] = useState<MasterOption[]>([]);
  const [locationOptions, setLocationOptions] = useState<MasterOption[]>([]);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSelectedItem, setAiSelectedItem] = useState<InventoryItem | null>(null);

  const watchedFormValues = Form.useWatch([], form);
  const isViewMode = modalMode === 'view';

  useEffect(() => {
    loadMasterOptions();
    loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function readProductMasterFromStorage() {
    if (typeof window === 'undefined') return [];

    const map = new Map<string, ProductMasterItem>();

    PRODUCT_MASTER_KEYS.forEach((key) => {
      const rows = readStorageArray<any>(key);

      rows.forEach((row) => {
        const normalized = normalizeProductMasterItem(row);
        if (!normalized?.productCode) return;

        const mapKey = normalizeCode(normalized.productCode);
        const existing = map.get(mapKey);

        if (!existing) {
          map.set(mapKey, normalized);
        } else {
          map.set(mapKey, {
            ...existing,
            ...normalized,
            raw: normalized.raw || existing.raw,
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => a.productCode.localeCompare(b.productCode));
  }

  function getProductMasterByCode(code: any) {
    const target = normalizeCode(code);
    if (!target) return null;

    return (
      productMaster.find(
        (product) =>
          normalizeCode(product.productCode) === target ||
          normalizeCode(product.sku) === target ||
          normalizeCode(readAny(product.raw, ['SKU', 'sku', 'Product Code', 'productCode'], '')) === target,
      ) || null
    );
  }

  function enrichInventoryWithProductMaster(item: InventoryItem) {
    const product = getProductMasterByCode(item.productCode);

    if (!product) return item;

    return {
      ...item,
      productName: item.productName || product.productName || '',
      uom: item.uom || product.uom || 'PCS',
      category: item.category || product.category || '',
      storageType: item.storageType || product.storageType || '',
      batchControlled: item.batchControlled || product.batchControlled || false,
      expiryControlled: item.expiryControlled || product.expiryControlled || false,
    };
  }

  function loadInventory() {
    const primary = readStorageArray<any>(INVENTORY_STORAGE_KEY);
    const compat = readStorageArray<any>(INVENTORY_COMPAT_STORAGE_KEY);

    const combined = [...primary, ...compat];
    const map = new Map<string, InventoryItem>();

    combined.forEach((raw) => {
      const item = normalizeInventoryItem(raw);
      const key = inventoryIdentityKey(item) || item.id;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, item);
      } else {
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();

        map.set(key, itemTime >= existingTime ? item : existing);
      }
    });

    const normalized = Array.from(map.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    setInventory(normalized);
  }

  function saveInventory(nextItems: InventoryItem[]) {
    const normalizedItems = nextItems.map((item) => ({
      ...item,
      sku: item.productCode,
      expiryDate: normalizeDateForInput(item.expiryDate),
      batchQty: asNumber(item.batchQty, 0),
      availableQty: asNumber(item.availableQty, 0),
      updatedAt: item.updatedAt || new Date().toISOString(),
    }));

    const persisted = normalizedItems.map(toPersistedInventoryRecord);

    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(persisted));
    localStorage.setItem(INVENTORY_COMPAT_STORAGE_KEY, JSON.stringify(persisted));

    setInventory(normalizedItems);
  }

  function loadOptionFromStorage(keys: string[], codeFields: string[], nameFields: string[]): MasterOption[] {
    for (const key of keys) {
      const rows = readStorageArray<any>(key);

      if (rows.length > 0) {
        const options = rows
          .map((item) => {
            const code = String(readAny(item, codeFields, '')).trim();
            const name = String(readAny(item, nameFields, '')).trim();

            if (!code) return null;

            return {
              value: code,
              label: name ? `${code} - ${name}` : code,
              raw: item,
            };
          })
          .filter(Boolean) as MasterOption[];

        if (options.length) return options;
      }
    }

    return [];
  }

  function loadMasterOptions() {
    const products = readProductMasterFromStorage();

    setProductMaster(products);

    const productMasterOptions = products.filter(isProductActive).map((product) => ({
      value: product.productCode,
      label: product.productName ? `${product.productCode} - ${product.productName}` : product.productCode,
      raw: product.raw || product,
    }));

    const fallbackProductOptions = loadOptionFromStorage(
      ['wms_products', 'products', 'productData', 'wms_product_master', 'master_products_v1'],
      ['productCode', 'Product Code', 'sku', 'SKU', 'code', 'Code'],
      ['productName', 'Product Name', 'description', 'Description', 'name', 'Name'],
    );

    const productMap = new Map<string, MasterOption>();

    [...productMasterOptions, ...fallbackProductOptions].forEach((option) => {
      if (!option.value) return;
      if (!productMap.has(option.value)) productMap.set(option.value, option);
    });

    setProductOptions(Array.from(productMap.values()));

    setUomOptions(
      loadOptionFromStorage(
        ['wms_uoms', 'uoms', 'uomData', 'wms_uom_master'],
        ['uom', 'UOM', 'code', 'Code', 'unit', 'Unit'],
        ['name', 'Name', 'description', 'Description'],
      ),
    );

    setPlantOptions(
      loadOptionFromStorage(
        ['wms_plants', 'plants', 'plantData', 'wms_plant_master'],
        ['plant', 'Plant', 'plantCode', 'Plant Code', 'code', 'Code'],
        ['plantName', 'Plant Name', 'name', 'Name', 'description', 'Description'],
      ),
    );

    setLocationOptions(
      loadOptionFromStorage(
        ['wms_locations', 'locations', 'locationData', 'wms_location_master'],
        ['location', 'Location', 'locationCode', 'Location Code', 'code', 'Code'],
        ['locationName', 'Location Name', 'name', 'Name', 'description', 'Description'],
      ),
    );
  }

  function refreshAll() {
    loadMasterOptions();
    loadInventory();
    messageApi.success('Inventory and Product / SKU Master refreshed.');
  }

  function refreshProductMaster() {
    loadMasterOptions();
    messageApi.success('Product / SKU Master refreshed.');
  }

  const allProductOptions = useMemo(() => {
    const fromInventory = inventory
      .filter((item) => item.productCode)
      .map((item) => ({
        value: item.productCode,
        label: item.productName ? `${item.productCode} - ${item.productName}` : item.productCode,
        raw: item,
      }));

    const merged = [...productOptions, ...fromInventory];
    const map = new Map<string, MasterOption>();

    merged.forEach((option) => {
      if (!option.value) return;
      if (!map.has(option.value)) map.set(option.value, option);
    });

    return Array.from(map.values());
  }, [inventory, productOptions]);

  const allUomOptions = useMemo(() => {
    const values = new Set<string>();

    uomOptions.forEach((option) => values.add(option.value));
    productMaster.forEach((item) => item.uom && values.add(item.uom));
    inventory.forEach((item) => item.uom && values.add(item.uom));

    return Array.from(values).map((value) => ({ value, label: value }));
  }, [inventory, productMaster, uomOptions]);

  const allPlantOptions = useMemo(() => {
    const values = new Set<string>();

    plantOptions.forEach((option) => values.add(option.value));
    inventory.forEach((item) => item.plant && values.add(item.plant));

    return Array.from(values).map((value) => ({ value, label: value }));
  }, [inventory, plantOptions]);

  const allLocationOptions = useMemo(() => {
    const values = new Set<string>();

    locationOptions.forEach((option) => values.add(option.value));
    inventory.forEach((item) => item.location && values.add(item.location));

    return Array.from(values).map((value) => ({ value, label: value }));
  }, [inventory, locationOptions]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const effectiveStatus = getEffectiveStatus(item);

      const haystack = [
        item.productCode,
        item.productName,
        item.category,
        item.storageType,
        item.batchNo,
        item.plant,
        item.location,
        item.expiryDate,
        item.uom,
        item.status,
        item.remarks,
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = !searchText || haystack.includes(searchText.toLowerCase());
      const matchesStatus = statusFilter === 'All' || effectiveStatus === statusFilter;
      const matchesPlant = plantFilter === 'All' || item.plant === plantFilter;
      const matchesLocation = locationFilter === 'All' || item.location === locationFilter;

      return matchesSearch && matchesStatus && matchesPlant && matchesLocation;
    });
  }, [inventory, searchText, statusFilter, plantFilter, locationFilter]);

  const summary = useMemo(() => {
    const totalRecords = inventory.length;
    const totalSku = new Set(inventory.map((item) => item.productCode).filter(Boolean)).size;
    const totalBatchQty = inventory.reduce((sum, item) => sum + Number(item.batchQty || 0), 0);
    const totalAvailableQty = inventory.reduce((sum, item) => sum + Number(item.availableQty || 0), 0);

    const availableRecords = inventory.filter((item) => getEffectiveStatus(item) === 'Available').length;
    const holdRecords = inventory.filter((item) => getEffectiveStatus(item) === 'Hold').length;
    const damagedRecords = inventory.filter((item) => getEffectiveStatus(item) === 'Damaged').length;
    const expiredRecords = inventory.filter((item) => getEffectiveStatus(item) === 'Expired').length;
    const inTransitRecords = inventory.filter((item) => getEffectiveStatus(item) === 'In Transit').length;

    return {
      totalRecords,
      totalSku,
      totalBatchQty,
      totalAvailableQty,
      availableRecords,
      holdRecords,
      damagedRecords,
      expiredRecords,
      inTransitRecords,
    };
  }, [inventory]);

  const aiReviewById = useMemo(() => {
    const map = new Map<string, AiInventoryReview>();

    inventory.forEach((item) => {
      map.set(item.id, analyzeInventoryItem(item, getProductMasterByCode(item.productCode), inventory));
    });

    return map;
  }, [inventory, productMaster]);

  const aiSummary = useMemo(() => {
    const reviews = Array.from(aiReviewById.values());

    const averageScore =
      reviews.length > 0 ? Math.round(reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length) : 100;

    const healthy = reviews.filter((review) => review.status === 'Healthy').length;
    const monitor = reviews.filter((review) => review.status === 'Monitor').length;
    const warning = reviews.filter((review) => review.status === 'Warning').length;
    const critical = reviews.filter((review) => review.status === 'Critical').length;

    const totalFindings = reviews.reduce(
      (sum, review) => sum + review.findings.filter((finding) => finding.severity !== 'success').length,
      0,
    );

    const expiringSoon = inventory.filter((item) => {
      const days = daysUntilExpiry(item.expiryDate);
      return days !== null && days >= 0 && days <= 90;
    }).length;

    const productMasterMissing = inventory.filter((item) => !getProductMasterByCode(item.productCode)).length;

    const uomMismatch = inventory.filter((item) => {
      const product = getProductMasterByCode(item.productCode);
      return product?.uom && item.uom && normalizeCode(product.uom) !== normalizeCode(item.uom);
    }).length;

    return {
      averageScore,
      healthy,
      monitor,
      warning,
      critical,
      totalFindings,
      expiringSoon,
      productMasterMissing,
      uomMismatch,
    };
  }, [aiReviewById, inventory, productMaster]);

  const aiFormPreview = useMemo(() => {
    if (!modalOpen || !watchedFormValues) return null;

    const now = new Date().toISOString();

    const previewItem: InventoryItem = {
      id: editingItem?.id || 'AI-PREVIEW',
      productCode: String(watchedFormValues.productCode || '').trim(),
      sku: String(watchedFormValues.productCode || '').trim(),
      productName: String(watchedFormValues.productName || '').trim(),
      category: String(watchedFormValues.category || '').trim(),
      storageType: String(watchedFormValues.storageType || '').trim(),
      batchControlled: !!watchedFormValues.batchControlled,
      expiryControlled: !!watchedFormValues.expiryControlled,
      batchNo: String(watchedFormValues.batchNo || '').trim(),
      plant: String(watchedFormValues.plant || '').trim(),
      location: String(watchedFormValues.location || '').trim(),
      expiryDate: normalizeDateForInput(watchedFormValues.expiryDate),
      uom: String(watchedFormValues.uom || 'PCS').trim(),
      batchQty: asNumber(watchedFormValues.batchQty, 0),
      availableQty: asNumber(watchedFormValues.availableQty, 0),
      status: watchedFormValues.status || 'Available',
      remarks: String(watchedFormValues.remarks || '').trim(),
      createdAt: editingItem?.createdAt || now,
      updatedAt: now,
    };

    const compareInventory =
      modalMode === 'edit' && editingItem ? inventory.filter((item) => item.id !== editingItem.id) : inventory;

    return analyzeInventoryItem(previewItem, getProductMasterByCode(previewItem.productCode), compareInventory);
  }, [modalOpen, watchedFormValues, editingItem, inventory, productMaster, modalMode]);

  function openCreateModal() {
    setModalMode('create');
    setEditingItem(null);
    form.resetFields();

    form.setFieldsValue({
      productCode: '',
      productName: '',
      category: '',
      storageType: '',
      batchControlled: false,
      expiryControlled: false,
      batchNo: '',
      plant: '',
      location: '',
      expiryDate: '',
      uom: 'PCS',
      batchQty: 0,
      availableQty: 0,
      status: 'Available',
      remarks: '',
    });

    setModalOpen(true);
  }

  function openEditModal(item: InventoryItem) {
    setModalMode('edit');
    setEditingItem(item);

    form.setFieldsValue({
      productCode: item.productCode,
      productName: item.productName,
      category: item.category || '',
      storageType: item.storageType || '',
      batchControlled: !!item.batchControlled,
      expiryControlled: !!item.expiryControlled,
      batchNo: item.batchNo,
      plant: item.plant,
      location: item.location,
      expiryDate: item.expiryDate,
      uom: item.uom,
      batchQty: item.batchQty,
      availableQty: item.availableQty,
      status: item.status,
      remarks: item.remarks || '',
    });

    setModalOpen(true);
  }

  function openViewModal(item: InventoryItem) {
    setModalMode('view');
    setEditingItem(item);

    form.setFieldsValue({
      productCode: item.productCode,
      productName: item.productName,
      category: item.category || '',
      storageType: item.storageType || '',
      batchControlled: !!item.batchControlled,
      expiryControlled: !!item.expiryControlled,
      batchNo: item.batchNo,
      plant: item.plant,
      location: item.location,
      expiryDate: item.expiryDate,
      uom: item.uom,
      batchQty: item.batchQty,
      availableQty: item.availableQty,
      status: item.status,
      remarks: item.remarks || '',
    });

    setModalOpen(true);
  }

  function handleProductSelect(value: string) {
    const selectedProduct = getProductMasterByCode(value);

    if (selectedProduct) {
      form.setFieldsValue({
        productCode: selectedProduct.productCode,
        productName: selectedProduct.productName || form.getFieldValue('productName'),
        uom: selectedProduct.uom || form.getFieldValue('uom') || 'PCS',
        category: selectedProduct.category || form.getFieldValue('category') || '',
        storageType: selectedProduct.storageType || form.getFieldValue('storageType') || '',
        batchControlled: !!selectedProduct.batchControlled,
        expiryControlled: !!selectedProduct.expiryControlled,
      });

      return;
    }

    const selected =
      productOptions.find((option) => normalizeCode(option.value) === normalizeCode(value))?.raw ||
      inventory.find((item) => normalizeCode(item.productCode) === normalizeCode(value));

    if (!selected) return;

    const productName = String(
      readAny(selected, ['productName', 'Product Name', 'productDescription', 'Product Description', 'description', 'name']),
    ).trim();

    const uom = String(readAny(selected, ['uom', 'UOM', 'unit', 'Unit', 'baseUom'])).trim();
    const category = String(readAny(selected, ['category', 'Category', 'productCategory', 'Product Category'])).trim();
    const storageType = String(readAny(selected, ['storageType', 'Storage Type', 'storageCondition'])).trim();

    form.setFieldsValue({
      productCode: value,
      productName: productName || form.getFieldValue('productName'),
      uom: uom || form.getFieldValue('uom') || 'PCS',
      category: category || form.getFieldValue('category') || '',
      storageType: storageType || form.getFieldValue('storageType') || '',
    });
  }

  async function handleSave() {
    if (isViewMode) {
      setModalOpen(false);
      return;
    }

    const values = await form.validateFields();
    const now = new Date().toISOString();

    const baseItem: InventoryItem = {
      id: editingItem?.id || uid(),
      productCode: String(values.productCode || '').trim(),
      sku: String(values.productCode || '').trim(),
      productName: String(values.productName || '').trim(),
      category: String(values.category || '').trim(),
      storageType: String(values.storageType || '').trim(),
      batchControlled: !!values.batchControlled,
      expiryControlled: !!values.expiryControlled,
      batchNo: String(values.batchNo || '').trim(),
      plant: String(values.plant || '').trim(),
      location: String(values.location || '').trim(),
      expiryDate: normalizeDateForInput(values.expiryDate),
      uom: String(values.uom || 'PCS').trim(),
      batchQty: asNumber(values.batchQty, 0),
      availableQty: asNumber(values.availableQty, 0),
      status: values.status || 'Available',
      remarks: String(values.remarks || '').trim(),
      createdAt: editingItem?.createdAt || now,
      updatedAt: now,
      raw: editingItem?.raw,
    };

    const product = getProductMasterByCode(baseItem.productCode);
    const item = enrichInventoryWithProductMaster(baseItem);

    const validationErrors = validateInventoryItem(item, product);

    if (validationErrors.length) {
      Modal.error({
        title: 'Inventory validation failed',
        content: (
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ),
      });

      return;
    }

    const duplicate = inventory.find((existing) => {
      if (existing.id === item.id) return false;
      return inventoryIdentityKey(existing) === inventoryIdentityKey(item);
    });

    if (duplicate) {
      Modal.warning({
        title: 'Duplicate inventory identity detected',
        content:
          'Another record already exists with the same Product Code, Batch No, Plant, Location, Expiry Date, UOM, and Status. Please edit the existing record instead.',
      });

      return;
    }

    const next =
      modalMode === 'edit'
        ? inventory.map((existing) => (existing.id === item.id ? item : existing))
        : [item, ...inventory];

    saveInventory(next);
    setModalOpen(false);

    messageApi.success(modalMode === 'edit' ? 'Inventory updated.' : 'Inventory created.');
  }

  function handleDelete(item: InventoryItem) {
    const next = inventory.filter((existing) => existing.id !== item.id);
    saveInventory(next);
    messageApi.success('Inventory deleted.');
  }

  function handleDuplicate(item: InventoryItem) {
    const now = new Date().toISOString();

    const duplicated: InventoryItem = {
      ...item,
      id: uid(),
      batchNo: `${item.batchNo || 'BATCH'}-COPY`,
      createdAt: now,
      updatedAt: now,
    };

    saveInventory([duplicated, ...inventory]);
    messageApi.success('Inventory duplicated.');
  }

  function handleExport() {
    const csv = buildCsv(filteredInventory);
    downloadFile(`inventory-export-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  function handleDownloadTemplate() {
    const sample = [
      CSV_HEADERS.join(','),
      [
        'SKU-030',
        'Demo Product SKU-030',
        'Finished Goods',
        'Ambient',
        'Yes',
        'Yes',
        'BATCH-001',
        'PLANT-01',
        'A-01-01',
        '2027-12-31',
        'PCS',
        '500',
        '500',
        'Available',
        'Sample row',
      ]
        .map(csvEscape)
        .join(','),
    ].join('\n');

    downloadFile('inventory-import-template.csv', sample);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const objects = rowsToObjects(rows);

      if (!objects.length) {
        messageApi.warning('CSV file has no data rows.');
        return;
      }

      const imported = objects.map((obj) => {
        const item = normalizeInventoryItem(obj);
        return enrichInventoryWithProductMaster(item);
      });

      const invalidRows: { row: number; errors: string[] }[] = [];
      const missingProductRows: number[] = [];

      imported.forEach((item, index) => {
        const product = getProductMasterByCode(item.productCode);

        if (!product) {
          missingProductRows.push(index + 2);
        }

        const errors = validateInventoryItem(item, product);

        if (errors.length) {
          invalidRows.push({
            row: index + 2,
            errors,
          });
        }
      });

      if (invalidRows.length) {
        Modal.error({
          title: 'CSV import validation failed',
          content: (
            <div>
              <p>Please fix the following CSV rows and import again:</p>
              <ul style={{ paddingLeft: 20 }}>
                {invalidRows.slice(0, 20).map((row) => (
                  <li key={row.row}>
                    <b>Row {row.row}</b>: {row.errors.join(', ')}
                  </li>
                ))}
              </ul>
              {invalidRows.length > 20 && <Text type="secondary">Only first 20 errors are shown.</Text>}
            </div>
          ),
        });

        return;
      }

      const now = new Date().toISOString();
      const map = new Map<string, InventoryItem>();

      inventory.forEach((item) => {
        map.set(inventoryIdentityKey(item), item);
      });

      let inserted = 0;
      let updated = 0;

      imported.forEach((item) => {
        const key = inventoryIdentityKey(item);
        const existing = map.get(key);

        if (existing) {
          map.set(key, {
            ...existing,
            ...item,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: now,
          });

          updated += 1;
        } else {
          map.set(key, {
            ...item,
            id: item.id || uid(),
            createdAt: now,
            updatedAt: now,
          });

          inserted += 1;
        }
      });

      const next = Array.from(map.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

      saveInventory(next);
      messageApi.success(`Import completed. Inserted: ${inserted}, Updated: ${updated}.`);

      if (missingProductRows.length) {
        Modal.warning({
          title: 'SKU not found in Product Master',
          content: (
            <div>
              <p>
                Import was completed, but some SKU values were not found in Product / SKU Master. Please review these
                rows:
              </p>
              <ul style={{ paddingLeft: 20 }}>
                {missingProductRows.slice(0, 30).map((row) => (
                  <li key={row}>CSV Row {row}</li>
                ))}
              </ul>
              {missingProductRows.length > 30 && <Text type="secondary">Only first 30 missing SKU rows are shown.</Text>}
            </div>
          ),
        });
      }
    } catch (error: any) {
      console.error(error);
      messageApi.error(error?.message || 'Failed to import CSV.');
    } finally {
      event.target.value = '';
    }
  }

  function handleLoadDemoInventory() {
    if (inventory.length > 0) {
      messageApi.warning('Demo inventory can only be loaded when inventory is empty.');
      return;
    }

    const demo = createDemoInventory();

    saveInventory(demo);
    messageApi.success('Demo inventory loaded.');
  }

  function resetFilters() {
    setSearchText('');
    setStatusFilter('All');
    setPlantFilter('All');
    setLocationFilter('All');
  }

  function openAiOverviewModal() {
    setAiSelectedItem(null);
    setAiModalOpen(true);
  }

  function openAiItemModal(item: InventoryItem) {
    setAiSelectedItem(item);
    setAiModalOpen(true);
  }

  const columns: ColumnsType<InventoryItem> = [
    {
      title: 'SKU / Product',
      key: 'product',
      width: 250,
      fixed: 'left',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.productCode}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.productName || '-'}
          </Text>
          {(record.category || record.storageType) && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {[record.category, record.storageType].filter(Boolean).join(' / ')}
            </Text>
          )}
        </Space>
      ),
      sorter: (a, b) => a.productCode.localeCompare(b.productCode),
    },
    {
      title: 'Batch No',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 150,
      sorter: (a, b) => a.batchNo.localeCompare(b.batchNo),
    },
    {
      title: 'Plant',
      dataIndex: 'plant',
      key: 'plant',
      width: 130,
      sorter: (a, b) => a.plant.localeCompare(b.plant),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 140,
      render: (value) => value || <Text type="secondary">Blank / Flexible</Text>,
      sorter: (a, b) => a.location.localeCompare(b.location),
    },
    {
      title: 'Expiry Date',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      width: 140,
      render: (value) => {
        if (!value) return <Text type="secondary">No expiry</Text>;

        const expired = isExpired(value);
        const days = daysUntilExpiry(value);

        return (
          <Tooltip title={days === null ? undefined : `${days} day(s) until expiry`}>
            <Tag color={expired ? 'volcano' : days !== null && days <= 90 ? 'orange' : 'blue'}>{value}</Tag>
          </Tooltip>
        );
      },
      sorter: (a, b) => String(a.expiryDate || '').localeCompare(String(b.expiryDate || '')),
    },
    {
      title: 'Control',
      key: 'control',
      width: 150,
      render: (_, record) => (
        <Space wrap size={4}>
          {record.batchControlled && <Tag color="purple">Batch</Tag>}
          {record.expiryControlled && <Tag color="cyan">Expiry</Tag>}
          {!record.batchControlled && !record.expiryControlled && <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    {
      title: 'UOM',
      dataIndex: 'uom',
      key: 'uom',
      width: 90,
    },
    {
      title: 'Batch Qty',
      dataIndex: 'batchQty',
      key: 'batchQty',
      width: 120,
      align: 'right',
      render: (value) => Number(value || 0).toLocaleString(),
      sorter: (a, b) => a.batchQty - b.batchQty,
    },
    {
      title: 'Available Qty',
      dataIndex: 'availableQty',
      key: 'availableQty',
      width: 130,
      align: 'right',
      render: (value) => <Text strong>{Number(value || 0).toLocaleString()}</Text>,
      sorter: (a, b) => a.availableQty - b.availableQty,
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const effectiveStatus = getEffectiveStatus(record);
        return <Tag color={statusColor(effectiveStatus)}>{effectiveStatus}</Tag>;
      },
      sorter: (a, b) => getEffectiveStatus(a).localeCompare(getEffectiveStatus(b)),
    },
    {
      title: 'AI',
      key: 'ai',
      width: 145,
      render: (_, record) => {
        const review = aiReviewById.get(record.id);

        if (!review) return '-';

        return (
          <Tooltip title={`AI Score: ${review.score}/100`}>
            <Tag color={review.color} icon={<RobotOutlined />} style={{ cursor: 'pointer' }} onClick={() => openAiItemModal(record)}>
              {review.status} {review.score}
            </Tag>
          </Tooltip>
        );
      },
      sorter: (a, b) => (aiReviewById.get(a.id)?.score || 0) - (aiReviewById.get(b.id)?.score || 0),
    },
    {
      title: 'Updated At',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value) => (value ? new Date(value).toLocaleString() : '-'),
      sorter: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
    },
    {
      title: 'Action',
      key: 'action',
      width: 235,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="View">
            <Button icon={<EyeOutlined />} size="small" onClick={() => openViewModal(record)} />
          </Tooltip>

          <Tooltip title="AI Review">
            <Button icon={<RobotOutlined />} size="small" onClick={() => openAiItemModal(record)} />
          </Tooltip>

          <Tooltip title="Edit">
            <Button icon={<EditOutlined />} size="small" type="primary" onClick={() => openEditModal(record)} />
          </Tooltip>

          <Tooltip title="Duplicate">
            <Button icon={<CopyOutlined />} size="small" onClick={() => handleDuplicate(record)} />
          </Tooltip>

          <Popconfirm
            title="Delete inventory?"
            description="This action cannot be undone."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record)}
          >
            <Tooltip title="Delete">
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const selectedAiReview = aiSelectedItem
    ? analyzeInventoryItem(aiSelectedItem, getProductMasterByCode(aiSelectedItem.productCode), inventory)
    : null;

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}

      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            📦 Inventory Management
          </Title>
          <Text type="secondary">
            Manage warehouse stock by SKU, batch, plant, location, expiry date, UOM, and available quantity.
          </Text>
        </div>

        <Alert
          type="info"
          showIcon
          title="Outbound / Adjustment / Transfer compatible inventory structure"
          description="This page saves SKU, Batch No, Plant, Location, Expiry Date, UOM, Batch Qty, and Available Qty using multiple field aliases so other modules can match and deduct stock reliably."
        />

        <Alert
          type={aiSummary.critical > 0 ? 'error' : aiSummary.warning > 0 ? 'warning' : 'success'}
          showIcon
          icon={<RobotOutlined />}
          title="AI Inventory Assistant"
          description={`AI reviewed ${inventory.length.toLocaleString()} inventory records. Average health score is ${
            aiSummary.averageScore
          }/100. Critical: ${aiSummary.critical}, Warning: ${aiSummary.warning}, Monitor: ${
            aiSummary.monitor
          }, Healthy: ${aiSummary.healthy}.`}
          action={
            <Button icon={<RobotOutlined />} onClick={openAiOverviewModal}>
              AI Health Check
            </Button>
          }
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Text type="secondary">Inventory Records</Text>
              <Title level={3} style={{ margin: 0 }}>
                {summary.totalRecords.toLocaleString()}
              </Title>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Text type="secondary">Unique SKU</Text>
              <Title level={3} style={{ margin: 0 }}>
                {summary.totalSku.toLocaleString()}
              </Title>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Text type="secondary">Total Batch Qty</Text>
              <Title level={3} style={{ margin: 0 }}>
                {summary.totalBatchQty.toLocaleString()}
              </Title>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Text type="secondary">Total Available Qty</Text>
              <Title level={3} style={{ margin: 0, color: '#1677ff' }}>
                {summary.totalAvailableQty.toLocaleString()}
              </Title>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">Available Records: </Text>
              <Text strong style={{ color: '#389e0d' }}>
                {summary.availableRecords}
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">Hold Records: </Text>
              <Text strong style={{ color: '#d48806' }}>
                {summary.holdRecords}
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">Damaged Records: </Text>
              <Text strong style={{ color: '#cf1322' }}>
                {summary.damagedRecords}
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">Expired / In Transit: </Text>
              <Text strong style={{ color: '#d4380d' }}>
                {summary.expiredRecords} / {summary.inTransitRecords}
              </Text>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">AI Avg Score: </Text>
              <Text
                strong
                style={{
                  color:
                    aiSummary.averageScore >= 90
                      ? '#389e0d'
                      : aiSummary.averageScore >= 75
                        ? '#1677ff'
                        : aiSummary.averageScore >= 50
                          ? '#d48806'
                          : '#cf1322',
                }}
              >
                {aiSummary.averageScore}/100
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">AI Findings: </Text>
              <Text strong>{aiSummary.totalFindings}</Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">Expiring ≤90 Days: </Text>
              <Text strong style={{ color: aiSummary.expiringSoon > 0 ? '#d48806' : '#389e0d' }}>
                {aiSummary.expiringSoon}
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">Master / UOM Issues: </Text>
              <Text strong style={{ color: aiSummary.productMasterMissing + aiSummary.uomMismatch > 0 ? '#cf1322' : '#389e0d' }}>
                {aiSummary.productMasterMissing + aiSummary.uomMismatch}
              </Text>
            </Card>
          </Col>
        </Row>

        <Card>
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Row gutter={[12, 12]} justify="space-between">
              <Col xs={24} lg={15}>
                <Space wrap>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} data-testid="inventory-add-btn">
                    Add Inventory
                  </Button>

                  <Button icon={<ImportOutlined />} onClick={handleImportClick}>
                    Import CSV
                  </Button>

                  <Button icon={<ExportOutlined />} onClick={handleExport}>
                    Export CSV
                  </Button>

                  <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                    Template
                  </Button>

                  <Button icon={<ReloadOutlined />} onClick={refreshProductMaster}>
                    Refresh Product Master
                  </Button>

                  <Button icon={<RobotOutlined />} onClick={openAiOverviewModal}>
                    AI Health Check
                  </Button>

                  {inventory.length === 0 && (
                    <Button icon={<InboxOutlined />} onClick={handleLoadDemoInventory}>
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

              <Col xs={24} lg={9}>
                <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="Search SKU, product, batch, plant, location..."
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    style={{ width: 300 }}
                    data-testid="inventory-search"
                  />

                  <Button icon={<ReloadOutlined />} onClick={refreshAll}>
                    Reload
                  </Button>
                </Space>
              </Col>
            </Row>

            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'All', label: 'All Status' },
                    ...STATUS_OPTIONS.map((status) => ({
                      value: status,
                      label: status,
                    })),
                  ]}
                />
              </Col>

              <Col xs={24} md={8}>
                <Select
                  showSearch
                  value={plantFilter}
                  onChange={setPlantFilter}
                  style={{ width: '100%' }}
                  optionFilterProp="label"
                  options={[
                    { value: 'All', label: 'All Plants' },
                    ...allPlantOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    })),
                  ]}
                />
              </Col>

              <Col xs={24} md={8}>
                <Select
                  showSearch
                  value={locationFilter}
                  onChange={setLocationFilter}
                  style={{ width: '100%' }}
                  filterOption={(input, option) =>
                    String(option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={[
                    { value: 'All', label: 'All Locations' },
                    ...allLocationOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    })),
                  ]}
                />
              </Col>
            </Row>

            <Space>
              <Text type="secondary">
                Showing {filteredInventory.length.toLocaleString()} of {inventory.length.toLocaleString()} records
              </Text>

              {(searchText || statusFilter !== 'All' || plantFilter !== 'All' || locationFilter !== 'All') && (
                <Button type="link" onClick={resetFilters}>
                  Clear filters
                </Button>
              )}
            </Space>

            <Table
              rowKey="id"
              columns={columns}
              dataSource={filteredInventory}
              scroll={{ x: 1850 }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `${total} records`,
              }}
              locale={{
                emptyText: <Empty description="No inventory found" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </Space>
        </Card>
      </Space>

      <Modal
        open={modalOpen}
        destroyOnHidden
        width={900}
        title={modalMode === 'create' ? 'Add Inventory' : modalMode === 'edit' ? 'Edit Inventory' : 'View Inventory'}
        okText={isViewMode ? 'Close' : 'Save'}
        cancelText={isViewMode ? undefined : 'Cancel'}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
      >
        <Divider />

        {aiFormPreview && (
          <Alert
            style={{ marginBottom: 16 }}
            type={aiFormPreview.status === 'Critical' ? 'error' : aiFormPreview.status === 'Warning' ? 'warning' : 'info'}
            showIcon
            icon={<RobotOutlined />}
            title={`AI Validation Preview: ${aiFormPreview.status} · Score ${aiFormPreview.score}/100`}
            description={
              <Space orientation="vertical" size={4}>
                {aiFormPreview.findings.slice(0, 3).map((finding) => (
                  <Text key={`${finding.title}-${finding.detail}`} type={finding.severity === 'error' ? 'danger' : undefined}>
                    {finding.title}: {finding.recommendation}
                  </Text>
                ))}
              </Space>
            }
          />
        )}

        <Form
          form={form}
          layout="vertical"
          disabled={isViewMode}
          initialValues={{
            status: 'Available',
            uom: 'PCS',
            batchQty: 0,
            availableQty: 0,
            batchControlled: false,
            expiryControlled: false,
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Product Code / SKU" name="productCode" rules={[{ required: true, message: 'Product Code / SKU is required' }]}>
                <AutoComplete
                  allowClear
                  virtual={false}
                  options={allProductOptions}
                  placeholder="Enter or select SKU"
                  onSelect={handleProductSelect}
                  onBlur={() => {
                    const value = form.getFieldValue('productCode');
                    if (value) handleProductSelect(value);
                  }}
                  filterOption={(inputValue, option) =>
                    normalizeText(option?.label).includes(normalizeText(inputValue)) ||
                    normalizeText(option?.value).includes(normalizeText(inputValue))
                  }
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Product Name" name="productName">
                <Input placeholder="Product description" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Category" name="category">
                <Input placeholder="Auto-filled from Product Master if available" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Storage Type" name="storageType">
                <Input placeholder="Ambient / Chilled / Frozen / Hazardous" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Batch Controlled" name="batchControlled" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Expiry Controlled" name="expiryControlled" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Batch No" name="batchNo" rules={[{ required: true, message: 'Batch No is required' }]}>
                <Input placeholder="Example: BATCH-001" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Plant" name="plant" rules={[{ required: true, message: 'Plant is required' }]}>
                <AutoComplete
                  allowClear
                  virtual={false}
                  options={allPlantOptions}
                  placeholder="Enter or select plant"
                  filterOption={(inputValue, option) =>
                    normalizeText(option?.label).includes(normalizeText(inputValue)) ||
                    normalizeText(option?.value).includes(normalizeText(inputValue))
                  }
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Location" name="location">
                <AutoComplete
                  allowClear
                  virtual={false}
                  options={allLocationOptions}
                  placeholder="Enter or select location"
                  filterOption={(inputValue, option) =>
                    normalizeText(option?.label).includes(normalizeText(inputValue)) ||
                    normalizeText(option?.value).includes(normalizeText(inputValue))
                  }
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Expiry Date"
                name="expiryDate"
                dependencies={['expiryControlled']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const expiryControlled = !!getFieldValue('expiryControlled');

                      if (expiryControlled && !value) {
                        return Promise.reject(new Error('Expiry Date is required for expiry-controlled SKU'));
                      }

                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="UOM" name="uom" rules={[{ required: true, message: 'UOM is required' }]}>
                <AutoComplete
                  allowClear
                  virtual={false}
                  options={allUomOptions}
                  placeholder="PCS / CTN / KG"
                  filterOption={(inputValue, option) =>
                    normalizeText(option?.label).includes(normalizeText(inputValue)) ||
                    normalizeText(option?.value).includes(normalizeText(inputValue))
                  }
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Batch Qty" name="batchQty" rules={[{ required: true, message: 'Batch Qty is required' }]}>
                <InputNumber
                  min={0}
                  precision={3}
                  style={{ width: '100%' }}
                  onChange={(value) => {
                    const availableQty = form.getFieldValue('availableQty');

                    if (availableQty === undefined || availableQty === null || Number(availableQty) === 0) {
                      form.setFieldsValue({ availableQty: Number(value || 0) });
                    }
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Available Qty"
                name="availableQty"
                dependencies={['batchQty']}
                rules={[
                  { required: true, message: 'Available Qty is required' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const batchQty = Number(getFieldValue('batchQty') || 0);
                      const availableQty = Number(value || 0);

                      if (availableQty > batchQty) {
                        return Promise.reject(new Error('Available Qty cannot exceed Batch Qty'));
                      }

                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <InputNumber min={0} precision={3} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Status" name="status" rules={[{ required: true, message: 'Status is required' }]}>
                <Select
                  options={STATUS_OPTIONS.map((status) => ({
                    value: status,
                    label: status,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Remarks" name="remarks">
                <Input.TextArea rows={3} placeholder="Optional notes" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {editingItem && (
          <>
            <Divider />
            <Space orientation="vertical" size={0}>
              <Text type="secondary">Record ID: {editingItem.id}</Text>
              <Text type="secondary">
                Created At: {editingItem.createdAt ? new Date(editingItem.createdAt).toLocaleString() : '-'}
              </Text>
              <Text type="secondary">
                Updated At: {editingItem.updatedAt ? new Date(editingItem.updatedAt).toLocaleString() : '-'}
              </Text>
            </Space>
          </>
        )}
      </Modal>

      <Modal
        open={aiModalOpen}
        destroyOnHidden
        width={900}
        title={
          <Space>
            <RobotOutlined />
            {aiSelectedItem ? `AI Inventory Review · ${aiSelectedItem.productCode}` : 'AI Inventory Health Check'}
          </Space>
        }
        footer={[
          <Button key="close" type="primary" onClick={() => setAiModalOpen(false)}>
            Close
          </Button>,
        ]}
        onCancel={() => setAiModalOpen(false)}
      >
        {aiSelectedItem && selectedAiReview ? (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <Card>
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={8}>
                  <Progress type="dashboard" percent={selectedAiReview.score} strokeColor={selectedAiReview.color} />
                </Col>

                <Col xs={24} md={16}>
                  <Space orientation="vertical" size={8}>
                    <Title level={4} style={{ margin: 0 }}>
                      {aiSelectedItem.productCode} · {aiSelectedItem.productName || '-'}
                    </Title>

                    <Space wrap>
                      <Tag color={selectedAiReview.color} icon={<RobotOutlined />}>
                        {selectedAiReview.status}
                      </Tag>
                      <Tag color={statusColor(getEffectiveStatus(aiSelectedItem))}>{getEffectiveStatus(aiSelectedItem)}</Tag>
                      <Tag>{aiSelectedItem.batchNo || 'No Batch'}</Tag>
                      <Tag>{aiSelectedItem.plant || 'No Plant'}</Tag>
                      <Tag>{aiSelectedItem.location || 'No Location'}</Tag>
                    </Space>

                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      AI checked Product Master linkage, UOM, batch / expiry control, quantity consistency, stock status,
                      duplicate identity, and outbound allocation readiness.
                    </Paragraph>
                  </Space>
                </Col>
              </Row>
            </Card>

            <List
              bordered
              dataSource={selectedAiReview.findings}
              renderItem={(finding) => (
                <List.Item>
                  <Space align="start">
                    <Tag color={aiSeverityColor(finding.severity)} icon={aiSeverityIcon(finding.severity)}>
                      {finding.severity.toUpperCase()}
                    </Tag>

                    <Space orientation="vertical" size={2}>
                      <Text strong>{finding.title}</Text>
                      <Text>{finding.detail}</Text>
                      <Text type="secondary">Recommendation: {finding.recommendation}</Text>
                    </Space>
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        ) : (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <Card>
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={8}>
                  <Progress type="dashboard" percent={aiSummary.averageScore} />
                </Col>

                <Col xs={24} md={16}>
                  <Title level={4} style={{ marginTop: 0 }}>
                    Overall Inventory AI Health
                  </Title>

                  <Paragraph>
                    AI reviewed your inventory records for master data mismatch, stock risks, expiry risk, duplicate
                    identity, status consistency, and outbound readiness.
                  </Paragraph>

                  <Space wrap>
                    <Tag color="green">Healthy: {aiSummary.healthy}</Tag>
                    <Tag color="blue">Monitor: {aiSummary.monitor}</Tag>
                    <Tag color="orange">Warning: {aiSummary.warning}</Tag>
                    <Tag color="red">Critical: {aiSummary.critical}</Tag>
                  </Space>
                </Col>
              </Row>
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <Card size="small">
                  <Text type="secondary">Total AI Findings</Text>
                  <Title level={4} style={{ margin: 0 }}>
                    {aiSummary.totalFindings}
                  </Title>
                </Card>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <Card size="small">
                  <Text type="secondary">Expiring ≤90 Days</Text>
                  <Title level={4} style={{ margin: 0 }}>
                    {aiSummary.expiringSoon}
                  </Title>
                </Card>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <Card size="small">
                  <Text type="secondary">Missing Product Master</Text>
                  <Title level={4} style={{ margin: 0 }}>
                    {aiSummary.productMasterMissing}
                  </Title>
                </Card>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <Card size="small">
                  <Text type="secondary">UOM Mismatch</Text>
                  <Title level={4} style={{ margin: 0 }}>
                    {aiSummary.uomMismatch}
                  </Title>
                </Card>
              </Col>
            </Row>

            <Alert
              type={aiSummary.critical > 0 ? 'error' : aiSummary.warning > 0 ? 'warning' : 'success'}
              showIcon
              title="AI Recommendation"
              description={
                aiSummary.critical > 0
                  ? 'Critical stock issues exist. Review expired, damaged, invalid quantity, inactive SKU, blocked stock, or missing required control data before outbound allocation.'
                  : aiSummary.warning > 0
                    ? 'Some inventory records require review. Focus on low stock, near-expiry, duplicate records, UOM mismatch, abnormal stock status, and missing Product Master linkage.'
                    : 'Inventory health is good. Continue monitoring expiry, low stock, and master data consistency.'
              }
            />

            <List
              bordered
              dataSource={inventory
                .map((item) => ({
                  item,
                  review: aiReviewById.get(item.id)!,
                }))
                .filter((row) => row.review && row.review.status !== 'Healthy')
                .sort((a, b) => a.review.score - b.review.score)
                .slice(0, 20)}
              locale={{
                emptyText: <Empty description="No AI risk records found" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
              renderItem={({ item, review }) => (
                <List.Item
                  actions={[
                    <Button key="review" size="small" icon={<RobotOutlined />} onClick={() => openAiItemModal(item)}>
                      Review
                    </Button>,
                  ]}
                >
                  <Space orientation="vertical" size={2}>
                    <Space wrap>
                      <Text strong>{item.productCode}</Text>
                      <Tag color={review.color}>{review.status}</Tag>
                      <Tag>Score {review.score}</Tag>
                      <Tag>{item.batchNo || 'No Batch'}</Tag>
                      <Tag>{item.plant || 'No Plant'}</Tag>
                    </Space>

                    <Text type="secondary">
                      {review.findings.filter((finding) => finding.severity !== 'success')[0]?.title ||
                        'AI found an issue requiring review'}
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        )}
      </Modal>
    </div>
  );
}