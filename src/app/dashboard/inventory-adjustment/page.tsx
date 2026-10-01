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
  ExperimentOutlined,
  EyeOutlined,
  FileExcelOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SendOutlined,
  StopOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ADJUSTMENT_STORAGE_KEY = 'wms_inventory_adjustments';
const INVENTORY_STORAGE_KEY = 'wms_inventory';
const INVENTORY_COMPAT_STORAGE_KEY = 'wms_inventory_management';
const MOVEMENT_STORAGE_KEY = 'wms_stock_movements';
const MOVEMENT_COMPAT_STORAGE_KEY = 'wms_inventory_movements';
const PRODUCT_MASTER_KEY = 'wms_product_master';

const INVENTORY_STORAGE_KEYS = [
  'wms_inventory',
  'wms_inventory_management',
  'wms_inventory_data',
  'wms_inventory_items',
  'wms_stock',
  'wms_stock_balance',
];

type AdjustmentType =
  | 'Positive Adjustment'
  | 'Negative Adjustment'
  | 'Shrinkage'
  | 'Write-off'
  | 'Internal Issue'
  | 'Quality Hold'
  | 'Quality Release';

type AdjustmentStatus = 'Draft' | 'Submitted' | 'Approved' | 'Posted' | 'Rejected' | 'Cancelled';

type AIStatus = 'Ready' | 'Ready with Warning' | 'Blocked' | 'Needs Approval';

interface ProductMaster {
  id?: string;
  productCode?: string;
  sku?: string;
  itemCode?: string;
  materialCode?: string;
  productName?: string;
  description?: string;
  name?: string;
  uom?: string;
  baseUom?: string;
  uomCode?: string;
  unitOfMeasure?: string;
  status?: string;
  active?: boolean;
  isBatchControlled?: boolean;
  batchControlled?: boolean;
  isExpiryControlled?: boolean;
  expiryControlled?: boolean;
  standardCost?: number;
  fixedCost?: number;
  unitCost?: number;
  averageCost?: number;
  weightedAverageCost?: number;
  movingAverageCost?: number;
  mapCost?: number;
  fifoCost?: number;
  lifoCost?: number;
  cost?: number;
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
  productName?: string;
  description?: string;
  name?: string;
  batchNo?: string;
  batch?: string;
  lotNo?: string;
  lot?: string;
  batchNumber?: string;
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
  unrestrictedQty?: number;
  goodQty?: number;
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
  [key: string]: any;
}

interface InventoryAdjustmentItem {
  id: string;
  sourceInventoryId?: string;
  productCode?: string;
  sku: string;
  productName?: string;
  batchNo?: string;
  plant: string;
  location?: string;
  expiryDate?: string;
  uom?: string;
  qty: number;
  unitCost?: number;
  totalCost?: number;
  currentBatchQty?: number;
  currentAvailableQty?: number;
  remarks?: string;
}

interface InventoryAdjustment {
  id: string;
  adjustmentNo: string;
  adjustmentDate: string;
  adjustmentType: AdjustmentType;
  status: AdjustmentStatus;
  reasonCode: string;
  reasonDescription?: string;
  referenceNo?: string;
  department?: string;
  requestor?: string;
  approver?: string;
  approvedBy?: string;
  approvedAt?: string;
  postedAt?: string;
  movementPosted: boolean;
  remarks?: string;
  items: InventoryAdjustmentItem[];
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

const adjustmentTypes: AdjustmentType[] = [
  'Positive Adjustment',
  'Negative Adjustment',
  'Shrinkage',
  'Write-off',
  'Internal Issue',
  'Quality Hold',
  'Quality Release',
];

const statuses: AdjustmentStatus[] = ['Draft', 'Submitted', 'Approved', 'Posted', 'Rejected', 'Cancelled'];

const reasonCodes = [
  'CYCLE_COUNT_GAIN',
  'CYCLE_COUNT_LOSS',
  'DAMAGED',
  'EXPIRED',
  'SHRINKAGE',
  'THEFT_LOSS',
  'SAMPLE_ISSUE',
  'PRODUCTION_ISSUE',
  'RND_ISSUE',
  'MARKETING_SAMPLE',
  'QC_HOLD',
  'QC_RELEASE',
  'SYSTEM_CORRECTION',
  'OTHER',
];

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function findInventoryArrayDeep(value: any, depth = 0): InventoryRow[] {
  if (!value || depth > 5) return [];

  if (Array.isArray(value)) {
    const looksLikeInventory = value.some(
      (row) =>
        row &&
        typeof row === 'object' &&
        (row.sku ||
          row.productCode ||
          row.itemCode ||
          row.materialCode ||
          row.batchNo ||
          row.batch ||
          row.lotNo ||
          row.location ||
          row.stockLocation ||
          row.storageLocation ||
          row.availableQty !== undefined ||
          row.availableBalance !== undefined ||
          row.batchQty !== undefined ||
          row.currentStock !== undefined ||
          row.stockQty !== undefined ||
          row.quantity !== undefined ||
          row.qty !== undefined),
    );

    return looksLikeInventory ? value : [];
  }

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
    ];

    for (const key of preferredKeys) {
      const found = findInventoryArrayDeep(value[key], depth + 1);
      if (found.length > 0) return found;
    }

    for (const key of Object.keys(value)) {
      const found = findInventoryArrayDeep(value[key], depth + 1);
      if (found.length > 0) return found;
    }
  }

  return [];
}

function loadInventoryRowsFromStorage(): InventoryRow[] {
  if (typeof window === 'undefined') return [];

  for (const key of INVENTORY_STORAGE_KEYS) {
    const parsed = safeJsonParse<any>(localStorage.getItem(key), null);
    const rows = findInventoryArrayDeep(parsed);
    if (rows.length > 0) return rows;
  }

  return [];
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateAdjustmentNo() {
  return `ADJ-${dayjs().format('YYYYMMDD')}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function generateMovementNo() {
  return `MOV-${dayjs().format('YYYYMMDD')}-${Math.floor(10000 + Math.random() * 90000)}`;
}

function normalizeText(value?: any) {
  return String(value ?? '').trim().toUpperCase();
}

function compactCode(value?: any) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s_\-./]/g, '');
}

function normalizeDate(value?: any) {
  if (!value) return '';
  const d = dayjs(value);
  if (!d.isValid()) return String(value).trim();
  return d.format('YYYY-MM-DD');
}

function toNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value: any) {
  return Math.round(toNumber(value) * 100) / 100;
}

function getSku(row: any) {
  return row?.sku || row?.productCode || row?.itemCode || row?.materialCode || row?.productSku || row?.code || '';
}

function getProductCode(row: any) {
  return row?.productCode || row?.sku || row?.itemCode || row?.materialCode || row?.productSku || row?.code || '';
}

function getProductName(row: any) {
  return row?.productName || row?.description || row?.itemName || row?.materialName || row?.name || '';
}

function getBatch(row: any) {
  return row?.batchNo || row?.batch || row?.lotNo || row?.lot || row?.batchNumber || '';
}

function getPlant(row: any) {
  return row?.plant || row?.plantCode || row?.warehouse || row?.warehouseCode || row?.site || row?.siteCode || '';
}

function getLocation(row: any) {
  return (
    row?.location ||
    row?.stockLocation ||
    row?.storageLocation ||
    row?.storageLoc ||
    row?.bin ||
    row?.binLocation ||
    row?.rackLocation ||
    row?.locator ||
    ''
  );
}

function getExpiry(row: any) {
  return normalizeDate(row?.expiryDate || row?.expirationDate || row?.expireDate || row?.expDate || '');
}

function getUom(row: any) {
  return row?.uom || row?.unit || row?.baseUom || row?.uomCode || row?.unitOfMeasure || '';
}

function getBatchQty(row: any): number {
  return toNumber(
    row?.batchQty ??
      row?.availableQty ??
      row?.availableBalance ??
      row?.availableStock ??
      row?.unrestrictedQty ??
      row?.goodQty ??
      row?.onHandQty ??
      row?.onHand ??
      row?.stockOnHand ??
      row?.balanceQty ??
      row?.balance ??
      row?.stockBalance ??
      row?.currentQty ??
      row?.currentStock ??
      row?.stockQty ??
      row?.quantity ??
      row?.qty ??
      row?.closingBalance ??
      row?.endingBalance ??
      row?.physicalQty ??
      row?.systemQty ??
      0,
  );
}

function getAvailableQty(row: any): number {
  return toNumber(
    row?.availableQty ??
      row?.availableBalance ??
      row?.availableStock ??
      row?.unrestrictedQty ??
      row?.goodQty ??
      row?.batchQty ??
      row?.onHandQty ??
      row?.onHand ??
      row?.stockOnHand ??
      row?.balanceQty ??
      row?.balance ??
      row?.stockBalance ??
      row?.currentQty ??
      row?.currentStock ??
      row?.stockQty ??
      row?.quantity ??
      row?.qty ??
      row?.closingBalance ??
      row?.endingBalance ??
      row?.physicalQty ??
      row?.systemQty ??
      0,
  );
}

function getInventoryUnitCost(row: any): number {
  const direct = toNumber(
    row?.unitCost ??
      row?.inventoryCost ??
      row?.cost ??
      row?.standardCost ??
      row?.fixedCost ??
      row?.averageCost ??
      row?.weightedAverageCost ??
      row?.movingAverageCost ??
      row?.mapCost ??
      row?.fifoCost ??
      row?.lifoCost ??
      row?.unitPrice ??
      row?.price ??
      0,
  );

  if (direct > 0) return roundMoney(direct);

  const qty = getBatchQty(row) || getAvailableQty(row);
  const totalValue = toNumber(row?.totalCost ?? row?.inventoryValue ?? row?.stockValue ?? row?.totalValue ?? row?.value ?? row?.amount ?? 0);

  if (qty > 0 && totalValue > 0) return roundMoney(totalValue / qty);
  return 0;
}

function getProductCost(product?: ProductMaster): number {
  if (!product) return 0;

  return roundMoney(
    product.unitCost ??
      product.cost ??
      product.standardCost ??
      product.fixedCost ??
      product.averageCost ??
      product.weightedAverageCost ??
      product.movingAverageCost ??
      product.mapCost ??
      product.fifoCost ??
      product.lifoCost ??
      product.unitPrice ??
      product.price ??
      0,
  );
}

function getInventoryStatus(row: any) {
  return row?.status || row?.stockStatus || row?.inventoryStatus || '';
}

function isHoldStatus(status?: any) {
  const s = normalizeText(status);
  return ['HOLD', 'QUALITY HOLD', 'QC HOLD', 'QA HOLD', 'ON HOLD', 'QUARANTINE'].includes(s);
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
  ].includes(s);
}

function isAvailableInventoryRow(row: any) {
  const status = normalizeText(getInventoryStatus(row));
  if (!status) return getAvailableQty(row) > 0;
  if (isBlockedInventoryStatus(status)) return false;
  return getAvailableQty(row) > 0;
}

function setInventoryQty(row: InventoryRow, qty: number, availableQty?: number) {
  const safeQty = Math.max(0, toNumber(qty));
  const safeAvailable = Math.max(0, toNumber(availableQty ?? qty));

  return {
    ...row,
    batchQty: safeQty,
    availableQty: safeAvailable,
    onHandQty: safeQty,
    balanceQty: safeQty,
    quantity: safeQty,
    qty: safeQty,
    updatedAt: new Date().toISOString(),
  };
}

function isProductActive(product?: ProductMaster) {
  if (!product) return true;
  if (product.active === false) return false;
  if (normalizeText(product.status) === 'INACTIVE') return false;
  if (normalizeText(product.status) === 'DISCONTINUED') return false;
  return true;
}

function productBatchControlled(product?: ProductMaster) {
  return Boolean(product?.isBatchControlled || product?.batchControlled);
}

function productExpiryControlled(product?: ProductMaster) {
  return Boolean(product?.isExpiryControlled || product?.expiryControlled);
}

function inventoryRowKey(row: InventoryRow, index?: number) {
  return String(
    row.id ||
      row.key ||
      row.inventoryId ||
      row.stockId ||
      `${getSku(row)}_${getBatch(row)}_${getPlant(row)}_${getLocation(row)}_${getExpiry(row)}_${index ?? ''}`,
  );
}

function matchesInventory(
  inv: InventoryRow,
  item: Partial<InventoryAdjustmentItem>,
  options?: {
    status?: 'Available' | 'Hold' | string;
    flexibleExpiry?: boolean;
  },
) {
  const requestedStatus = normalizeText(options?.status || '');

  if (requestedStatus === 'AVAILABLE' && !isAvailableInventoryRow(inv)) return false;

  if (requestedStatus === 'HOLD') {
    if (!isHoldStatus(getInventoryStatus(inv))) return false;
    if (getBatchQty(inv) <= 0) return false;
  }

  if (item.sourceInventoryId) {
    const invId = String(inv.id || inv.key || inv.inventoryId || inv.stockId || '');
    if (invId && invId === String(item.sourceInventoryId)) return true;
  }

  const targetSku = normalizeText(item.sku || item.productCode);
  const targetBatch = normalizeText(item.batchNo);
  const targetPlant = normalizeText(item.plant);
  const targetLocation = normalizeText(item.location);
  const targetExpiry = normalizeDate(item.expiryDate);

  const skuMatch = targetSku ? normalizeText(getSku(inv)) === targetSku : true;
  const batchMatch = targetBatch ? normalizeText(getBatch(inv)) === targetBatch : true;
  const plantMatch = targetPlant ? normalizeText(getPlant(inv)) === targetPlant : true;
  const locationMatch = targetLocation ? normalizeText(getLocation(inv)) === targetLocation : true;
  const expiryMatch = targetExpiry ? getExpiry(inv) === targetExpiry : options?.flexibleExpiry ? true : true;

  return skuMatch && batchMatch && plantMatch && locationMatch && expiryMatch;
}

function csvEscape(value: any) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;
  const clean = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    const next = clean[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);

  return rows;
}

function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function statusColor(status: AdjustmentStatus) {
  const map: Record<string, string> = {
    Draft: 'default',
    Submitted: 'processing',
    Approved: 'blue',
    Posted: 'success',
    Rejected: 'error',
    Cancelled: 'warning',
  };

  return map[status] || 'default';
}

function typeColor(type: AdjustmentType) {
  if (type === 'Positive Adjustment' || type === 'Quality Release') return 'green';

  if (['Negative Adjustment', 'Shrinkage', 'Write-off', 'Internal Issue'].includes(type)) {
    return 'red';
  }

  if (type === 'Quality Hold') return 'orange';

  return 'default';
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

function isNegativeLikeAdjustment(type: AdjustmentType) {
  return ['Negative Adjustment', 'Shrinkage', 'Write-off', 'Internal Issue', 'Quality Hold'].includes(type);
}

export default function InventoryAdjustmentPage() {
  const [form] = Form.useForm();

  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [products, setProducts] = useState<ProductMaster[]>([]);

  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<AdjustmentType | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<AdjustmentStatus | 'All'>('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryAdjustment | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<InventoryAdjustment | null>(null);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiReview, setAiReview] = useState<AIReviewResult | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  function loadAll() {
    const adj = safeJsonParse<InventoryAdjustment[]>(localStorage.getItem(ADJUSTMENT_STORAGE_KEY), []);
    const inventoryRows = loadInventoryRowsFromStorage();
    const productData = safeJsonParse<ProductMaster[]>(localStorage.getItem(PRODUCT_MASTER_KEY), []);

    setAdjustments(adj);
    setInventory(inventoryRows);
    setProducts(productData);
  }

  function persistAdjustments(next: InventoryAdjustment[]) {
    setAdjustments(next);
    localStorage.setItem(ADJUSTMENT_STORAGE_KEY, JSON.stringify(next));
  }

  function persistInventory(next: InventoryRow[]) {
    setInventory(next);
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(INVENTORY_COMPAT_STORAGE_KEY, JSON.stringify(next));
  }

  function appendMovements(movements: any[]) {
    const oldA = safeJsonParse<any[]>(localStorage.getItem(MOVEMENT_STORAGE_KEY), []);
    const oldB = safeJsonParse<any[]>(localStorage.getItem(MOVEMENT_COMPAT_STORAGE_KEY), []);

    localStorage.setItem(MOVEMENT_STORAGE_KEY, JSON.stringify([...oldA, ...movements]));
    localStorage.setItem(MOVEMENT_COMPAT_STORAGE_KEY, JSON.stringify([...oldB, ...movements]));
  }

  const productOptions = useMemo(() => {
    const map = new Map<string, { label: string; value: string }>();

    products.forEach((p) => {
      const value = p.sku || p.productCode || p.itemCode || p.materialCode || '';
      if (!value) return;

      map.set(value, {
        label: `${value} - ${getProductName(p) || '-'}`,
        value,
      });
    });

    inventory.forEach((inv) => {
      const value = getSku(inv);
      if (!value || map.has(value)) return;

      map.set(value, {
        label: `${value} - ${getProductName(inv) || '-'}`,
        value,
      });
    });

    return Array.from(map.values());
  }, [products, inventory]);

  const inventoryOptions = useMemo(() => {
    return inventory.map((inv, index) => {
      const key = inventoryRowKey(inv, index);
      const status = getInventoryStatus(inv) || 'Available';
      const cost = getInventoryUnitCost(inv);

      return {
        label: `${getSku(inv)} | ${getProductName(inv) || '-'} | Batch: ${getBatch(inv) || '-'} | Plant: ${
          getPlant(inv) || '-'
        } | Loc: ${getLocation(inv) || '-'} | Exp: ${getExpiry(inv) || '-'} | Status: ${status} | Batch Qty: ${getBatchQty(
          inv,
        )} | Available: ${getAvailableQty(inv)} | Cost: ${cost}`,
        value: key,
      };
    });
  }, [inventory]);

  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((adj) => {
      const text = normalizeText(searchText);

      const hitText =
        !text ||
        normalizeText(adj.adjustmentNo).includes(text) ||
        normalizeText(adj.reasonCode).includes(text) ||
        normalizeText(adj.referenceNo).includes(text) ||
        normalizeText(adj.approver).includes(text) ||
        adj.items.some(
          (it) =>
            normalizeText(it.sku).includes(text) ||
            normalizeText(it.productName).includes(text) ||
            normalizeText(it.batchNo).includes(text) ||
            normalizeText(it.location).includes(text),
        );

      const hitType = typeFilter === 'All' || adj.adjustmentType === typeFilter;
      const hitStatus = statusFilter === 'All' || adj.status === statusFilter;

      return hitText && hitType && hitStatus;
    });
  }, [adjustments, searchText, typeFilter, statusFilter]);

  const summary = useMemo(() => {
    const pending = adjustments.filter((a) => a.status === 'Submitted').length;
    const posted = adjustments.filter((a) => a.status === 'Posted').length;
    const highRisk = adjustments.filter((a) => a.aiStatus === 'Blocked' || a.aiStatus === 'Needs Approval').length;

    let positiveQty = 0;
    let negativeQty = 0;
    let totalValue = 0;

    adjustments.forEach((a) => {
      a.items.forEach((i) => {
        const qty = toNumber(i.qty);
        const value = roundMoney(i.totalCost ?? qty * toNumber(i.unitCost));

        totalValue += value;

        if (a.adjustmentType === 'Positive Adjustment' || a.adjustmentType === 'Quality Release') positiveQty += qty;

        if (['Negative Adjustment', 'Shrinkage', 'Write-off', 'Internal Issue', 'Quality Hold'].includes(a.adjustmentType)) {
          negativeQty += qty;
        }
      });
    });

    return {
      total: adjustments.length,
      pending,
      posted,
      highRisk,
      positiveQty,
      negativeQty,
      totalValue: roundMoney(totalValue),
    };
  }, [adjustments]);

  function findProductBySku(sku?: string) {
    return products.find((p) => normalizeText(p.sku || p.productCode || p.itemCode || p.materialCode) === normalizeText(sku));
  }

  function findInventoryByOptionValue(value?: string) {
    if (!value) return undefined;

    return inventory.find((inv, index) => {
      const key = inventoryRowKey(inv, index);
      const id = String(inv.id || inv.key || inv.inventoryId || inv.stockId || '');
      return key === value || id === value;
    });
  }

  function findInventoryRows(item: Partial<InventoryAdjustmentItem>, status?: 'Available' | 'Hold') {
    return inventory.filter((inv) =>
      matchesInventory(inv, item, {
        status,
        flexibleExpiry: true,
      }),
    );
  }

  function sampleValues(rows: InventoryRow[], getter: (row: InventoryRow) => any, limit = 5) {
    const values = Array.from(new Set(rows.map((row) => String(getter(row) ?? '').trim()).filter(Boolean)));
    return values.length > 0 ? values.slice(0, limit).join(', ') : '-';
  }

  function sampleInventoryRows(rows: InventoryRow[], limit = 3) {
    if (!rows.length) return '-';

    return rows
      .slice(0, limit)
      .map(
        (row) =>
          `SKU=${getSku(row) || '-'}, Batch=${getBatch(row) || '-'}, Plant=${getPlant(row) || '-'}, Location=${
            getLocation(row) || '-'
          }, Expiry=${getExpiry(row) || '-'}, Status=${getInventoryStatus(row) || 'Blank/Available'}, Batch Qty=${getBatchQty(
            row,
          )}, Available=${getAvailableQty(row)}`,
      )
      .join(' | ');
  }

  function buildInventoryDiagnostic(item: Partial<InventoryAdjustmentItem>, rowNo: number, requiredStatus: 'Available' | 'Hold') {
    const requiredLabel = requiredStatus === 'Hold' ? 'hold inventory' : 'available inventory';

    const sku = normalizeText(item.sku || item.productCode);
    const batch = normalizeText(item.batchNo);
    const plant = normalizeText(item.plant);
    const location = normalizeText(item.location);
    const expiry = normalizeDate(item.expiryDate);

    const transactionIdentity = `Transaction entered: SKU=${item.sku || '-'}, Batch=${item.batchNo || '-'}, Plant=${
      item.plant || '-'
    }, Location=${item.location || '-'}, Expiry=${expiry || '-'}, Required Status=${requiredStatus}.`;

    if (!inventory.length) {
      return `Row ${rowNo}: AI could not read inventory records from Inventory Management. ${transactionIdentity} Please open Inventory Management, confirm stock exists, click Refresh here, then try again.`;
    }

    if (!sku) {
      return `Row ${rowNo}: SKU is missing, so AI cannot search inventory. ${transactionIdentity}`;
    }

    if (item.sourceInventoryId) {
      const sourceExists = inventory.some(
        (inv) => String(inv.id || inv.key || inv.inventoryId || inv.stockId || '') === String(item.sourceInventoryId),
      );

      if (!sourceExists) {
        return `Row ${rowNo}: The selected inventory reference is no longer found. Source Inventory ID=${item.sourceInventoryId}. Please re-select the stock row from "Select Existing Inventory Stock".`;
      }
    }

    const bySku = inventory.filter((inv) => normalizeText(getSku(inv)) === sku);

    if (bySku.length === 0) {
      return `Row ${rowNo}: No ${requiredLabel} match found because SKU "${item.sku || item.productCode}" does not exist in the loaded Inventory records. ${transactionIdentity} Example loaded SKU values: ${sampleValues(
        inventory,
        getSku,
      )}.`;
    }

    const hints: string[] = [];

    const addFieldDiagnostic = (fieldName: string, formValue: any, rows: InventoryRow[], getter: (row: InventoryRow) => any) => {
      const formText = normalizeText(formValue);
      if (!formText) return;

      const exactMatch = rows.some((row) => normalizeText(getter(row)) === formText);
      if (exactMatch) return;

      const compactMatch = rows.some((row) => compactCode(getter(row)) === compactCode(formValue));

      if (compactMatch) {
        hints.push(
          `${fieldName} looks similar but formatting differs. Form="${formValue}", Inventory="${sampleValues(
            rows,
            getter,
          )}". Check spaces, hyphens, or punctuation.`,
        );
      } else {
        hints.push(`${fieldName} mismatch. Form="${formValue}", Inventory="${sampleValues(rows, getter)}".`);
      }
    };

    addFieldDiagnostic('Batch No', item.batchNo, bySku, getBatch);
    addFieldDiagnostic('Plant', item.plant, bySku, getPlant);
    addFieldDiagnostic('Location', item.location, bySku, getLocation);

    if (expiry) {
      const expiryExactMatch = bySku.some((row) => getExpiry(row) === expiry);
      if (!expiryExactMatch) {
        hints.push(`Expiry Date mismatch. Form="${expiry}", Inventory="${sampleValues(bySku, getExpiry)}".`);
      }
    }

    const keyMatchedRows = bySku.filter((inv) => {
      const batchMatch = batch ? normalizeText(getBatch(inv)) === batch : true;
      const plantMatch = plant ? normalizeText(getPlant(inv)) === plant : true;
      const locationMatch = location ? normalizeText(getLocation(inv)) === location : true;
      const expiryMatch = expiry ? getExpiry(inv) === expiry : true;
      return batchMatch && plantMatch && locationMatch && expiryMatch;
    });

    if (keyMatchedRows.length > 0) {
      if (requiredStatus === 'Available') {
        const availableRows = keyMatchedRows.filter(isAvailableInventoryRow);
        const totalAvailable = availableRows.reduce((sum, row) => sum + getAvailableQty(row), 0);

        if (availableRows.length === 0) {
          hints.push(
            `Inventory identity exists, but it is not eligible as Available stock. Status found="${sampleValues(
              keyMatchedRows,
              getInventoryStatus,
            )}", Available Qty found="${sampleValues(keyMatchedRows, getAvailableQty)}".`,
          );
        } else {
          hints.push(
            `Inventory identity exists and available stock was found during diagnostics. Total available=${totalAvailable}. Please re-select the inventory row to refresh the transaction line.`,
          );
        }
      }

      if (requiredStatus === 'Hold') {
        const holdRows = keyMatchedRows.filter((row) => isHoldStatus(getInventoryStatus(row)));
        const totalHold = holdRows.reduce((sum, row) => sum + getBatchQty(row), 0);

        if (holdRows.length === 0) {
          hints.push(
            `Inventory identity exists, but it is not in Hold/QC Hold status. Status found="${sampleValues(
              keyMatchedRows,
              getInventoryStatus,
            )}".`,
          );
        } else {
          hints.push(`Hold inventory was found during diagnostics. Total hold quantity=${totalHold}.`);
        }
      }
    }

    if (hints.length === 0) {
      hints.push(
        'SKU exists in Inventory, but no single inventory row matched all required fields together. Compare Batch, Plant, Location, Expiry Date, Status, and Available Qty.',
      );
    }

    return `Row ${rowNo}: No ${requiredLabel} match found. ${transactionIdentity} AI found ${bySku.length} inventory row(s) for this SKU, but none passed the full transaction matching rule. Likely cause: ${hints.join(
      ' ',
    )} Inventory examples: ${sampleInventoryRows(bySku)}.`;
  }

  function getRelevantInventoryBalance(item: Partial<InventoryAdjustmentItem>, adjustmentType?: AdjustmentType) {
    let rows: InventoryRow[] = [];

    if (adjustmentType === 'Quality Release') {
      rows = findInventoryRows(item, 'Hold');
    } else if (adjustmentType && ['Negative Adjustment', 'Shrinkage', 'Write-off', 'Internal Issue', 'Quality Hold'].includes(adjustmentType)) {
      rows = findInventoryRows(item, 'Available');
    } else {
      rows = inventory.filter((inv) => matchesInventory(inv, item, { flexibleExpiry: true }));
    }

    const qty =
      adjustmentType === 'Quality Release'
        ? rows.reduce((sum, inv) => sum + getBatchQty(inv), 0)
        : rows.reduce((sum, inv) => sum + getAvailableQty(inv), 0);

    const firstCostRow = rows.find((inv) => getInventoryUnitCost(inv) > 0);

    return {
      rows,
      qty,
      unitCost: firstCostRow ? getInventoryUnitCost(firstCostRow) : 0,
    };
  }

  function calculateItemCost(item: Partial<InventoryAdjustmentItem>, adjustmentType?: AdjustmentType) {
    const qty = toNumber(item.qty);
    let unitCost = toNumber(item.unitCost);

    if (!unitCost) {
      const balance = getRelevantInventoryBalance(item, adjustmentType);
      unitCost = balance.unitCost;
    }

    if (!unitCost) unitCost = getProductCost(findProductBySku(item.sku));

    return {
      unitCost: roundMoney(unitCost),
      totalCost: roundMoney(qty * unitCost),
    };
  }

  function refreshLineInventoryInfo(lineIndex: number) {
    const values = form.getFieldsValue();
    const items = form.getFieldValue('items') || [];
    const current = items[lineIndex];

    if (!current) return;

    const balance = getRelevantInventoryBalance(current, values.adjustmentType);
    const qty = toNumber(current.qty);
    const existingCost = toNumber(current.unitCost);
    const finalUnitCost = existingCost > 0 ? existingCost : balance.unitCost || getProductCost(findProductBySku(current.sku));

    items[lineIndex] = {
      ...current,
      currentBatchQty: balance.qty,
      currentAvailableQty: balance.qty,
      unitCost: roundMoney(finalUnitCost),
      totalCost: roundMoney(qty * finalUnitCost),
    };

    form.setFieldsValue({ items });
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

    const items = form.getFieldValue('items') || [];
    const current = items[lineIndex] || {};
    const unitCost = getInventoryUnitCost(inv);
    const qty = toNumber(current.qty || 1);

    items[lineIndex] = {
      ...current,
      sourceInventoryId: String(inv.id || inv.key || inv.inventoryId || inv.stockId || ''),
      sku: getSku(inv),
      productCode: getProductCode(inv),
      productName: getProductName(inv),
      batchNo: getBatch(inv),
      plant: getPlant(inv),
      location: getLocation(inv),
      expiryDate: getExpiry(inv) ? dayjs(getExpiry(inv)) : undefined,
      uom: getUom(inv),
      currentBatchQty: getBatchQty(inv),
      currentAvailableQty: isHoldStatus(getInventoryStatus(inv)) ? getBatchQty(inv) : getAvailableQty(inv),
      unitCost,
      totalCost: roundMoney(qty * unitCost),
    };

    form.setFieldsValue({ items });
  }

  function analyzeAdjustment(adj: InventoryAdjustment): AIReviewResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    let score = 100;
    let requiresApproval = false;

    if (!adj.reasonCode) {
      issues.push('Header: Reason Code is missing. Please select the adjustment reason before approval/posting.');
      score -= 12;
    }

    if (!adj.approver) {
      warnings.push('Header: Approver is recommended before approval/posting for audit control.');
      score -= 5;
    }

    if (!adj.items || adj.items.length === 0) {
      issues.push('Header: No adjustment items found. Add at least one SKU line.');
      score -= 30;
    }

    if (['Shrinkage', 'Write-off', 'Negative Adjustment'].includes(adj.adjustmentType) && !adj.remarks) {
      warnings.push('Header: Remarks are recommended for loss, shrinkage, write-off, or negative adjustment.');
      score -= 5;
    }

    adj.items.forEach((item, index) => {
      const rowNo = index + 1;
      const product = findProductBySku(item.sku);
      const qty = toNumber(item.qty);
      const unitCost = toNumber(item.unitCost);
      const totalCost = roundMoney(item.totalCost ?? qty * unitCost);

      if (!item.sku) {
        issues.push(`Row ${rowNo}: SKU is missing. AI cannot validate inventory without SKU.`);
        score -= 15;
      }

      if (!item.plant) {
        issues.push(`Row ${rowNo}: Plant is missing. Plant is required for inventory matching.`);
        score -= 10;
      }

      if (!item.location && adj.adjustmentType !== 'Positive Adjustment') {
        issues.push(`Row ${rowNo}: Stock Location is missing. Location is required for stock depletion, hold, or release.`);
        score -= 12;
      }

      if (!qty || qty <= 0) {
        issues.push(`Row ${rowNo}: Quantity must be greater than zero.`);
        score -= 15;
      }

      if (product && !isProductActive(product)) {
        issues.push(`Row ${rowNo}: Product is inactive or discontinued in Product Master.`);
        score -= 20;
      }

      if (productBatchControlled(product) && !item.batchNo) {
        issues.push(`Row ${rowNo}: Batch No is required because this SKU is batch-controlled.`);
        score -= 15;
      }

      if (productExpiryControlled(product) && !item.expiryDate) {
        issues.push(`Row ${rowNo}: Expiry Date is required because this SKU is expiry-controlled.`);
        score -= 15;
      }

      if (product && getUom(product) && item.uom && normalizeText(getUom(product)) !== normalizeText(item.uom)) {
        warnings.push(`Row ${rowNo}: UOM differs from Product Master. Product Master=${getUom(product)}, Transaction=${item.uom}.`);
        score -= 5;
      }

      if (!unitCost) {
        warnings.push(`Row ${rowNo}: Unit Cost is zero or missing. Please verify the cost before posting.`);
        score -= 5;
      }

      if (totalCost >= 10000) {
        warnings.push(`Row ${rowNo}: High adjustment value detected. Total Cost=${totalCost}. Supervisor approval is recommended.`);
        requiresApproval = true;
        score -= 8;
      }

      if (isNegativeLikeAdjustment(adj.adjustmentType)) {
        const matches = findInventoryRows(item, 'Available');
        const totalAvailable = matches.reduce((sum, inv) => sum + getAvailableQty(inv), 0);

        if (matches.length === 0) {
          issues.push(buildInventoryDiagnostic(item, rowNo, 'Available'));
          score -= 25;
        } else if (totalAvailable < qty) {
          issues.push(
            `Row ${rowNo}: Inventory was found, but available quantity is insufficient. Required=${qty}, Available=${totalAvailable}, Matched Rows=${matches.length}. Reduce quantity or select another inventory row with enough available balance.`,
          );
          score -= 25;
        }

        if (adj.adjustmentType === 'Shrinkage' && totalAvailable > 0) {
          const ratio = qty / totalAvailable;
          if (ratio >= 0.3) {
            warnings.push(`Row ${rowNo}: Shrinkage quantity is ${(ratio * 100).toFixed(1)}% of available stock. Recount or supervisor review is recommended.`);
            requiresApproval = true;
            score -= 10;
          }
        }
      }

      if (adj.adjustmentType === 'Quality Release') {
        const matches = findInventoryRows(item, 'Hold');
        const totalHold = matches.reduce((sum, inv) => sum + getBatchQty(inv), 0);

        if (matches.length === 0) {
          issues.push(buildInventoryDiagnostic(item, rowNo, 'Hold'));
          score -= 25;
        } else if (totalHold < qty) {
          issues.push(
            `Row ${rowNo}: Hold inventory was found, but hold quantity is insufficient. Required=${qty}, Hold Qty=${totalHold}, Matched Hold Rows=${matches.length}. Reduce release quantity or verify QC Hold stock.`,
          );
          score -= 25;
        }
      }

      if (adj.adjustmentType === 'Write-off') {
        const exp = normalizeDate(item.expiryDate);
        if (exp && dayjs(exp).isAfter(dayjs(), 'day')) {
          warnings.push(`Row ${rowNo}: Write-off item is not expired yet. Confirm damage, obsolete, or disposal reason.`);
          requiresApproval = true;
          score -= 8;
        }
      }

      if (adj.adjustmentType === 'Positive Adjustment' && qty >= 1000) {
        warnings.push(`Row ${rowNo}: Large positive adjustment detected. Verify physical count and approval evidence.`);
        requiresApproval = true;
        score -= 8;
      }
    });

    if (issues.length > 0) recommendations.push('Fix blocking validation issues before approval/posting.');
    if (warnings.length > 0) recommendations.push('Supervisor should review warnings before posting.');

    if (adj.adjustmentType === 'Shrinkage') recommendations.push('Perform recount and investigate repeated shrinkage by SKU/location.');
    if (adj.adjustmentType === 'Write-off') recommendations.push('Attach disposal/damage evidence where required by company policy.');
    if (adj.adjustmentType === 'Quality Hold') recommendations.push('Confirm QC reason and expected release/disposal action.');
    if (adj.adjustmentType === 'Quality Release') recommendations.push('Confirm QC release approval before returning stock to available inventory.');

    if (recommendations.length === 0) recommendations.push('Adjustment is ready for normal approval workflow.');

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

  function openCreate() {
    setEditing(null);
    form.resetFields();

    form.setFieldsValue({
      adjustmentNo: generateAdjustmentNo(),
      adjustmentDate: dayjs(),
      adjustmentType: 'Negative Adjustment',
      status: 'Draft',
      movementPosted: false,
      items: [
        {
          id: generateId('line'),
          qty: 1,
          unitCost: 0,
          totalCost: 0,
        },
      ],
    });

    setModalOpen(true);
  }

  function openEdit(record: InventoryAdjustment) {
    if (!['Draft', 'Rejected'].includes(record.status)) {
      message.warning('Only Draft or Rejected adjustments can be edited.');
      return;
    }

    setEditing(record);

    form.setFieldsValue({
      ...record,
      adjustmentDate: record.adjustmentDate ? dayjs(record.adjustmentDate) : dayjs(),
      items: record.items?.map((i) => ({
        ...i,
        expiryDate: i.expiryDate ? dayjs(i.expiryDate) : undefined,
      })),
    });

    setModalOpen(true);

    setTimeout(() => {
      record.items?.forEach((_, idx) => refreshLineInventoryInfo(idx));
    }, 0);
  }

  function buildPayloadFromForm(values: any, existing?: InventoryAdjustment): InventoryAdjustment {
    const now = new Date().toISOString();

    const normalizedItems: InventoryAdjustmentItem[] = (values.items || []).map((item: any) => {
      const expiryDate = item.expiryDate ? normalizeDate(item.expiryDate) : '';
      const qty = toNumber(item.qty);

      const baseItem = {
        ...item,
        expiryDate,
        qty,
      };

      const balance = getRelevantInventoryBalance(baseItem, values.adjustmentType);
      const costInfo = calculateItemCost(baseItem, values.adjustmentType);

      const unitCost = item.unitCost !== undefined ? roundMoney(item.unitCost) : costInfo.unitCost;
      const totalCost = roundMoney(qty * unitCost);

      return {
        ...baseItem,
        id: item.id || generateId('line'),
        sourceInventoryId: item.sourceInventoryId,
        productCode: item.productCode || item.sku,
        unitCost,
        totalCost,
        currentBatchQty: balance.qty,
        currentAvailableQty: balance.qty,
      };
    });

    const totalCost = roundMoney(normalizedItems.reduce((sum, item) => sum + toNumber(item.totalCost), 0));

    return {
      id: existing?.id || generateId('adj'),
      adjustmentNo: values.adjustmentNo || existing?.adjustmentNo || generateAdjustmentNo(),
      adjustmentDate: normalizeDate(values.adjustmentDate || dayjs()),
      adjustmentType: values.adjustmentType,
      status: existing?.status || 'Draft',
      reasonCode: values.reasonCode,
      reasonDescription: values.reasonDescription,
      referenceNo: values.referenceNo,
      department: values.department,
      requestor: values.requestor,
      approver: values.approver,
      approvedBy: existing?.approvedBy,
      approvedAt: existing?.approvedAt,
      postedAt: existing?.postedAt,
      movementPosted: existing?.movementPosted || false,
      remarks: values.remarks,
      items: normalizedItems,
      totalCost,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
  }

  function handleSave() {
    form.validateFields().then((values) => {
      const payload = buildPayloadFromForm(values, editing || undefined);
      const review = analyzeAdjustment(payload);

      payload.aiScore = review.score;
      payload.aiStatus = review.status;
      payload.aiIssues = [...review.issues, ...review.warnings];
      payload.aiRecommendations = review.recommendations;

      const next = editing ? adjustments.map((a) => (a.id === editing.id ? payload : a)) : [payload, ...adjustments];

      persistAdjustments(next);
      setModalOpen(false);
      message.success(editing ? 'Adjustment updated.' : 'Adjustment created.');
    });
  }

  function updateStatus(record: InventoryAdjustment, status: AdjustmentStatus) {
    const now = new Date().toISOString();

    const updated: InventoryAdjustment = {
      ...record,
      status,
      updatedAt: now,
      ...(status === 'Approved'
        ? {
            approvedBy: record.approver || 'System User',
            approvedAt: now,
          }
        : {}),
    };

    persistAdjustments(adjustments.map((a) => (a.id === record.id ? updated : a)));
    setSelected((prev) => (prev?.id === record.id ? updated : prev));
    message.success(`Adjustment ${status}.`);
  }

  function duplicateAdjustment(record: InventoryAdjustment) {
    const now = new Date().toISOString();

    const copy: InventoryAdjustment = {
      ...record,
      id: generateId('adj'),
      adjustmentNo: generateAdjustmentNo(),
      status: 'Draft',
      movementPosted: false,
      approvedBy: undefined,
      approvedAt: undefined,
      postedAt: undefined,
      items: record.items.map((i) => ({
        ...i,
        id: generateId('line'),
      })),
      createdAt: now,
      updatedAt: now,
    };

    persistAdjustments([copy, ...adjustments]);
    message.success('Adjustment duplicated as Draft.');
  }

  function deleteAdjustment(record: InventoryAdjustment) {
    if (record.status !== 'Draft') {
      message.warning('Only Draft adjustment can be deleted.');
      return;
    }

    persistAdjustments(adjustments.filter((a) => a.id !== record.id));
    message.success('Adjustment deleted.');
  }

  function consumeFromInventory(currentInventory: InventoryRow[], item: InventoryAdjustmentItem, qty: number, sourceStatus: 'Available' | 'Hold' = 'Available') {
    let remaining = qty;
    const movementsContext: any[] = [];

    const next = currentInventory.map((inv) => {
      if (
        remaining <= 0 ||
        !matchesInventory(inv, item, {
          status: sourceStatus,
          flexibleExpiry: true,
        })
      ) {
        return inv;
      }

      const available = sourceStatus === 'Hold' ? getBatchQty(inv) : getAvailableQty(inv);
      if (available <= 0) return inv;

      const deduct = Math.min(remaining, available);
      remaining -= deduct;

      const beforeQty = getBatchQty(inv);
      const beforeAvailable = getAvailableQty(inv);
      const newBatchQty = Math.max(0, beforeQty - deduct);
      const newAvailableQty = sourceStatus === 'Hold' ? 0 : Math.max(0, beforeAvailable - deduct);
      const unitCost = item.unitCost ?? getInventoryUnitCost(inv);

      movementsContext.push({
        inventoryId: inv.id || inv.key || inv.inventoryId || inv.stockId,
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

  function addToInventory(currentInventory: InventoryRow[], item: InventoryAdjustmentItem, qty: number, status: 'Available' | 'Hold' = 'Available', overrides?: Partial<InventoryRow>) {
    const targetSku = item.sku || item.productCode || '';
    const targetBatch = overrides?.batchNo ?? item.batchNo ?? '';
    const targetExpiry = normalizeDate(overrides?.expiryDate ?? item.expiryDate ?? '');
    const targetLocation = overrides?.location ?? item.location ?? '';
    const targetPlant = overrides?.plant ?? item.plant ?? '';
    const targetUom = overrides?.uom ?? item.uom ?? '';
    const unitCost = roundMoney(item.unitCost ?? overrides?.unitCost ?? getProductCost(findProductBySku(targetSku)));

    let merged = false;

    const next = currentInventory.map((inv) => {
      const same =
        normalizeText(getSku(inv)) === normalizeText(targetSku) &&
        normalizeText(getBatch(inv)) === normalizeText(targetBatch) &&
        normalizeText(getPlant(inv)) === normalizeText(targetPlant) &&
        normalizeText(getLocation(inv)) === normalizeText(targetLocation) &&
        normalizeDate(getExpiry(inv)) === normalizeDate(targetExpiry) &&
        normalizeText(getUom(inv)) === normalizeText(targetUom) &&
        normalizeText(getInventoryStatus(inv) || 'Available') === normalizeText(status);

      if (!same) return inv;

      merged = true;

      const newQty = getBatchQty(inv) + qty;
      const newAvail = status === 'Hold' ? 0 : getAvailableQty(inv) + qty;
      const finalCost = unitCost || getInventoryUnitCost(inv);

      return setInventoryQty(
        {
          ...inv,
          status,
          unitCost: finalCost,
          inventoryCost: finalCost,
          cost: finalCost,
          ...overrides,
        },
        newQty,
        newAvail,
      );
    });

    if (!merged) {
      next.push({
        id: generateId('inv'),
        productCode: item.productCode || targetSku,
        sku: targetSku,
        productName: item.productName,
        batchNo: targetBatch,
        plant: targetPlant,
        location: targetLocation,
        expiryDate: targetExpiry,
        uom: targetUom,
        status,
        batchQty: qty,
        availableQty: status === 'Hold' ? 0 : qty,
        onHandQty: qty,
        balanceQty: qty,
        quantity: qty,
        qty,
        unitCost,
        inventoryCost: unitCost,
        cost: unitCost,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
      });
    }

    return next;
  }

  function createMovement(adj: InventoryAdjustment, item: InventoryAdjustmentItem, movementType: string, direction: 'IN' | 'OUT' | 'STATUS', qty: number, extra?: any) {
    const unitCost = roundMoney(extra?.unitCost ?? item.unitCost ?? 0);
    const totalCost = roundMoney(extra?.totalCost ?? qty * unitCost);

    return {
      id: generateId('mov'),
      movementNo: generateMovementNo(),
      movementType,
      type: movementType,
      direction,
      referenceType: 'Inventory Adjustment',
      referenceNo: adj.adjustmentNo,
      sourceModule: 'Inventory Adjustment',
      sourceId: adj.id,
      sourceLineId: item.id,
      productCode: item.productCode || item.sku,
      sku: item.sku,
      productName: item.productName,
      batchNo: item.batchNo,
      plant: item.plant,
      location: item.location,
      expiryDate: normalizeDate(item.expiryDate),
      uom: item.uom,
      qty,
      unitCost,
      totalCost,
      reasonCode: adj.reasonCode,
      approver: adj.approver,
      approvedBy: adj.approvedBy,
      remarks: item.remarks || adj.remarks,
      movementDate: adj.adjustmentDate,
      createdAt: new Date().toISOString(),
      ...extra,
    };
  }

  function postAdjustment(record: InventoryAdjustment) {
    if (record.status !== 'Approved') {
      message.warning('Only Approved adjustment can be posted.');
      return;
    }

    if (record.movementPosted) {
      message.warning('This adjustment has already been posted.');
      return;
    }

    const review = analyzeAdjustment(record);

    if (review.status === 'Blocked') {
      Modal.error({
        title: 'AI Posting Blocked',
        width: 850,
        content: (
          <div>
            <p>AI blocked posting because the document still has blocking issues:</p>
            <ul>
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

        if (qty <= 0) throw new Error(`Invalid quantity for SKU ${item.sku}.`);

        if (record.adjustmentType === 'Positive Adjustment') {
          nextInventory = addToInventory(nextInventory, item, qty, 'Available');
          movements.push(createMovement(record, item, 'Positive Adjustment', 'IN', qty));
        }

        if (['Negative Adjustment', 'Shrinkage', 'Write-off', 'Internal Issue'].includes(record.adjustmentType)) {
          const result = consumeFromInventory(nextInventory, item, qty, 'Available');

          if (result.remaining > 0) {
            throw new Error(`Insufficient inventory for SKU ${item.sku}. Short ${result.remaining}.`);
          }

          nextInventory = result.inventory;

          result.movementsContext.forEach((ctx) => {
            movements.push(
              createMovement(record, item, record.adjustmentType, 'OUT', ctx.deductedQty, {
                inventoryId: ctx.inventoryId,
                beforeQty: ctx.beforeQty,
                afterQty: ctx.afterQty,
                beforeAvailableQty: ctx.beforeAvailableQty,
                afterAvailableQty: ctx.afterAvailableQty,
                unitCost: ctx.unitCost,
                totalCost: ctx.totalCost,
              }),
            );
          });
        }

        if (record.adjustmentType === 'Quality Hold') {
          const result = consumeFromInventory(nextInventory, item, qty, 'Available');

          if (result.remaining > 0) {
            throw new Error(`Insufficient available inventory for QC Hold SKU ${item.sku}. Short ${result.remaining}.`);
          }

          nextInventory = result.inventory;
          nextInventory = addToInventory(nextInventory, item, qty, 'Hold');

          result.movementsContext.forEach((ctx) => {
            movements.push(
              createMovement(record, item, 'Quality Hold', 'STATUS', ctx.deductedQty, {
                inventoryId: ctx.inventoryId,
                beforeQty: ctx.beforeQty,
                afterQty: ctx.afterQty,
                beforeAvailableQty: ctx.beforeAvailableQty,
                afterAvailableQty: ctx.afterAvailableQty,
                fromStatus: 'Available',
                toStatus: 'Hold',
                unitCost: ctx.unitCost,
                totalCost: ctx.totalCost,
              }),
            );
          });
        }

        if (record.adjustmentType === 'Quality Release') {
          const result = consumeFromInventory(nextInventory, item, qty, 'Hold');

          if (result.remaining > 0) {
            throw new Error(`Insufficient hold inventory for QC Release SKU ${item.sku}. Short ${result.remaining}.`);
          }

          nextInventory = result.inventory;
          nextInventory = addToInventory(nextInventory, item, qty, 'Available');

          result.movementsContext.forEach((ctx) => {
            movements.push(
              createMovement(record, item, 'Quality Release', 'STATUS', ctx.deductedQty, {
                inventoryId: ctx.inventoryId,
                beforeQty: ctx.beforeQty,
                afterQty: ctx.afterQty,
                beforeAvailableQty: ctx.beforeAvailableQty,
                afterAvailableQty: ctx.afterAvailableQty,
                fromStatus: 'Hold',
                toStatus: 'Available',
                unitCost: ctx.unitCost,
                totalCost: ctx.totalCost,
              }),
            );
          });
        }
      });

      persistInventory(nextInventory);
      appendMovements(movements);

      const now = new Date().toISOString();

      const posted: InventoryAdjustment = {
        ...record,
        status: 'Posted',
        movementPosted: true,
        postedAt: now,
        updatedAt: now,
        aiScore: review.score,
        aiStatus: review.status,
        aiIssues: [...review.issues, ...review.warnings],
        aiRecommendations: review.recommendations,
      };

      persistAdjustments(adjustments.map((a) => (a.id === record.id ? posted : a)));
      setSelected((prev) => (prev?.id === record.id ? posted : prev));

      message.success('Adjustment posted and inventory updated.');
    } catch (err: any) {
      Modal.error({
        title: 'Posting Failed',
        content: err?.message || 'Unable to post adjustment.',
      });
    }
  }

  function openAI(record: InventoryAdjustment) {
    const review = analyzeAdjustment(record);

    setAiReview(review);
    setAiOpen(true);

    const updated: InventoryAdjustment = {
      ...record,
      aiScore: review.score,
      aiStatus: review.status,
      aiIssues: [...review.issues, ...review.warnings],
      aiRecommendations: review.recommendations,
      updatedAt: new Date().toISOString(),
    };

    setSelected(updated);
    persistAdjustments(adjustments.map((a) => (a.id === record.id ? updated : a)));
  }

  function exportCsv() {
    const header = [
      'adjustmentNo',
      'adjustmentDate',
      'adjustmentType',
      'status',
      'reasonCode',
      'referenceNo',
      'department',
      'requestor',
      'approver',
      'sku',
      'productName',
      'batchNo',
      'plant',
      'location',
      'expiryDate',
      'uom',
      'qty',
      'unitCost',
      'totalCost',
      'remarks',
    ];

    const lines = [header.join(',')];

    adjustments.forEach((adj) => {
      adj.items.forEach((item) => {
        lines.push(
          [
            adj.adjustmentNo,
            adj.adjustmentDate,
            adj.adjustmentType,
            adj.status,
            adj.reasonCode,
            adj.referenceNo,
            adj.department,
            adj.requestor,
            adj.approver,
            item.sku,
            item.productName,
            item.batchNo,
            item.plant,
            item.location,
            item.expiryDate,
            item.uom,
            item.qty,
            item.unitCost,
            item.totalCost,
            item.remarks || adj.remarks,
          ]
            .map(csvEscape)
            .join(','),
        );
      });
    });

    downloadFile(`inventory-adjustments-${dayjs().format('YYYYMMDD-HHmm')}.csv`, lines.join('\n'));
  }

  function downloadTemplate() {
    const header = [
      'adjustmentNo',
      'adjustmentDate',
      'adjustmentType',
      'reasonCode',
      'referenceNo',
      'department',
      'requestor',
      'approver',
      'sku',
      'productName',
      'batchNo',
      'plant',
      'location',
      'expiryDate',
      'uom',
      'qty',
      'unitCost',
      'totalCost',
      'remarks',
    ];

    const sample = [
      '',
      dayjs().format('YYYY-MM-DD'),
      'Shrinkage',
      'SHRINKAGE',
      'REF-001',
      'Warehouse',
      'John',
      'Supervisor A',
      'SKU-030',
      'Sample Product',
      'BATCH-001',
      'PLANT-01',
      'A-01-01',
      '2026-12-31',
      'PCS',
      '5',
      '10.50',
      '52.50',
      'Cycle count shortage',
    ];

    downloadFile('inventory-adjustment-template.csv', `${header.join(',')}\n${sample.map(csvEscape).join(',')}`);
  }

  function importCsv(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      const rows = parseCsv(String(reader.result || ''));

      if (rows.length < 2) {
        message.error('CSV file is empty.');
        return;
      }

      const headers = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim());

      const records = rows.slice(1).map((row) => {
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = row[idx];
        });
        return obj;
      });

      const grouped = new Map<string, any[]>();

      records.forEach((r) => {
        const key = r.adjustmentNo || generateAdjustmentNo();
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)?.push(r);
      });

      const now = new Date().toISOString();
      const imported: InventoryAdjustment[] = [];

      grouped.forEach((groupRows, adjustmentNo) => {
        const first = groupRows[0];

        const items: InventoryAdjustmentItem[] = groupRows.map((r) => {
          const qty = toNumber(r.qty);
          const unitCost = roundMoney(r.unitCost);
          const totalCost = roundMoney(r.totalCost || qty * unitCost);

          return {
            id: generateId('line'),
            sku: r.sku,
            productCode: r.sku,
            productName: r.productName,
            batchNo: r.batchNo,
            plant: r.plant,
            location: r.location,
            expiryDate: normalizeDate(r.expiryDate),
            uom: r.uom,
            qty,
            unitCost,
            totalCost,
            remarks: r.remarks,
          };
        });

        const adjustmentType = adjustmentTypes.includes(first.adjustmentType as AdjustmentType)
          ? (first.adjustmentType as AdjustmentType)
          : 'Negative Adjustment';

        const adj: InventoryAdjustment = {
          id: generateId('adj'),
          adjustmentNo,
          adjustmentDate: normalizeDate(first.adjustmentDate || dayjs()),
          adjustmentType,
          status: 'Draft',
          reasonCode: first.reasonCode || 'OTHER',
          referenceNo: first.referenceNo,
          department: first.department,
          requestor: first.requestor,
          approver: first.approver,
          movementPosted: false,
          remarks: first.remarks,
          items,
          totalCost: roundMoney(items.reduce((sum, item) => sum + toNumber(item.totalCost), 0)),
          createdAt: now,
          updatedAt: now,
        };

        const review = analyzeAdjustment(adj);
        adj.aiScore = review.score;
        adj.aiStatus = review.status;
        adj.aiIssues = [...review.issues, ...review.warnings];
        adj.aiRecommendations = review.recommendations;

        imported.push(adj);
      });

      persistAdjustments([...imported, ...adjustments]);
      message.success(`${imported.length} adjustment document(s) imported.`);
    };

    reader.readAsText(file);
  }

  function loadDemo() {
    const now = new Date().toISOString();

    const demoItem: InventoryAdjustmentItem = {
      id: generateId('line'),
      sku: 'SKU-030',
      productCode: 'SKU-030',
      productName: 'Demo Product',
      batchNo: 'BATCH-001',
      plant: 'PLANT-01',
      location: 'A-01-01',
      expiryDate: '2026-12-31',
      uom: 'PCS',
      qty: 2,
      unitCost: 10,
      totalCost: 20,
    };

    const demo: InventoryAdjustment = {
      id: generateId('adj'),
      adjustmentNo: generateAdjustmentNo(),
      adjustmentDate: dayjs().format('YYYY-MM-DD'),
      adjustmentType: 'Shrinkage',
      status: 'Draft',
      reasonCode: 'SHRINKAGE',
      referenceNo: 'COUNT-REF-001',
      department: 'Warehouse',
      requestor: 'Cycle Count Team',
      approver: 'Warehouse Supervisor',
      movementPosted: false,
      remarks: 'Demo shrinkage adjustment from cycle count.',
      items: [demoItem],
      totalCost: 20,
      createdAt: now,
      updatedAt: now,
    };

    const review = analyzeAdjustment(demo);
    demo.aiScore = review.score;
    demo.aiStatus = review.status;
    demo.aiIssues = [...review.issues, ...review.warnings];
    demo.aiRecommendations = review.recommendations;

    persistAdjustments([demo, ...adjustments]);
    message.success('Demo adjustment loaded.');
  }

  const columns: ColumnsType<InventoryAdjustment> = [
    {
      title: 'Adjustment No',
      dataIndex: 'adjustmentNo',
      key: 'adjustmentNo',
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
      dataIndex: 'adjustmentDate',
      width: 110,
    },
    {
      title: 'Type',
      dataIndex: 'adjustmentType',
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
      title: 'Reason',
      dataIndex: 'reasonCode',
      width: 150,
    },
    {
      title: 'Approver',
      dataIndex: 'approver',
      width: 150,
      render: (v) => v || '-',
    },
    {
      title: 'Items',
      width: 90,
      render: (_, record) => record.items?.length || 0,
    },
    {
      title: 'Total Qty',
      width: 100,
      render: (_, record) => record.items?.reduce((sum, i) => sum + toNumber(i.qty), 0),
    },
    {
      title: 'Total Cost',
      width: 120,
      render: (_, record) => roundMoney(record.totalCost ?? record.items?.reduce((sum, i) => sum + toNumber(i.totalCost), 0)),
    },
    {
      title: 'Reference',
      dataIndex: 'referenceNo',
      width: 150,
      render: (v) => v || '-',
    },
    {
      title: 'Actions',
      width: 340,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button
            icon={<EyeOutlined />}
            onClick={() => {
              setSelected(record);
              setDetailOpen(true);
            }}
          />
          <Button icon={<RobotOutlined />} onClick={() => openAI(record)} />
          <Button icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Button icon={<CopyOutlined />} onClick={() => duplicateAdjustment(record)} />

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
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => postAdjustment(record)}>
              Post
            </Button>
          )}

          {['Draft', 'Submitted', 'Approved'].includes(record.status) && (
            <Button icon={<StopOutlined />} onClick={() => updateStatus(record, 'Cancelled')} />
          )}

          <Popconfirm title="Delete adjustment?" onConfirm={() => deleteAdjustment(record)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              <ExperimentOutlined /> Inventory Adjustment
            </Title>
            <Text type="secondary">Stock adjustment, shrinkage, write-off, internal issue, and quality hold/release.</Text>
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
                New Adjustment
              </Button>
            </Space>
          </Col>
        </Row>

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
              <Statistic title="Posted" value={summary.posted} />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Card>
              <Statistic title="High Risk" value={summary.highRisk} />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Card>
              <Statistic title="Net Qty Impact" value={summary.positiveQty - summary.negativeQty} />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Card>
              <Statistic title="Total Cost" value={summary.totalValue} precision={2} />
            </Card>
          </Col>
        </Row>

        <Card>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} md={10}>
              <Input.Search
                allowClear
                placeholder="Search adjustment no, SKU, batch, approver, reason..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Col>

            <Col xs={24} md={6}>
              <Select
                style={{ width: '100%' }}
                value={typeFilter}
                onChange={setTypeFilter}
                options={[{ label: 'All Types', value: 'All' }, ...adjustmentTypes.map((t) => ({ label: t, value: t }))]}
              />
            </Col>

            <Col xs={24} md={6}>
              <Select
                style={{ width: '100%' }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[{ label: 'All Status', value: 'All' }, ...statuses.map((s) => ({ label: s, value: s }))]}
              />
            </Col>
          </Row>

          <Table rowKey="id" columns={columns} dataSource={filteredAdjustments} scroll={{ x: 1900 }} pagination={{ pageSize: 10 }} />
        </Card>
      </Space>

      <Modal
        title={editing ? 'Edit Inventory Adjustment' : 'New Inventory Adjustment'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        width={1250}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changed) => {
            if (changed.adjustmentType !== undefined) {
              const items = form.getFieldValue('items') || [];
              setTimeout(() => {
                items.forEach((_: any, idx: number) => refreshLineInventoryInfo(idx));
              }, 0);
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
              <Form.Item name="adjustmentNo" label="Adjustment No">
                <Input disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="adjustmentDate" label="Adjustment Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="adjustmentType" label="Adjustment Type" rules={[{ required: true }]}>
                <Select options={adjustmentTypes.map((t) => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="reasonCode" label="Reason Code" rules={[{ required: true }]}>
                <Select showSearch options={reasonCodes.map((r) => ({ label: r, value: r }))} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="referenceNo" label="Reference No">
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="department" label="Department">
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="requestor" label="Requestor">
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item name="approver" label="Approver">
                <Input placeholder="Approver name" />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item name="remarks" label="Remarks">
                <TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Adjustment Items</Divider>

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title="Inventory Adjustment does not handle stock transfer."
            description="For location-to-location or plant-to-plant movement, use the Inventory Transfer module. This page only adds, depletes, holds, or releases stock from the selected stock location."
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
                        <Form.Item label="Select Existing Inventory Stock">
                          <Select
                            showSearch
                            allowClear
                            placeholder="Recommended. Select stock row to auto-fill SKU, batch, plant, location, expiry, UOM, balance and cost."
                            options={inventoryOptions}
                            onChange={(value) => {
                              if (value) applyInventoryToLine(field.name, value);
                            }}
                            filterOption={(input, option) => normalizeText(option?.label).includes(normalizeText(input))}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item name={[field.name, 'sku']} label="SKU" rules={[{ required: true }]}>
                          <Select
                            showSearch
                            allowClear
                            options={productOptions}
                            onChange={(value) => {
                              const product = findProductBySku(value);
                              const items = form.getFieldValue('items') || [];
                              const current = items[field.name] || {};
                              const unitCost = current.unitCost || getProductCost(product);
                              const qty = toNumber(current.qty || 1);

                              items[field.name] = {
                                ...current,
                                sku: value,
                                productCode: product?.productCode || value,
                                productName: getProductName(product),
                                uom: getUom(product),
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
                        <Form.Item name={[field.name, 'plant']} label="Plant" rules={[{ required: true }]}>
                          <Input />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item name={[field.name, 'location']} label="Stock Location">
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
                        <Form.Item name={[field.name, 'qty']} label="Qty" rules={[{ required: true }]}>
                          <InputNumber min={0.0001} style={{ width: '100%' }} onChange={(value) => recalculateLineCost(field.name, value)} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item name={[field.name, 'unitCost']} label="Unit Cost">
                          <InputNumber min={0} precision={2} style={{ width: '100%' }} onChange={() => setTimeout(() => recalculateLineCost(field.name), 0)} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item name={[field.name, 'totalCost']} label="Total Cost">
                          <InputNumber disabled precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item name={[field.name, 'currentAvailableQty']} label="Current Available / Hold">
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

                <Button
                  icon={<PlusOutlined />}
                  onClick={() =>
                    add({
                      id: generateId('line'),
                      qty: 1,
                      unitCost: 0,
                      totalCost: 0,
                    })
                  }
                >
                  Add Line
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Drawer title="Adjustment Detail" open={detailOpen} onClose={() => setDetailOpen(false)} size={1050} destroyOnHidden>
        {selected && (
          <Space orientation="vertical" style={{ width: '100%' }} size="large">
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Text strong>Adjustment No:</Text> {selected.adjustmentNo}
              </Col>

              <Col span={12}>
                <Text strong>Status:</Text> <Tag color={statusColor(selected.status)}>{selected.status}</Tag>
              </Col>

              <Col span={12}>
                <Text strong>Type:</Text> <Tag color={typeColor(selected.adjustmentType)}>{selected.adjustmentType}</Tag>
              </Col>

              <Col span={12}>
                <Text strong>Date:</Text> {selected.adjustmentDate}
              </Col>

              <Col span={12}>
                <Text strong>Reason:</Text> {selected.reasonCode}
              </Col>

              <Col span={12}>
                <Text strong>Reference:</Text> {selected.referenceNo || '-'}
              </Col>

              <Col span={12}>
                <Text strong>Requestor:</Text> {selected.requestor || '-'}
              </Col>

              <Col span={12}>
                <Text strong>Approver:</Text> {selected.approver || '-'}
              </Col>

              <Col span={12}>
                <Text strong>Total Cost:</Text> {roundMoney(selected.totalCost)}
              </Col>

              <Col span={12}>
                <Text strong>Approved By:</Text> {selected.approvedBy || '-'}
              </Col>
            </Row>

            <Alert
              title={
                <Space>
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
                AI Adjustment Review
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
                <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => postAdjustment(selected)}>
                  Post Adjustment
                </Button>
              )}
            </Space>

            <Table
              rowKey="id"
              dataSource={selected.items}
              pagination={false}
              scroll={{ x: 1400 }}
              columns={[
                { title: 'SKU', dataIndex: 'sku' },
                { title: 'Product', dataIndex: 'productName' },
                { title: 'Batch', dataIndex: 'batchNo' },
                { title: 'Plant', dataIndex: 'plant' },
                { title: 'Stock Location', dataIndex: 'location' },
                { title: 'Expiry', dataIndex: 'expiryDate' },
                { title: 'UOM', dataIndex: 'uom' },
                { title: 'Qty', dataIndex: 'qty' },
                { title: 'Unit Cost', dataIndex: 'unitCost', render: (v) => roundMoney(v) },
                { title: 'Total Cost', dataIndex: 'totalCost', render: (v) => roundMoney(v) },
                { title: 'Current Available / Hold', dataIndex: 'currentAvailableQty' },
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

      <Modal
        title={
          <Space>
            <RobotOutlined />
            AI Inventory Adjustment Review
          </Space>
        }
        open={aiOpen}
        onCancel={() => setAiOpen(false)}
        footer={[
          <Button key="close" onClick={() => setAiOpen(false)}>
            Close
          </Button>,
        ]}
        width={900}
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
                    styles={{
                      content: {
                        color: aiReview.status === 'Blocked' ? '#cf1322' : aiReview.status === 'Ready' ? '#3f8600' : '#faad14',
                        fontSize: 18,
                      },
                    }}
                  />
                </Col>

                <Col xs={24} md={16}>
                  <Text strong>Readiness Score</Text>
                  <Progress percent={aiReview.score} status={aiReview.status === 'Blocked' ? 'exception' : 'active'} />
                </Col>
              </Row>
            </Card>

            <Alert
              type="info"
              showIcon
              title="How AI checks this adjustment"
              description="AI compares each line against Inventory by SKU, Batch No, Plant, Stock Location, Expiry Date, stock status, and available/hold quantity. If no full match is found, AI explains which field is most likely different."
            />

            {aiReview.issues.length > 0 && (
              <Alert
                type="error"
                showIcon
                title="Blocking Issues — why posting is blocked"
                description={
                  <ul style={{ marginBottom: 0 }}>
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
                title="Warnings — review before posting"
                description={
                  <ul style={{ marginBottom: 0 }}>
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
              title="AI Recommendations — suggested next action"
              description={
                <ul style={{ marginBottom: 0 }}>
                  {aiReview.recommendations.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              }
            />

            {selected && (
              <Card size="small" title="Reviewed Document">
                <Space orientation="vertical">
                  <Text>
                    <strong>Adjustment:</strong> {selected.adjustmentNo}
                  </Text>
                  <Text>
                    <strong>Type:</strong> {selected.adjustmentType}
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
          </Space>
        )}
      </Modal>
    </div>
  );
}