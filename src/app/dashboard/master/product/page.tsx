'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
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
  ExclamationCircleOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

type ProductStatus = 'Active' | 'Inactive';
type ModalMode = 'create' | 'edit' | 'view';
type AiStatus = 'healthy' | 'warning' | 'critical';
type AiSeverity = 'info' | 'warning' | 'critical';

interface UomRecord {
  id?: string;
  uomCode?: string;
  uomName?: string;
  uomType?: string;
  code?: string;
  name?: string;
  uom?: string;
  unitCode?: string;
  unitName?: string;
  status?: string;
  recordStatus?: string;
  isActive?: boolean;
}

interface StatusRecord {
  id?: string;
  statusCode?: string;
  statusName?: string;
  code?: string;
  name?: string;
  module?: string;
  status?: string;
  recordStatus?: string;
  isActive?: boolean;
  isDefault?: boolean;
  sort?: number;
}

interface ProductMaster {
  id: string;
  productCode?: string;
  code?: string;
  itemCode?: string;
  itemName?: string;
  name?: string;
  sku: string;
  productName: string;
  barcode?: string;
  category?: string;
  brand?: string;
  itemType?: string;
  storageType?: string;
  shelfLifeDays?: number;
  uom: string;
  purchaseUom?: string;
  salesUom?: string;
  purchaseToBaseFactor?: number;
  salesToBaseFactor?: number;
  status: ProductStatus;
  isBatchControlled: boolean;
  isExpiryControlled: boolean;
  minStockLevel?: number;
  maxStockLevel?: number;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

interface InventoryRecord {
  id?: string;
  productCode?: string;
  sku?: string;
  productName?: string;
  itemCode?: string;
  itemName?: string;
  name?: string;
  batchNo?: string;
  batchNumber?: string;
  plant?: string;
  location?: string;
  expiryDate?: string;
  expDate?: string;
  uom?: string;
  UOM?: string;
  availableQty?: number;
  balanceQty?: number;
  qtyAvailable?: number;
  available?: number;
  currentQty?: number;
  stockBalance?: number;
  status?: string;
  __rowKey?: string;
  [key: string]: any;
}

interface ProductAiIssue {
  id: string;
  severity: AiSeverity;
  category: string;
  title: string;
  message: string;
  recommendation: string;
}

interface ProductAiResult {
  productId: string;
  sku: string;
  productCode: string;
  productName: string;
  status: AiStatus;
  score: number;
  stockQty: number;
  issueCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  summary: string;
  canUseInbound: boolean;
  canUseOutbound: boolean;
  issues: ProductAiIssue[];
  recommendations: string[];
}

const STORAGE_KEY = 'wms_product_master';
const LEGACY_STORAGE_KEY = 'master_products_v1';
const COMPAT_STORAGE_KEY = 'wms_products';
const EXTRA_COMPAT_STORAGE_KEY = 'wms_product_sku_master';
const UOM_STORAGE_KEY = 'wms_uom_master';
const STATUS_STORAGE_KEY = 'wms_status_master';
const INVENTORY_KEYS = ['wms_inventory', 'wms_inventory_management'];

const defaultCreatedAt = new Date().toISOString();

const defaultProducts: ProductMaster[] = [
  {
    id: 'PROD-001',
    productCode: 'SKU-001',
    code: 'SKU-001',
    itemCode: 'SKU-001',
    itemName: 'Sample Product A',
    name: 'Sample Product A',
    sku: 'SKU-001',
    productName: 'Sample Product A',
    barcode: '955000000001',
    category: 'General',
    brand: 'Default Brand',
    itemType: 'Finished Goods',
    storageType: 'Ambient',
    shelfLifeDays: 365,
    uom: 'PCS',
    purchaseUom: 'CTN',
    salesUom: 'PCS',
    purchaseToBaseFactor: 24,
    salesToBaseFactor: 1,
    status: 'Active',
    isBatchControlled: true,
    isExpiryControlled: true,
    minStockLevel: 10,
    maxStockLevel: 500,
    remarks: 'Sample product for testing GRN and inventory flow.',
    createdAt: defaultCreatedAt,
    updatedAt: defaultCreatedAt,
  },
  {
    id: 'PROD-002',
    productCode: 'SKU-002',
    code: 'SKU-002',
    itemCode: 'SKU-002',
    itemName: 'Sample Product B',
    name: 'Sample Product B',
    sku: 'SKU-002',
    productName: 'Sample Product B',
    barcode: '955000000002',
    category: 'General',
    brand: 'Default Brand',
    itemType: 'Finished Goods',
    storageType: 'Ambient',
    shelfLifeDays: undefined,
    uom: 'CTN',
    purchaseUom: 'CTN',
    salesUom: 'CTN',
    purchaseToBaseFactor: 1,
    salesToBaseFactor: 1,
    status: 'Active',
    isBatchControlled: true,
    isExpiryControlled: false,
    minStockLevel: 5,
    maxStockLevel: 200,
    remarks: 'Non-expiry controlled sample item.',
    createdAt: defaultCreatedAt,
    updatedAt: defaultCreatedAt,
  },
];

const fallbackUomOptions = [
  'PCS',
  'CTN',
  'BOX',
  'PACK',
  'KG',
  'G',
  'L',
  'ML',
  'BAG',
  'ROLL',
  'SET',
  'PALLET',
];

const fallbackProductStatusOptions: {
  label: string;
  value: ProductStatus;
}[] = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
];

const categoryOptions = [
  'General',
  'Raw Material',
  'Finished Goods',
  'Packaging',
  'Consumable',
  'Spare Part',
];

const itemTypeOptions = [
  'Finished Goods',
  'Raw Material',
  'Packaging Material',
  'Trading Goods',
  'Consumable',
  'Spare Part',
];

const storageTypeOptions = [
  'Ambient',
  'Chilled',
  'Frozen',
  'Dry',
  'Hazardous',
  'Controlled Room Temperature',
];

const csvHeaders = [
  'productCode',
  'sku',
  'productName',
  'barcode',
  'category',
  'brand',
  'itemType',
  'storageType',
  'shelfLifeDays',
  'uom',
  'purchaseUom',
  'salesUom',
  'purchaseToBaseFactor',
  'salesToBaseFactor',
  'status',
  'isBatchControlled',
  'isExpiryControlled',
  'minStockLevel',
  'maxStockLevel',
  'remarks',
];

/* ============================================================================
 * Generic Helpers
 * ========================================================================== */

function generateId() {
  return `PROD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function generateAiId() {
  return `AI-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function normalizeText(value?: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizePlainText(value?: unknown) {
  return String(value ?? '').trim();
}

function normalizeHeader(value?: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeStatusToProductStatus(value?: unknown): ProductStatus | undefined {
  const normalized = String(value ?? '').trim().toUpperCase();

  if (['ACTIVE', 'A', 'YES', 'Y', 'TRUE', '1', 'ENABLED'].includes(normalized)) {
    return 'Active';
  }

  if (['INACTIVE', 'I', 'NO', 'N', 'FALSE', '0', 'DISABLED'].includes(normalized)) {
    return 'Inactive';
  }

  return undefined;
}

function isActiveMasterRecord(record: any) {
  const status = record?.status ?? record?.recordStatus ?? record?.isActive;

  if (typeof status === 'boolean') return status;

  const normalized = String(status ?? '').trim().toUpperCase();

  if (!normalized) return true;

  return !['INACTIVE', 'DISABLED', 'FALSE', 'NO', 'N', '0'].includes(normalized);
}

function getFirstText(record: any, keys: string[]) {
  for (const key of keys) {
    const value = String(record?.[key] ?? '').trim();

    if (value) return value;
  }

  return '';
}

function firstNonEmpty(record: any, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];

    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return undefined;
}

function parseBoolean(value: unknown, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();

  if (['yes', 'y', 'true', '1', 'active', 'enabled'].includes(normalized)) return true;
  if (['no', 'n', 'false', '0', 'inactive', 'disabled'].includes(normalized)) return false;

  return defaultValue;
}

function parseNumber(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const numberValue = Number(String(value).replace(/,/g, '').trim());

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function parsePositiveNumber(value: unknown, defaultValue = 1) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const numberValue = Number(String(value).replace(/,/g, '').trim());

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return defaultValue;
  }

  return numberValue;
}

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) return '';

  const text = String(value);

  if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], {
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
}

function convertToCsv(headers: string[], rows: Record<string, unknown>[]) {
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(','));

  return [headerLine, ...dataLines].join('\n');
}

function parseCSVRows(csvText: string) {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let insideQuotes = false;

  const text = csvText.replace(/^\uFEFF/, '');

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

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
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i += 1;
      }

      row.push(current.trim());

      if (row.some((cell) => cell !== '')) {
        rows.push(row);
      }

      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current.trim());

  if (row.some((cell) => cell !== '')) {
    rows.push(row);
  }

  return rows;
}

function parseCSV(csvText: string) {
  const csvRows = parseCSVRows(csvText);

  if (csvRows.length < 2) return [];

  const headers = csvRows[0].map((header) => header.trim());

  return csvRows.slice(1).map((values) => {
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
      row[normalizeHeader(header)] = values[index] || '';
    });

    return row;
  });
}

function getCsvValue(row: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const directValue = row[alias];

    if (directValue !== undefined && directValue !== null && String(directValue).trim() !== '') {
      return directValue;
    }

    const normalizedValue = row[normalizeHeader(alias)];

    if (normalizedValue !== undefined && normalizedValue !== null && String(normalizedValue).trim() !== '') {
      return normalizedValue;
    }
  }

  return '';
}

function readStorageArray<T = any>(key: string): T[] {
  try {
    if (typeof window === 'undefined') return [];

    const stored = localStorage.getItem(key);

    if (!stored) return [];

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDateTime(value?: string) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString();
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

/* ============================================================================
 * Inventory Helpers
 * ========================================================================== */

function getInventoryAvailableQty(record: InventoryRecord) {
  const rawValue = firstNonEmpty(record, [
    'availableQty',
    'balanceQty',
    'qtyAvailable',
    'available',
    'currentQty',
    'stockBalance',
    'availableQuantity',
    'balanceInventory',
    'balanceQuantity',
    'onHandQty',
    'remainingQty',
    'currentStock',
    'qty',
    'quantity',
  ]);

  const qty = Number(rawValue);

  return Number.isFinite(qty) ? qty : 0;
}

function getInventoryRowKey(record: InventoryRecord) {
  if (record.__rowKey) return String(record.__rowKey);
  if (record.id) return String(record.id);

  return [
    normalizeText(record.productCode),
    normalizeText(record.sku || record.itemCode),
    normalizeText(record.batchNo || record.batchNumber),
    normalizeText(record.plant),
    normalizeText(record.location),
    normalizeText(record.expiryDate || record.expDate),
  ].join('|');
}

function readMergedInventory() {
  const map = new Map<string, InventoryRecord>();

  INVENTORY_KEYS.forEach((key) => {
    readStorageArray<InventoryRecord>(key).forEach((record, index) => {
      const baseKey = getInventoryRowKey(record);
      const rowKey = `${key}|${baseKey || 'ROW'}|${index}`;
      map.set(rowKey, {
        ...record,
        __rowKey: rowKey,
      });
    });
  });

  return Array.from(map.values());
}

/* ============================================================================
 * Product Migration / Normalization
 * ========================================================================== */

function migrateProduct(item: any): ProductMaster {
  const now = new Date().toISOString();

  const sku = normalizeText(
    firstNonEmpty(item, ['sku', 'SKU', 'skuCode', 'itemCode', 'Item Code', 'item_code', 'materialCode']),
  );

  const productCode =
    normalizeText(
      firstNonEmpty(item, ['productCode', 'Product Code', 'product_code', 'code', 'Code', 'materialCode']),
    ) || sku;

  const productName = normalizePlainText(
    firstNonEmpty(item, ['productName', 'Product Name', 'product_name', 'itemName', 'Item Name', 'name', 'Name']),
  );

  const baseUom = normalizeText(firstNonEmpty(item, ['uom', 'UOM', 'baseUom', 'Base UOM', 'unit'])) || 'PCS';

  const purchaseUom =
    normalizeText(firstNonEmpty(item, ['purchaseUom', 'Purchase UOM', 'purchase_uom'])) || baseUom;

  const salesUom = normalizeText(firstNonEmpty(item, ['salesUom', 'Sales UOM', 'sales_uom'])) || baseUom;

  const status =
    normalizeStatusToProductStatus(firstNonEmpty(item, ['status', 'Status', 'recordStatus', 'productStatus'])) ||
    'Active';

  return {
    id: item.id || generateId(),
    productCode,
    code: productCode,
    itemCode: sku,
    itemName: productName,
    name: productName,
    sku,
    productName,
    barcode: normalizePlainText(firstNonEmpty(item, ['barcode', 'Barcode', 'barCode'])),
    category: normalizePlainText(firstNonEmpty(item, ['category', 'Category', 'productCategory'])) || 'General',
    brand: normalizePlainText(firstNonEmpty(item, ['brand', 'Brand'])),
    itemType:
      normalizePlainText(firstNonEmpty(item, ['itemType', 'Item Type', 'item_type', 'productType'])) ||
      'Finished Goods',
    storageType:
      normalizePlainText(firstNonEmpty(item, ['storageType', 'Storage Type', 'storage_type'])) || 'Ambient',
    shelfLifeDays: parseNumber(firstNonEmpty(item, ['shelfLifeDays', 'Shelf Life Days', 'shelf_life_days', 'shelfLife'])),
    uom: baseUom,
    purchaseUom,
    salesUom,
    purchaseToBaseFactor: parsePositiveNumber(
      firstNonEmpty(item, ['purchaseToBaseFactor', 'Purchase To Base Factor', 'purchase_to_base_factor']),
      1,
    ),
    salesToBaseFactor: parsePositiveNumber(
      firstNonEmpty(item, ['salesToBaseFactor', 'Sales To Base Factor', 'sales_to_base_factor']),
      1,
    ),
    status,
    isBatchControlled:
      item.isBatchControlled === undefined
        ? parseBoolean(firstNonEmpty(item, ['batchControlled', 'Batch Controlled', 'is_batch_controlled']), true)
        : Boolean(item.isBatchControlled),
    isExpiryControlled:
      item.isExpiryControlled === undefined
        ? parseBoolean(firstNonEmpty(item, ['expiryControlled', 'Expiry Controlled', 'is_expiry_controlled']), true)
        : Boolean(item.isExpiryControlled),
    minStockLevel: parseNumber(firstNonEmpty(item, ['minStockLevel', 'Min Stock Level', 'min_stock_level'])),
    maxStockLevel: parseNumber(firstNonEmpty(item, ['maxStockLevel', 'Max Stock Level', 'max_stock_level'])),
    remarks: normalizePlainText(firstNonEmpty(item, ['remarks', 'Remarks', 'notes'])),
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  };
}

function mergeProductSources(sources: any[][]) {
  const map = new Map<string, ProductMaster>();

  sources.flat().forEach((item) => {
    const migrated = migrateProduct(item);

    if (!migrated.sku || !migrated.productName) return;

    const key = normalizeText(migrated.sku);

    if (!map.has(key)) {
      map.set(key, migrated);
    } else {
      const existing = map.get(key)!;

      map.set(key, {
        ...existing,
        ...migrated,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: migrated.updatedAt || existing.updatedAt,
      });
    }
  });

  return Array.from(map.values());
}

/* ============================================================================
 * AI Helpers
 * ========================================================================== */

function aiStatusColor(status: AiStatus) {
  if (status === 'healthy') return 'green';
  if (status === 'warning') return 'orange';
  return 'red';
}

function aiStatusLabel(status: AiStatus) {
  if (status === 'healthy') return 'Healthy';
  if (status === 'warning') return 'Warning';
  return 'Critical';
}

function aiSeverityColor(severity: AiSeverity) {
  if (severity === 'critical') return 'red';
  if (severity === 'warning') return 'orange';
  return 'blue';
}

function buildDuplicateMaps(products: ProductMaster[]) {
  const skuMap = new Map<string, ProductMaster[]>();
  const codeMap = new Map<string, ProductMaster[]>();
  const barcodeMap = new Map<string, ProductMaster[]>();

  products.forEach((product) => {
    const sku = normalizeText(product.sku);
    const productCode = normalizeText(product.productCode);
    const barcode = normalizeText(product.barcode);

    if (sku) {
      skuMap.set(sku, [...(skuMap.get(sku) || []), product]);
    }

    if (productCode) {
      codeMap.set(productCode, [...(codeMap.get(productCode) || []), product]);
    }

    if (barcode) {
      barcodeMap.set(barcode, [...(barcodeMap.get(barcode) || []), product]);
    }
  });

  return { skuMap, codeMap, barcodeMap };
}

function isExpiredDate(dateText?: string) {
  if (!dateText) return false;

  const value = new Date(dateText);
  const today = new Date(todayDate());

  if (Number.isNaN(value.getTime())) return false;

  return value < today;
}

function analyzeProductMasterAi(params: {
  product: ProductMaster;
  allProducts: ProductMaster[];
  inventoryRows: InventoryRecord[];
  validUomCodes: Set<string>;
  stockQty: number;
}): ProductAiResult {
  const { product, allProducts, inventoryRows, validUomCodes, stockQty } = params;

  const issues: ProductAiIssue[] = [];
  const recommendations: string[] = [];

  const addIssue = (
    severity: AiSeverity,
    category: string,
    title: string,
    message: string,
    recommendation: string,
  ) => {
    issues.push({
      id: generateAiId(),
      severity,
      category,
      title,
      message,
      recommendation,
    });

    recommendations.push(recommendation);
  };

  const duplicateMaps = buildDuplicateMaps(allProducts);
  const skuKey = normalizeText(product.sku);
  const codeKey = normalizeText(product.productCode);
  const barcodeKey = normalizeText(product.barcode);

  if (!skuKey) {
    addIssue(
      'critical',
      'Required Data',
      'Missing SKU',
      'SKU is required for inventory matching, inbound, outbound, and CSV integration.',
      'Maintain a unique SKU before using this product operationally.',
    );
  }

  if (!product.productName?.trim()) {
    addIssue(
      'critical',
      'Required Data',
      'Missing Product Name',
      'Product Name is required for operational visibility and document printing.',
      'Maintain Product Name.',
    );
  }

  if (!codeKey) {
    addIssue(
      'warning',
      'Required Data',
      'Missing Product Code',
      'Product Code is blank. Other modules may default to SKU, but a stable product code is recommended.',
      'Set Product Code equal to SKU if no separate product code is needed.',
    );
  }

  if (skuKey && (duplicateMaps.skuMap.get(skuKey)?.length || 0) > 1) {
    addIssue(
      'critical',
      'Duplicate',
      'Duplicate SKU detected',
      `SKU "${product.sku}" exists in more than one Product Master record.`,
      'Keep SKU unique. Merge or rename duplicate product records.',
    );
  }

  if (codeKey && (duplicateMaps.codeMap.get(codeKey)?.length || 0) > 1) {
    addIssue(
      'critical',
      'Duplicate',
      'Duplicate Product Code detected',
      `Product Code "${product.productCode}" exists in more than one Product Master record.`,
      'Keep Product Code unique across Product Master.',
    );
  }

  if (barcodeKey && (duplicateMaps.barcodeMap.get(barcodeKey)?.length || 0) > 1) {
    addIssue(
      'critical',
      'Duplicate',
      'Duplicate Barcode detected',
      `Barcode "${product.barcode}" exists in more than one Product Master record.`,
      'Keep Barcode unique or clear barcode on duplicate records.',
    );
  }

  const uom = normalizeText(product.uom);
  const purchaseUom = normalizeText(product.purchaseUom || product.uom);
  const salesUom = normalizeText(product.salesUom || product.uom);

  if (!uom || !validUomCodes.has(uom)) {
    addIssue(
      'critical',
      'UOM',
      'Invalid Base UOM',
      `Base UOM "${product.uom || '-'}" is not found in active UOM Master options.`,
      'Maintain the UOM in UOM Master or choose a valid Base UOM.',
    );
  }

  if (!purchaseUom || !validUomCodes.has(purchaseUom)) {
    addIssue(
      'critical',
      'UOM',
      'Invalid Purchase UOM',
      `Purchase UOM "${product.purchaseUom || '-'}" is not found in active UOM Master options.`,
      'Maintain the UOM in UOM Master or choose a valid Purchase UOM.',
    );
  }

  if (!salesUom || !validUomCodes.has(salesUom)) {
    addIssue(
      'critical',
      'UOM',
      'Invalid Sales UOM',
      `Sales UOM "${product.salesUom || '-'}" is not found in active UOM Master options.`,
      'Maintain the UOM in UOM Master or choose a valid Sales UOM.',
    );
  }

  if (!Number.isFinite(Number(product.purchaseToBaseFactor)) || Number(product.purchaseToBaseFactor || 0) <= 0) {
    addIssue(
      'critical',
      'UOM Conversion',
      'Invalid Purchase To Base Factor',
      'Purchase To Base Factor must be greater than 0.',
      'Set a valid purchase conversion factor. Example: 1 CTN = 24 PCS, factor = 24.',
    );
  }

  if (!Number.isFinite(Number(product.salesToBaseFactor)) || Number(product.salesToBaseFactor || 0) <= 0) {
    addIssue(
      'critical',
      'UOM Conversion',
      'Invalid Sales To Base Factor',
      'Sales To Base Factor must be greater than 0.',
      'Set a valid sales conversion factor.',
    );
  }

  if (product.status === 'Inactive' && stockQty > 0) {
    addIssue(
      'critical',
      'Status',
      'Inactive product has inventory balance',
      `Product is inactive but still has available stock quantity ${stockQty}.`,
      'Review whether stock should be consumed, transferred, adjusted, or product should remain Active until stock is cleared.',
    );
  } else if (product.status === 'Inactive') {
    addIssue(
      'warning',
      'Status',
      'Inactive product',
      'Inactive products should not be selected for new inbound/outbound transactions.',
      'Keep inactive status only for discontinued products.',
    );
  }

  if (product.isExpiryControlled && (product.shelfLifeDays === undefined || product.shelfLifeDays === null)) {
    addIssue(
      'warning',
      'Expiry Control',
      'Expiry-controlled product without shelf life',
      'Product is expiry controlled but Shelf Life Days is blank.',
      'Maintain Shelf Life Days to support expiry validation and FEFO planning.',
    );
  }

  if (!product.isExpiryControlled && product.shelfLifeDays !== undefined && product.shelfLifeDays !== null) {
    addIssue(
      'info',
      'Expiry Control',
      'Shelf life maintained for non-expiry product',
      'Shelf Life Days is maintained but product is not expiry controlled.',
      'Confirm whether the product should be expiry controlled or clear shelf life if not required.',
    );
  }

  if (product.minStockLevel !== undefined && product.maxStockLevel !== undefined) {
    if (Number(product.maxStockLevel) < Number(product.minStockLevel)) {
      addIssue(
        'critical',
        'Stock Policy',
        'Invalid min/max stock policy',
        'Max Stock Level is lower than Min Stock Level.',
        'Set Max Stock Level greater than or equal to Min Stock Level.',
      );
    }
  }

  if (product.minStockLevel !== undefined && stockQty < Number(product.minStockLevel)) {
    addIssue(
      'warning',
      'Stock Policy',
      'Low stock risk',
      `Available stock ${stockQty} is below Min Stock Level ${product.minStockLevel}.`,
      'Review replenishment, purchase order, inbound schedule, or adjust min stock policy.',
    );
  }

  if (product.maxStockLevel !== undefined && stockQty > Number(product.maxStockLevel)) {
    addIssue(
      'warning',
      'Stock Policy',
      'Overstock risk',
      `Available stock ${stockQty} is above Max Stock Level ${product.maxStockLevel}.`,
      'Review demand, storage usage, purchase plan, or adjust max stock policy.',
    );
  }

  if (inventoryRows.length === 0) {
    addIssue(
      'info',
      'Inventory Linkage',
      'No inventory rows linked',
      'No current inventory row is linked to this SKU/Product Code.',
      'No action required for new products. If stock exists, check SKU/Product Code consistency in Inventory.',
    );
  }

  const rowsWithBatch = inventoryRows.filter((row) => normalizePlainText(row.batchNo || row.batchNumber));
  const rowsWithoutBatch = inventoryRows.filter((row) => !normalizePlainText(row.batchNo || row.batchNumber));
  const rowsWithExpiry = inventoryRows.filter((row) => normalizePlainText(row.expiryDate || row.expDate));
  const rowsWithoutExpiry = inventoryRows.filter((row) => !normalizePlainText(row.expiryDate || row.expDate));
  const expiredRows = inventoryRows.filter((row) => isExpiredDate(row.expiryDate || row.expDate));

  if (product.isBatchControlled && rowsWithoutBatch.length > 0) {
    addIssue(
      'warning',
      'Batch Control',
      'Batch-controlled product has inventory without batch',
      `${rowsWithoutBatch.length} inventory row(s) do not have Batch No.`,
      'Correct inventory batch data to support outbound matching and traceability.',
    );
  }

  if (!product.isBatchControlled && rowsWithBatch.length > 0) {
    addIssue(
      'info',
      'Batch Control',
      'Inventory has batch for non-batch product',
      `${rowsWithBatch.length} inventory row(s) contain Batch No while product is not batch controlled.`,
      'Confirm whether this product should be batch controlled.',
    );
  }

  if (product.isExpiryControlled && rowsWithoutExpiry.length > 0) {
    addIssue(
      'warning',
      'Expiry Control',
      'Expiry-controlled product has inventory without expiry date',
      `${rowsWithoutExpiry.length} inventory row(s) do not have Expiry Date.`,
      'Correct inventory expiry data to support FEFO and outbound validation.',
    );
  }

  if (!product.isExpiryControlled && rowsWithExpiry.length > 0) {
    addIssue(
      'info',
      'Expiry Control',
      'Inventory has expiry for non-expiry product',
      `${rowsWithExpiry.length} inventory row(s) contain Expiry Date while product is not expiry controlled.`,
      'Confirm whether this product should be expiry controlled.',
    );
  }

  if (expiredRows.length > 0) {
    addIssue(
      'critical',
      'Expiry Risk',
      'Expired inventory detected',
      `${expiredRows.length} inventory row(s) are expired.`,
      'Block outbound shipment for expired stock and perform quarantine/adjustment workflow.',
    );
  }

  if (!product.category) {
    addIssue(
      'info',
      'Classification',
      'Missing category',
      'Category improves filtering, reporting, and replenishment analysis.',
      'Maintain Product Category.',
    );
  }

  if (!product.itemType) {
    addIssue(
      'info',
      'Classification',
      'Missing item type',
      'Item Type improves purchasing, production, and sales categorization.',
      'Maintain Item Type.',
    );
  }

  if (!product.storageType) {
    addIssue(
      'info',
      'Storage',
      'Missing storage type',
      'Storage Type helps warehouse receiving and put-away decisions.',
      'Maintain Storage Type.',
    );
  }

  let score = 100;

  issues.forEach((issue) => {
    if (issue.severity === 'critical') score -= 25;
    if (issue.severity === 'warning') score -= 12;
    if (issue.severity === 'info') score -= 3;
  });

  score = Math.max(0, Math.min(100, score));

  const criticalCount = issues.filter((item) => item.severity === 'critical').length;
  const warningCount = issues.filter((item) => item.severity === 'warning').length;
  const infoCount = issues.filter((item) => item.severity === 'info').length;

  const status: AiStatus = criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'healthy';

  const canUseInbound = product.status === 'Active' && criticalCount === 0;
  const canUseOutbound = product.status === 'Active' && criticalCount === 0;

  const summary =
    status === 'healthy'
      ? 'AI check passed. Product master data looks operationally ready.'
      : status === 'warning'
        ? `AI found ${warningCount} warning(s) and ${infoCount} info item(s). Product can be used but should be reviewed.`
        : `AI found ${criticalCount} critical issue(s). Product should be corrected before operational use.`;

  return {
    productId: product.id,
    sku: product.sku,
    productCode: product.productCode || product.sku,
    productName: product.productName,
    status,
    score,
    stockQty,
    issueCount: issues.length,
    criticalCount,
    warningCount,
    infoCount,
    summary,
    canUseInbound,
    canUseOutbound,
    issues,
    recommendations: Array.from(new Set(recommendations)),
  };
}

/* ============================================================================
 * Page Component
 * ========================================================================== */

export default function ProductMasterPage() {
  const [form] = Form.useForm<ProductMaster>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [uoms, setUoms] = useState<UomRecord[]>([]);
  const [statuses, setStatuses] = useState<StatusRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [uomFilter, setUomFilter] = useState<string>('All');
  const [controlFilter, setControlFilter] = useState<string>('All');
  const [storageFilter, setStorageFilter] = useState<string>('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedProduct, setSelectedProduct] = useState<ProductMaster | null>(null);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiDashboardOpen, setAiDashboardOpen] = useState(false);
  const [selectedAiResult, setSelectedAiResult] = useState<ProductAiResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isViewMode = modalMode === 'view';

  const saveProducts = (nextProducts: ProductMaster[]) => {
    const migrated = nextProducts.map(migrateProduct);

    setProducts(migrated);

    if (typeof window === 'undefined') return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(migrated));
    localStorage.setItem(COMPAT_STORAGE_KEY, JSON.stringify(migrated));
    localStorage.setItem(EXTRA_COMPAT_STORAGE_KEY, JSON.stringify(migrated));
  };

  const loadUoms = () => {
    try {
      const parsed = readStorageArray<UomRecord>(UOM_STORAGE_KEY);
      setUoms(parsed);
    } catch (error) {
      console.error(error);
      messageApi.error('Failed to load UOM Master data.');
      setUoms([]);
    }
  };

  const loadStatuses = () => {
    try {
      const parsed = readStorageArray<StatusRecord>(STATUS_STORAGE_KEY);
      setStatuses(parsed);
    } catch (error) {
      console.error(error);
      messageApi.error('Failed to load Status Master data.');
      setStatuses([]);
    }
  };

  const loadInventory = () => {
    setInventory(readMergedInventory());
  };

  const loadProducts = () => {
    try {
      const standardProducts = readStorageArray<any>(STORAGE_KEY);
      const legacyProducts = readStorageArray<any>(LEGACY_STORAGE_KEY);
      const compatProducts = readStorageArray<any>(COMPAT_STORAGE_KEY);
      const extraCompatProducts = readStorageArray<any>(EXTRA_COMPAT_STORAGE_KEY);

      const merged = mergeProductSources([standardProducts, compatProducts, extraCompatProducts, legacyProducts]);

      if (merged.length > 0) {
        saveProducts(merged);
      } else {
        saveProducts(defaultProducts);
      }
    } catch (error) {
      console.error(error);
      saveProducts(defaultProducts);
    }
  };

  useEffect(() => {
    loadUoms();
    loadStatuses();
    loadInventory();
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uomSelectOptions = useMemo(() => {
    const activeUoms = uoms
      .filter((item) => isActiveMasterRecord(item))
      .map((item) => {
        const uomCode = normalizeText(getFirstText(item, ['uomCode', 'code', 'uom', 'unitCode']));
        const uomName = getFirstText(item, ['uomName', 'name', 'unitName']);

        if (!uomCode) return null;

        return {
          label: uomName ? `${uomCode} - ${uomName}` : uomCode,
          value: uomCode,
        };
      })
      .filter(Boolean) as { label: string; value: string }[];

    const uniqueMap = new Map<string, { label: string; value: string }>();

    activeUoms.forEach((item) => {
      uniqueMap.set(item.value, item);
    });

    if (uniqueMap.size > 0) {
      return Array.from(uniqueMap.values());
    }

    return fallbackUomOptions.map((item) => ({
      label: item,
      value: item,
    }));
  }, [uoms]);

  const productStatusOptions = useMemo(() => {
    const activeStatusRecords = statuses
      .filter((item) => isActiveMasterRecord(item))
      .filter((item) => {
        const moduleName = String(item.module ?? '').trim().toUpperCase();

        return (
          !moduleName ||
          moduleName === 'GENERAL' ||
          moduleName === 'PRODUCT' ||
          moduleName === 'PRODUCT_MASTER' ||
          moduleName === 'MASTER'
        );
      })
      .map((item) => {
        const rawStatus = getFirstText(item, ['statusCode', 'statusName', 'status', 'code', 'name']) || '';
        const mappedStatus = normalizeStatusToProductStatus(rawStatus);

        if (!mappedStatus) return null;

        const statusCode = getFirstText(item, ['statusCode', 'code']);
        const statusName = getFirstText(item, ['statusName', 'name']);

        return {
          label: statusCode && statusName ? `${statusCode} - ${statusName}` : mappedStatus,
          value: mappedStatus,
        };
      })
      .filter(Boolean) as { label: string; value: ProductStatus }[];

    const uniqueMap = new Map<ProductStatus, { label: string; value: ProductStatus }>();

    activeStatusRecords.forEach((item) => {
      uniqueMap.set(item.value, item);
    });

    if (uniqueMap.size > 0) {
      return Array.from(uniqueMap.values());
    }

    return fallbackProductStatusOptions;
  }, [statuses]);

  const validUomCodeSet = useMemo(() => {
    return new Set(uomSelectOptions.map((item) => normalizeText(item.value)));
  }, [uomSelectOptions]);

  const isValidUomCode = (value?: string) => {
    const normalized = normalizeText(value);

    if (!normalized) return false;

    return validUomCodeSet.has(normalized);
  };

  const productStockMap = useMemo(() => {
    const map = new Map<string, number>();

    inventory.forEach((row) => {
      const sku = normalizeText(row.sku || row.itemCode);
      const productCode = normalizeText(row.productCode);
      const qty = getInventoryAvailableQty(row);

      if (sku) {
        map.set(sku, (map.get(sku) || 0) + qty);
      }

      if (productCode && productCode !== sku) {
        map.set(productCode, (map.get(productCode) || 0) + qty);
      }
    });

    return map;
  }, [inventory]);

  const getProductStock = (record: ProductMaster) => {
    const bySku = productStockMap.get(normalizeText(record.sku)) || 0;
    const byCode = productStockMap.get(normalizeText(record.productCode)) || 0;

    return Math.max(bySku, byCode);
  };

  const getProductInventoryRows = (record: ProductMaster | null) => {
    if (!record) return [];

    const sku = normalizeText(record.sku);
    const productCode = normalizeText(record.productCode);

    return inventory.filter((row) => {
      const rowSku = normalizeText(row.sku || row.itemCode);
      const rowProductCode = normalizeText(row.productCode);

      return rowSku === sku || rowSku === productCode || rowProductCode === sku || rowProductCode === productCode;
    });
  };

  const categoryFilterOptions = useMemo(() => {
    const set = new Set<string>();

    categoryOptions.forEach((item) => set.add(item));

    products.forEach((item) => {
      if (item.category) set.add(item.category);
    });

    return Array.from(set).sort();
  }, [products]);

  const storageFilterOptions = useMemo(() => {
    const set = new Set<string>();

    storageTypeOptions.forEach((item) => set.add(item));

    products.forEach((item) => {
      if (item.storageType) set.add(item.storageType);
    });

    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const keyword = searchText.toLowerCase().trim();

    return products.filter((item) => {
      const matchesKeyword =
        !keyword ||
        [
          item.productCode,
          item.sku,
          item.productName,
          item.barcode,
          item.category,
          item.brand,
          item.itemType,
          item.storageType,
          item.uom,
          item.purchaseUom,
          item.salesUom,
          item.status,
          item.remarks,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword));

      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      const matchesStorage = storageFilter === 'All' || item.storageType === storageFilter;

      const matchesUom =
        uomFilter === 'All' ||
        normalizeText(item.uom) === normalizeText(uomFilter) ||
        normalizeText(item.purchaseUom) === normalizeText(uomFilter) ||
        normalizeText(item.salesUom) === normalizeText(uomFilter);

      const matchesControl =
        controlFilter === 'All' ||
        (controlFilter === 'Batch' && item.isBatchControlled) ||
        (controlFilter === 'Expiry' && item.isExpiryControlled) ||
        (controlFilter === 'BatchExpiry' && item.isBatchControlled && item.isExpiryControlled) ||
        (controlFilter === 'NoControl' && !item.isBatchControlled && !item.isExpiryControlled);

      return matchesKeyword && matchesStatus && matchesCategory && matchesStorage && matchesUom && matchesControl;
    });
  }, [products, searchText, statusFilter, categoryFilter, storageFilter, uomFilter, controlFilter]);

  const aiResultsMap = useMemo(() => {
    const map = new Map<string, ProductAiResult>();

    products.forEach((product) => {
      const rows = getProductInventoryRows(product);
      const result = analyzeProductMasterAi({
        product,
        allProducts: products,
        inventoryRows: rows,
        validUomCodes: validUomCodeSet,
        stockQty: getProductStock(product),
      });

      map.set(product.id, result);
    });

    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, inventory, validUomCodeSet]);

  const aiResults = useMemo(() => Array.from(aiResultsMap.values()), [aiResultsMap]);

  const aiSummary = useMemo(() => {
    const healthy = aiResults.filter((item) => item.status === 'healthy').length;
    const warning = aiResults.filter((item) => item.status === 'warning').length;
    const critical = aiResults.filter((item) => item.status === 'critical').length;
    const avgScore =
      aiResults.length > 0
        ? Math.round(aiResults.reduce((sum, item) => sum + item.score, 0) / aiResults.length)
        : 100;

    return {
      healthy,
      warning,
      critical,
      avgScore,
    };
  }, [aiResults]);

  const activeCount = products.filter((item) => item.status === 'Active').length;
  const inactiveCount = products.filter((item) => item.status === 'Inactive').length;
  const batchControlledCount = products.filter((item) => item.isBatchControlled).length;
  const expiryControlledCount = products.filter((item) => item.isExpiryControlled).length;

  const lowStockCount = products.filter((item) => {
    if (item.minStockLevel === undefined || item.minStockLevel === null) return false;

    return getProductStock(item) < Number(item.minStockLevel);
  }).length;

  const inventoryRowsForSelectedProduct = useMemo(() => {
    return getProductInventoryRows(selectedProduct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, inventory]);

  const selectedProductAiResult = useMemo(() => {
    if (!selectedProduct) return null;

    return aiResultsMap.get(selectedProduct.id) || null;
  }, [selectedProduct, aiResultsMap]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedProduct(null);
    setModalOpen(true);
  };

  const openEditModal = (record: ProductMaster) => {
    setModalMode('edit');
    setSelectedProduct(record);
    setModalOpen(true);
  };

  const openViewModal = (record: ProductMaster) => {
    setModalMode('view');
    setSelectedProduct(record);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedProduct(null);
  };

  const handleProductModalAfterOpenChange = (visible: boolean) => {
    if (!visible) return;

    if (modalMode === 'create') {
      const defaultUom =
        uomSelectOptions.find((item) => item.value === 'PCS')?.value || uomSelectOptions[0]?.value || 'PCS';

      const defaultStatus =
        productStatusOptions.find((item) => item.value === 'Active')?.value ||
        productStatusOptions[0]?.value ||
        'Active';

      form.resetFields();
      form.setFieldsValue({
        status: defaultStatus,
        uom: defaultUom,
        purchaseUom: defaultUom,
        salesUom: defaultUom,
        purchaseToBaseFactor: 1,
        salesToBaseFactor: 1,
        category: 'General',
        itemType: 'Finished Goods',
        storageType: 'Ambient',
        isBatchControlled: true,
        isExpiryControlled: true,
      });
      return;
    }

    if (selectedProduct) {
      form.resetFields();
      form.setFieldsValue(migrateProduct(selectedProduct));
    }
  };

  const openAiModal = (record: ProductMaster) => {
    const result = aiResultsMap.get(record.id);

    if (!result) {
      messageApi.warning('AI analysis is not available for this product.');
      return;
    }

    setSelectedAiResult(result);
    setAiModalOpen(true);
  };

  const validateDuplicate = (fieldName: keyof ProductMaster, value: unknown, currentProductId?: string) => {
    const normalized = normalizeText(value);

    if (!normalized) return false;

    return products.some((item) => {
      if (currentProductId && item.id === currentProductId) return false;

      return normalizeText(item[fieldName]) === normalized;
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const sku = normalizeText(values.sku);
      const productCode = normalizeText(values.productCode) || sku;
      const productName = values.productName?.trim() || '';
      const baseUom = normalizeText(values.uom);
      const purchaseUom = normalizeText(values.purchaseUom) || baseUom;
      const salesUom = normalizeText(values.salesUom) || baseUom;
      const purchaseToBaseFactor = Number(values.purchaseToBaseFactor || 1);
      const salesToBaseFactor = Number(values.salesToBaseFactor || 1);
      const status = normalizeStatusToProductStatus(values.status) || 'Active';

      if (!isValidUomCode(baseUom)) {
        messageApi.error(`Invalid Base UOM: ${baseUom}. Please maintain it in UOM Master.`);
        return;
      }

      if (!isValidUomCode(purchaseUom)) {
        messageApi.error(`Invalid Purchase UOM: ${purchaseUom}. Please maintain it in UOM Master.`);
        return;
      }

      if (!isValidUomCode(salesUom)) {
        messageApi.error(`Invalid Sales UOM: ${salesUom}. Please maintain it in UOM Master.`);
        return;
      }

      if (!Number.isFinite(purchaseToBaseFactor) || purchaseToBaseFactor <= 0) {
        messageApi.error('Purchase To Base Factor must be greater than 0.');
        return;
      }

      if (!Number.isFinite(salesToBaseFactor) || salesToBaseFactor <= 0) {
        messageApi.error('Sales To Base Factor must be greater than 0.');
        return;
      }

      if (validateDuplicate('sku', sku, selectedProduct?.id)) {
        messageApi.error('SKU already exists. Please use a unique SKU.');
        return;
      }

      if (validateDuplicate('productCode', productCode, selectedProduct?.id)) {
        messageApi.error('Product Code already exists. Please use a unique Product Code.');
        return;
      }

      if (values.barcode && validateDuplicate('barcode', values.barcode, selectedProduct?.id)) {
        messageApi.error('Barcode already exists. Please use a unique Barcode.');
        return;
      }

      if (
        values.minStockLevel !== undefined &&
        values.maxStockLevel !== undefined &&
        Number(values.maxStockLevel) < Number(values.minStockLevel)
      ) {
        messageApi.error('Max Stock Level cannot be lower than Min Stock Level.');
        return;
      }

      if (values.shelfLifeDays !== undefined && values.shelfLifeDays !== null && Number(values.shelfLifeDays) < 0) {
        messageApi.error('Shelf Life Days cannot be negative.');
        return;
      }

      if (modalMode === 'create') {
        const now = new Date().toISOString();

        const newProduct: ProductMaster = {
          id: generateId(),
          productCode,
          code: productCode,
          itemCode: sku,
          itemName: productName,
          name: productName,
          sku,
          productName,
          barcode: values.barcode?.trim() || '',
          category: values.category || 'General',
          brand: values.brand?.trim() || '',
          itemType: values.itemType || 'Finished Goods',
          storageType: values.storageType || 'Ambient',
          shelfLifeDays: values.shelfLifeDays,
          uom: baseUom,
          purchaseUom,
          salesUom,
          purchaseToBaseFactor,
          salesToBaseFactor,
          status,
          isBatchControlled: Boolean(values.isBatchControlled),
          isExpiryControlled: Boolean(values.isExpiryControlled),
          minStockLevel: values.minStockLevel,
          maxStockLevel: values.maxStockLevel,
          remarks: values.remarks?.trim() || '',
          createdAt: now,
          updatedAt: now,
        };

        saveProducts([newProduct, ...products]);
        messageApi.success('Product created successfully.');
      }

      if (modalMode === 'edit' && selectedProduct) {
        const updatedProduct: ProductMaster = {
          ...selectedProduct,
          productCode,
          code: productCode,
          itemCode: sku,
          itemName: productName,
          name: productName,
          sku,
          productName,
          barcode: values.barcode?.trim() || '',
          category: values.category || 'General',
          brand: values.brand?.trim() || '',
          itemType: values.itemType || 'Finished Goods',
          storageType: values.storageType || 'Ambient',
          shelfLifeDays: values.shelfLifeDays,
          uom: baseUom,
          purchaseUom,
          salesUom,
          purchaseToBaseFactor,
          salesToBaseFactor,
          status,
          isBatchControlled: Boolean(values.isBatchControlled),
          isExpiryControlled: Boolean(values.isExpiryControlled),
          minStockLevel: values.minStockLevel,
          maxStockLevel: values.maxStockLevel,
          remarks: values.remarks?.trim() || '',
          updatedAt: new Date().toISOString(),
        };

        saveProducts(products.map((item) => (item.id === selectedProduct.id ? updatedProduct : item)));
        messageApi.success('Product updated successfully.');
      }

      closeModal();
    } catch {
      messageApi.error('Please check required fields.');
    }
  };

  const performDelete = (record: ProductMaster) => {
    const nextProducts = products.filter((item) => item.id !== record.id);

    saveProducts(nextProducts);
    messageApi.success('Product deleted successfully.');
  };

  const handleDelete = (record: ProductMaster) => {
    const stockQty = getProductStock(record);

    if (stockQty > 0) {
      modalApi.confirm({
        title: 'Product has inventory balance',
        content: (
          <div>
            <p>
              This product currently has available inventory balance: <Text strong>{stockQty}</Text>.
            </p>
            <p>
              For data integrity, it is usually better to edit the product and set status to Inactive instead of
              deleting it.
            </p>
            <p>Do you still want to delete this product?</p>
          </div>
        ),
        okText: 'Delete Anyway',
        okButtonProps: { danger: true },
        cancelText: 'Cancel',
        onOk: () => performDelete(record),
      });

      return;
    }

    performDelete(record);
  };

  const handleDuplicate = (record: ProductMaster) => {
    let suffix = 1;
    let newSku = `${record.sku}-COPY`;

    while (products.some((item) => normalizeText(item.sku) === normalizeText(newSku))) {
      suffix += 1;
      newSku = `${record.sku}-COPY-${suffix}`;
    }

    const now = new Date().toISOString();

    const duplicated: ProductMaster = {
      ...record,
      id: generateId(),
      productCode: newSku,
      code: newSku,
      itemCode: newSku,
      itemName: `${record.productName} Copy`,
      name: `${record.productName} Copy`,
      sku: newSku,
      barcode: '',
      productName: `${record.productName} Copy`,
      status: 'Inactive',
      createdAt: now,
      updatedAt: now,
    };

    saveProducts([duplicated, ...products]);
    messageApi.success('Product duplicated as inactive copy.');
  };

  const handleLoadDemoData = () => {
    modalApi.confirm({
      title: 'Load demo Product Master data?',
      content:
        'This will merge demo products into the current Product Master. Existing products with the same SKU will be updated.',
      okText: 'Load Demo',
      cancelText: 'Cancel',
      onOk: () => {
        const now = new Date().toISOString();
        const demo = defaultProducts.map((item) => ({
          ...item,
          updatedAt: now,
        }));

        const merged = [...products];

        demo.forEach((demoItem) => {
          const index = merged.findIndex((item) => normalizeText(item.sku) === normalizeText(demoItem.sku));

          if (index >= 0) {
            merged[index] = {
              ...merged[index],
              ...demoItem,
              id: merged[index].id,
              createdAt: merged[index].createdAt,
              updatedAt: now,
            };
          } else {
            merged.unshift({
              ...demoItem,
              id: generateId(),
              createdAt: now,
              updatedAt: now,
            });
          }
        });

        saveProducts(merged);
        messageApi.success('Demo Product Master data loaded successfully.');
      },
    });
  };

  const handleRefreshMasters = () => {
    loadUoms();
    loadStatuses();
    loadInventory();
    loadProducts();
    messageApi.success('Master references, product data, inventory balance, and AI audit refreshed.');
  };

  const handleClearFilters = () => {
    setSearchText('');
    setStatusFilter('All');
    setCategoryFilter('All');
    setUomFilter('All');
    setControlFilter('All');
    setStorageFilter('All');
  };

  const handleClearAllProducts = () => {
    modalApi.confirm({
      title: 'Clear all Product Master data?',
      content:
        'This will remove all products from wms_product_master, master_products_v1, wms_products, and wms_product_sku_master. Inventory records will not be deleted.',
      okText: 'Clear All',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: () => {
        saveProducts([]);
        messageApi.success('All Product Master records cleared.');
      },
    });
  };

  const handleCreateMissingFromInventory = () => {
    const existingKeys = new Set<string>();

    products.forEach((item) => {
      existingKeys.add(normalizeText(item.sku));
      existingKeys.add(normalizeText(item.productCode));
    });

    const now = new Date().toISOString();
    const newProducts: ProductMaster[] = [];
    const createdKeys = new Set<string>();

    inventory.forEach((row) => {
      const sku = normalizeText(row.sku || row.itemCode || row.productCode);
      const productCode = normalizeText(row.productCode) || sku;
      const productName = normalizePlainText(row.productName || row.itemName || row.name) || sku;

      if (!sku || existingKeys.has(sku) || existingKeys.has(productCode) || createdKeys.has(sku)) {
        return;
      }

      const baseUom = normalizeText(row.uom || row.UOM) || 'PCS';
      const validBaseUom = isValidUomCode(baseUom) ? baseUom : uomSelectOptions[0]?.value || 'PCS';

      const product: ProductMaster = {
        id: generateId(),
        productCode,
        code: productCode,
        itemCode: sku,
        itemName: productName,
        name: productName,
        sku,
        productName,
        barcode: '',
        category: 'General',
        brand: '',
        itemType: 'Finished Goods',
        storageType: 'Ambient',
        shelfLifeDays: undefined,
        uom: validBaseUom,
        purchaseUom: validBaseUom,
        salesUom: validBaseUom,
        purchaseToBaseFactor: 1,
        salesToBaseFactor: 1,
        status: 'Active',
        isBatchControlled: true,
        isExpiryControlled: Boolean(row.expiryDate || row.expDate),
        minStockLevel: undefined,
        maxStockLevel: undefined,
        remarks: 'Auto-created from inventory reconciliation.',
        createdAt: now,
        updatedAt: now,
      };

      createdKeys.add(sku);
      newProducts.push(product);
    });

    if (newProducts.length === 0) {
      messageApi.info('No missing product found from inventory.');
      return;
    }

    saveProducts([...newProducts, ...products]);
    messageApi.success(`${newProducts.length} missing product(s) created from inventory.`);
  };

  const buildExportRows = (rows: ProductMaster[]) => {
    return rows.map((item) => ({
      productCode: item.productCode || item.sku,
      sku: item.sku,
      productName: item.productName,
      barcode: item.barcode || '',
      category: item.category || '',
      brand: item.brand || '',
      itemType: item.itemType || '',
      storageType: item.storageType || '',
      shelfLifeDays: item.shelfLifeDays ?? '',
      uom: item.uom,
      purchaseUom: item.purchaseUom || item.uom,
      salesUom: item.salesUom || item.uom,
      purchaseToBaseFactor: item.purchaseToBaseFactor ?? 1,
      salesToBaseFactor: item.salesToBaseFactor ?? 1,
      status: item.status,
      isBatchControlled: item.isBatchControlled ? 'Yes' : 'No',
      isExpiryControlled: item.isExpiryControlled ? 'Yes' : 'No',
      minStockLevel: item.minStockLevel ?? '',
      maxStockLevel: item.maxStockLevel ?? '',
      remarks: item.remarks || '',
    }));
  };

  const handleTemplateDownload = () => {
    const sampleRows = [
      {
        productCode: 'SKU-001',
        sku: 'SKU-001',
        productName: 'Sample Product A',
        barcode: '955000000001',
        category: 'General',
        brand: 'Default Brand',
        itemType: 'Finished Goods',
        storageType: 'Ambient',
        shelfLifeDays: 365,
        uom: 'PCS',
        purchaseUom: 'CTN',
        salesUom: 'PCS',
        purchaseToBaseFactor: 24,
        salesToBaseFactor: 1,
        status: 'Active',
        isBatchControlled: 'Yes',
        isExpiryControlled: 'Yes',
        minStockLevel: 10,
        maxStockLevel: 500,
        remarks: 'Example: Purchase by CTN, store/sell by PCS. 1 CTN = 24 PCS.',
      },
      {
        productCode: 'SKU-002',
        sku: 'SKU-002',
        productName: 'Sample Product B',
        barcode: '955000000002',
        category: 'General',
        brand: 'Default Brand',
        itemType: 'Finished Goods',
        storageType: 'Ambient',
        shelfLifeDays: '',
        uom: 'PCS',
        purchaseUom: 'PCS',
        salesUom: 'PCS',
        purchaseToBaseFactor: 1,
        salesToBaseFactor: 1,
        status: 'Active',
        isBatchControlled: 'Yes',
        isExpiryControlled: 'No',
        minStockLevel: 5,
        maxStockLevel: 200,
        remarks: 'Example non-expiry product.',
      },
    ];

    const csv = convertToCsv(csvHeaders, sampleRows);

    downloadTextFile('product_master_template.csv', csv);
    messageApi.success('Product template downloaded successfully.');
  };

  const handleExport = () => {
    const rowsToExport = filteredProducts.length > 0 ? filteredProducts : products;

    if (rowsToExport.length === 0) {
      messageApi.warning('No data to export.');
      return;
    }

    const csv = convertToCsv(csvHeaders, buildExportRows(rowsToExport));

    downloadTextFile(`product_master_export_${todayDate()}.csv`, csv);
    messageApi.success('Product Master exported successfully.');
  };

  const handleExportAiAudit = () => {
    if (aiResults.length === 0) {
      messageApi.warning('No AI audit data to export.');
      return;
    }

    const headers = [
      'productCode',
      'sku',
      'productName',
      'aiStatus',
      'aiScore',
      'stockQty',
      'criticalCount',
      'warningCount',
      'infoCount',
      'canUseInbound',
      'canUseOutbound',
      'summary',
      'recommendations',
    ];

    const rows = aiResults.map((item) => ({
      productCode: item.productCode,
      sku: item.sku,
      productName: item.productName,
      aiStatus: aiStatusLabel(item.status),
      aiScore: item.score,
      stockQty: item.stockQty,
      criticalCount: item.criticalCount,
      warningCount: item.warningCount,
      infoCount: item.infoCount,
      canUseInbound: item.canUseInbound ? 'Yes' : 'No',
      canUseOutbound: item.canUseOutbound ? 'Yes' : 'No',
      summary: item.summary,
      recommendations: item.recommendations.join(' | '),
    }));

    downloadTextFile(`product_master_ai_audit_${todayDate()}.csv`, convertToCsv(headers, rows));
    messageApi.success('AI audit exported successfully.');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        messageApi.error('CSV file is empty or invalid.');
        return;
      }

      const now = new Date().toISOString();
      const invalidRows: string[] = [];

      const seenSkus = new Set<string>();
      const seenProductCodes = new Set<string>();
      const seenBarcodes = new Set<string>();

      const importedProducts = rows
        .map((row, index) => {
          const rowNo = index + 2;

          const sku = normalizeText(getCsvValue(row, ['sku', 'SKU', 'Item Code', 'itemCode', 'item_code']));

          const productCode =
            normalizeText(getCsvValue(row, ['productCode', 'Product Code', 'product_code', 'Code', 'code'])) || sku;

          const productName = normalizePlainText(
            getCsvValue(row, ['productName', 'Product Name', 'product_name', 'Item Name', 'itemName', 'name']),
          );

          if (!sku || !productName) {
            invalidRows.push(`Row ${rowNo}: Missing SKU or Product Name.`);
            return null;
          }

          if (seenSkus.has(sku)) {
            invalidRows.push(`Row ${rowNo}: Duplicate SKU "${sku}" inside CSV file.`);
            return null;
          }

          if (seenProductCodes.has(productCode)) {
            invalidRows.push(`Row ${rowNo}: Duplicate Product Code "${productCode}" inside CSV file.`);
            return null;
          }

          seenSkus.add(sku);
          seenProductCodes.add(productCode);

          const barcode = normalizePlainText(getCsvValue(row, ['barcode', 'Barcode', 'barCode']));

          if (barcode) {
            const normalizedBarcode = normalizeText(barcode);

            if (seenBarcodes.has(normalizedBarcode)) {
              invalidRows.push(`Row ${rowNo}: Duplicate Barcode "${barcode}" inside CSV file.`);
              return null;
            }

            seenBarcodes.add(normalizedBarcode);
          }

          const existingDifferentSkuWithCode = products.find(
            (item) => normalizeText(item.productCode) === productCode && normalizeText(item.sku) !== sku,
          );

          if (existingDifferentSkuWithCode) {
            invalidRows.push(
              `Row ${rowNo}: Product Code "${productCode}" already belongs to SKU "${existingDifferentSkuWithCode.sku}".`,
            );
            return null;
          }

          if (barcode) {
            const existingDifferentSkuWithBarcode = products.find(
              (item) => normalizeText(item.barcode) === normalizeText(barcode) && normalizeText(item.sku) !== sku,
            );

            if (existingDifferentSkuWithBarcode) {
              invalidRows.push(
                `Row ${rowNo}: Barcode "${barcode}" already belongs to SKU "${existingDifferentSkuWithBarcode.sku}".`,
              );
              return null;
            }
          }

          const baseUom = normalizeText(getCsvValue(row, ['uom', 'UOM', 'Base UOM', 'baseUom'])) || 'PCS';

          const purchaseUom =
            normalizeText(getCsvValue(row, ['purchaseUom', 'Purchase UOM', 'purchase_uom'])) || baseUom;

          const salesUom = normalizeText(getCsvValue(row, ['salesUom', 'Sales UOM', 'sales_uom'])) || baseUom;

          if (!isValidUomCode(baseUom)) {
            invalidRows.push(`Row ${rowNo}: Invalid Base UOM "${baseUom}".`);
            return null;
          }

          if (!isValidUomCode(purchaseUom)) {
            invalidRows.push(`Row ${rowNo}: Invalid Purchase UOM "${purchaseUom}".`);
            return null;
          }

          if (!isValidUomCode(salesUom)) {
            invalidRows.push(`Row ${rowNo}: Invalid Sales UOM "${salesUom}".`);
            return null;
          }

          const minStockLevel = parseNumber(
            getCsvValue(row, ['minStockLevel', 'Min Stock Level', 'min_stock_level']),
          );

          const maxStockLevel = parseNumber(
            getCsvValue(row, ['maxStockLevel', 'Max Stock Level', 'max_stock_level']),
          );

          const shelfLifeDays = parseNumber(
            getCsvValue(row, ['shelfLifeDays', 'Shelf Life Days', 'shelf_life_days']),
          );

          const purchaseToBaseFactor = parsePositiveNumber(
            getCsvValue(row, ['purchaseToBaseFactor', 'Purchase To Base Factor', 'purchase_to_base_factor']),
            1,
          );

          const salesToBaseFactor = parsePositiveNumber(
            getCsvValue(row, ['salesToBaseFactor', 'Sales To Base Factor', 'sales_to_base_factor']),
            1,
          );

          if (minStockLevel !== undefined && maxStockLevel !== undefined && maxStockLevel < minStockLevel) {
            invalidRows.push(`Row ${rowNo}: Max Stock Level cannot be lower than Min Stock Level.`);
            return null;
          }

          if (shelfLifeDays !== undefined && shelfLifeDays < 0) {
            invalidRows.push(`Row ${rowNo}: Shelf Life Days cannot be negative.`);
            return null;
          }

          const importedStatus = normalizeStatusToProductStatus(getCsvValue(row, ['status', 'Status'])) || 'Active';

          const product: ProductMaster = {
            id: generateId(),
            productCode,
            code: productCode,
            itemCode: sku,
            itemName: productName,
            name: productName,
            sku,
            productName,
            barcode,
            category: normalizePlainText(getCsvValue(row, ['category', 'Category'])) || 'General',
            brand: normalizePlainText(getCsvValue(row, ['brand', 'Brand'])),
            itemType: normalizePlainText(getCsvValue(row, ['itemType', 'Item Type', 'item_type'])) || 'Finished Goods',
            storageType:
              normalizePlainText(getCsvValue(row, ['storageType', 'Storage Type', 'storage_type'])) || 'Ambient',
            shelfLifeDays,
            uom: baseUom,
            purchaseUom,
            salesUom,
            purchaseToBaseFactor,
            salesToBaseFactor,
            status: importedStatus,
            isBatchControlled: parseBoolean(
              getCsvValue(row, ['isBatchControlled', 'Batch Controlled', 'is_batch_controlled']),
              true,
            ),
            isExpiryControlled: parseBoolean(
              getCsvValue(row, ['isExpiryControlled', 'Expiry Controlled', 'is_expiry_controlled']),
              true,
            ),
            minStockLevel,
            maxStockLevel,
            remarks: normalizePlainText(getCsvValue(row, ['remarks', 'Remarks', 'notes'])),
            createdAt: now,
            updatedAt: now,
          };

          return product;
        })
        .filter(Boolean) as ProductMaster[];

      if (importedProducts.length === 0) {
        modalApi.error({
          title: 'No valid product found',
          width: 760,
          content: (
            <div>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                title="Required fields: SKU and Product Name."
              />

              {invalidRows.length > 0 && (
                <>
                  <p>Validation errors:</p>
                  <ul>
                    {invalidRows.slice(0, 15).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>

                  {invalidRows.length > 15 && <p>And {invalidRows.length - 15} more error(s).</p>}
                </>
              )}
            </div>
          ),
        });

        return;
      }

      const mergedProducts = [...products];

      importedProducts.forEach((imported) => {
        const existingIndex = mergedProducts.findIndex(
          (item) => normalizeText(item.sku) === normalizeText(imported.sku),
        );

        if (existingIndex >= 0) {
          mergedProducts[existingIndex] = {
            ...mergedProducts[existingIndex],
            ...imported,
            id: mergedProducts[existingIndex].id,
            createdAt: mergedProducts[existingIndex].createdAt,
            updatedAt: now,
          };
        } else {
          mergedProducts.unshift(imported);
        }
      });

      saveProducts(mergedProducts);

      if (invalidRows.length > 0) {
        modalApi.warning({
          title: 'Import completed with validation warning',
          width: 760,
          content: (
            <div>
              <p>{importedProducts.length} product record(s) imported successfully.</p>
              <p>{invalidRows.length} row(s) skipped.</p>

              <ul>
                {invalidRows.slice(0, 15).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              {invalidRows.length > 15 && <p>And {invalidRows.length - 15} more error(s).</p>}
            </div>
          ),
        });
      } else {
        messageApi.success(`${importedProducts.length} product record(s) imported successfully.`);
      }
    } catch (error) {
      console.error(error);
      messageApi.error('Failed to import CSV file.');
    } finally {
      event.target.value = '';
    }
  };

  const columns: ColumnsType<ProductMaster> = [
    {
      title: 'Product Code',
      dataIndex: 'productCode',
      key: 'productCode',
      fixed: 'left',
      width: 150,
      sorter: (a, b) => String(a.productCode || '').localeCompare(String(b.productCode || '')),
      render: (value: string | undefined, record: ProductMaster) => (
  <Text strong>{value || record.sku}</Text>
),
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      fixed: 'left',
      width: 140,
      sorter: (a, b) => a.sku.localeCompare(b.sku),
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: 'Product Name',
      dataIndex: 'productName',
      key: 'productName',
      width: 240,
      sorter: (a, b) => a.productName.localeCompare(b.productName),
    },
    {
      title: 'AI',
      key: 'ai',
      width: 150,
      render: (_, record) => {
        const result = aiResultsMap.get(record.id);

        if (!result) return '-';

        return (
          <Tooltip title={result.summary}>
            <Tag
              color={aiStatusColor(result.status)}
              icon={<RobotOutlined />}
              style={{ cursor: 'pointer' }}
              onClick={() => openAiModal(record)}
            >
              {aiStatusLabel(result.status)} {result.score}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Barcode',
      dataIndex: 'barcode',
      key: 'barcode',
      width: 150,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Brand',
      dataIndex: 'brand',
      key: 'brand',
      width: 150,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Item Type',
      dataIndex: 'itemType',
      key: 'itemType',
      width: 160,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Storage',
      dataIndex: 'storageType',
      key: 'storageType',
      width: 180,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Shelf Life',
      dataIndex: 'shelfLifeDays',
      key: 'shelfLifeDays',
      width: 120,
      render: (value?: number) => (value !== undefined ? `${value} days` : '-'),
    },
    {
      title: 'Base UOM',
      dataIndex: 'uom',
      key: 'uom',
      width: 110,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: 'Purchase UOM',
      dataIndex: 'purchaseUom',
      key: 'purchaseUom',
      width: 130,
      render: (value: string | undefined, record: ProductMaster) => (
  <Tag color="purple">{value || record.uom}</Tag>
),
    },
    {
      title: 'Purchase Factor',
      dataIndex: 'purchaseToBaseFactor',
      key: 'purchaseToBaseFactor',
      width: 140,
      render: (value?: number) => value ?? 1,
    },
    {
      title: 'Sales UOM',
      dataIndex: 'salesUom',
      key: 'salesUom',
      width: 120,
      render: (value: string | undefined, record: ProductMaster) => (
  <Tag color="cyan">{value || record.uom}</Tag>
),
    },
    {
      title: 'Sales Factor',
      dataIndex: 'salesToBaseFactor',
      key: 'salesToBaseFactor',
      width: 120,
      render: (value?: number) => value ?? 1,
    },
    {
      title: 'Available Stock',
      key: 'availableStock',
      width: 140,
      render: (_, record) => {
        const stockQty = getProductStock(record);
        const isLow = record.minStockLevel !== undefined && stockQty < Number(record.minStockLevel);

        return <Tag color={isLow ? 'red' : stockQty > 0 ? 'green' : 'default'}>{stockQty}</Tag>;
      },
    },
    {
      title: 'Batch',
      dataIndex: 'isBatchControlled',
      key: 'isBatchControlled',
      width: 110,
      render: (value: boolean) => (value ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>),
    },
    {
      title: 'Expiry',
      dataIndex: 'isExpiryControlled',
      key: 'isExpiryControlled',
      width: 110,
      render: (value: boolean) => (value ? <Tag color="orange">Yes</Tag> : <Tag>No</Tag>),
    },
    {
      title: 'Min Stock',
      dataIndex: 'minStockLevel',
      key: 'minStockLevel',
      width: 110,
      render: (value?: number) => value ?? '-',
    },
    {
      title: 'Max Stock',
      dataIndex: 'maxStockLevel',
      key: 'maxStockLevel',
      width: 110,
      render: (value?: number) => value ?? '-',
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
      render: (value: ProductStatus) =>
        value === 'Active' ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>,
    },
    {
      title: 'Updated At',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 360,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openViewModal(record)}>
            View
          </Button>

          <Button size="small" icon={<RobotOutlined />} onClick={() => openAiModal(record)}>
            AI
          </Button>

          <Button size="small" type="primary" onClick={() => openEditModal(record)}>
            Edit
          </Button>

          <Button size="small" onClick={() => handleDuplicate(record)}>
            Duplicate
          </Button>

          <Popconfirm
            title="Delete this product?"
            description="This action cannot be undone."
            okText="Delete"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
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

  const inventoryPreviewColumns: ColumnsType<InventoryRecord> = [
    {
      title: 'SKU',
      key: 'sku',
      width: 130,
      render: (_, record) => record.sku || record.itemCode || '-',
    },
    {
      title: 'Product Code',
      dataIndex: 'productCode',
      key: 'productCode',
      width: 130,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Batch No',
      key: 'batchNo',
      width: 130,
      render: (_, record) => record.batchNo || record.batchNumber || '-',
    },
    {
      title: 'Plant',
      dataIndex: 'plant',
      key: 'plant',
      width: 100,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 120,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Expiry',
      key: 'expiryDate',
      width: 120,
      render: (_, record) => record.expiryDate || record.expDate || '-',
    },
    {
      title: 'UOM',
      key: 'uom',
      width: 90,
      render: (_, record) => record.uom || record.UOM || '-',
    },
    {
      title: 'Available Qty',
      key: 'availableQty',
      width: 120,
      render: (_, record) => <Tag color="green">{getInventoryAvailableQty(record)}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (value?: string) => value || '-',
    },
  ];

  const aiDashboardColumns: ColumnsType<ProductAiResult> = [
    {
      title: 'Product Code',
      dataIndex: 'productCode',
      key: 'productCode',
      width: 150,
      render: (value) => <Text strong>{value}</Text>,
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 150,
    },
    {
      title: 'Product Name',
      dataIndex: 'productName',
      key: 'productName',
      width: 240,
    },
    {
      title: 'AI Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value: AiStatus) => (
        <Tag color={aiStatusColor(value)} icon={<RobotOutlined />}>
          {aiStatusLabel(value)}
        </Tag>
      ),
      filters: [
        { text: 'Healthy', value: 'healthy' },
        { text: 'Warning', value: 'warning' },
        { text: 'Critical', value: 'critical' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: 160,
      sorter: (a, b) => a.score - b.score,
      render: (value: number, record) => (
        <Progress
          percent={value}
          size="small"
          status={record.status === 'critical' ? 'exception' : record.status === 'warning' ? 'active' : 'success'}
        />
      ),
    },
    {
      title: 'Stock',
      dataIndex: 'stockQty',
      key: 'stockQty',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.stockQty - b.stockQty,
    },
    {
      title: 'Critical',
      dataIndex: 'criticalCount',
      key: 'criticalCount',
      width: 100,
      align: 'right',
      render: (value: number) => <Tag color={value > 0 ? 'red' : 'default'}>{value}</Tag>,
    },
    {
      title: 'Warning',
      dataIndex: 'warningCount',
      key: 'warningCount',
      width: 100,
      align: 'right',
      render: (value: number) => <Tag color={value > 0 ? 'orange' : 'default'}>{value}</Tag>,
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      key: 'summary',
      width: 420,
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Button
          size="small"
          onClick={() => {
            setSelectedAiResult(record);
            setAiModalOpen(true);
          }}
        >
          Details
        </Button>
      ),
    },
  ];

  const aiIssueColumns: ColumnsType<ProductAiIssue> = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (value: AiSeverity) => <Tag color={aiSeverityColor(value)}>{value.toUpperCase()}</Tag>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
    },
    {
      title: 'Issue',
      dataIndex: 'title',
      key: 'title',
      width: 240,
      render: (value) => <Text strong>{value}</Text>,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      width: 360,
    },
    {
      title: 'Recommendation',
      dataIndex: 'recommendation',
      key: 'recommendation',
      width: 420,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {messageContextHolder}
      {modalContextHolder}

      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            Product Master
          </Title>

          <Text type="secondary">
            Standardized product/SKU master data for inventory, inbound, outbound, purchasing, CSV import, UOM
            conversion, stock control, reconciliation, and AI data quality auditing.
          </Text>
        </div>

        <Alert
          type="info"
          showIcon
          icon={<RobotOutlined />}
          title="AI Product Master Auditor enabled"
          description="AI checks duplicate SKU/Product Code/Barcode, UOM validity, stock policy, inactive products with stock, batch/expiry control consistency, expired inventory risk, and operational readiness for inbound/outbound."
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Text type="secondary">Total Products</Text>
              <Title level={3} style={{ margin: 0 }}>
                {products.length}
              </Title>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Text type="secondary">Active</Text>
              <Title level={3} style={{ margin: 0, color: '#389e0d' }}>
                {activeCount}
              </Title>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Text type="secondary">Inactive</Text>
              <Title level={3} style={{ margin: 0, color: '#cf1322' }}>
                {inactiveCount}
              </Title>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Text type="secondary">Low Stock Products</Text>
              <Title level={3} style={{ margin: 0, color: lowStockCount > 0 ? '#cf1322' : undefined }}>
                {lowStockCount}
              </Title>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Text type="secondary">Batch Controlled</Text>
              <Title level={3} style={{ margin: 0 }}>
                {batchControlledCount}
              </Title>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Text type="secondary">Expiry Controlled</Text>
              <Title level={3} style={{ margin: 0 }}>
                {expiryControlledCount}
              </Title>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Text type="secondary">Inventory Rows Linked</Text>
              <Title level={3} style={{ margin: 0 }}>
                {inventory.length}
              </Title>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Text type="secondary">Filtered Result</Text>
              <Title level={3} style={{ margin: 0 }}>
                {filteredProducts.length}
              </Title>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Text type="secondary">AI Average Score</Text>
              <Progress percent={aiSummary.avgScore} status={aiSummary.critical > 0 ? 'exception' : 'active'} />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Text type="secondary">AI Healthy</Text>
              <Title level={3} style={{ margin: 0, color: '#389e0d' }}>
                {aiSummary.healthy}
              </Title>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Text type="secondary">AI Warning</Text>
              <Title level={3} style={{ margin: 0, color: '#d46b08' }}>
                {aiSummary.warning}
              </Title>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Text type="secondary">AI Critical</Text>
              <Title level={3} style={{ margin: 0, color: '#cf1322' }}>
                {aiSummary.critical}
              </Title>
            </Card>
          </Col>
        </Row>

        <Card>
          <Row gutter={[16, 16]} justify="space-between" align="middle">
            <Col xs={24} md={10}>
              <Search
                allowClear
                placeholder="Search code, SKU, product name, barcode, category, brand, UOM..."
                value={searchText}
                onSearch={setSearchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Col>

            <Col>
              <Space wrap>
                <Button onClick={handleRefreshMasters}>Refresh Masters</Button>

                <Button onClick={handleCreateMissingFromInventory}>Create Missing From Inventory</Button>

                <Button icon={<RobotOutlined />} onClick={() => setAiDashboardOpen(true)}>
                  AI Audit
                </Button>

                <Button icon={<ThunderboltOutlined />} onClick={handleExportAiAudit}>
                  Export AI Audit
                </Button>

                <Button onClick={handleClearFilters}>Clear Filters</Button>

                <Button onClick={handleLoadDemoData}>Load Demo</Button>

                <Button onClick={handleTemplateDownload}>Template CSV</Button>

                <Button onClick={handleImportClick}>Import CSV</Button>

                <Button onClick={handleExport}>Export CSV</Button>

                <Button danger onClick={handleClearAllProducts}>
                  Clear All
                </Button>

                <Button type="primary" onClick={openCreateModal}>
                  Add Product
                </Button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={handleImportFile}
                />
              </Space>
            </Col>
          </Row>

          <Divider />

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={5}>
              <Select
                style={{ width: '100%' }}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value)}
                options={[
                  { label: 'All Status', value: 'All' },
                  { label: 'Active', value: 'Active' },
                  { label: 'Inactive', value: 'Inactive' },
                ]}
              />
            </Col>

            <Col xs={24} sm={12} md={5}>
              <Select
                showSearch
                style={{ width: '100%' }}
                value={categoryFilter}
                onChange={setCategoryFilter}
                optionFilterProp="label"
                options={[
                  { label: 'All Categories', value: 'All' },
                  ...categoryFilterOptions.map((item) => ({
                    label: item,
                    value: item,
                  })),
                ]}
              />
            </Col>

            <Col xs={24} sm={12} md={5}>
              <Select
                showSearch
                style={{ width: '100%' }}
                value={storageFilter}
                onChange={setStorageFilter}
                optionFilterProp="label"
                options={[
                  { label: 'All Storage Types', value: 'All' },
                  ...storageFilterOptions.map((item) => ({
                    label: item,
                    value: item,
                  })),
                ]}
              />
            </Col>

            <Col xs={24} sm={12} md={5}>
              <Select
                showSearch
                style={{ width: '100%' }}
                value={uomFilter}
                onChange={setUomFilter}
                optionFilterProp="label"
                options={[
                  { label: 'All UOM', value: 'All' },
                  ...uomSelectOptions.map((item) => ({
                    label: item.label,
                    value: item.value,
                  })),
                ]}
              />
            </Col>

            <Col xs={24} sm={12} md={4}>
              <Select
                style={{ width: '100%' }}
                value={controlFilter}
                onChange={setControlFilter}
                options={[
                  { label: 'All Control Types', value: 'All' },
                  { label: 'Batch Controlled', value: 'Batch' },
                  { label: 'Expiry Controlled', value: 'Expiry' },
                  { label: 'Batch + Expiry', value: 'BatchExpiry' },
                  { label: 'No Control', value: 'NoControl' },
                ]}
              />
            </Col>
          </Row>

          <Divider />

          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredProducts}
            bordered
            scroll={{ x: 3300 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} products`,
            }}
          />
        </Card>
      </Space>

      {/* Product Create/Edit/View Modal */}
      <Modal
        title={modalMode === 'create' ? 'Add Product' : modalMode === 'edit' ? 'Edit Product' : 'View Product'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={isViewMode ? closeModal : handleSubmit}
        okText={isViewMode ? 'Close' : 'Save'}
        cancelButtonProps={{
          style: isViewMode ? { display: 'none' } : undefined,
        }}
        width={1100}
        destroyOnHidden
        afterOpenChange={handleProductModalAfterOpenChange}
      >
        <Form
          form={form}
          layout="vertical"
          disabled={isViewMode}
          initialValues={{
            status: 'Active',
            uom: 'PCS',
            purchaseUom: 'PCS',
            salesUom: 'PCS',
            purchaseToBaseFactor: 1,
            salesToBaseFactor: 1,
            category: 'General',
            itemType: 'Finished Goods',
            storageType: 'Ambient',
            isBatchControlled: true,
            isExpiryControlled: true,
          }}
          onValuesChange={(changedValues) => {
            if (changedValues.sku && !form.getFieldValue('productCode')) {
              form.setFieldValue('productCode', normalizeText(changedValues.sku));
            }

            if (changedValues.uom) {
              const currentPurchaseUom = form.getFieldValue('purchaseUom');
              const currentSalesUom = form.getFieldValue('salesUom');

              if (!currentPurchaseUom) {
                form.setFieldValue('purchaseUom', changedValues.uom);
              }

              if (!currentSalesUom) {
                form.setFieldValue('salesUom', changedValues.uom);
              }
            }
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Product Code"
                name="productCode"
                tooltip="Stable product code used across Inventory, PO, SO, Inbound, and Outbound. Defaults to SKU if blank."
                rules={[
                  {
                    pattern: /^[A-Za-z0-9-_./]+$/,
                    message: 'Product Code should only contain letters, numbers, dash, underscore, dot or slash.',
                  },
                ]}
              >
                <Input placeholder="Example: SKU-001" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="SKU"
                name="sku"
                rules={[
                  { required: true, message: 'SKU is required.' },
                  {
                    pattern: /^[A-Za-z0-9-_./]+$/,
                    message: 'SKU should only contain letters, numbers, dash, underscore, dot or slash.',
                  },
                ]}
              >
                <Input placeholder="Example: SKU-001" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Product Name"
                name="productName"
                rules={[{ required: true, message: 'Product name is required.' }]}
              >
                <Input placeholder="Example: Product A" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Barcode" name="barcode">
                <Input placeholder="Optional barcode" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Brand" name="brand">
                <Input placeholder="Optional brand" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Category" name="category" rules={[{ required: true, message: 'Category is required.' }]}>
                <Select
                  showSearch
                  placeholder="Select category"
                  optionFilterProp="label"
                  options={categoryFilterOptions.map((item) => ({
                    label: item,
                    value: item,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Item Type" name="itemType">
                <Select
                  showSearch
                  placeholder="Select item type"
                  optionFilterProp="label"
                  options={itemTypeOptions.map((item) => ({
                    label: item,
                    value: item,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Storage Type" name="storageType">
                <Select
                  showSearch
                  placeholder="Select storage type"
                  optionFilterProp="label"
                  options={storageTypeOptions.map((item) => ({
                    label: item,
                    value: item,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Shelf Life Days"
                name="shelfLifeDays"
                tooltip="Useful for expiry-controlled products."
              >
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: '100%' }}
                  placeholder="Optional shelf life in days"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Status" name="status" rules={[{ required: true, message: 'Status is required.' }]}>
                <Select
                  showSearch
                  placeholder="Select status"
                  optionFilterProp="label"
                  options={productStatusOptions}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Base UOM"
                name="uom"
                tooltip="Base UOM is used for inventory stock balance."
                rules={[{ required: true, message: 'Base UOM is required.' }]}
              >
                <Select
                  showSearch
                  placeholder="Select Base UOM"
                  optionFilterProp="label"
                  options={uomSelectOptions}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Purchase UOM"
                name="purchaseUom"
                tooltip="Purchase UOM is used for PO / GRN receiving."
                rules={[{ required: true, message: 'Purchase UOM is required.' }]}
              >
                <Select
                  showSearch
                  placeholder="Select Purchase UOM"
                  optionFilterProp="label"
                  options={uomSelectOptions}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Sales UOM"
                name="salesUom"
                tooltip="Sales UOM is used for outbound / selling."
                rules={[{ required: true, message: 'Sales UOM is required.' }]}
              >
                <Select
                  showSearch
                  placeholder="Select Sales UOM"
                  optionFilterProp="label"
                  options={uomSelectOptions}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Purchase To Base Factor"
                name="purchaseToBaseFactor"
                tooltip="Example: Base UOM PCS, Purchase UOM CTN, factor 24 means 1 CTN = 24 PCS."
                rules={[{ required: true, message: 'Purchase To Base Factor is required.' }]}
              >
                <InputNumber min={0.000001} precision={6} style={{ width: '100%' }} placeholder="Example: 24" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Sales To Base Factor"
                name="salesToBaseFactor"
                tooltip="Example: Base UOM PCS, Sales UOM PCS, factor 1 means 1 PCS = 1 PCS."
                rules={[{ required: true, message: 'Sales To Base Factor is required.' }]}
              >
                <InputNumber min={0.000001} precision={6} style={{ width: '100%' }} placeholder="Example: 1" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Batch Controlled" name="isBatchControlled" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Expiry Controlled" name="isExpiryControlled" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Min Stock Level" name="minStockLevel">
                <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="Optional minimum stock level" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Max Stock Level" name="maxStockLevel">
                <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="Optional maximum stock level" />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label="Remarks" name="remarks">
                <Input.TextArea rows={3} placeholder="Optional remarks" />
              </Form.Item>
            </Col>
          </Row>

          {selectedProduct && (
            <>
              <Divider />

              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Text type="secondary">Current Available Stock:</Text>
                  <br />
                  <Text strong>{getProductStock(selectedProduct)}</Text>
                </Col>

                <Col xs={24} md={8}>
                  <Text type="secondary">Created At:</Text>
                  <br />
                  <Text>{formatDateTime(selectedProduct.createdAt)}</Text>
                </Col>

                <Col xs={24} md={8}>
                  <Text type="secondary">Updated At:</Text>
                  <br />
                  <Text>{formatDateTime(selectedProduct.updatedAt)}</Text>
                </Col>
              </Row>

              {selectedProductAiResult && (
                <>
                  <Divider titlePlacement="left">AI Product Master Check</Divider>

                  <Alert
                    showIcon
                    icon={<RobotOutlined />}
                    type={
                      selectedProductAiResult.status === 'critical'
                        ? 'error'
                        : selectedProductAiResult.status === 'warning'
                          ? 'warning'
                          : 'success'
                    }
                    title={
                      <Space>
                        <span>{selectedProductAiResult.summary}</span>
                        <Tag color={aiStatusColor(selectedProductAiResult.status)}>
                          Score {selectedProductAiResult.score}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Button
                        size="small"
                        icon={<RobotOutlined />}
                        style={{ marginTop: 8 }}
                        onClick={() => openAiModal(selectedProduct)}
                      >
                        View AI Details
                      </Button>
                    }
                  />
                </>
              )}

              <Divider titlePlacement="left">Linked Inventory Rows</Divider>

              <Table
                rowKey={(record) => getInventoryRowKey(record)}
                columns={inventoryPreviewColumns}
                dataSource={inventoryRowsForSelectedProduct}
                size="small"
                bordered
                scroll={{ x: 1100 }}
                pagination={{
                  pageSize: 5,
                  showSizeChanger: false,
                  showTotal: (total) => `${total} inventory row(s)`,
                }}
              />
            </>
          )}
        </Form>
      </Modal>

      {/* Individual AI Modal */}
      <Modal
        open={aiModalOpen}
        destroyOnHidden
        width={1100}
        title={
          <Space>
            <RobotOutlined />
            <span>AI Product Master Auditor</span>
          </Space>
        }
        onCancel={() => {
          setAiModalOpen(false);
          setSelectedAiResult(null);
        }}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setAiModalOpen(false);
              setSelectedAiResult(null);
            }}
          >
            Close
          </Button>,
        ]}
      >
        {selectedAiResult ? (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <Alert
              showIcon
              icon={<RobotOutlined />}
              type={
                selectedAiResult.status === 'critical'
                  ? 'error'
                  : selectedAiResult.status === 'warning'
                    ? 'warning'
                    : 'success'
              }
              title={selectedAiResult.summary}
              description="AI analysis is rule-based and checks product master quality, inventory linkage, operational readiness, and warehouse risk signals."
            />

            <Row gutter={[16, 16]}>
              <Col xs={24} md={6}>
                <Card size="small">
                  <Text type="secondary">AI Status</Text>
                  <br />
                  <Tag color={aiStatusColor(selectedAiResult.status)} icon={<RobotOutlined />} style={{ marginTop: 8 }}>
                    {aiStatusLabel(selectedAiResult.status)}
                  </Tag>
                </Card>
              </Col>

              <Col xs={24} md={6}>
                <Card size="small">
                  <Text type="secondary">AI Score</Text>
                  <Progress
                    percent={selectedAiResult.score}
                    status={
                      selectedAiResult.status === 'critical'
                        ? 'exception'
                        : selectedAiResult.status === 'warning'
                          ? 'active'
                          : 'success'
                    }
                  />
                </Card>
              </Col>

              <Col xs={24} md={6}>
                <Card size="small">
                  <Text type="secondary">Can Use Inbound</Text>
                  <br />
                  <Tag color={selectedAiResult.canUseInbound ? 'green' : 'red'} style={{ marginTop: 8 }}>
                    {selectedAiResult.canUseInbound ? 'Yes' : 'No'}
                  </Tag>
                </Card>
              </Col>

              <Col xs={24} md={6}>
                <Card size="small">
                  <Text type="secondary">Can Use Outbound</Text>
                  <br />
                  <Tag color={selectedAiResult.canUseOutbound ? 'green' : 'red'} style={{ marginTop: 8 }}>
                    {selectedAiResult.canUseOutbound ? 'Yes' : 'No'}
                  </Tag>
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={6}>
                <Card size="small">
                  <Text type="secondary">Critical Issues</Text>
                  <Title level={4} style={{ margin: 0, color: selectedAiResult.criticalCount > 0 ? '#cf1322' : undefined }}>
                    {selectedAiResult.criticalCount}
                  </Title>
                </Card>
              </Col>

              <Col xs={24} md={6}>
                <Card size="small">
                  <Text type="secondary">Warnings</Text>
                  <Title level={4} style={{ margin: 0, color: selectedAiResult.warningCount > 0 ? '#d46b08' : undefined }}>
                    {selectedAiResult.warningCount}
                  </Title>
                </Card>
              </Col>

              <Col xs={24} md={6}>
                <Card size="small">
                  <Text type="secondary">Info Items</Text>
                  <Title level={4} style={{ margin: 0 }}>
                    {selectedAiResult.infoCount}
                  </Title>
                </Card>
              </Col>

              <Col xs={24} md={6}>
                <Card size="small">
                  <Text type="secondary">Linked Stock Qty</Text>
                  <Title level={4} style={{ margin: 0 }}>
                    {selectedAiResult.stockQty}
                  </Title>
                </Card>
              </Col>
            </Row>

            <Card size="small">
              <Paragraph>
                <Text strong>Product Code:</Text> {selectedAiResult.productCode}
              </Paragraph>
              <Paragraph>
                <Text strong>SKU:</Text> {selectedAiResult.sku}
              </Paragraph>
              <Paragraph style={{ marginBottom: 0 }}>
                <Text strong>Product Name:</Text> {selectedAiResult.productName}
              </Paragraph>
            </Card>

            <Divider titlePlacement="left">
              <Space>
                <ExclamationCircleOutlined />
                AI Issues
              </Space>
            </Divider>

            <Table
              rowKey="id"
              size="small"
              columns={aiIssueColumns}
              dataSource={selectedAiResult.issues}
              bordered
              scroll={{ x: 1300 }}
              pagination={{
                pageSize: 8,
                showSizeChanger: false,
              }}
              locale={{
                emptyText: <Empty description="No AI issues found" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />

            <Divider titlePlacement="left">
              <Space>
                <BulbOutlined />
                AI Recommendations
              </Space>
            </Divider>

            {selectedAiResult.recommendations.length > 0 ? (
              <ul>
                {selectedAiResult.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <Alert type="success" showIcon icon={<CheckCircleOutlined />} title="No action required." />
            )}
          </Space>
        ) : (
          <Empty description="No AI result selected" />
        )}
      </Modal>

      {/* AI Dashboard Modal */}
      <Modal
        open={aiDashboardOpen}
        destroyOnHidden
        width={1300}
        title={
          <Space>
            <RobotOutlined />
            <span>AI Product Master Audit Dashboard</span>
          </Space>
        }
        onCancel={() => setAiDashboardOpen(false)}
        footer={[
          <Button key="export" icon={<ThunderboltOutlined />} onClick={handleExportAiAudit}>
            Export AI Audit
          </Button>,
          <Button key="close" type="primary" onClick={() => setAiDashboardOpen(false)}>
            Close
          </Button>,
        ]}
      >
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            showIcon
            icon={<RobotOutlined />}
            type={aiSummary.critical > 0 ? 'error' : aiSummary.warning > 0 ? 'warning' : 'success'}
            title="AI Product Master Audit Summary"
            description={`Average score ${aiSummary.avgScore}. Healthy: ${aiSummary.healthy}, Warning: ${aiSummary.warning}, Critical: ${aiSummary.critical}.`}
          />

          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}>
              <Card>
                <Text type="secondary">Average Score</Text>
                <Progress percent={aiSummary.avgScore} status={aiSummary.critical > 0 ? 'exception' : 'active'} />
              </Card>
            </Col>

            <Col xs={24} md={6}>
              <Card>
                <Text type="secondary">Healthy</Text>
                <Title level={3} style={{ margin: 0, color: '#389e0d' }}>
                  {aiSummary.healthy}
                </Title>
              </Card>
            </Col>

            <Col xs={24} md={6}>
              <Card>
                <Text type="secondary">Warning</Text>
                <Title level={3} style={{ margin: 0, color: '#d46b08' }}>
                  {aiSummary.warning}
                </Title>
              </Card>
            </Col>

            <Col xs={24} md={6}>
              <Card>
                <Text type="secondary">Critical</Text>
                <Title level={3} style={{ margin: 0, color: '#cf1322' }}>
                  {aiSummary.critical}
                </Title>
              </Card>
            </Col>
          </Row>

          {aiSummary.critical > 0 && (
            <Alert
              type="error"
              showIcon
              icon={<WarningOutlined />}
              title="Critical products require correction"
              description="Products with critical AI status may have duplicate codes, invalid UOM, inactive stock, expired inventory, or invalid stock policy. Review before using in inbound or outbound."
            />
          )}

          <Table
            rowKey="productId"
            columns={aiDashboardColumns}
            dataSource={aiResults}
            bordered
            scroll={{ x: 1600 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `${total} AI audit result(s)`,
            }}
          />
        </Space>
      </Modal>
    </div>
  );
}