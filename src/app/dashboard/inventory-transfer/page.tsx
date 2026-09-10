'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Drawer,
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
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SendOutlined,
  StopOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/* ============================================================================
 * Storage Keys
 * ========================================================================== */

const TRANSFER_STORAGE_KEY = 'wms_inventory_transfers';

const INVENTORY_STORAGE_KEY = 'wms_inventory';
const INVENTORY_COMPAT_STORAGE_KEY = 'wms_inventory_management';

const MOVEMENT_STORAGE_KEY = 'wms_stock_movements';
const MOVEMENT_COMPAT_STORAGE_KEY = 'wms_inventory_movements';

const PRODUCT_MASTER_KEYS = ['wms_product_master', 'wms_products', 'master_products_v1'];

const INVENTORY_STORAGE_KEYS = [
  'wms_inventory',
  'wms_inventory_management',
  'wms_inventory_data',
  'wms_inventory_items',
  'wms_stock',
  'wms_stock_balance',
];

/* ============================================================================
 * Types
 * ========================================================================== */

type TransferType = 'Same Plant Transfer' | 'Inter-Plant Transfer';

type TransferStatus = 'Draft' | 'Submitted' | 'Approved' | 'In Transit' | 'Completed' | 'Rejected' | 'Cancelled';

type AIStatus = 'Ready' | 'Ready with Warning' | 'Blocked' | 'Needs Approval';

interface ProductMaster {
  id?: string;
  productCode?: string;
  sku?: string;
  itemCode?: string;
  materialCode?: string;
  productName?: string;
  description?: string;
  itemName?: string;
  materialName?: string;
  name?: string;
  uom?: string;
  baseUom?: string;
  unit?: string;
  unitOfMeasure?: string;
  status?: string;
  active?: boolean;
  isBatchControlled?: boolean;
  batchControlled?: boolean;
  isExpiryControlled?: boolean;
  expiryControlled?: boolean;
  unitCost?: number;
  inventoryCost?: number;
  cost?: number;
  standardCost?: number;
  fixedCost?: number;
  averageCost?: number;
  weightedAverageCost?: number;
  movingAverageCost?: number;
  mapCost?: number;
  fifoCost?: number;
  lifoCost?: number;
  unitPrice?: number;
  price?: number;
  [key: string]: any;
}

interface InventoryRow {
  id?: string;
  key?: string;
  inventoryId?: string;
  stockId?: string;

  productCode?: string;
  sku?: string;
  itemCode?: string;
  materialCode?: string;
  productSku?: string;
  code?: string;

  productName?: string;
  description?: string;
  itemName?: string;
  materialName?: string;
  name?: string;

  batchNo?: string;
  batch?: string;
  batchNumber?: string;
  lotNo?: string;
  lot?: string;

  plant?: string;
  plantCode?: string;
  warehouse?: string;
  warehouseCode?: string;
  site?: string;
  siteCode?: string;

  location?: string;
  stockLocation?: string;
  storageLocation?: string;
  storageLoc?: string;
  bin?: string;
  binLocation?: string;
  rackLocation?: string;
  locator?: string;

  expiryDate?: string;
  expirationDate?: string;
  expireDate?: string;
  expDate?: string;

  uom?: string;
  unit?: string;
  baseUom?: string;
  uomCode?: string;
  unitOfMeasure?: string;

  status?: string;
  stockStatus?: string;
  inventoryStatus?: string;

  batchQty?: number;
  availableQty?: number;
  availableBalance?: number;
  availableStock?: number;
  onHandQty?: number;
  onHand?: number;
  stockOnHand?: number;
  quantity?: number;
  qty?: number;
  balanceQty?: number;
  balance?: number;
  stockBalance?: number;
  currentQty?: number;
  currentStock?: number;
  stockQty?: number;
  unrestrictedQty?: number;
  goodQty?: number;
  closingBalance?: number;
  endingBalance?: number;
  physicalQty?: number;
  systemQty?: number;

  unitCost?: number;
  inventoryCost?: number;
  cost?: number;
  standardCost?: number;
  fixedCost?: number;
  averageCost?: number;
  weightedAverageCost?: number;
  movingAverageCost?: number;
  mapCost?: number;
  fifoCost?: number;
  lifoCost?: number;
  unitPrice?: number;
  price?: number;

  totalCost?: number;
  inventoryValue?: number;
  stockValue?: number;
  totalValue?: number;
  value?: number;
  amount?: number;

  transferNo?: string;
  sourceTransferId?: string;

  createdAt?: string;
  updatedAt?: string;

  [key: string]: any;
}

interface InventoryTransferItem {
  id: string;
  sourceInventoryId?: string;

  productCode?: string;
  sku: string;
  productName?: string;

  batchNo?: string;
  expiryDate?: string;
  uom?: string;

  fromPlant: string;
  fromLocation: string;
  toPlant: string;
  toLocation: string;

  qty: number;

  unitCost?: number;
  totalCost?: number;

  currentBatchQty?: number;
  currentAvailableQty?: number;

  remarks?: string;
}

interface InventoryTransfer {
  id: string;
  transferNo: string;
  transferDate: string;
  expectedReceiveDate?: string;

  transferType: TransferType;
  status: TransferStatus;

  reasonCode: string;
  referenceNo?: string;
  requestor?: string;
  department?: string;
  approver?: string;

  fromPlant?: string;
  fromLocation?: string;
  toPlant?: string;
  toLocation?: string;
  inTransitLocation?: string;

  approvedBy?: string;
  approvedAt?: string;

  dispatchedBy?: string;
  dispatchedAt?: string;

  receivedBy?: string;
  receivedAt?: string;

  movementPosted: boolean;
  receivePosted: boolean;

  remarks?: string;

  items: InventoryTransferItem[];

  totalQty?: number;
  totalCost?: number;

  aiScore?: number;
  aiStatus?: AIStatus;
  aiIssues?: string[];
  aiRecommendations?: string[];

  createdAt: string;
  updatedAt: string;
}

interface AIReviewResult {
  status: AIStatus;
  score: number;
  issues: string[];
  warnings: string[];
  recommendations: string[];
}

/* ============================================================================
 * Constants
 * ========================================================================== */

const transferTypes: TransferType[] = ['Same Plant Transfer', 'Inter-Plant Transfer'];

const transferStatuses: TransferStatus[] = [
  'Draft',
  'Submitted',
  'Approved',
  'In Transit',
  'Completed',
  'Rejected',
  'Cancelled',
];

const reasonCodes = [
  'LOCATION_REPLENISHMENT',
  'PICK_FACE_REPLENISHMENT',
  'WAREHOUSE_RELOCATION',
  'PLANT_TRANSFER',
  'STOCK_BALANCING',
  'QUALITY_MOVEMENT',
  'SYSTEM_CORRECTION',
  'OTHER',
];

/* ============================================================================
 * Generic Helpers
 * ========================================================================== */

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateTransferNo() {
  return `TRF-${dayjs().format('YYYYMMDD')}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function generateMovementNo() {
  return `MOV-${dayjs().format('YYYYMMDD')}-${Math.floor(10000 + Math.random() * 90000)}`;
}

function normalizeText(value?: any) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeKey(value: any) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeDate(value?: any) {
  if (!value) return '';

  if (dayjs.isDayjs(value)) {
    return value.isValid() ? value.format('YYYY-MM-DD') : '';
  }

  const text = String(value).trim();
  if (!text) return '';

  const parsed = dayjs(text);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : text;
}

function toNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;

  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value: any) {
  return Math.round(toNumber(value) * 100) / 100;
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

function findArrayDeep<T = any>(value: any, depth = 0): T[] {
  if (!value || depth > 7) return [];

  if (Array.isArray(value)) return value as T[];

  if (typeof value === 'object') {
    const preferredKeys = [
      'inventory',
      'inventories',
      'inventoryData',
      'inventoryItems',
      'stock',
      'stocks',
      'stockBalance',
      'stockBalances',
      'data',
      'rows',
      'items',
      'records',
      'list',
      'products',
      'productMaster',
      'transfers',
    ];

    for (const key of preferredKeys) {
      const found = findArrayDeep<T>(value[key], depth + 1);
      if (found.length > 0) return found;
    }

    for (const key of Object.keys(value)) {
      const found = findArrayDeep<T>(value[key], depth + 1);
      if (found.length > 0) return found;
    }
  }

  return [];
}

function readStorageArray<T = any>(key: string): T[] {
  if (typeof window === 'undefined') return [];

  const parsed = safeJsonParse<any>(localStorage.getItem(key), []);
  return findArrayDeep<T>(parsed);
}

/* ============================================================================
 * Inventory Field Helpers
 * ========================================================================== */

function getSku(row: any) {
  return (
    readAny(row, [
      'sku',
      'SKU',
      'productCode',
      'Product Code',
      'itemCode',
      'Item Code',
      'materialCode',
      'Material Code',
      'productSku',
      'code',
      'Code',
    ]) || ''
  );
}

function getProductCode(row: any) {
  return (
    readAny(row, [
      'productCode',
      'Product Code',
      'sku',
      'SKU',
      'itemCode',
      'Item Code',
      'materialCode',
      'Material Code',
      'productSku',
      'code',
      'Code',
    ]) || ''
  );
}

function getProductName(row: any) {
  return (
    readAny(row, [
      'productName',
      'Product Name',
      'description',
      'Description',
      'productDescription',
      'Product Description',
      'itemName',
      'Item Name',
      'materialName',
      'Material Name',
      'name',
      'Name',
    ]) || ''
  );
}

function getBatch(row: any) {
  return readAny(row, ['batchNo', 'Batch No', 'batch', 'batchNumber', 'Batch Number', 'lotNo', 'Lot No', 'lot']) || '';
}

function getPlant(row: any) {
  return (
    readAny(row, [
      'plant',
      'Plant',
      'plantCode',
      'Plant Code',
      'warehouse',
      'Warehouse',
      'warehouseCode',
      'site',
      'siteCode',
    ]) || ''
  );
}

function getLocation(row: any) {
  return (
    readAny(row, [
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
    ]) || ''
  );
}

function getExpiry(row: any) {
  return normalizeDate(readAny(row, ['expiryDate', 'Expiry Date', 'expirationDate', 'expireDate', 'expDate', 'expiry']));
}

function getUom(row: any) {
  return readAny(row, ['uom', 'UOM', 'unit', 'Unit', 'baseUom', 'Base UOM', 'uomCode', 'unitOfMeasure'], '') || '';
}

function getBatchQty(row: any): number {
  return toNumber(
    readAny(row, [
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
      'availableQty',
      'Available Qty',
      'availableBalance',
      'availableStock',
      'unrestrictedQty',
      'goodQty',
    ]),
  );
}

function getAvailableQty(row: any): number {
  return toNumber(
    readAny(row, [
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
      'batchQty',
      'Batch Qty',
      'onHandQty',
      'onHand',
      'stockOnHand',
      'balanceQty',
      'Balance Qty',
      'balance',
      'stockBalance',
      'currentQty',
      'currentStock',
      'stockQty',
      'quantity',
      'qty',
      'closingBalance',
      'endingBalance',
      'physicalQty',
      'systemQty',
    ]),
  );
}

function getInventoryUnitCost(row: any): number {
  const direct = toNumber(
    readAny(row, [
      'unitCost',
      'inventoryCost',
      'cost',
      'standardCost',
      'fixedCost',
      'averageCost',
      'weightedAverageCost',
      'movingAverageCost',
      'mapCost',
      'fifoCost',
      'lifoCost',
      'unitPrice',
      'price',
    ]),
  );

  if (direct > 0) return roundMoney(direct);

  const qty = getBatchQty(row) || getAvailableQty(row);

  const totalValue = toNumber(
    readAny(row, ['totalCost', 'inventoryValue', 'stockValue', 'totalValue', 'value', 'amount'], 0),
  );

  if (qty > 0 && totalValue > 0) return roundMoney(totalValue / qty);

  return 0;
}

function getProductCost(product?: ProductMaster): number {
  if (!product) return 0;

  return roundMoney(
    readAny(product, [
      'unitCost',
      'inventoryCost',
      'cost',
      'standardCost',
      'fixedCost',
      'averageCost',
      'weightedAverageCost',
      'movingAverageCost',
      'mapCost',
      'fifoCost',
      'lifoCost',
      'unitPrice',
      'price',
    ]),
  );
}

function getInventoryId(row: InventoryRow) {
  return String(row.id || row.key || row.inventoryId || row.stockId || '');
}

function inventoryRowKey(row: InventoryRow, index?: number) {
  return String(
    getInventoryId(row) ||
      `${getSku(row)}_${getBatch(row)}_${getPlant(row)}_${getLocation(row)}_${getExpiry(row)}_${getUom(row)}_${
        index ?? ''
      }`,
  );
}

function isBlockedInventoryStatus(status?: any) {
  const s = normalizeText(status || '');

  return [
    'HOLD',
    'ON HOLD',
    'QUALITY HOLD',
    'QC HOLD',
    'QA HOLD',
    'BLOCKED',
    'DAMAGED',
    'EXPIRED',
    'QUARANTINE',
    'REJECTED',
    'SCRAPPED',
    'WRITEOFF',
    'WRITE OFF',
    'CANCELLED',
    'CANCELED',
    'IN TRANSIT',
    'IN-TRANSIT',
    'TRANSIT',
  ].includes(s);
}

function isInTransitStatus(row: any) {
  const s = normalizeText(row?.status || row?.stockStatus || row?.inventoryStatus || '');
  return ['IN TRANSIT', 'IN-TRANSIT', 'TRANSIT'].includes(s);
}

function isAvailableInventoryRow(row: any) {
  const status = normalizeText(row?.status || row?.stockStatus || row?.inventoryStatus || '');

  if (!status) return getAvailableQty(row) > 0;

  if (isBlockedInventoryStatus(status)) return false;

  return getAvailableQty(row) > 0;
}

function setInventoryQty(row: InventoryRow, batchQty: number, availableQty?: number) {
  const safeBatchQty = Math.max(0, toNumber(batchQty));
  const safeAvailableQty = Math.max(0, toNumber(availableQty ?? batchQty));
  const now = new Date().toISOString();

  return {
    ...row,

    batchQty: safeBatchQty,
    'Batch Qty': safeBatchQty,
    onHandQty: safeBatchQty,
    onHand: safeBatchQty,
    stockOnHand: safeBatchQty,
    balanceQty: safeBatchQty,
    'Balance Qty': safeBatchQty,
    balance: safeBatchQty,
    stockBalance: safeBatchQty,
    currentQty: safeBatchQty,
    currentStock: safeBatchQty,
    stockQty: safeBatchQty,
    quantity: safeBatchQty,
    Quantity: safeBatchQty,
    qty: safeBatchQty,
    Qty: safeBatchQty,
    closingBalance: safeBatchQty,
    endingBalance: safeBatchQty,
    physicalQty: safeBatchQty,
    systemQty: safeBatchQty,

    availableQty: safeAvailableQty,
    'Available Qty': safeAvailableQty,
    available: safeAvailableQty,
    Available: safeAvailableQty,
    availableBalance: safeAvailableQty,
    'Available Balance': safeAvailableQty,
    availableStock: safeAvailableQty,
    unrestrictedQty: safeAvailableQty,
    goodQty: safeAvailableQty,
    qtyAvailable: safeAvailableQty,
    'Qty Available': safeAvailableQty,
    availableQuantity: safeAvailableQty,
    'Available Quantity': safeAvailableQty,

    updatedAt: row.updatedAt || now,
  };
}

function normalizeInventoryRecord(row: InventoryRow): InventoryRow {
  const now = new Date().toISOString();

  const sku = String(getSku(row)).trim();
  const productCode = String(getProductCode(row) || sku).trim();
  const productName = String(getProductName(row)).trim();
  const batchNo = String(getBatch(row)).trim();
  const plant = String(getPlant(row)).trim();
  const location = String(getLocation(row)).trim();
  const expiryDate = getExpiry(row);
  const uom = String(getUom(row) || 'PCS').trim();
  const status = String(readAny(row, ['status', 'Status', 'stockStatus', 'inventoryStatus'], 'Available')).trim();

  const batchQty = getBatchQty(row);
  const availableQty = getAvailableQty(row);
  const unitCost = getInventoryUnitCost(row);

  return {
    ...row,

    id: getInventoryId(row) || generateId('inv'),
    key: getInventoryId(row) || row.key,

    productCode,
    sku,
    SKU: sku,
    'Product Code': productCode,

    productName,
    'Product Name': productName,
    productDescription: productName,
    description: productName,

    batchNo,
    batch: batchNo,
    batchNumber: batchNo,
    lotNo: batchNo,
    'Batch No': batchNo,

    plant,
    Plant: plant,
    plantCode: plant,

    location,
    Location: location,
    stockLocation: location,
    storageLocation: location,
    'Storage Location': location,
    bin: location,

    expiryDate,
    expirationDate: expiryDate,
    expireDate: expiryDate,
    expDate: expiryDate,
    'Expiry Date': expiryDate,

    uom,
    UOM: uom,
    unit: uom,
    baseUom: uom,
    unitOfMeasure: uom,

    status,
    Status: status,
    stockStatus: status,
    inventoryStatus: status,

    unitCost,
    inventoryCost: unitCost,
    cost: unitCost,

    createdAt: row.createdAt || now,

    ...setInventoryQty(row, batchQty, availableQty),
  };
}
function loadInventoryRowsFromStorage(): InventoryRow[] {
  if (typeof window === 'undefined') return [];

  const map = new Map<string, InventoryRow>();

  INVENTORY_STORAGE_KEYS.forEach((key) => {
    const rows = readStorageArray<InventoryRow>(key);

    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object') return;

      const normalized = normalizeInventoryRecord(row);

      const naturalKey = [
        normalizeText(getSku(normalized)),
        normalizeText(getBatch(normalized)),
        normalizeText(getPlant(normalized)),
        normalizeText(getLocation(normalized)),
        normalizeDate(getExpiry(normalized)),
        normalizeText(getUom(normalized)),
        normalizeText(normalized.status || 'Available'),
        normalizeText(normalized.transferNo || ''),
      ].join('|');

      const existing = map.get(naturalKey);

      if (!existing) {
        map.set(naturalKey, normalized);
      } else {
        const existingTime = dayjs(existing.updatedAt || existing.createdAt || 0).valueOf();
        const nextTime = dayjs(normalized.updatedAt || normalized.createdAt || 0).valueOf();

        map.set(naturalKey, nextTime >= existingTime ? normalized : existing);
      }

      if (!getInventoryId(normalized)) {
        normalized.id = inventoryRowKey(normalized, index);
      }
    });
  });

  return Array.from(map.values());
}

/* ============================================================================
 * Product Master Helpers
 * ========================================================================== */

function loadProductMasterFromStorage(): ProductMaster[] {
  if (typeof window === 'undefined') return [];

  const map = new Map<string, ProductMaster>();

  PRODUCT_MASTER_KEYS.forEach((key) => {
    const rows = readStorageArray<ProductMaster>(key);

    rows.forEach((row) => {
      const sku = String(getSku(row)).trim();
      if (!sku) return;

      const existing = map.get(normalizeText(sku));

      const normalized: ProductMaster = {
        ...row,
        sku,
        productCode: String(getProductCode(row) || sku).trim(),
        productName: String(getProductName(row)).trim(),
        uom: String(getUom(row) || 'PCS').trim(),
      };

      map.set(normalizeText(sku), existing ? { ...existing, ...normalized } : normalized);
    });
  });

  return Array.from(map.values()).sort((a, b) => String(getSku(a)).localeCompare(String(getSku(b))));
}

function isProductActive(product?: ProductMaster) {
  if (!product) return true;
  if (product.active === false) return false;

  return !['INACTIVE', 'DISCONTINUED', 'BLOCKED', 'DELETED', 'DISABLED'].includes(normalizeText(product.status));
}

function productBatchControlled(product?: ProductMaster) {
  return Boolean(product?.isBatchControlled || product?.batchControlled);
}

function productExpiryControlled(product?: ProductMaster) {
  return Boolean(product?.isExpiryControlled || product?.expiryControlled);
}

/* ============================================================================
 * Inventory Matching
 * ========================================================================== */

function matchesInventory(
  inv: InventoryRow,
  item: Partial<InventoryTransferItem>,
  options?: {
    status?: 'Available' | 'In Transit';
    plant?: string;
    location?: string;
    flexibleExpiry?: boolean;
    allowSourceId?: boolean;
    transferNo?: string;
  },
) {
  if (options?.allowSourceId && item.sourceInventoryId) {
    const invId = getInventoryId(inv);

    if (invId && invId === String(item.sourceInventoryId)) {
      if (options.status === 'Available' && !isAvailableInventoryRow(inv)) return false;
      if (options.status === 'In Transit' && !isInTransitStatus(inv)) return false;

      return true;
    }
  }

  if (options?.status === 'Available' && !isAvailableInventoryRow(inv)) return false;
  if (options?.status === 'In Transit' && !isInTransitStatus(inv)) return false;

  if (options?.transferNo) {
    if (normalizeText(inv.transferNo) !== normalizeText(options.transferNo)) return false;
  }

  const targetSku = normalizeText(item.sku || item.productCode);
  const targetBatch = normalizeText(item.batchNo);
  const targetPlant = normalizeText(options?.plant ?? item.fromPlant);
  const targetLocation = normalizeText(options?.location ?? item.fromLocation);
  const targetExpiry = normalizeDate(item.expiryDate);
  const targetUom = normalizeText(item.uom);

  const skuMatch = targetSku ? normalizeText(getSku(inv)) === targetSku || normalizeText(getProductCode(inv)) === targetSku : true;
  const batchMatch = targetBatch ? normalizeText(getBatch(inv)) === targetBatch : true;
  const plantMatch = targetPlant ? normalizeText(getPlant(inv)) === targetPlant : true;
  const locationMatch = targetLocation ? normalizeText(getLocation(inv)) === targetLocation : true;
  const uomMatch = targetUom ? normalizeText(getUom(inv)) === targetUom : true;

  const invExpiry = getExpiry(inv);
  const expiryMatch = targetExpiry ? normalizeDate(invExpiry) === targetExpiry : Boolean(options?.flexibleExpiry ?? true);

  return skuMatch && batchMatch && plantMatch && locationMatch && expiryMatch && uomMatch;
}

/* ============================================================================
 * CSV Helpers
 * ========================================================================== */

function csvEscape(value: any) {
  const str = String(value ?? '');
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  const cleanText = String(text || '').replace(/^\uFEFF/, '');

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

function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/* ============================================================================
 * UI Color Helpers
 * ========================================================================== */

function statusColor(status: TransferStatus) {
  const map: Record<string, string> = {
    Draft: 'default',
    Submitted: 'processing',
    Approved: 'blue',
    'In Transit': 'orange',
    Completed: 'success',
    Rejected: 'error',
    Cancelled: 'warning',
  };

  return map[status] || 'default';
}

function typeColor(type: TransferType) {
  return type === 'Same Plant Transfer' ? 'blue' : 'purple';
}

function aiStatusColor(status?: AIStatus) {
  const map: Record<string, string> = {
    Ready: 'success',
    'Ready with Warning': 'warning',
    Blocked: 'error',
    'Needs Approval': 'processing',
  };

  return status ? map[status] || 'default' : 'default';
}

/* ============================================================================
 * Main Page
 * ========================================================================== */

export default function InventoryTransferPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm();

  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [products, setProducts] = useState<ProductMaster[]>([]);

  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransferType | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<TransferStatus | 'All'>('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryTransfer | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<InventoryTransfer | null>(null);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiReview, setAiReview] = useState<AIReviewResult | null>(null);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadAll() {
    const transferData = safeJsonParse<InventoryTransfer[]>(localStorage.getItem(TRANSFER_STORAGE_KEY), []);
    const inventoryRows = loadInventoryRowsFromStorage();
    const productData = loadProductMasterFromStorage();

    setTransfers(Array.isArray(transferData) ? transferData : []);
    setInventory(inventoryRows);
    setProducts(productData);

    messageApi.success('Inventory transfer data refreshed.');
  }

  function persistTransfers(next: InventoryTransfer[]) {
    setTransfers(next);
    localStorage.setItem(TRANSFER_STORAGE_KEY, JSON.stringify(next));
  }

  function persistInventory(next: InventoryRow[]) {
    const normalized = next.map(normalizeInventoryRecord);

    setInventory(normalized);

    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(normalized));
    localStorage.setItem(INVENTORY_COMPAT_STORAGE_KEY, JSON.stringify(normalized));
  }

  function appendMovements(movements: any[]) {
    if (!movements.length) return;

    const oldA = safeJsonParse<any[]>(localStorage.getItem(MOVEMENT_STORAGE_KEY), []);
    const oldB = safeJsonParse<any[]>(localStorage.getItem(MOVEMENT_COMPAT_STORAGE_KEY), []);

    localStorage.setItem(MOVEMENT_STORAGE_KEY, JSON.stringify([...oldA, ...movements]));
    localStorage.setItem(MOVEMENT_COMPAT_STORAGE_KEY, JSON.stringify([...oldB, ...movements]));
  }

  function findProductBySku(sku?: string) {
    return products.find((p) => normalizeText(getSku(p)) === normalizeText(sku));
  }

  function findInventoryByOptionValue(value?: string) {
    if (!value) return undefined;

    return inventory.find((inv, index) => {
      const key = inventoryRowKey(inv, index);
      const id = getInventoryId(inv);

      return key === value || id === value;
    });
  }

  function findAvailableInventoryRows(item: Partial<InventoryTransferItem>) {
    return inventory.filter((inv) =>
      matchesInventory(inv, item, {
        status: 'Available',
        flexibleExpiry: true,
        allowSourceId: true,
      }),
    );
  }

  function getInventoryBalanceForLine(item: Partial<InventoryTransferItem>) {
    const matches = findAvailableInventoryRows(item);
    const availableQty = matches.reduce((sum, inv) => sum + getAvailableQty(inv), 0);
    const batchQty = matches.reduce((sum, inv) => sum + getBatchQty(inv), 0);
    const firstCostRow = matches.find((inv) => getInventoryUnitCost(inv) > 0);

    return {
      availableQty,
      batchQty,
      unitCost: firstCostRow ? getInventoryUnitCost(firstCostRow) : 0,
      matchedRows: matches,
    };
  }

  const productOptions = useMemo(() => {
    const map = new Map<string, { label: string; value: string }>();

    products.forEach((p) => {
      const sku = String(getSku(p)).trim();
      if (!sku) return;

      map.set(normalizeText(sku), {
        label: `${sku} - ${getProductName(p) || '-'}`,
        value: sku,
      });
    });

    inventory.forEach((inv) => {
      const sku = String(getSku(inv)).trim();
      if (!sku) return;

      if (!map.has(normalizeText(sku))) {
        map.set(normalizeText(sku), {
          label: `${sku} - ${getProductName(inv) || '-'}`,
          value: sku,
        });
      }
    });

    return Array.from(map.values());
  }, [products, inventory]);

  const availableInventoryOptions = useMemo(
    () =>
      inventory.filter(isAvailableInventoryRow).map((inv, index) => {
        const key = inventoryRowKey(inv, index);
        const exp = getExpiry(inv);
        const unitCost = getInventoryUnitCost(inv);

        return {
          label: `${getSku(inv)} | ${getProductName(inv) || '-'} | Batch: ${getBatch(inv) || '-'} | Plant: ${
            getPlant(inv) || '-'
          } | Loc: ${getLocation(inv) || '-'} | Exp: ${exp || '-'} | Qty: ${getAvailableQty(inv)} | Cost: ${unitCost}`,
          value: key,
        };
      }),
    [inventory],
  );

  const filteredTransfers = useMemo(() => {
    return transfers.filter((trf) => {
      const text = normalizeText(searchText);

      const hitText =
        !text ||
        normalizeText(trf.transferNo).includes(text) ||
        normalizeText(trf.referenceNo).includes(text) ||
        normalizeText(trf.reasonCode).includes(text) ||
        normalizeText(trf.requestor).includes(text) ||
        normalizeText(trf.approver).includes(text) ||
        trf.items.some(
          (it) =>
            normalizeText(it.sku).includes(text) ||
            normalizeText(it.productName).includes(text) ||
            normalizeText(it.batchNo).includes(text) ||
            normalizeText(it.fromLocation).includes(text) ||
            normalizeText(it.toLocation).includes(text),
        );

      return (
        hitText &&
        (typeFilter === 'All' || trf.transferType === typeFilter) &&
        (statusFilter === 'All' || trf.status === statusFilter)
      );
    });
  }, [transfers, searchText, typeFilter, statusFilter]);

  const summary = useMemo(() => {
    const totalCost = transfers.reduce(
      (sum, t) => sum + roundMoney(t.totalCost ?? t.items.reduce((s, i) => s + toNumber(i.totalCost), 0)),
      0,
    );

    return {
      total: transfers.length,
      pending: transfers.filter((t) => t.status === 'Submitted').length,
      inTransit: transfers.filter((t) => t.status === 'In Transit').length,
      completed: transfers.filter((t) => t.status === 'Completed').length,
      highRisk: transfers.filter((t) => t.aiStatus === 'Blocked' || t.aiStatus === 'Needs Approval').length,
      totalCost: roundMoney(totalCost),
    };
  }, [transfers]);

  function refreshLineInventoryInfo(lineIndex: number) {
    const items = form.getFieldValue('items') || [];
    const current = items[lineIndex];

    if (!current) return;

    const balance = getInventoryBalanceForLine(current);
    const qty = toNumber(current.qty);
    const existingUnitCost = toNumber(current.unitCost);
    const finalUnitCost = existingUnitCost > 0 ? existingUnitCost : balance.unitCost;

    items[lineIndex] = {
      ...current,
      currentAvailableQty: balance.availableQty,
      currentBatchQty: balance.batchQty,
      unitCost: finalUnitCost,
      totalCost: roundMoney(qty * finalUnitCost),
    };

    form.setFieldsValue({ items });
  }

  function calculateItemCost(item: Partial<InventoryTransferItem>) {
    const qty = toNumber(item.qty);
    let unitCost = toNumber(item.unitCost);

    if (!unitCost) {
      const balance = getInventoryBalanceForLine(item);
      unitCost = balance.unitCost;
    }

    if (!unitCost) unitCost = getProductCost(findProductBySku(item.sku));

    return {
      unitCost: roundMoney(unitCost),
      totalCost: roundMoney(qty * unitCost),
    };
  }

  function recalculateLineCost(lineIndex: number, qtyValue?: any) {
    const items = form.getFieldValue('items') || [];
    const current = items[lineIndex] || {};
    const qty = qtyValue !== undefined ? toNumber(qtyValue) : toNumber(current.qty);
    const unitCost = toNumber(current.unitCost);

    items[lineIndex] = {
      ...current,
      qty,
      totalCost: roundMoney(qty * unitCost),
    };

    form.setFieldsValue({ items });
  }

  function applyInventoryToLine(lineIndex: number, selectedValue: string) {
    const inv = findInventoryByOptionValue(selectedValue);
    if (!inv) return;

    const header = form.getFieldsValue();
    const items = form.getFieldValue('items') || [];
    const current = items[lineIndex] || {};

    const fromPlant = getPlant(inv);
    const fromLocation = getLocation(inv);

    const transferType: TransferType = header.transferType || 'Same Plant Transfer';

    const headerToPlant = transferType === 'Same Plant Transfer' ? fromPlant : header.toPlant || current.toPlant || '';
    const unitCost = getInventoryUnitCost(inv);
    const qty = toNumber(current.qty || 1);

    items[lineIndex] = {
      ...current,
      sourceInventoryId: getInventoryId(inv),
      sku: getSku(inv),
      productCode: getProductCode(inv),
      productName: getProductName(inv),
      batchNo: getBatch(inv),
      expiryDate: getExpiry(inv) ? dayjs(getExpiry(inv)) : undefined,
      uom: getUom(inv),
      fromPlant,
      fromLocation,
      toPlant: headerToPlant,
      toLocation: header.toLocation || current.toLocation || '',
      currentBatchQty: getBatchQty(inv),
      currentAvailableQty: getAvailableQty(inv),
      unitCost,
      totalCost: roundMoney(qty * unitCost),
    };

    form.setFieldsValue({
      fromPlant: header.fromPlant || fromPlant,
      fromLocation: header.fromLocation || fromLocation,
      toPlant: header.toPlant || headerToPlant,
      items,
    });
  }

  function syncHeaderToLines(changed?: any) {
    const values = form.getFieldsValue();
    const items = form.getFieldValue('items') || [];

    const nextItems = items.map((line: any) => {
      const next = { ...line };

      if (changed?.fromPlant !== undefined && !next.fromPlant) next.fromPlant = changed.fromPlant;
      if (changed?.fromLocation !== undefined && !next.fromLocation) next.fromLocation = changed.fromLocation;
      if (changed?.toPlant !== undefined && !next.toPlant) next.toPlant = changed.toPlant;
      if (changed?.toLocation !== undefined && !next.toLocation) next.toLocation = changed.toLocation;

      if (values.transferType === 'Same Plant Transfer' && next.fromPlant) {
        next.toPlant = next.fromPlant;
      }

      return next;
    });

    form.setFieldsValue({ items: nextItems });

    setTimeout(() => {
      nextItems.forEach((_: any, idx: number) => refreshLineInventoryInfo(idx));
    }, 0);
  }

  function analyzeTransfer(trf: InventoryTransfer): AIReviewResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    let score = 100;
    let requiresApproval = false;

    if (!trf.transferType) {
      issues.push('Header: Transfer type is missing.');
      score -= 12;
    }

    if (!trf.reasonCode) {
      issues.push('Header: Missing reason code.');
      score -= 12;
    }

    if (!trf.requestor) {
      warnings.push('Header: Requestor is recommended.');
      score -= 4;
    }

    if (!trf.approver) {
      warnings.push('Header: Approver is recommended before approval.');
      score -= 5;
    }

    if (!trf.inTransitLocation) {
      warnings.push('Header: In-transit location is recommended for transfer traceability.');
      score -= 4;
    }

    if (!trf.items || trf.items.length === 0) {
      issues.push('Header: No transfer items found.');
      score -= 30;
    }

    trf.items.forEach((item, index) => {
      const rowNo = index + 1;
      const product = findProductBySku(item.sku);
      const qty = toNumber(item.qty);
      const unitCost = toNumber(item.unitCost);
      const totalCost = roundMoney(item.totalCost ?? qty * unitCost);

      if (!item.sku) {
        issues.push(`Row ${rowNo}: SKU is missing.`);
        score -= 15;
      }

      if (!item.fromPlant) {
        issues.push(`Row ${rowNo}: From Plant is missing.`);
        score -= 10;
      }

      if (!item.fromLocation) {
        issues.push(`Row ${rowNo}: From Location is missing.`);
        score -= 10;
      }

      if (!item.toPlant) {
        issues.push(`Row ${rowNo}: To Plant is missing.`);
        score -= 10;
      }

      if (!item.toLocation) {
        issues.push(`Row ${rowNo}: To Location is missing.`);
        score -= 10;
      }

      if (trf.transferType === 'Same Plant Transfer' && normalizeText(item.fromPlant) !== normalizeText(item.toPlant)) {
        issues.push(`Row ${rowNo}: Same Plant Transfer requires From Plant and To Plant to be the same.`);
        score -= 15;
      }

      if (
        item.fromPlant &&
        item.toPlant &&
        item.fromLocation &&
        item.toLocation &&
        normalizeText(item.fromPlant) === normalizeText(item.toPlant) &&
        normalizeText(item.fromLocation) === normalizeText(item.toLocation)
      ) {
        issues.push(`Row ${rowNo}: Source and destination are the same.`);
        score -= 15;
      }

      if (!qty || qty <= 0) {
        issues.push(`Row ${rowNo}: Quantity must be greater than zero.`);
        score -= 15;
      }

      if (product && !isProductActive(product)) {
        issues.push(`Row ${rowNo}: Product is inactive / blocked.`);
        score -= 20;
      }

      if (productBatchControlled(product) && !item.batchNo) {
        issues.push(`Row ${rowNo}: Batch number is required for batch-controlled SKU.`);
        score -= 15;
      }

      if (productExpiryControlled(product) && !item.expiryDate) {
        issues.push(`Row ${rowNo}: Expiry date is required for expiry-controlled SKU.`);
        score -= 15;
      }

      if (product && getUom(product) && item.uom && normalizeText(getUom(product)) !== normalizeText(item.uom)) {
        warnings.push(`Row ${rowNo}: UOM differs from Product Master. Master=${getUom(product)}, Item=${item.uom}.`);
        score -= 5;
      }

      const matches = findAvailableInventoryRows(item);
      const totalAvailable = matches.reduce((sum, inv) => sum + getAvailableQty(inv), 0);

      if (matches.length === 0) {
        issues.push(`Row ${rowNo}: No available source inventory match found.`);
        score -= 25;
      } else if (totalAvailable < qty) {
        issues.push(`Row ${rowNo}: Insufficient source inventory. Required ${qty}, available ${totalAvailable}.`);
        score -= 25;
      }

      const expired = item.expiryDate && dayjs(normalizeDate(item.expiryDate)).isBefore(dayjs(), 'day');

      if (expired) {
        issues.push(`Row ${rowNo}: Inventory is expired and should not be transferred as available stock.`);
        score -= 20;
      } else if (item.expiryDate && dayjs(normalizeDate(item.expiryDate)).diff(dayjs(), 'day') <= 30) {
        warnings.push(`Row ${rowNo}: Inventory expires within 30 days.`);
        score -= 5;
      }

      if (!unitCost) {
        warnings.push(`Row ${rowNo}: Unit cost is zero or missing.`);
        score -= 5;
      }

      if (totalCost >= 10000) {
        warnings.push(`Row ${rowNo}: High value transfer detected. Total cost=${totalCost}.`);
        requiresApproval = true;
        score -= 8;
      }
    });

    if (trf.transferType === 'Inter-Plant Transfer') {
      recommendations.push('Confirm receiving plant and receiving location before dispatch.');
      recommendations.push('Use in-transit status until receiving team confirms goods receipt.');
    }

    if (issues.length > 0) recommendations.push('Fix blocking validation issues before approval or dispatch.');
    if (warnings.length > 0) recommendations.push('Supervisor should review warnings before dispatch.');

    if (recommendations.length === 0) {
      recommendations.push('Transfer is ready for normal approval and dispatch workflow.');
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    let status: AIStatus = 'Ready';

    if (issues.length > 0) status = 'Blocked';
    else if (requiresApproval) status = 'Needs Approval';
    else if (warnings.length > 0) status = 'Ready with Warning';

    return {
      status,
      score,
      issues,
      warnings,
      recommendations,
    };
  }

  function buildPayloadFromForm(values: any, existing?: InventoryTransfer): InventoryTransfer {
    const now = new Date().toISOString();

    const normalizedItems: InventoryTransferItem[] = (values.items || []).map((item: any) => {
      const expiryDate = item.expiryDate ? normalizeDate(item.expiryDate) : '';
      const qty = toNumber(item.qty);

      const baseItem = {
        ...item,
        expiryDate,
        qty,
      };

      const costInfo = calculateItemCost(baseItem);
      const unitCost = item.unitCost !== undefined ? roundMoney(item.unitCost) : costInfo.unitCost;
      const totalCost = roundMoney(qty * unitCost);
      const balance = getInventoryBalanceForLine(baseItem);

      return {
        ...baseItem,
        id: item.id || generateId('line'),
        sourceInventoryId: item.sourceInventoryId,
        productCode: item.productCode || item.sku,
        sku: item.sku,
        productName: item.productName,
        fromPlant: item.fromPlant,
        fromLocation: item.fromLocation,
        toPlant: item.toPlant,
        toLocation: item.toLocation,
        currentAvailableQty: balance.availableQty,
        currentBatchQty: balance.batchQty,
        unitCost,
        totalCost,
      };
    });

    const totalQty = normalizedItems.reduce((sum, item) => sum + toNumber(item.qty), 0);
    const totalCost = roundMoney(normalizedItems.reduce((sum, item) => sum + toNumber(item.totalCost), 0));

    const transferType: TransferType = values.transferType || 'Same Plant Transfer';

    return {
      id: existing?.id || generateId('trf'),
      transferNo: values.transferNo || existing?.transferNo || generateTransferNo(),
      transferDate: normalizeDate(values.transferDate || dayjs()),
      expectedReceiveDate: values.expectedReceiveDate ? normalizeDate(values.expectedReceiveDate) : '',
      transferType,
      status: existing?.status || 'Draft',
      reasonCode: values.reasonCode,
      referenceNo: values.referenceNo,
      requestor: values.requestor,
      department: values.department,
      approver: values.approver,
      fromPlant: values.fromPlant,
      fromLocation: values.fromLocation,
      toPlant: values.toPlant,
      toLocation: values.toLocation,
      inTransitLocation: values.inTransitLocation || 'IN-TRANSIT',
      approvedBy: existing?.approvedBy,
      approvedAt: existing?.approvedAt,
      dispatchedBy: existing?.dispatchedBy,
      dispatchedAt: existing?.dispatchedAt,
      receivedBy: existing?.receivedBy,
      receivedAt: existing?.receivedAt,
      movementPosted: existing?.movementPosted || false,
      receivePosted: existing?.receivePosted || false,
      remarks: values.remarks,
      items: normalizedItems,
      totalQty,
      totalCost,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
  }

  function openCreate() {
    setEditing(null);
    form.resetFields();

    form.setFieldsValue({
      transferNo: generateTransferNo(),
      transferDate: dayjs(),
      expectedReceiveDate: dayjs().add(1, 'day'),
      transferType: 'Same Plant Transfer',
      status: 'Draft',
      reasonCode: 'LOCATION_REPLENISHMENT',
      inTransitLocation: 'IN-TRANSIT',
      movementPosted: false,
      receivePosted: false,
      items: [{ id: generateId('line'), qty: 1, unitCost: 0, totalCost: 0 }],
    });

    setModalOpen(true);
  }

  function openEdit(record: InventoryTransfer) {
    if (!['Draft', 'Rejected'].includes(record.status)) {
      messageApi.warning('Only Draft or Rejected transfer can be edited.');
      return;
    }

    setEditing(record);

    form.setFieldsValue({
      ...record,
      transferDate: record.transferDate ? dayjs(record.transferDate) : dayjs(),
      expectedReceiveDate: record.expectedReceiveDate ? dayjs(record.expectedReceiveDate) : undefined,
      items: record.items?.map((i) => ({
        ...i,
        expiryDate: i.expiryDate ? dayjs(i.expiryDate) : undefined,
      })),
    });

    setModalOpen(true);

    setTimeout(() => {
      (record.items || []).forEach((_, idx) => refreshLineInventoryInfo(idx));
    }, 0);
  }

  function handleSave() {
    form.validateFields().then((values) => {
      const payload = buildPayloadFromForm(values, editing || undefined);
      const review = analyzeTransfer(payload);

      payload.aiScore = review.score;
      payload.aiStatus = review.status;
      payload.aiIssues = [...review.issues, ...review.warnings];
      payload.aiRecommendations = review.recommendations;

      const next = editing ? transfers.map((t) => (t.id === editing.id ? payload : t)) : [payload, ...transfers];

      persistTransfers(next);
      setModalOpen(false);

      messageApi.success(editing ? 'Transfer updated.' : 'Transfer created.');
    });
  }

  function updateStatus(record: InventoryTransfer, status: TransferStatus) {
    const now = new Date().toISOString();

    if (status === 'Approved') {
      const review = analyzeTransfer(record);

      if (review.status === 'Blocked') {
        Modal.error({
          title: 'AI Approval Blocked',
          content: (
            <div>
              <p>Please resolve the following blocking issues before approval:</p>
              <ul style={{ paddingLeft: 20 }}>
                {review.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ),
        });

        return;
      }
    }

    const updated: InventoryTransfer = {
  ...record,
  status,
  ...(status === 'Approved'
    ? {
        approvedBy: record.approver || 'System User',
        approvedAt: now,
      }
    : {}),
  updatedAt: now,
};

    persistTransfers(transfers.map((t) => (t.id === record.id ? updated : t)));
    setSelected((prev) => (prev?.id === record.id ? updated : prev));

    messageApi.success(`Transfer ${status}.`);
  }

  function duplicateTransfer(record: InventoryTransfer) {
    const now = new Date().toISOString();

    const copy: InventoryTransfer = {
      ...record,
      id: generateId('trf'),
      transferNo: generateTransferNo(),
      status: 'Draft',
      approvedBy: undefined,
      approvedAt: undefined,
      dispatchedBy: undefined,
      dispatchedAt: undefined,
      receivedBy: undefined,
      receivedAt: undefined,
      movementPosted: false,
      receivePosted: false,
      aiScore: undefined,
      aiStatus: undefined,
      aiIssues: undefined,
      aiRecommendations: undefined,
      items: record.items.map((i) => ({ ...i, id: generateId('line') })),
      createdAt: now,
      updatedAt: now,
    };

    persistTransfers([copy, ...transfers]);
    messageApi.success('Transfer duplicated as Draft.');
  }

  function deleteTransfer(record: InventoryTransfer) {
    if (record.status !== 'Draft') {
      messageApi.warning('Only Draft transfer can be deleted.');
      return;
    }

    persistTransfers(transfers.filter((t) => t.id !== record.id));
    messageApi.success('Transfer deleted.');
  }

  function consumeFromInventory(
    currentInventory: InventoryRow[],
    item: InventoryTransferItem,
    qty: number,
    sourceStatus: 'Available' | 'In Transit',
    options?: {
      plant?: string;
      location?: string;
      allowSourceId?: boolean;
      transferNo?: string;
    },
  ) {
    let remaining = qty;
    const movementsContext: any[] = [];

    const next = currentInventory.map((inv) => {
      if (
        remaining <= 0 ||
        !matchesInventory(inv, item, {
          status: sourceStatus,
          plant: options?.plant,
          location: options?.location,
          flexibleExpiry: true,
          allowSourceId: options?.allowSourceId,
          transferNo: options?.transferNo,
        })
      ) {
        return inv;
      }

      const available = sourceStatus === 'In Transit' ? getBatchQty(inv) : getAvailableQty(inv);
      if (available <= 0) return inv;

      const deduct = Math.min(remaining, available);
      remaining -= deduct;

      const beforeQty = getBatchQty(inv);
      const beforeAvailable = getAvailableQty(inv);

      const newBatchQty = Math.max(0, beforeQty - deduct);
      const newAvailableQty = sourceStatus === 'In Transit' ? 0 : Math.max(0, beforeAvailable - deduct);

      const unitCost = item.unitCost ?? getInventoryUnitCost(inv);

      movementsContext.push({
        inventoryId: getInventoryId(inv),
        deductedQty: deduct,
        beforeQty,
        afterQty: newBatchQty,
        beforeAvailableQty: beforeAvailable,
        afterAvailableQty: newAvailableQty,
        sourceInventory: inv,
        unitCost,
        totalCost: roundMoney(deduct * toNumber(unitCost)),
      });

      return setInventoryQty(inv, newBatchQty, newAvailableQty);
    });

    return {
      inventory: next,
      remaining,
      movementsContext,
    };
  }

  function addToInventory(
    currentInventory: InventoryRow[],
    item: InventoryTransferItem,
    qty: number,
    status: 'Available' | 'In Transit',
    overrides?: Partial<InventoryRow>,
  ) {
    const targetSku = item.sku || item.productCode || '';
    const targetProductCode = item.productCode || item.sku || '';
    const targetBatch = String(overrides?.batchNo ?? item.batchNo ?? '');
    const targetExpiry = normalizeDate(overrides?.expiryDate ?? item.expiryDate ?? '');
    const targetPlant = String(overrides?.plant ?? item.toPlant ?? '');
    const targetLocation = String(overrides?.location ?? item.toLocation ?? '');
    const targetUom = String(overrides?.uom ?? item.uom ?? '');
    const unitCost = roundMoney(item.unitCost ?? overrides?.unitCost ?? 0);

    let merged = false;

    const next = currentInventory.map((inv) => {
      const same =
        normalizeText(getSku(inv)) === normalizeText(targetSku) &&
        normalizeText(getBatch(inv)) === normalizeText(targetBatch) &&
        normalizeText(getPlant(inv)) === normalizeText(targetPlant) &&
        normalizeText(getLocation(inv)) === normalizeText(targetLocation) &&
        normalizeDate(getExpiry(inv)) === normalizeDate(targetExpiry) &&
        normalizeText(getUom(inv)) === normalizeText(targetUom) &&
        normalizeText(inv.status || inv.stockStatus || inv.inventoryStatus || 'Available') === normalizeText(status) &&
        normalizeText(inv.transferNo || '') === normalizeText(overrides?.transferNo || '');

      if (!same) return inv;

      merged = true;

      const newQty = getBatchQty(inv) + qty;
      const newAvail = status === 'In Transit' ? 0 : getAvailableQty(inv) + qty;

      return normalizeInventoryRecord(
        setInventoryQty(
          {
            ...inv,
            status,
            Status: status,
            stockStatus: status,
            inventoryStatus: status,
            unitCost: unitCost || getInventoryUnitCost(inv),
            inventoryCost: unitCost || getInventoryUnitCost(inv),
            cost: unitCost || getInventoryUnitCost(inv),
            ...overrides,
          },
          newQty,
          newAvail,
        ),
      );
    });

    if (!merged) {
      const now = new Date().toISOString();

      next.push(
        normalizeInventoryRecord({
          id: generateId('inv'),
          productCode: targetProductCode,
          sku: targetSku,
          productName: item.productName,
          batchNo: targetBatch,
          plant: targetPlant,
          location: targetLocation,
          expiryDate: targetExpiry,
          uom: targetUom,
          status,
          batchQty: qty,
          availableQty: status === 'In Transit' ? 0 : qty,
          onHandQty: qty,
          balanceQty: qty,
          quantity: qty,
          qty,
          unitCost,
          inventoryCost: unitCost,
          cost: unitCost,
          createdAt: now,
          updatedAt: now,
          ...overrides,
        }),
      );
    }

    return next;
  }

  function createMovement(
    trf: InventoryTransfer,
    item: InventoryTransferItem,
    movementType: string,
    direction: 'OUT' | 'IN' | 'TRANSFER',
    qty: number,
    extra?: any,
  ) {
    const unitCost = roundMoney(extra?.unitCost ?? item.unitCost ?? 0);
    const totalCost = roundMoney(extra?.totalCost ?? qty * unitCost);

    return {
      id: generateId('mov'),
      movementNo: generateMovementNo(),
      movementType,
      type: movementType,
      direction,

      referenceType: 'Inventory Transfer',
      referenceNo: trf.transferNo,
      sourceModule: 'Inventory Transfer',
      sourceId: trf.id,
      sourceLineId: item.id,

      productCode: item.productCode || item.sku,
      sku: item.sku,
      productName: item.productName,

      batchNo: item.batchNo,
      expiryDate: normalizeDate(item.expiryDate),
      uom: item.uom,

      qty,

      fromPlant: item.fromPlant,
      fromLocation: item.fromLocation,
      toPlant: item.toPlant,
      toLocation: item.toLocation,
      inTransitLocation: trf.inTransitLocation,

      unitCost,
      totalCost,

      reasonCode: trf.reasonCode,
      approver: trf.approver,
      approvedBy: trf.approvedBy,

      remarks: item.remarks || trf.remarks,
      movementDate: dayjs().format('YYYY-MM-DD'),
      createdAt: new Date().toISOString(),

      ...extra,
    };
  }

  function dispatchTransfer(record: InventoryTransfer) {
    if (record.status !== 'Approved') {
      messageApi.warning('Only Approved transfer can be dispatched.');
      return;
    }

    if (record.movementPosted) {
      messageApi.warning('This transfer has already been dispatched.');
      return;
    }

    const review = analyzeTransfer(record);

    if (review.status === 'Blocked') {
      Modal.error({
        title: 'AI Dispatch Blocked',
        content: (
          <div>
            <p>Please resolve the following issues before dispatch:</p>
            <ul style={{ paddingLeft: 20 }}>
              {review.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        ),
      });

      return;
    }

    let nextInventory = [...inventory];
    const movements: any[] = [];

    try {
      record.items.forEach((item) => {
        const qty = toNumber(item.qty);

        if (qty <= 0) {
          throw new Error(`Invalid transfer quantity for SKU ${item.sku}.`);
        }

        const result = consumeFromInventory(nextInventory, item, qty, 'Available', {
          allowSourceId: true,
        });

        if (result.remaining > 0) {
          throw new Error(`Insufficient source inventory for SKU ${item.sku}. Short ${result.remaining}.`);
        }

        nextInventory = result.inventory;

        result.movementsContext.forEach((ctx) => {
          movements.push(
            createMovement(record, item, 'Inventory Transfer Dispatch Out', 'OUT', ctx.deductedQty, {
              inventoryId: ctx.inventoryId,
              plant: item.fromPlant,
              location: item.fromLocation,
              beforeQty: ctx.beforeQty,
              afterQty: ctx.afterQty,
              beforeAvailableQty: ctx.beforeAvailableQty,
              afterAvailableQty: ctx.afterAvailableQty,
              unitCost: ctx.unitCost,
              totalCost: ctx.totalCost,
            }),
          );
        });

        nextInventory = addToInventory(nextInventory, item, qty, 'In Transit', {
          plant: item.toPlant,
          location: record.inTransitLocation || 'IN-TRANSIT',
          status: 'In Transit',
          stockStatus: 'In Transit',
          inventoryStatus: 'In Transit',
          availableQty: 0,
          transferNo: record.transferNo,
          sourceTransferId: record.id,
        });

        movements.push(
          createMovement(record, item, 'Inventory Transfer In Transit', 'TRANSFER', qty, {
            fromStatus: 'Available',
            toStatus: 'In Transit',
            plant: item.toPlant,
            location: record.inTransitLocation || 'IN-TRANSIT',
            transferNo: record.transferNo,
          }),
        );
      });

      persistInventory(nextInventory);
      appendMovements(movements);

      const now = new Date().toISOString();

      const updated: InventoryTransfer = {
        ...record,
        status: 'In Transit',
        movementPosted: true,
        dispatchedBy: 'System User',
        dispatchedAt: now,
        updatedAt: now,
        aiScore: review.score,
        aiStatus: review.status,
        aiIssues: [...review.issues, ...review.warnings],
        aiRecommendations: review.recommendations,
      };

      persistTransfers(transfers.map((t) => (t.id === record.id ? updated : t)));
      setSelected((prev) => (prev?.id === record.id ? updated : prev));

      messageApi.success('Transfer dispatched. Stock moved to In Transit.');
    } catch (err: any) {
      Modal.error({
        title: 'Dispatch Failed',
        content: err?.message || 'Unable to dispatch transfer.',
      });
    }
  }

  function receiveTransfer(record: InventoryTransfer) {
    if (record.status !== 'In Transit') {
      messageApi.warning('Only In Transit transfer can be received.');
      return;
    }

    if (record.receivePosted) {
      messageApi.warning('This transfer has already been received.');
      return;
    }

    let nextInventory = [...inventory];
    const movements: any[] = [];

    try {
      record.items.forEach((item) => {
        const qty = toNumber(item.qty);

        const inTransitItem: InventoryTransferItem = {
          ...item,
          fromPlant: item.toPlant,
          fromLocation: record.inTransitLocation || 'IN-TRANSIT',
        };

        const result = consumeFromInventory(nextInventory, inTransitItem, qty, 'In Transit', {
          plant: item.toPlant,
          location: record.inTransitLocation || 'IN-TRANSIT',
          allowSourceId: false,
          transferNo: record.transferNo,
        });

        if (result.remaining > 0) {
          throw new Error(`Insufficient in-transit inventory for SKU ${item.sku}. Short ${result.remaining}.`);
        }

        nextInventory = result.inventory;

        result.movementsContext.forEach((ctx) => {
          movements.push(
            createMovement(record, item, 'Inventory Transfer Receive From Transit', 'OUT', ctx.deductedQty, {
              inventoryId: ctx.inventoryId,
              plant: item.toPlant,
              location: record.inTransitLocation || 'IN-TRANSIT',
              beforeQty: ctx.beforeQty,
              afterQty: ctx.afterQty,
              beforeAvailableQty: ctx.beforeAvailableQty,
              afterAvailableQty: ctx.afterAvailableQty,
              unitCost: ctx.unitCost,
              totalCost: ctx.totalCost,
              transferNo: record.transferNo,
            }),
          );
        });

        nextInventory = addToInventory(nextInventory, item, qty, 'Available', {
          plant: item.toPlant,
          location: item.toLocation,
          status: 'Available',
          stockStatus: 'Available',
          inventoryStatus: 'Available',
          transferNo: undefined,
          sourceTransferId: undefined,
        });

        movements.push(
          createMovement(record, item, 'Inventory Transfer Receipt In', 'IN', qty, {
            fromStatus: 'In Transit',
            toStatus: 'Available',
            plant: item.toPlant,
            location: item.toLocation,
            transferNo: record.transferNo,
          }),
        );
      });

      persistInventory(nextInventory);
      appendMovements(movements);

      const now = new Date().toISOString();

      const updated: InventoryTransfer = {
        ...record,
        status: 'Completed',
        receivePosted: true,
        receivedBy: 'System User',
        receivedAt: now,
        updatedAt: now,
      };

      persistTransfers(transfers.map((t) => (t.id === record.id ? updated : t)));
      setSelected((prev) => (prev?.id === record.id ? updated : prev));

      messageApi.success('Transfer received and completed.');
    } catch (err: any) {
      Modal.error({
        title: 'Receive Failed',
        content: err?.message || 'Unable to receive transfer.',
      });
    }
  }

  function openAI(record: InventoryTransfer) {
    const review = analyzeTransfer(record);

    setAiReview(review);
    setSelected(record);
    setAiOpen(true);

    const updated: InventoryTransfer = {
      ...record,
      aiScore: review.score,
      aiStatus: review.status,
      aiIssues: [...review.issues, ...review.warnings],
      aiRecommendations: review.recommendations,
      updatedAt: new Date().toISOString(),
    };

    persistTransfers(transfers.map((t) => (t.id === record.id ? updated : t)));
  }

  function exportCsv() {
    const header = [
      'transferNo',
      'transferDate',
      'expectedReceiveDate',
      'transferType',
      'status',
      'reasonCode',
      'referenceNo',
      'requestor',
      'department',
      'approver',
      'inTransitLocation',
      'sku',
      'productName',
      'batchNo',
      'expiryDate',
      'uom',
      'fromPlant',
      'fromLocation',
      'toPlant',
      'toLocation',
      'qty',
      'unitCost',
      'totalCost',
      'remarks',
    ];

    const lines = [header.join(',')];

    transfers.forEach((trf) => {
      trf.items.forEach((item) => {
        lines.push(
          [
            trf.transferNo,
            trf.transferDate,
            trf.expectedReceiveDate,
            trf.transferType,
            trf.status,
            trf.reasonCode,
            trf.referenceNo,
            trf.requestor,
            trf.department,
            trf.approver,
            trf.inTransitLocation,
            item.sku,
            item.productName,
            item.batchNo,
            item.expiryDate,
            item.uom,
            item.fromPlant,
            item.fromLocation,
            item.toPlant,
            item.toLocation,
            item.qty,
            item.unitCost,
            item.totalCost,
            item.remarks || trf.remarks,
          ]
            .map(csvEscape)
            .join(','),
        );
      });
    });

    downloadFile(`inventory-transfers-${dayjs().format('YYYYMMDD-HHmm')}.csv`, lines.join('\n'));
  }

  function downloadTemplate() {
    const header = [
      'transferNo',
      'transferDate',
      'expectedReceiveDate',
      'transferType',
      'reasonCode',
      'referenceNo',
      'requestor',
      'department',
      'approver',
      'inTransitLocation',
      'sku',
      'productName',
      'batchNo',
      'expiryDate',
      'uom',
      'fromPlant',
      'fromLocation',
      'toPlant',
      'toLocation',
      'qty',
      'unitCost',
      'totalCost',
      'remarks',
    ];

    const sample = [
      '',
      dayjs().format('YYYY-MM-DD'),
      dayjs().add(1, 'day').format('YYYY-MM-DD'),
      'Same Plant Transfer',
      'LOCATION_REPLENISHMENT',
      'REF-TRF-001',
      'Warehouse User',
      'Warehouse',
      'Warehouse Supervisor',
      'IN-TRANSIT',
      'SKU-030',
      'Sample Product',
      'BATCH-001',
      '2027-12-31',
      'PCS',
      'PLANT-01',
      'A-01-01',
      'PLANT-01',
      'B-01-01',
      '5',
      '10.50',
      '52.50',
      'Move stock to pick face',
    ];

    downloadFile('inventory-transfer-template.csv', `${header.join(',')}\n${sample.map(csvEscape).join(',')}`);
  }

  function importCsv(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ''));

        if (rows.length < 2) {
          messageApi.error('CSV file is empty.');
          return;
        }

        const headers = rows[0].map((h) => h.trim());

        const records = rows.slice(1).map((row) => {
          const obj: any = {};

          headers.forEach((h, idx) => {
            obj[h] = row[idx]?.trim() ?? '';
          });

          return obj;
        });

        const grouped = new Map<string, any[]>();

        records.forEach((r, idx) => {
          const key = r.transferNo || `IMPORT-${idx + 1}-${generateTransferNo()}`;

          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)?.push(r);
        });

        const now = new Date().toISOString();
        const imported: InventoryTransfer[] = [];

        grouped.forEach((groupRows, transferNo) => {
          const first = groupRows[0];

          const items: InventoryTransferItem[] = groupRows.map((r) => {
            const qty = toNumber(r.qty);
            const unitCost = roundMoney(r.unitCost);

            return {
              id: generateId('line'),
              sku: r.sku,
              productCode: r.sku,
              productName: r.productName,
              batchNo: r.batchNo,
              expiryDate: normalizeDate(r.expiryDate),
              uom: r.uom,
              fromPlant: r.fromPlant,
              fromLocation: r.fromLocation,
              toPlant: r.toPlant,
              toLocation: r.toLocation,
              qty,
              unitCost,
              totalCost: roundMoney(r.totalCost || qty * unitCost),
              remarks: r.remarks,
            };
          });

          const totalQty = items.reduce((sum, item) => sum + toNumber(item.qty), 0);
          const totalCost = roundMoney(items.reduce((sum, item) => sum + toNumber(item.totalCost), 0));

          const trf: InventoryTransfer = {
            id: generateId('trf'),
            transferNo: transferNo.startsWith('IMPORT-') ? generateTransferNo() : transferNo,
            transferDate: normalizeDate(first.transferDate || dayjs()),
            expectedReceiveDate: normalizeDate(first.expectedReceiveDate),
            transferType: transferTypes.includes(first.transferType) ? first.transferType : 'Same Plant Transfer',
            status: 'Draft',
            reasonCode: first.reasonCode || 'OTHER',
            referenceNo: first.referenceNo,
            requestor: first.requestor,
            department: first.department,
            approver: first.approver,
            fromPlant: first.fromPlant,
            fromLocation: first.fromLocation,
            toPlant: first.toPlant,
            toLocation: first.toLocation,
            inTransitLocation: first.inTransitLocation || 'IN-TRANSIT',
            movementPosted: false,
            receivePosted: false,
            remarks: first.remarks,
            items,
            totalQty,
            totalCost,
            createdAt: now,
            updatedAt: now,
          };

          const review = analyzeTransfer(trf);

          trf.aiScore = review.score;
          trf.aiStatus = review.status;
          trf.aiIssues = [...review.issues, ...review.warnings];
          trf.aiRecommendations = review.recommendations;

          imported.push(trf);
        });

        persistTransfers([...imported, ...transfers]);
        messageApi.success(`${imported.length} transfer document(s) imported.`);
      } catch (err: any) {
        messageApi.error(err?.message || 'Failed to import CSV.');
      }
    };

    reader.readAsText(file);
  }

  function loadDemo() {
    const now = new Date().toISOString();

    const item: InventoryTransferItem = {
      id: generateId('line'),
      sku: 'SKU-030',
      productCode: 'SKU-030',
      productName: 'Demo Product',
      batchNo: 'BATCH-001',
      expiryDate: '2027-12-31',
      uom: 'PCS',
      fromPlant: 'PLANT-01',
      fromLocation: 'A-01-01',
      toPlant: 'PLANT-01',
      toLocation: 'B-01-01',
      qty: 2,
      unitCost: 10,
      totalCost: 20,
    };

    const demo: InventoryTransfer = {
      id: generateId('trf'),
      transferNo: generateTransferNo(),
      transferDate: dayjs().format('YYYY-MM-DD'),
      expectedReceiveDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
      transferType: 'Same Plant Transfer',
      status: 'Draft',
      reasonCode: 'LOCATION_REPLENISHMENT',
      referenceNo: 'TRF-DEMO-001',
      requestor: 'Warehouse User',
      department: 'Warehouse',
      approver: 'Warehouse Supervisor',
      fromPlant: 'PLANT-01',
      fromLocation: 'A-01-01',
      toPlant: 'PLANT-01',
      toLocation: 'B-01-01',
      inTransitLocation: 'IN-TRANSIT',
      movementPosted: false,
      receivePosted: false,
      remarks: 'Demo same plant inventory transfer.',
      items: [item],
      totalQty: 2,
      totalCost: 20,
      createdAt: now,
      updatedAt: now,
    };

    const review = analyzeTransfer(demo);

    demo.aiScore = review.score;
    demo.aiStatus = review.status;
    demo.aiIssues = [...review.issues, ...review.warnings];
    demo.aiRecommendations = review.recommendations;

    persistTransfers([demo, ...transfers]);
    messageApi.success('Demo transfer loaded.');
  }

  const columns: ColumnsType<InventoryTransfer> = [
    {
      title: 'Transfer No',
      dataIndex: 'transferNo',
      width: 170,
      fixed: 'left',
      render: (v, record) => (
        <Button
          type="link"
          onClick={() => {
            setSelected(record);
            setDetailOpen(true);
          }}
        >
          {v}
        </Button>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'transferDate',
      width: 110,
    },
    {
      title: 'Type',
      dataIndex: 'transferType',
      width: 170,
      render: (v) => <Tag color={typeColor(v)}>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (v) => <Tag color={statusColor(v)}>{v}</Tag>,
    },
    {
      title: 'AI',
      width: 170,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Tag color={aiStatusColor(record.aiStatus)} icon={<RobotOutlined />}>
            {record.aiStatus || 'Not Checked'}
          </Tag>
          {record.aiScore !== undefined && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Score: {record.aiScore}/100
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'From',
      width: 180,
      render: (_, record) => `${record.fromPlant || '-'} / ${record.fromLocation || '-'}`,
    },
    {
      title: 'To',
      width: 180,
      render: (_, record) => `${record.toPlant || '-'} / ${record.toLocation || '-'}`,
    },
    {
      title: 'Items',
      width: 90,
      render: (_, record) => record.items?.length || 0,
    },
    {
      title: 'Total Qty',
      width: 100,
      render: (_, record) => record.totalQty ?? record.items.reduce((sum, i) => sum + toNumber(i.qty), 0),
    },
    {
      title: 'Total Cost',
      width: 120,
      render: (_, record) => roundMoney(record.totalCost ?? record.items.reduce((sum, i) => sum + toNumber(i.totalCost), 0)),
    },
    {
      title: 'Reference',
      dataIndex: 'referenceNo',
      width: 150,
      render: (v) => v || '-',
    },
    {
      title: 'Actions',
      width: 390,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Tooltip title="View">
            <Button
              icon={<EyeOutlined />}
              onClick={() => {
                setSelected(record);
                setDetailOpen(true);
              }}
            />
          </Tooltip>

          <Tooltip title="AI Review">
            <Button icon={<RobotOutlined />} onClick={() => openAI(record)} />
          </Tooltip>

          <Tooltip title="Edit">
            <Button icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>

          <Tooltip title="Duplicate">
            <Button icon={<CopyOutlined />} onClick={() => duplicateTransfer(record)} />
          </Tooltip>

          {record.status === 'Draft' && (
            <Button type="primary" icon={<SendOutlined />} onClick={() => updateStatus(record, 'Submitted')}>
              Submit
            </Button>
          )}

          {record.status === 'Submitted' && (
            <>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => updateStatus(record, 'Approved')}>
                Approve
              </Button>
              <Button danger icon={<CloseCircleOutlined />} onClick={() => updateStatus(record, 'Rejected')}>
                Reject
              </Button>
            </>
          )}

          {record.status === 'Approved' && (
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => dispatchTransfer(record)}>
              Dispatch
            </Button>
          )}

          {record.status === 'In Transit' && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => receiveTransfer(record)}>
              Receive
            </Button>
          )}

          {['Draft', 'Submitted', 'Approved'].includes(record.status) && (
            <Tooltip title="Cancel">
              <Button icon={<StopOutlined />} onClick={() => updateStatus(record, 'Cancelled')} />
            </Tooltip>
          )}

          <Popconfirm title="Delete transfer?" onConfirm={() => deleteTransfer(record)}>
            <Tooltip title="Delete">
              <Button danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}

      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              <SwapOutlined /> Inventory Transfer
            </Title>
            <Text type="secondary">
              Move stock between locations or plants with in-transit tracking, receiving confirmation, inventory balance
              update, movement logs, and AI readiness review.
            </Text>
          </Col>

          <Col>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={loadAll}>
                Refresh
              </Button>

              <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
                Template
              </Button>

              <Upload
                showUploadList={false}
                beforeUpload={(file) => {
                  importCsv(file as File);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />}>Import CSV</Button>
              </Upload>

              <Button icon={<FileExcelOutlined />} onClick={exportCsv}>
                Export CSV
              </Button>

              <Button icon={<ImportOutlined />} onClick={loadDemo}>
                Load Demo
              </Button>

              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                New Transfer
              </Button>
            </Space>
          </Col>
        </Row>

        <Alert
          type="info"
          showIcon
          icon={<RobotOutlined />}
          title="AI transfer validation uses live inventory balance"
          description="AI checks source stock using SKU, Batch No, Plant, Location, Expiry Date, UOM, available quantity aliases, Product Master controls, and transfer workflow readiness."
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={4}>
            <Card>
              <Statistic title="Total" value={summary.total} />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Card>
              <Statistic title="Pending Approval" value={summary.pending} />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Card>
              <Statistic title="In Transit" value={summary.inTransit} />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Card>
              <Statistic title="Completed" value={summary.completed} />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Card>
              <Statistic title="High Risk" value={summary.highRisk} />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Card>
              <Statistic title="Transfer Value" value={summary.totalCost} precision={2} />
            </Card>
          </Col>
        </Row>

        <Card>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} md={10}>
              <Input.Search
                allowClear
                placeholder="Search transfer no, SKU, batch, location, approver..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Col>

            <Col xs={24} md={6}>
              <Select
                style={{ width: '100%' }}
                value={typeFilter}
                onChange={setTypeFilter}
                options={[{ label: 'All Types', value: 'All' }, ...transferTypes.map((t) => ({ label: t, value: t }))]}
              />
            </Col>

            <Col xs={24} md={6}>
              <Select
                style={{ width: '100%' }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { label: 'All Status', value: 'All' },
                  ...transferStatuses.map((s) => ({ label: s, value: s })),
                ]}
              />
            </Col>
          </Row>

          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredTransfers}
            scroll={{ x: 2100 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `${total} transfer(s)`,
            }}
            locale={{
              emptyText: <Empty description="No inventory transfer found" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        </Card>
      </Space>

      {/* Create / Edit Modal */}
      <Modal
        title={editing ? 'Edit Inventory Transfer' : 'New Inventory Transfer'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        width={1300}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changed) => {
            if (
              changed.transferType !== undefined ||
              changed.fromPlant !== undefined ||
              changed.fromLocation !== undefined ||
              changed.toPlant !== undefined ||
              changed.toLocation !== undefined
            ) {
              syncHeaderToLines(changed);
            }

            if (changed.items) {
              const changedIndex = Number(Object.keys(changed.items)[0]);

              if (Number.isFinite(changedIndex)) {
                setTimeout(() => refreshLineInventoryInfo(changedIndex), 0);
              }
            }
          }}
        >
          <Row gutter={12}>
            <Col xs={24} md={6}>
              <Form.Item name="transferNo" label="Transfer No">
                <Input disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="transferDate" label="Transfer Date" rules={[{ required: true, message: 'Transfer Date is required' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="expectedReceiveDate" label="Expected Receive Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="transferType" label="Transfer Type" rules={[{ required: true, message: 'Transfer Type is required' }]}>
                <Select options={transferTypes.map((t) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="reasonCode" label="Reason Code" rules={[{ required: true, message: 'Reason Code is required' }]}>
                <Select showSearch options={reasonCodes.map((r) => ({ label: r, value: r }))} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="referenceNo" label="Reference No">
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="requestor" label="Requestor">
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="department" label="Department">
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="approver" label="Approver">
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="fromPlant" label="Header From Plant">
                <Input placeholder="Optional header default" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="fromLocation" label="Header From Location">
                <Input placeholder="Optional header default" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="toPlant" label="Header To Plant">
                <Input placeholder="For same plant, can match From Plant" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="toLocation" label="Header To Location">
                <Input placeholder="Destination location" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="inTransitLocation" label="In-Transit Location">
                <Input placeholder="IN-TRANSIT" />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item name="remarks" label="Remarks">
                <TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left">Transfer Items</Divider>

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title="Transfer workflow"
            description="Approved transfers must be dispatched first. Dispatch deducts available stock and creates In Transit stock. Receive confirms the transfer and moves stock into the destination plant/location."
          />

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <Space orientation="vertical" style={{ width: '100%' }}>
                {fields.map((field, idx) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`Line ${idx + 1}`}
                    extra={
                      fields.length > 1 && (
                        <Button danger size="small" onClick={() => remove(field.name)}>
                          Remove
                        </Button>
                      )
                    }
                  >
                    <Row gutter={12}>
                      <Form.Item name={[field.name, 'id']} hidden>
                        <Input />
                      </Form.Item>

                      <Form.Item name={[field.name, 'sourceInventoryId']} hidden>
                        <Input />
                      </Form.Item>

                      <Col xs={24}>
                        <Form.Item label="Select Source Inventory Stock">
                          <Select
                            showSearch
                            allowClear
                            placeholder="Recommended. Select source inventory to auto-fill SKU, batch, plant, location, expiry, UOM, qty and cost."
                            options={availableInventoryOptions}
                            onChange={(value) => {
                              if (value) applyInventoryToLine(field.name, value);
                            }}
                            filterOption={(input, option) => normalizeText(option?.label).includes(normalizeText(input))}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item name={[field.name, 'sku']} label="SKU" rules={[{ required: true, message: 'SKU is required' }]}>
                          <Select
                            showSearch
                            allowClear
                            options={productOptions}
                            onChange={(value) => {
                              const product = findProductBySku(value);
                              const items = form.getFieldValue('items') || [];
                              const current = items[field.name] || {};
                              const qty = toNumber(current.qty || 1);
                              const unitCost = current.unitCost || getProductCost(product);

                              items[field.name] = {
                                ...current,
                                sku: value,
                                productCode: product?.productCode || value,
                                productName: getProductName(product),
                                uom: getUom(product) || '',
                                unitCost,
                                totalCost: roundMoney(qty * unitCost),
                              };

                              form.setFieldsValue({ items });

                              setTimeout(() => refreshLineInventoryInfo(field.name), 0);
                            }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item name={[field.name, 'productName']} label="Product Name">
                          <Input />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item name={[field.name, 'batchNo']} label="Batch No">
                          <Input />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item name={[field.name, 'expiryDate']} label="Expiry Date">
                          <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item name={[field.name, 'uom']} label="UOM">
                          <Input />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item name={[field.name, 'fromPlant']} label="From Plant" rules={[{ required: true, message: 'From Plant is required' }]}>
                          <Input />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item
                          name={[field.name, 'fromLocation']}
                          label="From Location"
                          rules={[{ required: true, message: 'From Location is required' }]}
                        >
                          <Input />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item name={[field.name, 'toPlant']} label="To Plant" rules={[{ required: true, message: 'To Plant is required' }]}>
                          <Input />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item
                          name={[field.name, 'toLocation']}
                          label="To Location"
                          rules={[{ required: true, message: 'To Location is required' }]}
                        >
                          <Input />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item name={[field.name, 'qty']} label="Qty" rules={[{ required: true, message: 'Qty is required' }]}>
                          <InputNumber min={0.0001} style={{ width: '100%' }} onChange={(value) => recalculateLineCost(field.name, value)} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item name={[field.name, 'unitCost']} label="Unit Cost">
                          <InputNumber
                            min={0}
                            precision={2}
                            style={{ width: '100%' }}
                            onChange={() => setTimeout(() => recalculateLineCost(field.name), 0)}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item name={[field.name, 'totalCost']} label="Total Cost">
                          <InputNumber disabled precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item name={[field.name, 'currentAvailableQty']} label="Current Available">
                          <InputNumber disabled style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>

                      <Col span={24}>
                        <Form.Item name={[field.name, 'remarks']} label="Line Remarks">
                          <Input />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}

                <Button icon={<PlusOutlined />} onClick={() => add({ id: generateId('line'), qty: 1, unitCost: 0, totalCost: 0 })}>
                  Add Line
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer title="Inventory Transfer Detail" open={detailOpen} onClose={() => setDetailOpen(false)} size="large" destroyOnHidden>
        {selected && (
          <Space orientation="vertical" style={{ width: '100%' }} size="large">
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Text strong>Transfer No:</Text> {selected.transferNo}
              </Col>

              <Col span={12}>
                <Text strong>Status:</Text> <Tag color={statusColor(selected.status)}>{selected.status}</Tag>
              </Col>

              <Col span={12}>
                <Text strong>Type:</Text> <Tag color={typeColor(selected.transferType)}>{selected.transferType}</Tag>
              </Col>

              <Col span={12}>
                <Text strong>Date:</Text> {selected.transferDate}
              </Col>

              <Col span={12}>
                <Text strong>Expected Receive:</Text> {selected.expectedReceiveDate || '-'}
              </Col>

              <Col span={12}>
                <Text strong>Reason:</Text> {selected.reasonCode}
              </Col>

              <Col span={12}>
                <Text strong>Requestor:</Text> {selected.requestor || '-'}
              </Col>

              <Col span={12}>
                <Text strong>Approver:</Text> {selected.approver || '-'}
              </Col>

              <Col span={12}>
                <Text strong>In-Transit Location:</Text> {selected.inTransitLocation || '-'}
              </Col>

              <Col span={12}>
                <Text strong>Total Cost:</Text> {roundMoney(selected.totalCost)}
              </Col>
            </Row>

            <Alert
              title={
                <Space wrap>
                  <RobotOutlined />
                  AI Status:
                  <Tag color={aiStatusColor(selected.aiStatus)}>{selected.aiStatus || 'Not Checked'}</Tag>
                  {selected.aiScore !== undefined && <Text>Score: {selected.aiScore}/100</Text>}
                </Space>
              }
              type={selected.aiStatus === 'Blocked' ? 'error' : selected.aiStatus === 'Ready' ? 'success' : 'warning'}
              showIcon
            />

            <Space wrap>
              <Button icon={<RobotOutlined />} onClick={() => openAI(selected)}>
                AI Transfer Review
              </Button>

              {selected.status === 'Draft' && (
                <Button type="primary" icon={<SendOutlined />} onClick={() => updateStatus(selected, 'Submitted')}>
                  Submit
                </Button>
              )}

              {selected.status === 'Submitted' && (
                <>
                  <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => updateStatus(selected, 'Approved')}>
                    Approve
                  </Button>
                  <Button danger icon={<CloseCircleOutlined />} onClick={() => updateStatus(selected, 'Rejected')}>
                    Reject
                  </Button>
                </>
              )}

              {selected.status === 'Approved' && (
                <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => dispatchTransfer(selected)}>
                  Dispatch Transfer
                </Button>
              )}

              {selected.status === 'In Transit' && (
                <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => receiveTransfer(selected)}>
                  Receive Transfer
                </Button>
              )}
            </Space>

            <Table
              rowKey="id"
              dataSource={selected.items}
              pagination={false}
              scroll={{ x: 1500 }}
              columns={[
                { title: 'SKU', dataIndex: 'sku' },
                { title: 'Product', dataIndex: 'productName' },
                { title: 'Batch', dataIndex: 'batchNo' },
                { title: 'Expiry', dataIndex: 'expiryDate' },
                { title: 'UOM', dataIndex: 'uom' },
                { title: 'From Plant', dataIndex: 'fromPlant' },
                { title: 'From Location', dataIndex: 'fromLocation' },
                { title: 'To Plant', dataIndex: 'toPlant' },
                { title: 'To Location', dataIndex: 'toLocation' },
                { title: 'Qty', dataIndex: 'qty' },
                { title: 'Unit Cost', dataIndex: 'unitCost', render: (v) => roundMoney(v) },
                { title: 'Total Cost', dataIndex: 'totalCost', render: (v) => roundMoney(v) },
                { title: 'Current Available', dataIndex: 'currentAvailableQty' },
                { title: 'Remarks', dataIndex: 'remarks' },
              ]}
            />

            {selected.remarks && (
              <Card title="Remarks">
                <Text>{selected.remarks}</Text>
              </Card>
            )}
          </Space>
        )}
      </Drawer>

      {/* AI Modal */}
      <Modal
        title={
          <Space>
            <RobotOutlined />
            AI Inventory Transfer Review
          </Space>
        }
        open={aiOpen}
        onCancel={() => setAiOpen(false)}
        footer={[
          <Button key="close" onClick={() => setAiOpen(false)}>
            Close
          </Button>,
        ]}
        width={850}
        destroyOnHidden
      >
        {aiReview && (
          <Space orientation="vertical" style={{ width: '100%' }} size="large">
            <Card>
              <Row gutter={16} align="middle">
                <Col xs={24} md={8}>
                  <Statistic
                    title="AI Status"
                    value={aiReview.status}
                    prefix={<RobotOutlined />}
                    valueStyle={{
                      color: aiReview.status === 'Blocked' ? '#cf1322' : aiReview.status === 'Ready' ? '#3f8600' : '#faad14',
                      fontSize: 18,
                    }}
                  />
                </Col>

                <Col xs={24} md={16}>
                  <Text strong>Transfer Readiness Score</Text>
                  <Progress percent={aiReview.score} status={aiReview.status === 'Blocked' ? 'exception' : 'active'} />
                </Col>
              </Row>
            </Card>

            {aiReview.issues.length > 0 && (
              <Alert
                type="error"
                showIcon
                icon={<WarningOutlined />}
                title="Blocking Issues"
                description={
                  <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                    {aiReview.issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                }
              />
            )}

            {aiReview.warnings.length > 0 && (
              <Alert
                type="warning"
                showIcon
                title="Warnings"
                description={
                  <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                    {aiReview.warnings.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                }
              />
            )}

            <Alert
              type="info"
              showIcon
              title="AI Recommendations"
              description={
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  {aiReview.recommendations.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              }
            />

            {selected && (
              <Card size="small" title="Reviewed Transfer">
                <Space orientation="vertical">
                  <Text>
                    <strong>Transfer:</strong> {selected.transferNo}
                  </Text>
                  <Text>
                    <strong>Type:</strong> {selected.transferType}
                  </Text>
                  <Text>
                    <strong>Status:</strong> {selected.status}
                  </Text>
                  <Text>
                    <strong>Approver:</strong> {selected.approver || '-'}
                  </Text>
                </Space>
              </Card>
            )}

            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              AI checked source inventory balance, SKU / batch / plant / location matching, expiry, UOM, product master
              status, transfer route, value risk, and dispatch / receiving readiness.
            </Paragraph>
          </Space>
        )}
      </Modal>
    </div>
  );
}