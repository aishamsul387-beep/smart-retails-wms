'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AutoComplete,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
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
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CloseCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExportOutlined,
  EyeOutlined,
  FileDoneOutlined,
  ImportOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  SendOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const OUTBOUND_STORAGE_KEY = 'wms_outbound_shipments';
const INVENTORY_STORAGE_KEY = 'wms_inventory';
const INVENTORY_COMPAT_STORAGE_KEY = 'wms_inventory_management';
const MOVEMENT_LOG_KEY = 'wms_inventory_movements';

type ShipmentStatus = 'Draft' | 'Confirmed' | 'Shipped' | 'Cancelled';
type InventoryStatus = 'Available' | 'Hold' | 'Damaged' | 'Expired';
type ModalMode = 'create' | 'edit' | 'view';
type AiSeverity = 'success' | 'info' | 'warning' | 'error';

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
  status: InventoryStatus;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

interface OutboundLine {
  id: string;
  productCode: string;
  productName: string;
  batchNo: string;
  plant: string;
  location?: string;
  expiryDate?: string;
  uom: string;
  qty: number;
  remarks?: string;
}

interface Allocation {
  id: string;
  lineId: string;
  inventoryId: string;
  productCode: string;
  productName: string;
  batchNo: string;
  plant: string;
  location: string;
  expiryDate: string;
  uom: string;
  qty: number;
}

interface OutboundShipment {
  id: string;
  shipmentNo: string;
  salesOrderNo?: string;
  customerCode: string;
  customerName: string;
  requestedShipDate: string;
  shipDate?: string;
  status: ShipmentStatus;
  remarks?: string;
  lines: OutboundLine[];
  allocations: Allocation[];
  createdAt: string;
  updatedAt: string;
}

interface OutboundFormValues {
  shipmentNo: string;
  salesOrderNo?: string;
  customerCode: string;
  customerName: string;
  requestedShipDate: string;
  remarks?: string;
  lines: Array<{
    productCode: string;
    productName: string;
    batchNo: string;
    plant: string;
    location?: string;
    expiryDate?: string;
    uom: string;
    qty: number;
    remarks?: string;
  }>;
}

interface AiFinding {
  severity: AiSeverity;
  title: string;
  detail: string;
  recommendation: string;
}

interface AiReview {
  score: number;
  status: 'Ready' | 'Monitor' | 'Warning' | 'Blocked';
  color: string;
  findings: AiFinding[];
  allocationSuggestions: Allocation[];
}

const CSV_HEADERS = [
  'Shipment No',
  'Sales Order No',
  'Customer Code',
  'Customer Name',
  'Requested Ship Date',
  'SKU',
  'Product Name',
  'Batch No',
  'Plant',
  'Location',
  'Expiry Date',
  'UOM',
  'Qty',
  'Remarks',
];

/* ============================================================================
 * Helpers
 * ========================================================================== */

function uid(prefix = 'ID') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function normalizeText(value: any) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeCode(value: any) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeKey(value: any) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function asNumber(value: any, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function safeJsonParse<T = any>(text: string | null, fallback: T): T {
  if (!text) return fallback;

  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function readStorageArray<T = any>(key: string): T[] {
  if (typeof window === 'undefined') return [];

  const parsed = safeJsonParse<any>(localStorage.getItem(key), []);

  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.data)) return parsed.data;
  if (Array.isArray(parsed?.items)) return parsed.items;
  if (Array.isArray(parsed?.rows)) return parsed.rows;
  if (Array.isArray(parsed?.records)) return parsed.records;
  if (Array.isArray(parsed?.list)) return parsed.list;
  if (Array.isArray(parsed?.inventory)) return parsed.inventory;
  if (Array.isArray(parsed?.shipments)) return parsed.shipments;

  if (parsed && typeof parsed === 'object') {
    const arrays = Object.values(parsed).filter(Array.isArray) as T[][];
    if (arrays.length) return arrays.flat();
  }

  return [];
}

function readAny(obj: any, keys: string[], fallback = '') {
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

/**
 * Supports:
 * - YYYY-MM-DD
 * - YYYY/MM/DD
 * - DD/MM/YYYY
 * - MM/DD/YYYY
 * - Date object
 * - dayjs/moment object
 */
function getDateKeys(value: any): string[] {
  if (!value) return [];

  const keys = new Set<string>();

  if (typeof value?.format === 'function') {
    const formatted = value.format('YYYY-MM-DD');
    if (formatted) keys.add(formatted);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    keys.add(value.toISOString().slice(0, 10));
  }

  const raw = String(value ?? '').trim();
  if (!raw) return Array.from(keys);

  keys.add(raw);

  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    keys.add(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  const slashMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (slashMatch) {
    const [, a, b, y] = slashMatch;
    const first = Number(a);
    const second = Number(b);

    // DD/MM/YYYY
    if (first >= 1 && first <= 31 && second >= 1 && second <= 12) {
      keys.add(`${y}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`);
    }

    // MM/DD/YYYY
    if (first >= 1 && first <= 12 && second >= 1 && second <= 31) {
      keys.add(`${y}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`);
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    keys.add(parsed.toISOString().slice(0, 10));
  }

  return Array.from(keys).filter(Boolean);
}

function normalizeDateForInput(value: any) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const keys = getDateKeys(value);
  const normalized = keys.find((key) => /^\d{4}-\d{2}-\d{2}$/.test(key));

  return normalized || text;
}

function datesMatchFlexible(a?: string, b?: string) {
  const aKeys = getDateKeys(a);
  const bKeys = getDateKeys(b);

  /**
   * Flexible rule:
   * If outbound expiry is blank, any inventory expiry is acceptable.
   * If inventory expiry is blank, it is also treated as flexible.
   */
  if (!aKeys.length || !bKeys.length) return true;

  return aKeys.some((key) => bKeys.includes(key));
}

function sameDateFlexible(a?: string, b?: string) {
  return datesMatchFlexible(a, b);
}

function sameLocationFlexible(outboundLocation?: string, inventoryLocation?: string) {
  const outLoc = normalizeText(outboundLocation);
  const invLoc = normalizeText(inventoryLocation);

  /**
   * Flexible rule:
   * If outbound location is blank, any inventory location is acceptable.
   * If inventory location is blank, it is treated as flexible.
   */
  if (!outLoc || !invLoc) return true;

  return outLoc === invLoc;
}

function getInventoryAvailableQty(stock: any): number {
  if (!stock) return 0;

  const possibleKeys = [
    'availableQty',
    'Available Qty',
    'available',
    'Available',
    'balanceQty',
    'Balance Qty',
    'qtyAvailable',
    'Qty Available',
    'availableBalance',
    'Available Balance',
    'availableQuantity',
    'Available Quantity',
    'remainingQty',
    'Remaining Qty',
  ];

  for (const key of possibleKeys) {
    if (stock[key] !== undefined && stock[key] !== null && stock[key] !== '') {
      return asNumber(stock[key], 0);
    }
  }

  return asNumber(stock.batchQty ?? stock.qty ?? stock.quantity ?? stock.stockQty ?? stock.onHandQty, 0);
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

function shipmentStatusColor(status: ShipmentStatus) {
  switch (status) {
    case 'Draft':
      return 'default';
    case 'Confirmed':
      return 'blue';
    case 'Shipped':
      return 'green';
    case 'Cancelled':
      return 'red';
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

/* ============================================================================
 * Inventory Normalization
 * ========================================================================== */

function normalizeInventoryItem(raw: any): InventoryItem {
  const productCode = String(
    readAny(raw, [
      'productCode',
      'Product Code',
      'sku',
      'SKU',
      'skuCode',
      'SKU Code',
      'itemCode',
      'Item Code',
      'materialCode',
      'Material Code',
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
      'name',
      'Name',
    ]),
  ).trim();

  const batchNo = String(readAny(raw, ['batchNo', 'Batch No', 'batchNumber', 'Batch Number', 'lotNo', 'Lot No'])).trim();

  const plant = String(readAny(raw, ['plant', 'Plant', 'plantCode', 'Plant Code'])).trim();

  const location = String(
    readAny(raw, ['location', 'Location', 'storageLocation', 'Storage Location', 'bin', 'Bin', 'warehouse', 'Warehouse']),
  ).trim();

  const expiryDate = normalizeDateForInput(
    readAny(raw, ['expiryDate', 'Expiry Date', 'expiry', 'Expiry', 'expirationDate', 'Expiration Date']),
  );

  const uom =
    String(readAny(raw, ['uom', 'UOM', 'unit', 'Unit', 'unitOfMeasure', 'Unit Of Measure'], 'PCS')).trim() || 'PCS';

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
    'balanceQty',
    'Balance Qty',
    'qtyAvailable',
    'Qty Available',
    'availableBalance',
    'Available Balance',
    'availableQuantity',
    'Available Quantity',
    'remainingQty',
    'Remaining Qty',
  ]);

  const availableQty = availableRaw === '' ? batchQty : asNumber(availableRaw, batchQty);

  const rawStatus = String(readAny(raw, ['status', 'Status'], 'Available')).trim() as InventoryStatus;
  const status: InventoryStatus = ['Available', 'Hold', 'Damaged', 'Expired'].includes(rawStatus)
    ? rawStatus
    : 'Available';

  return {
    ...raw,
    id: String(readAny(raw, ['id', 'ID', 'key', 'Key'], uid('INV'))).trim(),
    productCode,
    sku: productCode,
    productName,
    batchNo,
    plant,
    location,
    expiryDate,
    uom,
    batchQty,
    availableQty,
    status,
    remarks: String(readAny(raw, ['remarks', 'Remarks', 'remark', 'Remark'], '')).trim(),
    createdAt: String(readAny(raw, ['createdAt', 'Created At'], '')),
    updatedAt: String(readAny(raw, ['updatedAt', 'Updated At'], '')),
  };
}

function toPersistedInventoryRecord(item: InventoryItem) {
  return {
    ...item,

    productCode: item.productCode,
    sku: item.productCode,
    SKU: item.productCode,
    'Product Code': item.productCode,

    productName: item.productName,
    'Product Name': item.productName,
    productDescription: item.productName,
    'Product Description': item.productName,

    batchNo: item.batchNo,
    'Batch No': item.batchNo,
    batchNumber: item.batchNo,
    'Batch Number': item.batchNo,

    plant: item.plant,
    Plant: item.plant,

    location: item.location,
    Location: item.location,
    storageLocation: item.location,
    'Storage Location': item.location,

    expiryDate: item.expiryDate,
    'Expiry Date': item.expiryDate,

    uom: item.uom,
    UOM: item.uom,

    batchQty: item.batchQty,
    'Batch Qty': item.batchQty,
    qty: item.batchQty,
    Qty: item.batchQty,
    quantity: item.batchQty,
    Quantity: item.batchQty,
    stockQty: item.batchQty,
    'Stock Qty': item.batchQty,

    availableQty: item.availableQty,
    'Available Qty': item.availableQty,
    available: item.availableQty,
    Available: item.availableQty,
    balanceQty: item.availableQty,
    'Balance Qty': item.availableQty,
    qtyAvailable: item.availableQty,
    'Qty Available': item.availableQty,
    availableBalance: item.availableQty,
    'Available Balance': item.availableQty,
    availableQuantity: item.availableQty,
    'Available Quantity': item.availableQty,
    remainingQty: item.availableQty,
    'Remaining Qty': item.availableQty,

    status: item.status,
    Status: item.status,
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
}

/* ============================================================================
 * Outbound Normalization
 * ========================================================================== */

function normalizeOutboundLine(raw: any): OutboundLine {
  const productCode = String(
    readAny(raw, ['productCode', 'Product Code', 'sku', 'SKU', 'itemCode', 'Item Code', 'materialCode', 'Material Code']),
  ).trim();

  return {
    id: String(readAny(raw, ['id', 'ID', 'lineId', 'Line ID'], uid('LINE'))).trim(),
    productCode,
    productName: String(
      readAny(raw, ['productName', 'Product Name', 'productDescription', 'Product Description', 'description', 'Description']),
    ).trim(),
    batchNo: String(readAny(raw, ['batchNo', 'Batch No', 'batchNumber', 'Batch Number', 'lotNo', 'Lot No'])).trim(),
    plant: String(readAny(raw, ['plant', 'Plant', 'plantCode', 'Plant Code'])).trim(),
    location: String(readAny(raw, ['location', 'Location', 'storageLocation', 'Storage Location', 'bin', 'Bin'], '')).trim(),
    expiryDate: normalizeDateForInput(
      readAny(raw, ['expiryDate', 'Expiry Date', 'expiry', 'Expiry', 'expirationDate', 'Expiration Date'], ''),
    ),
    uom: String(readAny(raw, ['uom', 'UOM', 'unit', 'Unit'], 'PCS')).trim() || 'PCS',
    qty: asNumber(readAny(raw, ['qty', 'Qty', 'quantity', 'Quantity', 'orderQty', 'Order Qty'], '0')),
    remarks: String(readAny(raw, ['remarks', 'Remarks', 'remark', 'Remark'], '')).trim(),
  };
}

function normalizeShipment(raw: any): OutboundShipment {
  const now = new Date().toISOString();

  const rawLines = Array.isArray(raw?.lines)
    ? raw.lines
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.details)
        ? raw.details
        : [];

  const lines = rawLines.map((line: unknown) => normalizeOutboundLine(line));

  const rawAllocations = Array.isArray(raw?.allocations) ? raw.allocations : [];

  const allocations: Allocation[] = rawAllocations.map((allocation: any) => ({
    id: String(readAny(allocation, ['id', 'ID'], uid('ALLOC'))),
    lineId: String(readAny(allocation, ['lineId', 'Line ID'], '')),
    inventoryId: String(readAny(allocation, ['inventoryId', 'Inventory ID'], '')),
    productCode: String(readAny(allocation, ['productCode', 'Product Code', 'sku', 'SKU'], '')).trim(),
    productName: String(readAny(allocation, ['productName', 'Product Name'], '')).trim(),
    batchNo: String(readAny(allocation, ['batchNo', 'Batch No'], '')).trim(),
    plant: String(readAny(allocation, ['plant', 'Plant'], '')).trim(),
    location: String(readAny(allocation, ['location', 'Location', 'storageLocation', 'Storage Location'], '')).trim(),
    expiryDate: normalizeDateForInput(readAny(allocation, ['expiryDate', 'Expiry Date'], '')),
    uom: String(readAny(allocation, ['uom', 'UOM'], '')).trim(),
    qty: asNumber(readAny(allocation, ['qty', 'Qty', 'allocatedQty', 'Allocated Qty'], '0')),
  }));

  const statusText = String(readAny(raw, ['status', 'Status'], 'Draft')).trim() as ShipmentStatus;
  const status: ShipmentStatus = ['Draft', 'Confirmed', 'Shipped', 'Cancelled'].includes(statusText)
    ? statusText
    : 'Draft';

  return {
    id: String(readAny(raw, ['id', 'ID', 'key', 'Key'], uid('DO'))).trim(),
    shipmentNo: String(readAny(raw, ['shipmentNo', 'Shipment No', 'doNo', 'DO No', 'deliveryOrderNo'], uid('DO'))).trim(),
    salesOrderNo: String(readAny(raw, ['salesOrderNo', 'Sales Order No', 'soNo', 'SO No'], '')).trim(),
    customerCode: String(readAny(raw, ['customerCode', 'Customer Code'], '')).trim(),
    customerName: String(readAny(raw, ['customerName', 'Customer Name'], '')).trim(),
    requestedShipDate: normalizeDateForInput(readAny(raw, ['requestedShipDate', 'Requested Ship Date'], '')),
    shipDate: normalizeDateForInput(readAny(raw, ['shipDate', 'Ship Date'], '')),
    status,
    remarks: String(readAny(raw, ['remarks', 'Remarks'], '')).trim(),
    lines,
    allocations,
    createdAt: String(readAny(raw, ['createdAt', 'Created At'], now)),
    updatedAt: String(readAny(raw, ['updatedAt', 'Updated At'], now)),
  };
}

/* ============================================================================
 * Allocation / AI
 * ========================================================================== */

function isInventoryEligibleForLine(inventory: InventoryItem, line: OutboundLine) {
  if (normalizeCode(inventory.productCode) !== normalizeCode(line.productCode)) return false;
  if (normalizeText(inventory.batchNo) !== normalizeText(line.batchNo)) return false;
  if (normalizeText(inventory.plant) !== normalizeText(line.plant)) return false;
  if (!sameLocationFlexible(line.location, inventory.location)) return false;
  if (!sameDateFlexible(line.expiryDate, inventory.expiryDate)) return false;
  if (line.uom && inventory.uom && normalizeCode(line.uom) !== normalizeCode(inventory.uom)) return false;
  if (inventory.status !== 'Available') return false;
  if (isExpired(inventory.expiryDate)) return false;
  if (getInventoryAvailableQty(inventory) <= 0) return false;

  return true;
}

function sortInventoryFefo(a: InventoryItem, b: InventoryItem) {
  const da = normalizeDateForInput(a.expiryDate);
  const db = normalizeDateForInput(b.expiryDate);

  if (!da && db) return 1;
  if (da && !db) return -1;
  if (da && db && da !== db) return da.localeCompare(db);

  return String(a.location || '').localeCompare(String(b.location || ''));
}

function diagnoseInventoryMismatch(line: OutboundLine, inventory: InventoryItem[]) {
  const sku = normalizeCode(line.productCode);
  const batchNo = normalizeText(line.batchNo);
  const plant = normalizeText(line.plant);
  const expiryDate = normalizeDateForInput(line.expiryDate);
  const uom = normalizeCode(line.uom);
  const requiredQty = asNumber(line.qty, 0);

  const productRows = inventory.filter((stock) => normalizeCode(stock.productCode) === sku);

  if (!productRows.length) {
    return {
      detail: `No inventory row exists for SKU ${line.productCode || '-'}.`,
      recommendation: `Create or import inventory for SKU ${line.productCode || '-'} in Inventory Management.`,
    };
  }

  const availableStatusRows = productRows.filter((stock) => stock.status === 'Available');

  if (!availableStatusRows.length) {
    const statuses = Array.from(new Set(productRows.map((stock) => stock.status || 'Unknown')));

    return {
      detail: `SKU ${line.productCode} exists, but no row is Available. Current status(es): ${statuses.join(', ')}.`,
      recommendation: `Change inventory status to Available or select another available stock row.`,
    };
  }

  const nonExpiredRows = availableStatusRows.filter((stock) => !isExpired(stock.expiryDate));

  if (!nonExpiredRows.length) {
    const expiries = Array.from(new Set(availableStatusRows.map((stock) => stock.expiryDate || '-')));

    return {
      detail: `SKU ${line.productCode} exists, but all available rows are expired. Expiry date(s): ${expiries.join(', ')}.`,
      recommendation: `Use non-expired inventory or update inventory expiry date if data is incorrect.`,
    };
  }

  const positiveQtyRows = nonExpiredRows.filter((stock) => getInventoryAvailableQty(stock) > 0);

  if (!positiveQtyRows.length) {
    return {
      detail: `SKU ${line.productCode} exists and is Available, but available quantity is zero.`,
      recommendation: `Review batchQty / availableQty / balanceQty fields in Inventory Management.`,
    };
  }

  const batchRows = positiveQtyRows.filter((stock) => normalizeText(stock.batchNo) === batchNo);

  if (!batchRows.length) {
    const batches = Array.from(new Set(positiveQtyRows.map((stock) => stock.batchNo || '-')));

    return {
      detail: `SKU ${line.productCode} exists, but Batch No does not match. Outbound Batch: ${line.batchNo || '-'}. Available Batch(es): ${batches.join(', ')}.`,
      recommendation: `Select one of the available batches or correct the outbound Batch No.`,
    };
  }

  const plantRows = batchRows.filter((stock) => normalizeText(stock.plant) === plant);

  if (!plantRows.length) {
    const plants = Array.from(new Set(batchRows.map((stock) => stock.plant || '-')));

    return {
      detail: `SKU ${line.productCode} / Batch ${line.batchNo} exists, but Plant does not match. Outbound Plant: ${line.plant || '-'}. Available Plant(s): ${plants.join(', ')}.`,
      recommendation: `Correct the outbound Plant or select inventory from the correct plant.`,
    };
  }

  const locationRows = plantRows.filter((stock) => sameLocationFlexible(line.location, stock.location));

  if (!locationRows.length) {
    const locations = Array.from(new Set(plantRows.map((stock) => stock.location || 'Blank/Flexible')));

    return {
      detail: `SKU ${line.productCode} / Batch ${line.batchNo} / Plant ${line.plant} exists, but Location does not match. Outbound Location: ${
        line.location || 'Blank/Flexible'
      }. Available Location(s): ${locations.join(', ')}.`,
      recommendation: `Leave outbound Location blank for flexible matching or select the correct inventory Location.`,
    };
  }

  const expiryRows = locationRows.filter((stock) => sameDateFlexible(line.expiryDate, stock.expiryDate));

  if (!expiryRows.length) {
    const expiries = Array.from(new Set(locationRows.map((stock) => stock.expiryDate || 'Blank/Flexible')));

    return {
      detail: `Expiry date mismatch for SKU ${line.productCode} / Batch ${line.batchNo}. Outbound Expiry: ${
        expiryDate || 'Blank/Flexible'
      }. Inventory Expiry Date(s): ${expiries.join(', ')}.`,
      recommendation: `Select inventory row directly or update outbound expiry date to match inventory expiry date. Date formats are normalized automatically.`,
    };
  }

  const uomRows = expiryRows.filter((stock) => !uom || !stock.uom || normalizeCode(stock.uom) === uom);

  if (!uomRows.length) {
    const uoms = Array.from(new Set(expiryRows.map((stock) => stock.uom || '-')));

    return {
      detail: `UOM mismatch for SKU ${line.productCode}. Outbound UOM: ${line.uom || '-'}. Inventory UOM(s): ${uoms.join(', ')}.`,
      recommendation: `Correct outbound UOM or inventory UOM.`,
    };
  }

  const totalAvailable = uomRows.reduce((sum, stock) => sum + getInventoryAvailableQty(stock), 0);

  if (totalAvailable < requiredQty) {
    return {
      detail: `Insufficient available quantity for SKU ${line.productCode}. Required: ${requiredQty.toLocaleString()} ${
        line.uom
      }, Available: ${totalAvailable.toLocaleString()} ${line.uom}.`,
      recommendation: `Reduce outbound quantity, split shipment, or replenish inventory.`,
    };
  }

  return {
    detail: `Inventory exists but did not pass all eligibility checks.`,
    recommendation: `Review SKU, Batch No, Plant, Location, Expiry Date, UOM, status, and available quantity.`,
  };
}

/**
 * Builds split allocation safely.
 * Important:
 * - It tracks remaining quantity per inventory row.
 * - It prevents over-allocation when multiple outbound lines use the same stock row.
 */
function buildAllocationSuggestions(lines: OutboundLine[], inventory: InventoryItem[]) {
  const suggestions: Allocation[] = [];
  const issues: string[] = [];

  const remainingByInventoryId = new Map<string, number>();

  inventory.forEach((stock) => {
    remainingByInventoryId.set(stock.id, getInventoryAvailableQty(stock));
  });

  lines.forEach((line) => {
    let remaining = asNumber(line.qty, 0);

    const candidates = inventory.filter((stock) => isInventoryEligibleForLine(stock, line)).sort(sortInventoryFefo);

    candidates.forEach((stock) => {
      if (remaining <= 0) return;

      const available = remainingByInventoryId.get(stock.id) ?? 0;
      const allocateQty = Math.min(remaining, available);

      if (allocateQty <= 0) return;

      suggestions.push({
        id: uid('ALLOC'),
        lineId: line.id,
        inventoryId: stock.id,
        productCode: stock.productCode,
        productName: stock.productName || line.productName,
        batchNo: stock.batchNo,
        plant: stock.plant,
        location: stock.location,
        expiryDate: stock.expiryDate,
        uom: stock.uom || line.uom,
        qty: allocateQty,
      });

      remaining -= allocateQty;
      remainingByInventoryId.set(stock.id, available - allocateQty);
    });

    if (remaining > 0) {
      issues.push(
        `${line.productCode} / Batch ${line.batchNo} / Plant ${line.plant}: shortage ${remaining.toLocaleString()} ${
          line.uom
        }`,
      );
    }
  });

  return {
    suggestions,
    issues,
  };
}

function analyzeShipment(shipment: OutboundShipment, inventory: InventoryItem[]): AiReview {
  const findings: AiFinding[] = [];
  let score = 100;

  const addFinding = (finding: AiFinding, deduction = 0) => {
    findings.push(finding);
    score -= deduction;
  };

  if (!shipment.customerCode && !shipment.customerName) {
    addFinding(
      {
        severity: 'warning',
        title: 'Missing customer information',
        detail: 'Customer Code and Customer Name are blank.',
        recommendation: 'Add customer information for shipping document traceability.',
      },
      8,
    );
  }

  if (!shipment.requestedShipDate) {
    addFinding(
      {
        severity: 'info',
        title: 'Requested ship date is blank',
        detail: 'No requested ship date is defined.',
        recommendation: 'Add requested ship date for warehouse planning.',
      },
      3,
    );
  }

  if (!shipment.lines.length) {
    addFinding(
      {
        severity: 'error',
        title: 'No outbound lines',
        detail: 'This shipment has no SKU lines.',
        recommendation: 'Add at least one outbound line before confirmation.',
      },
      40,
    );
  }

  shipment.lines.forEach((line, index) => {
    const label = `Line ${index + 1} (${line.productCode || 'No SKU'})`;

    if (!line.productCode) {
      addFinding(
        {
          severity: 'error',
          title: `${label}: Missing SKU`,
          detail: 'Product Code / SKU is required.',
          recommendation: 'Enter a valid SKU from available inventory.',
        },
        20,
      );
    }

    if (!line.batchNo) {
      addFinding(
        {
          severity: 'error',
          title: `${label}: Missing Batch No`,
          detail: 'Batch No is required for outbound inventory matching.',
          recommendation: 'Enter the batch number exactly as inventory stock.',
        },
        20,
      );
    }

    if (!line.plant) {
      addFinding(
        {
          severity: 'error',
          title: `${label}: Missing Plant`,
          detail: 'Plant is required for outbound inventory matching.',
          recommendation: 'Enter the plant code exactly as inventory stock.',
        },
        20,
      );
    }

    if (!line.uom) {
      addFinding(
        {
          severity: 'error',
          title: `${label}: Missing UOM`,
          detail: 'UOM is required.',
          recommendation: 'Enter the outbound UOM.',
        },
        10,
      );
    }

    if (!Number.isFinite(line.qty) || line.qty <= 0) {
      addFinding(
        {
          severity: 'error',
          title: `${label}: Invalid quantity`,
          detail: 'Outbound quantity must be greater than zero.',
          recommendation: 'Correct the outbound quantity.',
        },
        25,
      );
    }

    const matchingStock = inventory.filter((stock) => isInventoryEligibleForLine(stock, line));
    const available = matchingStock.reduce((sum, stock) => sum + getInventoryAvailableQty(stock), 0);

    if (line.productCode && line.batchNo && line.plant && line.qty > 0) {
      if (!matchingStock.length) {
        const diagnosis = diagnoseInventoryMismatch(line, inventory);

        addFinding(
          {
            severity: 'error',
            title: `${label}: No eligible inventory found`,
            detail: diagnosis.detail,
            recommendation: diagnosis.recommendation,
          },
          25,
        );
      } else if (available < line.qty) {
        addFinding(
          {
            severity: 'error',
            title: `${label}: Insufficient inventory`,
            detail: `Required ${line.qty.toLocaleString()} ${line.uom}, but only ${available.toLocaleString()} ${
              line.uom
            } is available.`,
            recommendation: 'Reduce outbound quantity, split shipment, replenish stock, or review inventory balance.',
          },
          25,
        );
      } else {
        const splitCount = matchingStock.length;

        addFinding(
          {
            severity: splitCount > 1 ? 'info' : 'success',
            title: `${label}: Inventory available`,
            detail: `Available matching stock: ${available.toLocaleString()} ${line.uom}. ${
              splitCount > 1 ? 'Split allocation may be used.' : 'Single-stock allocation is possible.'
            }`,
            recommendation: splitCount > 1 ? 'Use AI FEFO allocation suggestion to split qty across inventory rows.' : 'Ready to allocate.',
          },
          splitCount > 1 ? 1 : 0,
        );

        const nearestExpiry = matchingStock
          .map((stock) => daysUntilExpiry(stock.expiryDate))
          .filter((days) => days !== null) as number[];

        if (nearestExpiry.length && Math.min(...nearestExpiry) <= 90) {
          addFinding(
            {
              severity: 'warning',
              title: `${label}: Near-expiry stock involved`,
              detail: `One or more eligible inventory rows expire within ${Math.min(...nearestExpiry)} day(s).`,
              recommendation: 'Confirm customer acceptance and use FEFO picking.',
            },
            8,
          );
        }
      }
    }
  });

  const allocationResult = buildAllocationSuggestions(shipment.lines, inventory);

  allocationResult.issues.forEach((issue) => {
    addFinding(
      {
        severity: 'error',
        title: 'Allocation shortage',
        detail: issue,
        recommendation: 'Review inventory balance and matching fields before confirming shipment.',
      },
      15,
    );
  });

  if (!findings.length) {
    addFinding({
      severity: 'success',
      title: 'Shipment is ready',
      detail: 'AI did not detect blocking outbound issues.',
      recommendation: 'Confirm shipment and proceed to warehouse picking / shipping.',
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let status: AiReview['status'] = 'Ready';
  let color = 'green';

  if (findings.some((finding) => finding.severity === 'error') || score < 50) {
    status = 'Blocked';
    color = 'red';
  } else if (findings.some((finding) => finding.severity === 'warning') || score < 75) {
    status = 'Warning';
    color = 'orange';
  } else if (findings.some((finding) => finding.severity === 'info') || score < 90) {
    status = 'Monitor';
    color = 'blue';
  }

  return {
    score,
    status,
    color,
    findings,
    allocationSuggestions: allocationResult.suggestions,
  };
}

/* ============================================================================
 * CSV / Demo
 * ========================================================================== */

function buildCsv(shipments: OutboundShipment[]) {
  const lines = [CSV_HEADERS.join(',')];

  shipments.forEach((shipment) => {
    shipment.lines.forEach((line) => {
      lines.push(
        [
          shipment.shipmentNo,
          shipment.salesOrderNo || '',
          shipment.customerCode,
          shipment.customerName,
          shipment.requestedShipDate,
          line.productCode,
          line.productName,
          line.batchNo,
          line.plant,
          line.location || '',
          line.expiryDate || '',
          line.uom,
          line.qty,
          shipment.remarks || line.remarks || '',
        ]
          .map(csvEscape)
          .join(','),
      );
    });
  });

  return lines.join('\n');
}

function createDemoOutbound(): OutboundShipment[] {
  const now = new Date().toISOString();

  return [
    {
      id: uid('DO'),
      shipmentNo: 'DO-DEMO-001',
      salesOrderNo: 'SO-DEMO-001',
      customerCode: 'CUST-001',
      customerName: 'Demo Customer',
      requestedShipDate: new Date().toISOString().slice(0, 10),
      status: 'Draft',
      remarks: 'Demo outbound shipment',
      allocations: [],
      lines: [
        {
          id: uid('LINE'),
          productCode: 'DEMO-SKU-001',
          productName: 'Demo Product A',
          batchNo: 'BATCH-A001',
          plant: 'PLANT-01',
          location: '',
          expiryDate: '',
          uom: 'PCS',
          qty: 10,
          remarks: '',
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/* ============================================================================
 * Main Page
 * ========================================================================== */

export default function OutboundPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<OutboundFormValues>();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [shipments, setShipments] = useState<OutboundShipment[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingShipment, setEditingShipment] = useState<OutboundShipment | null>(null);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSelectedShipment, setAiSelectedShipment] = useState<OutboundShipment | null>(null);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const watchedFormValues = Form.useWatch([], form);
  const isViewMode = modalMode === 'view';

  useEffect(() => {
    loadShipments();
    loadInventory();
  }, []);

  function loadShipments() {
    const rows = readStorageArray<any>(OUTBOUND_STORAGE_KEY);
    const normalized = rows.map(normalizeShipment).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    setShipments(normalized);
  }

  function saveShipments(next: OutboundShipment[]) {
    localStorage.setItem(OUTBOUND_STORAGE_KEY, JSON.stringify(next));
    setShipments(next);
  }

  function loadInventory() {
    const primary = readStorageArray<any>(INVENTORY_STORAGE_KEY);
    const compat = readStorageArray<any>(INVENTORY_COMPAT_STORAGE_KEY);
    const map = new Map<string, InventoryItem>();

    [...primary, ...compat].forEach((raw) => {
      const item = normalizeInventoryItem(raw);
      if (!item.id) item.id = uid('INV');

      const key = item.id;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, item);
      } else {
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();

        map.set(key, itemTime >= existingTime ? item : existing);
      }
    });

    setInventory(Array.from(map.values()));
  }

  function saveInventory(next: InventoryItem[]) {
    const persisted = next.map(toPersistedInventoryRecord);

    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(persisted));
    localStorage.setItem(INVENTORY_COMPAT_STORAGE_KEY, JSON.stringify(persisted));

    setInventory(next);
  }

  function addMovementLogs(logs: any[]) {
    const existing = readStorageArray<any>(MOVEMENT_LOG_KEY);
    localStorage.setItem(MOVEMENT_LOG_KEY, JSON.stringify([...logs, ...existing]));
  }

  const skuOptions = useMemo(() => {
    const map = new Map<string, any>();

    inventory.forEach((item) => {
      if (!item.productCode) return;

      map.set(item.productCode, {
        value: item.productCode,
        label: item.productName ? `${item.productCode} - ${item.productName}` : item.productCode,
        raw: item,
      });
    });

    return Array.from(map.values());
  }, [inventory]);

  const batchOptions = useMemo(() => {
    return inventory
      .filter((item) => item.batchNo)
      .map((item) => ({
        value: item.batchNo,
        label: `${item.batchNo} · ${item.productCode} · ${item.plant} · ${item.location || 'No Location'} · ${getInventoryAvailableQty(
          item,
        )} ${item.uom}`,
      }));
  }, [inventory]);

  const plantOptions = useMemo(() => {
    const values = new Set<string>();

    inventory.forEach((item) => item.plant && values.add(item.plant));

    return Array.from(values).map((value) => ({
      value,
      label: value,
    }));
  }, [inventory]);

  const locationOptions = useMemo(() => {
    const values = new Set<string>();

    inventory.forEach((item) => item.location && values.add(item.location));

    return Array.from(values).map((value) => ({
      value,
      label: value,
    }));
  }, [inventory]);

  const filteredShipments = useMemo(() => {
    return shipments.filter((shipment) => {
      const haystack = [
        shipment.shipmentNo,
        shipment.salesOrderNo,
        shipment.customerCode,
        shipment.customerName,
        shipment.status,
        shipment.remarks,
        ...shipment.lines.flatMap((line) => [
          line.productCode,
          line.productName,
          line.batchNo,
          line.plant,
          line.location,
          line.expiryDate,
          line.uom,
        ]),
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = !searchText || haystack.includes(searchText.toLowerCase());
      const matchesStatus = statusFilter === 'All' || shipment.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [shipments, searchText, statusFilter]);

  const summary = useMemo(() => {
    const total = shipments.length;
    const draft = shipments.filter((shipment) => shipment.status === 'Draft').length;
    const confirmed = shipments.filter((shipment) => shipment.status === 'Confirmed').length;
    const shipped = shipments.filter((shipment) => shipment.status === 'Shipped').length;
    const cancelled = shipments.filter((shipment) => shipment.status === 'Cancelled').length;
    const totalQty = shipments.reduce(
      (sum, shipment) => sum + shipment.lines.reduce((lineSum, line) => lineSum + asNumber(line.qty, 0), 0),
      0,
    );

    return {
      total,
      draft,
      confirmed,
      shipped,
      cancelled,
      totalQty,
    };
  }, [shipments]);

  const aiByShipmentId = useMemo(() => {
    const map = new Map<string, AiReview>();

    shipments.forEach((shipment) => {
      map.set(shipment.id, analyzeShipment(shipment, inventory));
    });

    return map;
  }, [shipments, inventory]);

  const aiSummary = useMemo(() => {
    const reviews = Array.from(aiByShipmentId.values());
    const avgScore = reviews.length ? Math.round(reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length) : 100;

    return {
      avgScore,
      ready: reviews.filter((review) => review.status === 'Ready').length,
      monitor: reviews.filter((review) => review.status === 'Monitor').length,
      warning: reviews.filter((review) => review.status === 'Warning').length,
      blocked: reviews.filter((review) => review.status === 'Blocked').length,
    };
  }, [aiByShipmentId]);

  const aiFormPreview = useMemo(() => {
    if (!modalOpen || !watchedFormValues) return null;

    const now = new Date().toISOString();

    const preview: OutboundShipment = {
      id: editingShipment?.id || 'AI-PREVIEW',
      shipmentNo: watchedFormValues.shipmentNo || 'NEW',
      salesOrderNo: watchedFormValues.salesOrderNo || '',
      customerCode: watchedFormValues.customerCode || '',
      customerName: watchedFormValues.customerName || '',
      requestedShipDate: normalizeDateForInput(watchedFormValues.requestedShipDate),
      status: editingShipment?.status || 'Draft',
      remarks: watchedFormValues.remarks || '',
      allocations: editingShipment?.allocations || [],
      lines: (watchedFormValues.lines || []).map((line, index) => ({
        id: editingShipment?.lines?.[index]?.id || `PREVIEW-${index}`,
        productCode: String(line.productCode || '').trim(),
        productName: String(line.productName || '').trim(),
        batchNo: String(line.batchNo || '').trim(),
        plant: String(line.plant || '').trim(),
        location: String(line.location || '').trim(),
        expiryDate: normalizeDateForInput(line.expiryDate),
        uom: String(line.uom || 'PCS').trim(),
        qty: asNumber(line.qty, 0),
        remarks: String(line.remarks || '').trim(),
      })),
      createdAt: editingShipment?.createdAt || now,
      updatedAt: now,
    };

    return analyzeShipment(preview, inventory);
  }, [modalOpen, watchedFormValues, editingShipment, inventory]);

  function openCreateModal() {
    setModalMode('create');
    setEditingShipment(null);

    form.resetFields();
    form.setFieldsValue({
      shipmentNo: `DO-${Date.now()}`,
      salesOrderNo: '',
      customerCode: '',
      customerName: '',
      requestedShipDate: new Date().toISOString().slice(0, 10),
      remarks: '',
      lines: [
        {
          productCode: '',
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

  function openEditModal(shipment: OutboundShipment) {
    if (shipment.status === 'Shipped' || shipment.status === 'Cancelled') {
      messageApi.warning('Shipped or Cancelled shipment cannot be edited');
      return;
    }

    setModalMode('edit');
    setEditingShipment(shipment);

    form.setFieldsValue({
      shipmentNo: shipment.shipmentNo,
      salesOrderNo: shipment.salesOrderNo || '',
      customerCode: shipment.customerCode,
      customerName: shipment.customerName,
      requestedShipDate: shipment.requestedShipDate,
      remarks: shipment.remarks || '',
      lines: shipment.lines.map((line) => ({
        productCode: line.productCode,
        productName: line.productName,
        batchNo: line.batchNo,
        plant: line.plant,
        location: line.location || '',
        expiryDate: line.expiryDate || '',
        uom: line.uom,
        qty: line.qty,
        remarks: line.remarks || '',
      })),
    });

    setModalOpen(true);
  }

  function openViewModal(shipment: OutboundShipment) {
    setModalMode('view');
    setEditingShipment(shipment);

    form.setFieldsValue({
      shipmentNo: shipment.shipmentNo,
      salesOrderNo: shipment.salesOrderNo || '',
      customerCode: shipment.customerCode,
      customerName: shipment.customerName,
      requestedShipDate: shipment.requestedShipDate,
      remarks: shipment.remarks || '',
      lines: shipment.lines.map((line) => ({
        productCode: line.productCode,
        productName: line.productName,
        batchNo: line.batchNo,
        plant: line.plant,
        location: line.location || '',
        expiryDate: line.expiryDate || '',
        uom: line.uom,
        qty: line.qty,
        remarks: line.remarks || '',
      })),
    });

    setModalOpen(true);
  }

  function handleSkuSelect(value: string, fieldName: number) {
    const lines = form.getFieldValue('lines') || [];
    const currentLine = lines[fieldName] || {};

    const candidates = inventory
      .filter((item) => normalizeCode(item.productCode) === normalizeCode(value))
      .filter((item) => item.status === 'Available')
      .filter((item) => !isExpired(item.expiryDate))
      .filter((item) => getInventoryAvailableQty(item) > 0)
      .sort(sortInventoryFefo);

    const preferredStock =
      candidates.find((item) => {
        const batchOk = !currentLine.batchNo || normalizeText(item.batchNo) === normalizeText(currentLine.batchNo);
        const plantOk = !currentLine.plant || normalizeText(item.plant) === normalizeText(currentLine.plant);

        return batchOk && plantOk;
      }) || candidates[0];

    const stock = preferredStock || inventory.find((item) => normalizeCode(item.productCode) === normalizeCode(value));

    if (!stock) return;

    lines[fieldName] = {
      ...currentLine,
      productCode: stock.productCode,
      productName: stock.productName,
      batchNo: stock.batchNo,
      plant: stock.plant,
      location: stock.location || '',
      expiryDate: normalizeDateForInput(stock.expiryDate),
      uom: stock.uom || currentLine.uom || 'PCS',
    };

    form.setFieldsValue({ lines });

    messageApi.success(`Inventory auto-filled for ${stock.productCode}: Batch, Plant, Location, Expiry Date and UOM.`);
  }

  function handleBatchSelect(value: string, fieldName: number) {
    const lines = form.getFieldValue('lines') || [];
    const currentLine = lines[fieldName] || {};

    const candidates = inventory
      .filter((item) => normalizeText(item.batchNo) === normalizeText(value))
      .filter((item) => {
        if (!currentLine.productCode) return true;
        return normalizeCode(item.productCode) === normalizeCode(currentLine.productCode);
      })
      .filter((item) => {
        if (!currentLine.plant) return true;
        return normalizeText(item.plant) === normalizeText(currentLine.plant);
      })
      .filter((item) => item.status === 'Available')
      .filter((item) => !isExpired(item.expiryDate))
      .filter((item) => getInventoryAvailableQty(item) > 0)
      .sort(sortInventoryFefo);

    const stock = candidates[0] || inventory.find((item) => normalizeText(item.batchNo) === normalizeText(value));

    if (!stock) return;

    lines[fieldName] = {
      ...currentLine,
      productCode: stock.productCode,
      productName: stock.productName,
      batchNo: stock.batchNo,
      plant: stock.plant,
      location: stock.location || '',
      expiryDate: normalizeDateForInput(stock.expiryDate),
      uom: stock.uom || currentLine.uom || 'PCS',
    };

    form.setFieldsValue({ lines });

    messageApi.success('Batch selected from inventory. Plant, Location, Expiry Date and UOM were auto-filled.');
  }

  async function handleSave() {
    if (isViewMode) {
      setModalOpen(false);
      return;
    }

    const values = await form.validateFields();
    const now = new Date().toISOString();

    const lineItems: OutboundLine[] = (values.lines || []).map((line, index) => ({
      id: editingShipment?.lines?.[index]?.id || uid('LINE'),
      productCode: String(line.productCode || '').trim(),
      productName: String(line.productName || '').trim(),
      batchNo: String(line.batchNo || '').trim(),
      plant: String(line.plant || '').trim(),
      location: String(line.location || '').trim(),
      expiryDate: normalizeDateForInput(line.expiryDate),
      uom: String(line.uom || 'PCS').trim(),
      qty: asNumber(line.qty, 0),
      remarks: String(line.remarks || '').trim(),
    }));

    const allocationPreview = buildAllocationSuggestions(lineItems, inventory);

    const shipment: OutboundShipment = {
      id: editingShipment?.id || uid('DO'),
      shipmentNo: String(values.shipmentNo || '').trim(),
      salesOrderNo: String(values.salesOrderNo || '').trim(),
      customerCode: String(values.customerCode || '').trim(),
      customerName: String(values.customerName || '').trim(),
      requestedShipDate: normalizeDateForInput(values.requestedShipDate),
      status: editingShipment?.status || 'Draft',
      remarks: String(values.remarks || '').trim(),
      allocations: editingShipment?.status === 'Confirmed' ? allocationPreview.suggestions : editingShipment?.allocations || [],
      lines: lineItems,
      createdAt: editingShipment?.createdAt || now,
      updatedAt: now,
    };

    const review = analyzeShipment(shipment, inventory);

    if (review.findings.some((finding) => finding.severity === 'error')) {
      Modal.error({
        title: 'Outbound validation failed',
        width: 760,
        content: (
          <div>
            <p>Please fix these blocking issues before saving:</p>
            <ul style={{ paddingLeft: 20 }}>
              {review.findings
                .filter((finding) => finding.severity === 'error')
                .slice(0, 20)
                .map((finding) => (
                  <li key={`${finding.title}-${finding.detail}`}>
                    <b>{finding.title}</b>: {finding.detail}
                    <br />
                    <Text type="secondary">Recommendation: {finding.recommendation}</Text>
                  </li>
                ))}
            </ul>
          </div>
        ),
      });

      return;
    }

    const duplicate = shipments.find(
      (existing) => existing.id !== shipment.id && normalizeText(existing.shipmentNo) === normalizeText(shipment.shipmentNo),
    );

    if (duplicate) {
      Modal.warning({
        title: 'Duplicate Shipment No',
        content: 'Another outbound shipment already uses this Shipment No.',
      });

      return;
    }

    const next =
      modalMode === 'edit'
        ? shipments.map((existing) => (existing.id === shipment.id ? shipment : existing))
        : [shipment, ...shipments];

    saveShipments(next);
    setModalOpen(false);

    messageApi.success(modalMode === 'edit' ? 'Outbound shipment updated' : 'Outbound shipment created');
  }

  function handleDuplicate(shipment: OutboundShipment) {
    const now = new Date().toISOString();

    const duplicated: OutboundShipment = {
      ...shipment,
      id: uid('DO'),
      shipmentNo: `${shipment.shipmentNo}-COPY`,
      status: 'Draft',
      shipDate: '',
      allocations: [],
      lines: shipment.lines.map((line) => ({
        ...line,
        id: uid('LINE'),
      })),
      createdAt: now,
      updatedAt: now,
    };

    saveShipments([duplicated, ...shipments]);
    messageApi.success('Outbound shipment duplicated');
  }

  function handleDelete(shipment: OutboundShipment) {
    if (shipment.status === 'Shipped') {
      messageApi.error('Shipped shipment cannot be deleted');
      return;
    }

    saveShipments(shipments.filter((existing) => existing.id !== shipment.id));
    messageApi.success('Outbound shipment deleted');
  }

  function handleCancelShipment(shipment: OutboundShipment) {
    if (shipment.status === 'Shipped') {
      messageApi.error('Shipped shipment cannot be cancelled');
      return;
    }

    const now = new Date().toISOString();

    const next = shipments.map((existing) =>
      existing.id === shipment.id
        ? {
            ...existing,
            status: 'Cancelled' as ShipmentStatus,
            updatedAt: now,
          }
        : existing,
    );

    saveShipments(next);
    messageApi.success('Shipment cancelled');
  }

  function handleConfirmShipment(shipment: OutboundShipment) {
    if (shipment.status !== 'Draft') {
      messageApi.warning('Only Draft shipment can be confirmed');
      return;
    }

    const review = analyzeShipment(shipment, inventory);

    if (review.status === 'Blocked') {
      Modal.error({
        title: 'AI blocked confirmation',
        width: 760,
        content: (
          <div>
            <p>Shipment cannot be confirmed because AI found blocking issues:</p>
            <ul style={{ paddingLeft: 20 }}>
              {review.findings
                .filter((finding) => finding.severity === 'error')
                .map((finding) => (
                  <li key={`${finding.title}-${finding.detail}`}>
                    <b>{finding.title}</b>: {finding.detail}
                    <br />
                    <Text type="secondary">Recommendation: {finding.recommendation}</Text>
                  </li>
                ))}
            </ul>
          </div>
        ),
      });

      return;
    }

    const allocationResult = buildAllocationSuggestions(shipment.lines, inventory);

    if (allocationResult.issues.length) {
      Modal.error({
        title: 'Allocation shortage',
        content: (
          <ul style={{ paddingLeft: 20 }}>
            {allocationResult.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ),
      });

      return;
    }

    const now = new Date().toISOString();

    const next = shipments.map((existing) =>
      existing.id === shipment.id
        ? {
            ...existing,
            status: 'Confirmed' as ShipmentStatus,
            allocations: allocationResult.suggestions,
            updatedAt: now,
          }
        : existing,
    );

    saveShipments(next);
    messageApi.success('Shipment confirmed with AI allocation');
  }

  function handleShipShipment(shipment: OutboundShipment) {
    if (shipment.status === 'Shipped') {
      messageApi.warning('Shipment already shipped');
      return;
    }

    if (shipment.status === 'Cancelled') {
      messageApi.error('Cancelled shipment cannot be shipped');
      return;
    }

    const allocationResult =
      shipment.allocations && shipment.allocations.length
        ? { suggestions: shipment.allocations, issues: [] as string[] }
        : buildAllocationSuggestions(shipment.lines, inventory);

    if (allocationResult.issues.length) {
      Modal.error({
        title: 'Cannot ship due to allocation shortage',
        content: (
          <ul style={{ paddingLeft: 20 }}>
            {allocationResult.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ),
      });

      return;
    }

    const allocations = allocationResult.suggestions;

    if (!allocations.length) {
      Modal.error({
        title: 'No allocation found',
        content: 'This shipment has no valid allocation rows. Please confirm allocation before shipping.',
      });

      return;
    }

    const requiredByInventoryId = new Map<string, number>();

    allocations.forEach((allocation) => {
      requiredByInventoryId.set(
        allocation.inventoryId,
        (requiredByInventoryId.get(allocation.inventoryId) || 0) + asNumber(allocation.qty, 0),
      );
    });

    for (const [inventoryId, requiredQty] of requiredByInventoryId.entries()) {
      const stock = inventory.find((item) => item.id === inventoryId);

      if (!stock) {
        Modal.error({
          title: 'Inventory row missing',
          content: `Inventory ID ${inventoryId} no longer exists.`,
        });

        return;
      }

      if (stock.status !== 'Available' || isExpired(stock.expiryDate)) {
        Modal.error({
          title: 'Inventory no longer available',
          content: `${stock.productCode} / ${stock.batchNo} is no longer Available or is expired.`,
        });

        return;
      }

      const liveAvailable = getInventoryAvailableQty(stock);

      if (liveAvailable < requiredQty) {
        Modal.error({
          title: 'Inventory balance changed',
          content: `${stock.productCode} / ${stock.batchNo} has only ${liveAvailable} ${stock.uom}, but shipment needs ${requiredQty}.`,
        });

        return;
      }
    }

    const now = new Date().toISOString();
    const shipDate = new Date().toISOString().slice(0, 10);

    const nextInventory = inventory.map((stock) => {
      const qtyToDeduct = requiredByInventoryId.get(stock.id) || 0;

      if (qtyToDeduct <= 0) return stock;

      const nextAvailableQty = Math.max(0, getInventoryAvailableQty(stock) - qtyToDeduct);
      const nextBatchQty = Math.max(0, asNumber(stock.batchQty, getInventoryAvailableQty(stock)) - qtyToDeduct);

      return {
        ...stock,
        batchQty: nextBatchQty,
        availableQty: nextAvailableQty,
        updatedAt: now,
      };
    });

    const movementLogs = allocations.map((allocation) => {
      const beforeStock = inventory.find((item) => item.id === allocation.inventoryId);
      const beforeAvailable = getInventoryAvailableQty(beforeStock);
      const afterAvailable = Math.max(0, beforeAvailable - allocation.qty);

      return {
        id: uid('MOVE'),
        type: 'OUTBOUND_SHIPMENT',
        direction: 'OUT',
        referenceNo: shipment.shipmentNo,
        shipmentId: shipment.id,
        shipmentNo: shipment.shipmentNo,
        inventoryId: allocation.inventoryId,
        productCode: allocation.productCode,
        sku: allocation.productCode,
        productName: allocation.productName,
        batchNo: allocation.batchNo,
        plant: allocation.plant,
        location: allocation.location,
        expiryDate: allocation.expiryDate,
        uom: allocation.uom,
        qty: allocation.qty,
        beforeQty: beforeAvailable,
        afterQty: afterAvailable,
        createdAt: now,
        remarks: `Outbound shipped ${allocation.qty} ${allocation.uom} for ${shipment.shipmentNo}`,
      };
    });

    const nextShipments = shipments.map((existing) =>
      existing.id === shipment.id
        ? {
            ...existing,
            status: 'Shipped' as ShipmentStatus,
            allocations,
            shipDate,
            updatedAt: now,
          }
        : existing,
    );

    saveInventory(nextInventory);
    addMovementLogs(movementLogs);
    saveShipments(nextShipments);

    messageApi.success('Shipment shipped and inventory deducted');
  }

  function openAiModal(shipment: OutboundShipment | null = null) {
    setAiSelectedShipment(shipment);
    setAiModalOpen(true);
  }

  function handleExport() {
    downloadFile(`outbound-export-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(filteredShipments));
  }

  function handleDownloadTemplate() {
    const sample = [
      CSV_HEADERS.join(','),
      [
        'DO-SAMPLE-001',
        'SO-SAMPLE-001',
        'CUST-001',
        'Sample Customer',
        new Date().toISOString().slice(0, 10),
        'DEMO-SKU-001',
        'Demo Product A',
        'BATCH-A001',
        'PLANT-01',
        '',
        '',
        'PCS',
        '10',
        'Sample import row',
      ]
        .map(csvEscape)
        .join(','),
    ].join('\n');

    downloadFile('outbound-import-template.csv', sample);
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
        messageApi.warning('CSV file has no data rows');
        return;
      }

      const grouped = new Map<string, OutboundShipment>();
      const now = new Date().toISOString();

      objects.forEach((obj) => {
        const shipmentNo = String(readAny(obj, ['Shipment No', 'shipmentNo'], '')).trim() || `DO-${Date.now()}`;
        const line = normalizeOutboundLine(obj);

        if (!grouped.has(shipmentNo)) {
          grouped.set(shipmentNo, {
            id: uid('DO'),
            shipmentNo,
            salesOrderNo: String(readAny(obj, ['Sales Order No', 'salesOrderNo'], '')).trim(),
            customerCode: String(readAny(obj, ['Customer Code', 'customerCode'], '')).trim(),
            customerName: String(readAny(obj, ['Customer Name', 'customerName'], '')).trim(),
            requestedShipDate: normalizeDateForInput(readAny(obj, ['Requested Ship Date', 'requestedShipDate'], '')),
            status: 'Draft',
            remarks: String(readAny(obj, ['Remarks', 'remarks'], '')).trim(),
            lines: [],
            allocations: [],
            createdAt: now,
            updatedAt: now,
          });
        }

        grouped.get(shipmentNo)!.lines.push({
          ...line,
          id: uid('LINE'),
        });
      });

      const imported = Array.from(grouped.values());
      const invalid: string[] = [];

      imported.forEach((shipment) => {
        const review = analyzeShipment(shipment, inventory);
        const errors = review.findings.filter((finding) => finding.severity === 'error');

        if (errors.length) {
          invalid.push(`${shipment.shipmentNo}: ${errors.map((error) => error.title).join(', ')}`);
        }
      });

      if (invalid.length) {
        Modal.error({
          title: 'CSV import validation failed',
          width: 760,
          content: (
            <div>
              <p>Please fix these shipments and import again:</p>
              <ul style={{ paddingLeft: 20 }}>
                {invalid.slice(0, 20).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ),
        });

        return;
      }

      const map = new Map<string, OutboundShipment>();

      shipments.forEach((shipment) => {
        map.set(normalizeText(shipment.shipmentNo), shipment);
      });

      let inserted = 0;
      let updated = 0;

      imported.forEach((shipment) => {
        const key = normalizeText(shipment.shipmentNo);
        const existing = map.get(key);

        if (existing && existing.status !== 'Shipped') {
          map.set(key, {
            ...shipment,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: now,
          });

          updated += 1;
        } else {
          map.set(key, shipment);
          inserted += 1;
        }
      });

      const next = Array.from(map.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

      saveShipments(next);
      messageApi.success(`Import completed. Inserted: ${inserted}, Updated: ${updated}`);
    } catch (error: any) {
      console.error(error);
      messageApi.error(error?.message || 'Failed to import CSV');
    } finally {
      event.target.value = '';
    }
  }

  function handleLoadDemo() {
    if (shipments.length > 0) {
      messageApi.warning('Demo outbound can only be loaded when shipment list is empty');
      return;
    }

    saveShipments(createDemoOutbound());
    messageApi.success('Demo outbound shipment loaded');
  }

  const columns: ColumnsType<OutboundShipment> = [
    {
      title: 'Shipment No',
      dataIndex: 'shipmentNo',
      key: 'shipmentNo',
      width: 180,
      fixed: 'left',
      render: (value, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          {record.salesOrderNo && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              SO: {record.salesOrderNo}
            </Text>
          )}
        </Space>
      ),
      sorter: (a, b) => a.shipmentNo.localeCompare(b.shipmentNo),
    },
    {
      title: 'Customer',
      key: 'customer',
      width: 240,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.customerName || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.customerCode || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Requested Ship Date',
      dataIndex: 'requestedShipDate',
      key: 'requestedShipDate',
      width: 160,
      render: (value) => value || '-',
      sorter: (a, b) => String(a.requestedShipDate || '').localeCompare(String(b.requestedShipDate || '')),
    },
    {
      title: 'Lines',
      key: 'lines',
      width: 100,
      align: 'right',
      render: (_, record) => record.lines.length,
    },
    {
      title: 'Total Qty',
      key: 'totalQty',
      width: 130,
      align: 'right',
      render: (_, record) => record.lines.reduce((sum, line) => sum + asNumber(line.qty, 0), 0).toLocaleString(),
    },
    {
      title: 'Allocated Qty',
      key: 'allocatedQty',
      width: 140,
      align: 'right',
      render: (_, record) => record.allocations.reduce((sum, allocation) => sum + asNumber(allocation.qty, 0), 0).toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: ShipmentStatus) => <Tag color={shipmentStatusColor(status)}>{status}</Tag>,
      sorter: (a, b) => a.status.localeCompare(b.status),
    },
    {
      title: 'AI',
      key: 'ai',
      width: 145,
      render: (_, record) => {
        const review = aiByShipmentId.get(record.id);

        if (!review) return '-';

        return (
          <Tooltip title={`AI Score: ${review.score}/100`}>
            <Tag color={review.color} icon={<RobotOutlined />} style={{ cursor: 'pointer' }} onClick={() => openAiModal(record)}>
              {review.status} {review.score}
            </Tag>
          </Tooltip>
        );
      },
      sorter: (a, b) => (aiByShipmentId.get(a.id)?.score || 0) - (aiByShipmentId.get(b.id)?.score || 0),
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
      width: 360,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Tooltip title="View">
            <Button icon={<EyeOutlined />} size="small" onClick={() => openViewModal(record)} />
          </Tooltip>

          <Tooltip title="AI Review">
            <Button icon={<RobotOutlined />} size="small" onClick={() => openAiModal(record)} />
          </Tooltip>

          <Tooltip title="Edit">
            <Button
              icon={<EditOutlined />}
              size="small"
              type="primary"
              disabled={record.status === 'Shipped' || record.status === 'Cancelled'}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>

          <Tooltip title="Duplicate">
            <Button icon={<CopyOutlined />} size="small" onClick={() => handleDuplicate(record)} />
          </Tooltip>

          <Tooltip title="Confirm / Allocate">
            <Button icon={<FileDoneOutlined />} size="small" disabled={record.status !== 'Draft'} onClick={() => handleConfirmShipment(record)} />
          </Tooltip>

          <Tooltip title="Ship and deduct inventory">
            <Button
              icon={<SendOutlined />}
              size="small"
              type="primary"
              disabled={record.status === 'Shipped' || record.status === 'Cancelled'}
              onClick={() => handleShipShipment(record)}
            />
          </Tooltip>

          <Popconfirm
            title="Cancel shipment?"
            okText="Cancel shipment"
            okButtonProps={{ danger: true }}
            disabled={record.status === 'Shipped' || record.status === 'Cancelled'}
            onConfirm={() => handleCancelShipment(record)}
          >
            <Tooltip title="Cancel">
              <Button icon={<CloseCircleOutlined />} size="small" danger disabled={record.status === 'Shipped' || record.status === 'Cancelled'} />
            </Tooltip>
          </Popconfirm>

          <Popconfirm
            title="Delete shipment?"
            description="This action cannot be undone."
            okText="Delete"
            okButtonProps={{ danger: true }}
            disabled={record.status === 'Shipped'}
            onConfirm={() => handleDelete(record)}
          >
            <Tooltip title="Delete">
              <Button icon={<DeleteOutlined />} size="small" danger disabled={record.status === 'Shipped'} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const selectedAiReview = aiSelectedShipment ? analyzeShipment(aiSelectedShipment, inventory) : null;

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}

      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            🚚 Outbound Shipments
          </Title>
          <Text type="secondary">Create, validate, allocate, confirm, and ship outbound transactions using live Inventory Management stock.</Text>
        </div>

        <Alert
          type="info"
          showIcon
          title="Inventory-based outbound matching"
          description="Outbound allocation matches Inventory only using SKU + Batch No + Plant as required fields. Location and Expiry Date are flexible when blank. Shipping deducts only allocated outbound qty and supports split allocation across multiple inventory rows."
        />

        <Alert
          type={aiSummary.blocked > 0 ? 'error' : aiSummary.warning > 0 ? 'warning' : 'success'}
          showIcon
          icon={<RobotOutlined />}
          title="AI Outbound Assistant"
          description={`AI reviewed ${shipments.length.toLocaleString()} shipments. Average score ${aiSummary.avgScore}/100. Ready: ${
            aiSummary.ready
          }, Monitor: ${aiSummary.monitor}, Warning: ${aiSummary.warning}, Blocked: ${aiSummary.blocked}.`}
          action={
            <Button icon={<RobotOutlined />} onClick={() => openAiModal(null)}>
              AI Dashboard
            </Button>
          }
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Total Shipments" value={summary.total} prefix={<ShoppingCartOutlined />} />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
  <Card>
    <Statistic
      title="Draft"
      value={summary.draft}
      styles={{
        content: {
          color: '#8c8c8c',
        },
      }}
    />
  </Card>
</Col>

         <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Confirmed"
                value={summary.confirmed}
                styles={{
                content: {
                  color: '#1677ff',
                 },
                }}
              />
            </Card>
          </Col>


          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Shipped"
                value={summary.shipped}
                styles={{
                  content: {
                 color: '#389e0d'
               },
              }}
             />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">Total Qty: </Text>
              <Text strong>{summary.totalQty.toLocaleString()}</Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">Cancelled: </Text>
              <Text strong style={{ color: '#cf1322' }}>
                {summary.cancelled}
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">AI Avg Score: </Text>
              <Text strong>{aiSummary.avgScore}/100</Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Text type="secondary">Inventory Rows: </Text>
              <Text strong>{inventory.length.toLocaleString()}</Text>
            </Card>
          </Col>
        </Row>

        <Card>
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Row gutter={[12, 12]} justify="space-between">
              <Col xs={24} lg={16}>
                <Space wrap>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                    Create Outbound
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

                  <Button icon={<ReloadOutlined />} onClick={loadInventory}>
                    Reload Inventory
                  </Button>

                  <Button icon={<RobotOutlined />} onClick={() => openAiModal(null)}>
                    AI Dashboard
                  </Button>

                  {shipments.length === 0 && (
                    <Button icon={<InboxOutlined />} onClick={handleLoadDemo}>
                      Load Demo
                    </Button>
                  )}
                </Space>

                <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleImportFile} />
              </Col>

              <Col xs={24} lg={8}>
                <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="Search shipment, customer, SKU, batch..."
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    style={{ width: 300 }}
                  />

                  <Button icon={<ReloadOutlined />} onClick={loadShipments}>
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
                    { value: 'Draft', label: 'Draft' },
                    { value: 'Confirmed', label: 'Confirmed' },
                    { value: 'Shipped', label: 'Shipped' },
                    { value: 'Cancelled', label: 'Cancelled' },
                  ]}
                />
              </Col>

              <Col xs={24} md={16}>
                <Text type="secondary">
                  Showing {filteredShipments.length.toLocaleString()} of {shipments.length.toLocaleString()} shipments
                </Text>
              </Col>
            </Row>

            <Table
              rowKey="id"
              columns={columns}
              dataSource={filteredShipments}
              scroll={{ x: 1900 }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `${total} shipments`,
              }}
              locale={{
                emptyText: <Empty description="No outbound shipment found" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
              expandable={{
                expandedRowRender: (record) => (
                  <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={record.lines}
                      columns={[
                        { title: 'SKU', dataIndex: 'productCode' },
                        { title: 'Product', dataIndex: 'productName' },
                        { title: 'Batch No', dataIndex: 'batchNo' },
                        { title: 'Plant', dataIndex: 'plant' },
                        { title: 'Location', dataIndex: 'location', render: (v) => v || <Text type="secondary">Flexible</Text> },
                        { title: 'Expiry', dataIndex: 'expiryDate', render: (v) => v || <Text type="secondary">Flexible</Text> },
                        { title: 'UOM', dataIndex: 'uom' },
                        { title: 'Qty', dataIndex: 'qty', align: 'right' as const },
                      ]}
                    />

                    {record.allocations.length > 0 && (
                      <>
                        <Text strong>Allocations</Text>

                        <Table
                          rowKey="id"
                          size="small"
                          pagination={false}
                          dataSource={record.allocations}
                          columns={[
                            { title: 'Inventory ID', dataIndex: 'inventoryId' },
                            { title: 'SKU', dataIndex: 'productCode' },
                            { title: 'Batch No', dataIndex: 'batchNo' },
                            { title: 'Plant', dataIndex: 'plant' },
                            { title: 'Location', dataIndex: 'location' },
                            { title: 'Expiry', dataIndex: 'expiryDate' },
                            { title: 'UOM', dataIndex: 'uom' },
                            { title: 'Allocated Qty', dataIndex: 'qty', align: 'right' as const },
                          ]}
                        />
                      </>
                    )}
                  </Space>
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
        title={modalMode === 'create' ? 'Create Outbound Shipment' : modalMode === 'edit' ? 'Edit Outbound Shipment' : 'View Outbound Shipment'}
        okText={isViewMode ? 'Close' : 'Save'}
        cancelText={isViewMode ? undefined : 'Cancel'}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
      >
        <Divider />

        {editingShipment && (
          <Descriptions size="small" bordered column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Status">
              <Tag color={shipmentStatusColor(editingShipment.status)}>{editingShipment.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Ship Date">{editingShipment.shipDate || '-'}</Descriptions.Item>
            <Descriptions.Item label="Created At">{editingShipment.createdAt ? new Date(editingShipment.createdAt).toLocaleString() : '-'}</Descriptions.Item>
            <Descriptions.Item label="Updated At">{editingShipment.updatedAt ? new Date(editingShipment.updatedAt).toLocaleString() : '-'}</Descriptions.Item>
          </Descriptions>
        )}

        {aiFormPreview && (
          <Alert
            style={{ marginBottom: 16 }}
            type={aiFormPreview.status === 'Blocked' ? 'error' : aiFormPreview.status === 'Warning' ? 'warning' : 'info'}
            showIcon
            icon={<RobotOutlined />}
            title={`AI Readiness Preview: ${aiFormPreview.status} · Score ${aiFormPreview.score}/100`}
            description={
              <Space orientation="vertical" size={4}>
                {aiFormPreview.findings.slice(0, 4).map((finding) => (
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
            requestedShipDate: new Date().toISOString().slice(0, 10),
            lines: [
              {
                uom: 'PCS',
                qty: 1,
              },
            ],
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Shipment No" name="shipmentNo" rules={[{ required: true, message: 'Shipment No is required' }]}>
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Sales Order No" name="salesOrderNo">
                <Input placeholder="Optional SO reference" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Requested Ship Date" name="requestedShipDate" rules={[{ required: true, message: 'Requested Ship Date is required' }]}>
                <Input type="date" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Customer Code" name="customerCode">
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} md={16}>
              <Form.Item label="Customer Name" name="customerName">
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Remarks" name="remarks">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left">Outbound Lines</Divider>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`Line ${index + 1}`}
                    extra={
                      !isViewMode && fields.length > 1 ? (
                        <Button danger size="small" onClick={() => remove(field.name)}>
                          Remove
                        </Button>
                      ) : null
                    }
                  >
                    <Row gutter={12}>
                      <Col xs={24} md={8}>
                        <Form.Item label="SKU / Product Code" name={[field.name, 'productCode']} rules={[{ required: true, message: 'SKU is required' }]}>
                          <AutoComplete
                            allowClear
                            virtual={false}
                            options={skuOptions}
                            placeholder="Select SKU from inventory"
                            onSelect={(value) => handleSkuSelect(value, field.name)}
                            filterOption={(inputValue, option) =>
                              normalizeText(option?.label).includes(normalizeText(inputValue)) ||
                              normalizeText(option?.value).includes(normalizeText(inputValue))
                            }
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item label="Product Name" name={[field.name, 'productName']}>
                          <Input />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item label="Batch No" name={[field.name, 'batchNo']} rules={[{ required: true, message: 'Batch No is required' }]}>
                          <AutoComplete
                            allowClear
                            virtual={false}
                            options={batchOptions}
                            placeholder="Batch No"
                            onSelect={(value) => handleBatchSelect(value, field.name)}
                            filterOption={(inputValue, option) =>
                              normalizeText(option?.label).includes(normalizeText(inputValue)) ||
                              normalizeText(option?.value).includes(normalizeText(inputValue))
                            }
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item label="Plant" name={[field.name, 'plant']} rules={[{ required: true, message: 'Plant is required' }]}>
                          <AutoComplete
                            allowClear
                            virtual={false}
                            options={plantOptions}
                            placeholder="Plant"
                            filterOption={(inputValue, option) =>
                              normalizeText(option?.label).includes(normalizeText(inputValue)) ||
                              normalizeText(option?.value).includes(normalizeText(inputValue))
                            }
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item label="Location" name={[field.name, 'location']}>
                          <AutoComplete
                            allowClear
                            virtual={false}
                            options={locationOptions}
                            placeholder="Blank = flexible"
                            filterOption={(inputValue, option) =>
                              normalizeText(option?.label).includes(normalizeText(inputValue)) ||
                              normalizeText(option?.value).includes(normalizeText(inputValue))
                            }
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item label="Expiry Date" name={[field.name, 'expiryDate']}>
                          <Input type="date" placeholder="Blank = flexible" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={3}>
                        <Form.Item label="UOM" name={[field.name, 'uom']} rules={[{ required: true, message: 'UOM required' }]}>
                          <Input />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={3}>
                        <Form.Item label="Qty" name={[field.name, 'qty']} rules={[{ required: true, message: 'Qty required' }]}>
                          <InputNumber min={0.001} precision={3} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Form.Item label="Line Remarks" name={[field.name, 'remarks']}>
                          <Input />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}

                {!isViewMode && (
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add({
                        productCode: '',
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
                    Add Line
                  </Button>
                )}
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        open={aiModalOpen}
        destroyOnHidden
        width={1000}
        title={
          <Space>
            <RobotOutlined />
            {aiSelectedShipment ? `AI Outbound Review · ${aiSelectedShipment.shipmentNo}` : 'AI Outbound Dashboard'}
          </Space>
        }
        footer={[
          <Button key="close" type="primary" onClick={() => setAiModalOpen(false)}>
            Close
          </Button>,
        ]}
        onCancel={() => setAiModalOpen(false)}
      >
        {aiSelectedShipment && selectedAiReview ? (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <Card>
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={8}>
                  <Progress type="dashboard" percent={selectedAiReview.score} strokeColor={selectedAiReview.color} />
                </Col>

                <Col xs={24} md={16}>
                  <Title level={4} style={{ marginTop: 0 }}>
                    {aiSelectedShipment.shipmentNo}
                  </Title>

                  <Space wrap>
                    <Tag color={shipmentStatusColor(aiSelectedShipment.status)}>{aiSelectedShipment.status}</Tag>
                    <Tag color={selectedAiReview.color}>{selectedAiReview.status}</Tag>
                    <Tag>{aiSelectedShipment.lines.length} Lines</Tag>
                    <Tag>{selectedAiReview.allocationSuggestions.length} Allocation Rows</Tag>
                  </Space>

                  <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                    AI checks inventory availability, SKU + Batch + Plant matching, flexible Location / Expiry logic, FEFO allocation,
                    quantity sufficiency, expiry risk, and shipping readiness.
                  </Paragraph>
                </Col>
              </Row>
            </Card>

            <List
              bordered
              dataSource={selectedAiReview.findings}
              renderItem={(finding) => (
                <List.Item>
                  <Space align="start">
                    <Tag color={aiSeverityColor(finding.severity)}>{finding.severity.toUpperCase()}</Tag>

                    <Space orientation="vertical" size={2}>
                      <Text strong>{finding.title}</Text>
                      <Text>{finding.detail}</Text>
                      <Text type="secondary">Recommendation: {finding.recommendation}</Text>
                    </Space>
                  </Space>
                </List.Item>
              )}
            />

            <Card title="AI Allocation Recommendation">
              {selectedAiReview.allocationSuggestions.length ? (
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  dataSource={selectedAiReview.allocationSuggestions}
                  columns={[
                    { title: 'Inventory ID', dataIndex: 'inventoryId' },
                    { title: 'SKU', dataIndex: 'productCode' },
                    { title: 'Batch No', dataIndex: 'batchNo' },
                    { title: 'Plant', dataIndex: 'plant' },
                    { title: 'Location', dataIndex: 'location' },
                    { title: 'Expiry Date', dataIndex: 'expiryDate' },
                    { title: 'UOM', dataIndex: 'uom' },
                    { title: 'Qty', dataIndex: 'qty', align: 'right' as const },
                  ]}
                />
              ) : (
                <Empty description="No allocation suggestion available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>

            <Space>
              {aiSelectedShipment.status === 'Draft' && (
                <Button
                  type="primary"
                  icon={<FileDoneOutlined />}
                  disabled={selectedAiReview.status === 'Blocked'}
                  onClick={() => {
                    handleConfirmShipment(aiSelectedShipment);
                    setAiModalOpen(false);
                  }}
                >
                  Confirm with AI Allocation
                </Button>
              )}

              {aiSelectedShipment.status !== 'Shipped' && aiSelectedShipment.status !== 'Cancelled' && (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  disabled={selectedAiReview.status === 'Blocked'}
                  onClick={() => {
                    handleShipShipment(aiSelectedShipment);
                    setAiModalOpen(false);
                  }}
                >
                  Ship and Deduct Inventory
                </Button>
              )}
            </Space>
          </Space>
        ) : (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <Card>
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={8}>
                  <Progress type="dashboard" percent={aiSummary.avgScore} />
                </Col>

                <Col xs={24} md={16}>
                  <Title level={4} style={{ marginTop: 0 }}>
                    Overall Outbound AI Readiness
                  </Title>

                  <Paragraph>AI reviewed all outbound shipments against live inventory stock and allocation rules.</Paragraph>

                  <Space wrap>
                    <Badge status="success" text={`Ready: ${aiSummary.ready}`} />
                    <Badge status="processing" text={`Monitor: ${aiSummary.monitor}`} />
                    <Badge status="warning" text={`Warning: ${aiSummary.warning}`} />
                    <Badge status="error" text={`Blocked: ${aiSummary.blocked}`} />
                  </Space>
                </Col>
              </Row>
            </Card>

            <Alert
              type={aiSummary.blocked > 0 ? 'error' : aiSummary.warning > 0 ? 'warning' : 'success'}
              showIcon
              title="AI Recommendation"
              description={
                aiSummary.blocked > 0
                  ? 'Some shipments are blocked by missing inventory, insufficient qty, invalid line data, expired stock, or unavailable stock. Review blocked shipments before confirmation.'
                  : aiSummary.warning > 0
                    ? 'Some shipments require monitoring due to near-expiry stock or split allocation. Review before shipping.'
                    : 'Outbound readiness is good. Continue normal confirmation and shipping process.'
              }
            />

            <List
              bordered
              dataSource={shipments
                .map((shipment) => ({
                  shipment,
                  review: aiByShipmentId.get(shipment.id)!,
                }))
                .filter((row) => row.review && row.review.status !== 'Ready')
                .sort((a, b) => a.review.score - b.review.score)
                .slice(0, 20)}
              locale={{
                emptyText: <Empty description="No outbound AI risk found" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
              renderItem={({ shipment, review }) => (
                <List.Item
                  actions={[
                    <Button key="review" size="small" icon={<RobotOutlined />} onClick={() => openAiModal(shipment)}>
                      Review
                    </Button>,
                  ]}
                >
                  <Space orientation="vertical" size={2}>
                    <Space wrap>
                      <Text strong>{shipment.shipmentNo}</Text>
                      <Tag color={shipmentStatusColor(shipment.status)}>{shipment.status}</Tag>
                      <Tag color={review.color}>{review.status}</Tag>
                      <Tag>Score {review.score}</Tag>
                    </Space>

                    <Text type="secondary">
                      {review.findings.filter((finding) => finding.severity !== 'success')[0]?.title || 'AI found an item requiring review'}
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