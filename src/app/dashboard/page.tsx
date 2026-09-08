'use client';

import React, {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Flex,
  List,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AlertOutlined,
  BarChartOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DollarOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileDoneOutlined,
  InboxOutlined,
  LineChartOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  TruckOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

type UnknownRecord = Record<string, unknown>;

type PeriodFilter = '7' | '30' | '90' | '365' | 'all';

type RiskSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

type AchievementStatus =
  | 'Excellent'
  | 'Healthy'
  | 'Attention Required'
  | 'High Risk'
  | 'Critical';

interface DashboardFilters {
  period: PeriodFilter;
  plant: string;
  location: string;
}

interface DashboardRecords {
  products: UnknownRecord[];
  inventory: UnknownRecord[];
  salesOrders: UnknownRecord[];
  outbound: UnknownRecord[];
  adjustments: UnknownRecord[];
  transfers: UnknownRecord[];
  purchaseOrders: UnknownRecord[];
  inbound: UnknownRecord[];
  stockMovements: UnknownRecord[];
  inventoryMovements: UnknownRecord[];
  currentUser: UnknownRecord | null;
}

interface InventorySummary {
  totalQuantity: number;
  availableQuantity: number;
  allocatedQuantity: number;
  inventoryValue: number;
  nearExpiryValue: number;
  expiredValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  nearExpiryCount: number;
  expiredCount: number;
  healthyCount: number;
  totalSkuCount: number;
  availabilityRate: number;
  healthScore: number;
  missingCostCount: number;
}

interface DashboardRisk {
  key: string;
  severity: RiskSeverity;
  module: string;
  title: string;
  description: string;
  impact: string;
  reference: string;
  ageDays: number;
  recommendation: string;
  owner: string;
  route: string;
}

interface RecentActivity {
  key: string;
  date: string;
  timestamp: number;
  module: string;
  reference: string;
  description: string;
  status: string;
  route: string;
}

interface ModuleAchievement {
  key: string;
  module: string;
  route: string;
  score: number;
  target: number;
  completed: number;
  pending: number;
  critical: number;
  trend: number;
  description: string;
  color: string;
  icon: React.ReactNode;
}

interface TrendPoint {
  label: string;
  value: number;
}

interface ExecutiveAnalytics {
  inventory: InventorySummary;
  totalProducts: number;
  activeProducts: number;
  salesOrderCount: number;
  outboundCount: number;
  purchaseOrderCount: number;
  inboundCount: number;
  transferCount: number;
  adjustmentCount: number;
  movementCount: number;
  orderFulfilmentRate: number;
  outboundCompletionRate: number;
  purchaseCompletionRate: number;
  inboundCompletionRate: number;
  transferCompletionRate: number;
  adjustmentControlRate: number;
  movementIntegrityRate: number;
  executiveScore: number;
  confidence: number;
  status: AchievementStatus;
  risks: DashboardRisk[];
  achievements: ModuleAchievement[];
  activities: RecentActivity[];
  trend: TrendPoint[];
  criticalCount: number;
  highRiskCount: number;
  pendingCount: number;
  totalRecords: number;
}

const STORAGE_KEYS = {
  products: 'wms_product_master',
  inventory: 'wms_inventory',
  salesOrders: 'wms_sales_orders',
  outbound: 'wms_outbound_shipments',
  adjustments: 'wms_inventory_adjustments',
  transfers: 'wms_inventory_transfers',
  purchaseOrders: 'wms_purchase_orders',
  inbound: 'wms_inbound_receipts',
  stockMovements: 'wms_stock_movements',
  inventoryMovements: 'wms_inventory_movements',
  currentUser: 'wms_current_user',
} as const;

const STORAGE_KEY_LIST = Object.values(STORAGE_KEYS);

const TARGETS = {
  inventoryHealth: 95,
  orderFulfilment: 97,
  outboundCompletion: 95,
  purchaseCompletion: 90,
  inboundCompletion: 95,
  transferCompletion: 95,
  adjustmentControl: 98,
  movementIntegrity: 98,
  productCompleteness: 95,
} as const;

const MODULE_ROUTES = {
  products: '/dashboard/product-master',
  salesOrders: '/dashboard/sales-orders',
  outbound: '/dashboard/outbound',
  inventory: '/dashboard/inventory',
  adjustments: '/dashboard/inventory-adjustment',
  transfers: '/dashboard/inventory-transfer',
  purchaseOrders: '/dashboard/purchase-orders',
  inbound: '/dashboard/inbound',
  stockMovements: '/dashboard/stock-movement',
} as const;

const COMPLETED_STATUSES = [
  'completed',
  'complete',
  'received',
  'delivered',
  'shipped',
  'closed',
  'posted',
  'approved',
  'confirmed',
  'goods received',
  'fully received',
  'fulfilled',
];

const PENDING_STATUSES = [
  'pending',
  'draft',
  'open',
  'in progress',
  'processing',
  'awaiting approval',
  'approved',
  'allocated',
  'partially received',
  'partially shipped',
  'in transit',
];

const CRITICAL_STATUSES = [
  'cancelled',
  'rejected',
  'failed',
  'blocked',
  'overdue',
  'exception',
  'error',
];

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeParse(rawValue: string | null): unknown {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return null;
  }
}

function extractRecordArray(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) {
    return value.filter(isUnknownRecord);
  }

  if (!isUnknownRecord(value)) {
    return [];
  }

  const possibleArrays = [
    value.data,
    value.records,
    value.items,
    value.rows,
    value.list,
    value.results,
  ];

  for (const possibleArray of possibleArrays) {
    if (Array.isArray(possibleArray)) {
      return possibleArray.filter(isUnknownRecord);
    }
  }

  return [];
}

function getString(
  record: UnknownRecord,
  keys: string[],
  fallback = '',
): string {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return fallback;
}

function getNumber(
  record: UnknownRecord,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(
        value
          .replace(/,/g, '')
          .replace(/[^\d.-]/g, ''),
      );

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function getNestedItems(record: UnknownRecord): UnknownRecord[] {
  const possibleItems = [
    record.items,
    record.lines,
    record.orderItems,
    record.details,
    record.products,
    record.materials,
  ];

  for (const possibleItem of possibleItems) {
    if (Array.isArray(possibleItem)) {
      return possibleItem.filter(isUnknownRecord);
    }
  }

  return [];
}

function normaliseStatus(value: string): string {
  return value.trim().toLowerCase();
}

function isCompletedStatus(status: string): boolean {
  const normalised = normaliseStatus(status);

  return COMPLETED_STATUSES.some(
    (candidate) =>
      normalised === candidate || normalised.includes(candidate),
  );
}

function isPendingStatus(status: string): boolean {
  const normalised = normaliseStatus(status);

  if (!normalised) {
    return true;
  }

  if (isCompletedStatus(normalised)) {
    return false;
  }

  return PENDING_STATUSES.some(
    (candidate) =>
      normalised === candidate || normalised.includes(candidate),
  );
}

function isCriticalStatus(status: string): boolean {
  const normalised = normaliseStatus(status);

  return CRITICAL_STATUSES.some(
    (candidate) =>
      normalised === candidate || normalised.includes(candidate),
  );
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();

  const directDate = new Date(trimmed);

  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const dateParts = trimmed.split(/[/-]/);

  if (dateParts.length === 3) {
    const first = Number(dateParts[0]);
    const second = Number(dateParts[1]);
    const third = Number(dateParts[2]);

    if (
      Number.isFinite(first) &&
      Number.isFinite(second) &&
      Number.isFinite(third)
    ) {
      const year = first > 1900 ? first : third;
      const month = second - 1;
      const day = first > 1900 ? third : first;
      const parsedDate = new Date(year, month, day);

      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }
  }

  return null;
}

function getRecordDate(record: UnknownRecord): Date | null {
  const dateKeys = [
    'updatedAt',
    'updatedDate',
    'createdAt',
    'createdDate',
    'date',
    'documentDate',
    'orderDate',
    'shipmentDate',
    'movementDate',
    'receiptDate',
    'transferDate',
    'postingDate',
    'deliveryDate',
    'grnDate',
    'poDate',
  ];

  for (const key of dateKeys) {
    const parsedDate = parseDateValue(record[key]);

    if (parsedDate) {
      return parsedDate;
    }
  }

  return null;
}

function getExpiryDate(record: UnknownRecord): Date | null {
  const expiryKeys = [
    'expiryDate',
    'expirationDate',
    'expiredDate',
    'expiry',
    'bestBeforeDate',
  ];

  for (const key of expiryKeys) {
    const parsedDate = parseDateValue(record[key]);

    if (parsedDate) {
      return parsedDate;
    }
  }

  return null;
}

function formatDate(date: Date | null): string {
  if (!date) {
    return 'No date';
  }

  return new Intl.DateTimeFormat('en-MY', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-MY', {
    maximumFractionDigits: 2,
  }).format(value);
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return clamp((numerator / denominator) * 100);
}

function daysBetween(fromDate: Date, toDate: Date): number {
  const difference = toDate.getTime() - fromDate.getTime();
  return Math.floor(difference / 86_400_000);
}

function getPeriodStart(period: PeriodFilter): Date | null {
  if (period === 'all') {
    return null;
  }

  const periodDays = Number(period);
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - periodDays);

  return startDate;
}

function recordMatchesPeriod(
  record: UnknownRecord,
  period: PeriodFilter,
): boolean {
  const periodStart = getPeriodStart(period);

  if (!periodStart) {
    return true;
  }

  const recordDate = getRecordDate(record);

  /*
   * Master and opening-balance records may not have transaction dates.
   * Keep them available so executive inventory totals remain accurate.
   */
  if (!recordDate) {
    return true;
  }

  return recordDate >= periodStart;
}

function recordMatchesOrganisation(
  record: UnknownRecord,
  plant: string,
  location: string,
): boolean {
  const recordPlant = getString(record, [
    'plant',
    'plantCode',
    'warehouse',
    'warehouseCode',
    'site',
  ]);

  const recordLocation = getString(record, [
    'location',
    'locationCode',
    'storageLocation',
    'binLocation',
    'fromLocation',
  ]);

  const plantMatches =
    plant === 'ALL' || !recordPlant || recordPlant === plant;

  const locationMatches =
    location === 'ALL' || !recordLocation || recordLocation === location;

  return plantMatches && locationMatches;
}

function filterRecords(
  records: UnknownRecord[],
  filters: DashboardFilters,
): UnknownRecord[] {
  return records.filter(
    (record) =>
      recordMatchesPeriod(record, filters.period) &&
      recordMatchesOrganisation(
        record,
        filters.plant,
        filters.location,
      ),
  );
}

function getDocumentStatus(record: UnknownRecord): string {
  return getString(
    record,
    [
      'status',
      'documentStatus',
      'approvalStatus',
      'shipmentStatus',
      'receiptStatus',
      'transferStatus',
    ],
    'Unknown',
  );
}

function getReference(
  record: UnknownRecord,
  fallbackPrefix: string,
  index: number,
): string {
  return getString(
    record,
    [
      'reference',
      'referenceNo',
      'documentNo',
      'orderNo',
      'salesOrderNo',
      'soNumber',
      'poNumber',
      'purchaseOrderNo',
      'shipmentNo',
      'deliveryOrderNo',
      'doNumber',
      'transferNo',
      'movementNo',
      'adjustmentNo',
      'grnNo',
      'receiptNo',
      'id',
    ],
    `${fallbackPrefix}-${String(index + 1).padStart(4, '0')}`,
  );
}

function getStringsFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }

      if (isUnknownRecord(item)) {
        return getString(item, [
          'code',
          'name',
          'plant',
          'plantCode',
          'location',
          'locationCode',
          'value',
        ]);
      }

      return '';
    })
    .filter(Boolean);
}

function getStatusColor(status: string): string {
  if (isCompletedStatus(status)) {
    return 'success';
  }

  if (isCriticalStatus(status)) {
    return 'error';
  }

  if (isPendingStatus(status)) {
    return 'warning';
  }

  return 'default';
}

function getSeverityColor(severity: RiskSeverity): string {
  if (severity === 'Critical') {
    return 'red';
  }

  if (severity === 'High') {
    return 'volcano';
  }

  if (severity === 'Medium') {
    return 'orange';
  }

  return 'blue';
}

function getScoreColor(score: number): string {
  if (score >= 90) {
    return '#52c41a';
  }

  if (score >= 80) {
    return '#1677ff';
  }

  if (score >= 70) {
    return '#faad14';
  }

  return '#ff4d4f';
}

function getAchievementStatus(score: number): AchievementStatus {
  if (score >= 90) {
    return 'Excellent';
  }

  if (score >= 80) {
    return 'Healthy';
  }

  if (score >= 70) {
    return 'Attention Required';
  }

  if (score >= 60) {
    return 'High Risk';
  }

  return 'Critical';
}

function calculateCompletion(records: UnknownRecord[]): {
  completed: number;
  pending: number;
  critical: number;
  rate: number;
} {
  const completed = records.filter((record) =>
    isCompletedStatus(getDocumentStatus(record)),
  ).length;

  const critical = records.filter((record) =>
    isCriticalStatus(getDocumentStatus(record)),
  ).length;

  const pending = Math.max(records.length - completed - critical, 0);

  return {
    completed,
    pending,
    critical,
    rate: records.length > 0 ? percentage(completed, records.length) : 100,
  };
}

function calculateProductCompleteness(products: UnknownRecord[]): number {
  if (products.length === 0) {
    return 0;
  }

  const totalPossibleFields = products.length * 5;
  let completedFields = 0;

  products.forEach((product) => {
    const requiredValues = [
      getString(product, ['sku', 'skuCode', 'productCode', 'materialCode']),
      getString(product, ['name', 'productName', 'description']),
      getString(product, ['uom', 'unitOfMeasure', 'baseUom']),
      getString(product, ['category', 'productCategory']),
      getString(product, ['status'], 'Active'),
    ];

    completedFields += requiredValues.filter(Boolean).length;
  });

  return percentage(completedFields, totalPossibleFields);
}

function calculateOrderFulfilment(records: UnknownRecord[]): number {
  if (records.length === 0) {
    return 100;
  }

  let requestedQuantity = 0;
  let fulfilledQuantity = 0;
  let completedOrders = 0;

  records.forEach((order) => {
    const items = getNestedItems(order);
    const status = getDocumentStatus(order);

    if (isCompletedStatus(status)) {
      completedOrders += 1;
    }

    if (items.length === 0) {
      const requested = getNumber(order, [
        'quantity',
        'qty',
        'orderedQty',
        'requestedQty',
        'totalQty',
      ]);

      const fulfilled = getNumber(
        order,
        [
          'fulfilledQty',
          'shippedQty',
          'deliveredQty',
          'allocatedQty',
        ],
        isCompletedStatus(status) ? requested : 0,
      );

      requestedQuantity += requested;
      fulfilledQuantity += Math.min(fulfilled, requested);
      return;
    }

    items.forEach((item) => {
      const requested = getNumber(item, [
        'quantity',
        'qty',
        'orderedQty',
        'requestedQty',
      ]);

      const fulfilled = getNumber(
        item,
        [
          'fulfilledQty',
          'shippedQty',
          'deliveredQty',
          'allocatedQty',
        ],
        isCompletedStatus(status) ? requested : 0,
      );

      requestedQuantity += requested;
      fulfilledQuantity += Math.min(fulfilled, requested);
    });
  });

  if (requestedQuantity > 0) {
    return percentage(fulfilledQuantity, requestedQuantity);
  }

  return percentage(completedOrders, records.length);
}

function calculateInventorySummary(
  inventory: UnknownRecord[],
  products: UnknownRecord[],
): InventorySummary {
  const now = new Date();
  const productMinimumBySku = new Map<string, number>();
  const productCostBySku = new Map<string, number>();

  products.forEach((product) => {
    const sku = getString(product, [
      'sku',
      'skuCode',
      'productCode',
      'materialCode',
      'code',
    ]);

    if (!sku) {
      return;
    }

    const minimum = getNumber(product, [
      'minimumStock',
      'minStock',
      'minimumQty',
      'reorderLevel',
      'safetyStock',
    ]);

    const unitCost = getNumber(product, [
      'unitCost',
      'cost',
      'standardCost',
      'averageCost',
      'purchasePrice',
      'price',
    ]);

    productMinimumBySku.set(sku, minimum);
    productCostBySku.set(sku, unitCost);
  });

  const skuBalances = new Map<string, number>();
  let totalQuantity = 0;
  let availableQuantity = 0;
  let allocatedQuantity = 0;
  let inventoryValue = 0;
  let nearExpiryValue = 0;
  let expiredValue = 0;
  let nearExpiryCount = 0;
  let expiredCount = 0;
  let missingCostCount = 0;

  inventory.forEach((record) => {
    const sku = getString(record, [
      'sku',
      'skuCode',
      'productCode',
      'materialCode',
      'code',
    ]);

    const quantity = Math.max(
      getNumber(record, [
        'batchQty',
        'quantity',
        'qty',
        'onHandQty',
        'stockQty',
        'balanceQty',
      ]),
      0,
    );

    const available = Math.max(
      getNumber(
        record,
        ['availableQty', 'availableQuantity', 'freeQty'],
        quantity,
      ),
      0,
    );

    const allocated = Math.max(
      getNumber(record, [
        'allocatedQty',
        'reservedQty',
        'committedQty',
      ]),
      0,
    );

    const directCost = getNumber(record, [
      'unitCost',
      'cost',
      'standardCost',
      'averageCost',
      'price',
    ]);

    const productCost = productCostBySku.get(sku) ?? 0;
    const unitCost = directCost > 0 ? directCost : productCost;
    const lineValue = quantity * unitCost;
    const expiryDate = getExpiryDate(record);

    totalQuantity += quantity;
    availableQuantity += Math.min(available, quantity);
    allocatedQuantity += allocated;
    inventoryValue += lineValue;

    if (sku) {
      skuBalances.set(sku, (skuBalances.get(sku) ?? 0) + available);
    }

    if (unitCost <= 0 && quantity > 0) {
      missingCostCount += 1;
    }

    if (expiryDate) {
      const daysToExpiry = daysBetween(now, expiryDate);

      if (daysToExpiry < 0) {
        expiredCount += 1;
        expiredValue += lineValue;
      } else if (daysToExpiry <= 30) {
        nearExpiryCount += 1;
        nearExpiryValue += lineValue;
      }
    }
  });

  let lowStockCount = 0;
  let outOfStockCount = 0;
  let healthyCount = 0;

  const allSkuCodes = new Set<string>([
    ...productMinimumBySku.keys(),
    ...skuBalances.keys(),
  ]);

  allSkuCodes.forEach((sku) => {
    const balance = skuBalances.get(sku) ?? 0;
    const minimum = productMinimumBySku.get(sku) ?? 0;

    if (balance <= 0) {
      outOfStockCount += 1;
      return;
    }

    if (minimum > 0 && balance <= minimum) {
      lowStockCount += 1;
      return;
    }

    healthyCount += 1;
  });

  const totalSkuCount = allSkuCodes.size;
  const availabilityRate =
    totalQuantity > 0
      ? percentage(availableQuantity, totalQuantity)
      : 0;

  const healthySkuRate =
    totalSkuCount > 0
      ? percentage(healthyCount, totalSkuCount)
      : 0;

  const expiryPenalty =
    totalSkuCount > 0
      ? percentage(
          nearExpiryCount + expiredCount * 2,
          Math.max(totalSkuCount, 1),
        ) * 0.25
      : 0;

  const healthScore = clamp(
    availabilityRate * 0.45 +
      healthySkuRate * 0.55 -
      expiryPenalty,
  );

  return {
    totalQuantity,
    availableQuantity,
    allocatedQuantity,
    inventoryValue,
    nearExpiryValue,
    expiredValue,
    lowStockCount,
    outOfStockCount,
    nearExpiryCount,
    expiredCount,
    healthyCount,
    totalSkuCount,
    availabilityRate,
    healthScore,
    missingCostCount,
  };
}

function buildActivitiesForModule(
  records: UnknownRecord[],
  module: string,
  route: string,
  prefix: string,
  description: string,
): RecentActivity[] {
  return records.map((record, index) => {
    const date = getRecordDate(record);
    const status = getDocumentStatus(record);
    const reference = getReference(record, prefix, index);

    return {
      key: `${module}-${reference}-${index}`,
      date: formatDate(date),
      timestamp: date?.getTime() ?? 0,
      module,
      reference,
      description,
      status,
      route,
    };
  });
}

function calculateWeeklyTrend(
  allActivities: RecentActivity[],
): TrendPoint[] {
  const now = new Date();
  const trend: TrendPoint[] = [];

  for (let weekIndex = 5; weekIndex >= 0; weekIndex -= 1) {
    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);
    weekEnd.setDate(now.getDate() - weekIndex * 7);

    const weekStart = new Date(weekEnd);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekEnd.getDate() - 6);

    const count = allActivities.filter(
      (activity) =>
        activity.timestamp >= weekStart.getTime() &&
        activity.timestamp <= weekEnd.getTime(),
    ).length;

    trend.push({
      label: new Intl.DateTimeFormat('en-MY', {
        day: '2-digit',
        month: 'short',
      }).format(weekStart),
      value: count,
    });
  }

  return trend;
}

function buildRisks(
  records: DashboardRecords,
  inventorySummary: InventorySummary,
): DashboardRisk[] {
  const risks: DashboardRisk[] = [];
  const now = new Date();

  if (inventorySummary.expiredCount > 0) {
    risks.push({
      key: 'expired-inventory',
      severity: 'Critical',
      module: 'Inventory',
      title: `${inventorySummary.expiredCount} expired inventory batches detected`,
      description:
        'Expired inventory may still be included in warehouse balances and requires immediate review.',
      impact:
        inventorySummary.expiredValue > 0
          ? formatCurrency(inventorySummary.expiredValue)
          : `${inventorySummary.expiredCount} batches`,
      reference: 'Inventory expiry control',
      ageDays: 0,
      recommendation:
        'Block expired batches, review disposition, and create an approved write-off or quality action.',
      owner: 'Inventory Controller / Quality',
      route: MODULE_ROUTES.inventory,
    });
  }

  if (inventorySummary.outOfStockCount > 0) {
    risks.push({
      key: 'out-of-stock',
      severity: 'Critical',
      module: 'Inventory',
      title: `${inventorySummary.outOfStockCount} SKUs are out of stock`,
      description:
        'Current inventory availability may be insufficient to support customer demand.',
      impact: `${inventorySummary.outOfStockCount} SKUs`,
      reference: 'Stock availability',
      ageDays: 0,
      recommendation:
        'Review open sales orders and accelerate replenishment through purchase or inventory transfer.',
      owner: 'Warehouse Manager / Procurement',
      route: MODULE_ROUTES.inventory,
    });
  }

  if (inventorySummary.lowStockCount > 0) {
    risks.push({
      key: 'low-stock',
      severity: 'High',
      module: 'Inventory',
      title: `${inventorySummary.lowStockCount} SKUs are at or below minimum stock`,
      description:
        'Reorder-level exceptions may create future order fulfilment delays.',
      impact: `${inventorySummary.lowStockCount} SKUs`,
      reference: 'Minimum stock control',
      ageDays: 0,
      recommendation:
        'Review replenishment requirements and prioritise purchase orders for high-demand SKUs.',
      owner: 'Procurement / Inventory Controller',
      route: MODULE_ROUTES.purchaseOrders,
    });
  }

  if (inventorySummary.nearExpiryCount > 0) {
    risks.push({
      key: 'near-expiry',
      severity: 'High',
      module: 'Inventory',
      title: `${inventorySummary.nearExpiryCount} batches expire within 30 days`,
      description:
        'Near-expiry inventory requires FEFO allocation or commercial action.',
      impact:
        inventorySummary.nearExpiryValue > 0
          ? formatCurrency(inventorySummary.nearExpiryValue)
          : `${inventorySummary.nearExpiryCount} batches`,
      reference: 'Expiry exposure',
      ageDays: 0,
      recommendation:
        'Apply FEFO allocation, prioritise shipment, or arrange approved stock disposition.',
      owner: 'Warehouse Manager / Sales',
      route: MODULE_ROUTES.inventory,
    });
  }

  const addDocumentRisks = (
    moduleRecords: UnknownRecord[],
    module: string,
    route: string,
    prefix: string,
    owner: string,
  ) => {
    moduleRecords.forEach((record, index) => {
      const status = getDocumentStatus(record);
      const date = getRecordDate(record);
      const ageDays = date
        ? Math.max(daysBetween(date, now), 0)
        : 0;

      if (isCriticalStatus(status)) {
        risks.push({
          key: `${module}-critical-${index}`,
          severity: 'Critical',
          module,
          title: `${getReference(record, prefix, index)} has a ${status} status`,
          description:
            'A failed, rejected, blocked, or overdue transaction requires management review.',
          impact: 'Transaction exception',
          reference: getReference(record, prefix, index),
          ageDays,
          recommendation:
            'Review the exception reason, assign an owner, and resolve or formally close the transaction.',
          owner,
          route,
        });

        return;
      }

      if (isPendingStatus(status) && ageDays >= 7) {
        risks.push({
          key: `${module}-aged-${index}`,
          severity: ageDays >= 14 ? 'High' : 'Medium',
          module,
          title: `${getReference(record, prefix, index)} has been pending for ${ageDays} days`,
          description:
            'The transaction has exceeded the recommended operational processing time.',
          impact: `${ageDays} days pending`,
          reference: getReference(record, prefix, index),
          ageDays,
          recommendation:
            'Confirm the responsible owner and complete, approve, receive, or cancel the transaction.',
          owner,
          route,
        });
      }
    });
  };

  addDocumentRisks(
    records.salesOrders,
    'Sales Orders',
    MODULE_ROUTES.salesOrders,
    'SO',
    'Sales / Outbound',
  );

  addDocumentRisks(
    records.outbound,
    'Outbound',
    MODULE_ROUTES.outbound,
    'DO',
    'Outbound Supervisor',
  );

  addDocumentRisks(
    records.purchaseOrders,
    'Purchase Orders',
    MODULE_ROUTES.purchaseOrders,
    'PO',
    'Procurement Manager',
  );

  addDocumentRisks(
    records.transfers,
    'Inventory Transfer',
    MODULE_ROUTES.transfers,
    'TRF',
    'Warehouse Manager',
  );

  addDocumentRisks(
    records.inbound,
    'Inbound',
    MODULE_ROUTES.inbound,
    'GRN',
    'Inbound Supervisor',
  );

  if (inventorySummary.missingCostCount > 0) {
    risks.push({
      key: 'missing-cost',
      severity: 'Medium',
      module: 'Product Master',
      title: `${inventorySummary.missingCostCount} inventory records have no unit cost`,
      description:
        'Inventory valuation and financial exposure may be understated.',
      impact: 'Reduced financial confidence',
      reference: 'Data quality',
      ageDays: 0,
      recommendation:
        'Complete standard or average cost information in Product / SKU Master.',
      owner: 'Finance / Product Master Administrator',
      route: MODULE_ROUTES.products,
    });
  }

  const severityOrder: Record<RiskSeverity, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };

  return risks.sort((first, second) => {
    const severityDifference =
      severityOrder[second.severity] -
      severityOrder[first.severity];

    if (severityDifference !== 0) {
      return severityDifference;
    }

    return second.ageDays - first.ageDays;
  });
}

function buildAnalytics(
  sourceRecords: DashboardRecords,
  filters: DashboardFilters,
): ExecutiveAnalytics {
  const records: DashboardRecords = {
    products: sourceRecords.products.filter((record) =>
      recordMatchesOrganisation(
        record,
        filters.plant,
        filters.location,
      ),
    ),
    inventory: sourceRecords.inventory.filter((record) =>
      recordMatchesOrganisation(
        record,
        filters.plant,
        filters.location,
      ),
    ),
    salesOrders: filterRecords(sourceRecords.salesOrders, filters),
    outbound: filterRecords(sourceRecords.outbound, filters),
    adjustments: filterRecords(sourceRecords.adjustments, filters),
    transfers: filterRecords(sourceRecords.transfers, filters),
    purchaseOrders: filterRecords(
      sourceRecords.purchaseOrders,
      filters,
    ),
    inbound: filterRecords(sourceRecords.inbound, filters),
    stockMovements: filterRecords(
      sourceRecords.stockMovements,
      filters,
    ),
    inventoryMovements: filterRecords(
      sourceRecords.inventoryMovements,
      filters,
    ),
    currentUser: sourceRecords.currentUser,
  };

  const inventorySummary = calculateInventorySummary(
    records.inventory,
    records.products,
  );

  const salesOrderCompletion = calculateCompletion(
    records.salesOrders,
  );
  const outboundCompletion = calculateCompletion(records.outbound);
  const purchaseCompletion = calculateCompletion(
    records.purchaseOrders,
  );
  const inboundCompletion = calculateCompletion(records.inbound);
  const transferCompletion = calculateCompletion(records.transfers);
  const adjustmentCompletion = calculateCompletion(
    records.adjustments,
  );
  const movementCompletion = calculateCompletion(
    records.stockMovements,
  );

  const productCompleteness = calculateProductCompleteness(
    records.products,
  );

  const orderFulfilmentRate = calculateOrderFulfilment(
    records.salesOrders,
  );

  const achievements: ModuleAchievement[] = [
    {
      key: 'products',
      module: 'Product / SKU Master',
      route: MODULE_ROUTES.products,
      score: productCompleteness,
      target: TARGETS.productCompleteness,
      completed: records.products.length,
      pending: Math.round(
        records.products.length *
          ((100 - productCompleteness) / 100),
      ),
      critical: 0,
      trend: 0,
      description: 'SKU master completeness and active product coverage',
      color: '#1677ff',
      icon: <InboxOutlined />,
    },
    {
      key: 'sales-orders',
      module: 'Sales Orders',
      route: MODULE_ROUTES.salesOrders,
      score: orderFulfilmentRate,
      target: TARGETS.orderFulfilment,
      completed: salesOrderCompletion.completed,
      pending: salesOrderCompletion.pending,
      critical: salesOrderCompletion.critical,
      trend: orderFulfilmentRate - TARGETS.orderFulfilment,
      description: 'Order readiness and quantity fulfilment performance',
      color: '#722ed1',
      icon: <FileDoneOutlined />,
    },
    {
      key: 'outbound',
      module: 'Outbound Shipments',
      route: MODULE_ROUTES.outbound,
      score: outboundCompletion.rate,
      target: TARGETS.outboundCompletion,
      completed: outboundCompletion.completed,
      pending: outboundCompletion.pending,
      critical: outboundCompletion.critical,
      trend: outboundCompletion.rate - TARGETS.outboundCompletion,
      description: 'Shipment completion and delivery execution',
      color: '#13c2c2',
      icon: <TruckOutlined />,
    },
    {
      key: 'inventory',
      module: 'Inventory Management',
      route: MODULE_ROUTES.inventory,
      score: inventorySummary.healthScore,
      target: TARGETS.inventoryHealth,
      completed: inventorySummary.healthyCount,
      pending: inventorySummary.lowStockCount,
      critical:
        inventorySummary.outOfStockCount +
        inventorySummary.expiredCount,
      trend:
        inventorySummary.healthScore - TARGETS.inventoryHealth,
      description: 'Stock availability, expiry, and inventory health',
      color: '#52c41a',
      icon: <DashboardOutlined />,
    },
    {
      key: 'adjustments',
      module: 'Inventory Adjustment',
      route: MODULE_ROUTES.adjustments,
      score: adjustmentCompletion.rate,
      target: TARGETS.adjustmentControl,
      completed: adjustmentCompletion.completed,
      pending: adjustmentCompletion.pending,
      critical: adjustmentCompletion.critical,
      trend:
        adjustmentCompletion.rate - TARGETS.adjustmentControl,
      description: 'Adjustment approval and shrinkage control',
      color: '#fa541c',
      icon: <AlertOutlined />,
    },
    {
      key: 'transfers',
      module: 'Inventory Transfer',
      route: MODULE_ROUTES.transfers,
      score: transferCompletion.rate,
      target: TARGETS.transferCompletion,
      completed: transferCompletion.completed,
      pending: transferCompletion.pending,
      critical: transferCompletion.critical,
      trend: transferCompletion.rate - TARGETS.transferCompletion,
      description: 'Transfer completion and goods receipt performance',
      color: '#fa8c16',
      icon: <SwapOutlined />,
    },
    {
      key: 'purchase-orders',
      module: 'Purchase Orders',
      route: MODULE_ROUTES.purchaseOrders,
      score: purchaseCompletion.rate,
      target: TARGETS.purchaseCompletion,
      completed: purchaseCompletion.completed,
      pending: purchaseCompletion.pending,
      critical: purchaseCompletion.critical,
      trend: purchaseCompletion.rate - TARGETS.purchaseCompletion,
      description: 'PO approval, supply, and receipt completion',
      color: '#9254de',
      icon: <ShoppingCartOutlined />,
    },
    {
      key: 'inbound',
      module: 'Inbound Receiving',
      route: MODULE_ROUTES.inbound,
      score: inboundCompletion.rate,
      target: TARGETS.inboundCompletion,
      completed: inboundCompletion.completed,
      pending: inboundCompletion.pending,
      critical: inboundCompletion.critical,
      trend: inboundCompletion.rate - TARGETS.inboundCompletion,
      description: 'Receiving completion and inbound processing',
      color: '#389e0d',
      icon: <InboxOutlined />,
    },
    {
      key: 'stock-movement',
      module: 'Stock Movement',
      route: MODULE_ROUTES.stockMovements,
      score: movementCompletion.rate,
      target: TARGETS.movementIntegrity,
      completed: movementCompletion.completed,
      pending: movementCompletion.pending,
      critical: movementCompletion.critical,
      trend: movementCompletion.rate - TARGETS.movementIntegrity,
      description: 'Movement posting and transaction integrity',
      color: '#d48806',
      icon: <BarChartOutlined />,
    },
  ];

  const executiveScore = clamp(
    inventorySummary.healthScore * 0.25 +
      orderFulfilmentRate * 0.2 +
      outboundCompletion.rate * 0.15 +
      purchaseCompletion.rate * 0.15 +
      inboundCompletion.rate * 0.1 +
      transferCompletion.rate * 0.05 +
      movementCompletion.rate * 0.05 +
      adjustmentCompletion.rate * 0.05,
  );

  const allActivities = [
    ...buildActivitiesForModule(
      records.salesOrders,
      'Sales Orders',
      MODULE_ROUTES.salesOrders,
      'SO',
      'Sales order activity',
    ),
    ...buildActivitiesForModule(
      records.outbound,
      'Outbound',
      MODULE_ROUTES.outbound,
      'DO',
      'Outbound shipment activity',
    ),
    ...buildActivitiesForModule(
      records.purchaseOrders,
      'Purchase Orders',
      MODULE_ROUTES.purchaseOrders,
      'PO',
      'Purchase order activity',
    ),
    ...buildActivitiesForModule(
      records.inbound,
      'Inbound',
      MODULE_ROUTES.inbound,
      'GRN',
      'Inbound receipt activity',
    ),
    ...buildActivitiesForModule(
      records.transfers,
      'Inventory Transfer',
      MODULE_ROUTES.transfers,
      'TRF',
      'Inventory transfer activity',
    ),
    ...buildActivitiesForModule(
      records.adjustments,
      'Inventory Adjustment',
      MODULE_ROUTES.adjustments,
      'ADJ',
      'Inventory adjustment activity',
    ),
    ...buildActivitiesForModule(
      records.stockMovements,
      'Stock Movement',
      MODULE_ROUTES.stockMovements,
      'MOV',
      'Stock movement activity',
    ),
  ].sort((first, second) => second.timestamp - first.timestamp);

  const risks = buildRisks(records, inventorySummary);

  const totalRecords =
    records.products.length +
    records.inventory.length +
    records.salesOrders.length +
    records.outbound.length +
    records.adjustments.length +
    records.transfers.length +
    records.purchaseOrders.length +
    records.inbound.length +
    records.stockMovements.length;

  const populatedModules = [
    records.products,
    records.inventory,
    records.salesOrders,
    records.outbound,
    records.adjustments,
    records.transfers,
    records.purchaseOrders,
    records.inbound,
    records.stockMovements,
  ].filter((moduleRecords) => moduleRecords.length > 0).length;

  const moduleCoverage = percentage(populatedModules, 9);

  const datedActivities = allActivities.filter(
    (activity) => activity.timestamp > 0,
  ).length;

  const dateCoverage =
    allActivities.length > 0
      ? percentage(datedActivities, allActivities.length)
      : 0;

  const valuationCoverage =
    records.inventory.length > 0
      ? percentage(
          records.inventory.length -
            inventorySummary.missingCostCount,
          records.inventory.length,
        )
      : 0;

  const confidence = clamp(
    moduleCoverage * 0.5 +
      dateCoverage * 0.25 +
      valuationCoverage * 0.25,
  );

  const pendingCount = achievements.reduce(
    (total, achievement) => total + achievement.pending,
    0,
  );

  return {
    inventory: inventorySummary,
    totalProducts: records.products.length,
    activeProducts: records.products.filter((product) => {
      const status = normaliseStatus(
        getString(product, ['status'], 'active'),
      );

      return !['inactive', 'disabled', 'deleted'].includes(status);
    }).length,
    salesOrderCount: records.salesOrders.length,
    outboundCount: records.outbound.length,
    purchaseOrderCount: records.purchaseOrders.length,
    inboundCount: records.inbound.length,
    transferCount: records.transfers.length,
    adjustmentCount: records.adjustments.length,
    movementCount: records.stockMovements.length,
    orderFulfilmentRate,
    outboundCompletionRate: outboundCompletion.rate,
    purchaseCompletionRate: purchaseCompletion.rate,
    inboundCompletionRate: inboundCompletion.rate,
    transferCompletionRate: transferCompletion.rate,
    adjustmentControlRate: adjustmentCompletion.rate,
    movementIntegrityRate: movementCompletion.rate,
    executiveScore,
    confidence,
    status: getAchievementStatus(executiveScore),
    risks,
    achievements,
    activities: allActivities.slice(0, 50),
    trend: calculateWeeklyTrend(allActivities),
    criticalCount: risks.filter(
      (risk) => risk.severity === 'Critical',
    ).length,
    highRiskCount: risks.filter(
      (risk) => risk.severity === 'High',
    ).length,
    pendingCount,
    totalRecords,
  };
}

function getStorageSnapshot(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return JSON.stringify(
    STORAGE_KEY_LIST.map((storageKey) =>
      window.localStorage.getItem(storageKey),
    ),
  );
}

function getServerStorageSnapshot(): string {
  return '';
}

function subscribeToStorageChanges(
  callback: () => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleStorage = () => callback();

  window.addEventListener('storage', handleStorage);
  window.addEventListener('wms-data-updated', handleStorage);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(
      'wms-data-updated',
      handleStorage,
    );
  };
}

function parseStorageSnapshot(snapshot: string): DashboardRecords {
  if (!snapshot) {
    return {
      products: [],
      inventory: [],
      salesOrders: [],
      outbound: [],
      adjustments: [],
      transfers: [],
      purchaseOrders: [],
      inbound: [],
      stockMovements: [],
      inventoryMovements: [],
      currentUser: null,
    };
  }

  const parsedSnapshot = safeParse(snapshot);

  if (!Array.isArray(parsedSnapshot)) {
    return {
      products: [],
      inventory: [],
      salesOrders: [],
      outbound: [],
      adjustments: [],
      transfers: [],
      purchaseOrders: [],
      inbound: [],
      stockMovements: [],
      inventoryMovements: [],
      currentUser: null,
    };
  }

  const rawValues = parsedSnapshot.map((value) =>
    typeof value === 'string' ? safeParse(value) : null,
  );

  return {
    products: extractRecordArray(rawValues[0]),
    inventory: extractRecordArray(rawValues[1]),
    salesOrders: extractRecordArray(rawValues[2]),
    outbound: extractRecordArray(rawValues[3]),
    adjustments: extractRecordArray(rawValues[4]),
    transfers: extractRecordArray(rawValues[5]),
    purchaseOrders: extractRecordArray(rawValues[6]),
    inbound: extractRecordArray(rawValues[7]),
    stockMovements: extractRecordArray(rawValues[8]),
    inventoryMovements: extractRecordArray(rawValues[9]),
    currentUser: isUnknownRecord(rawValues[10])
      ? rawValues[10]
      : null,
  };
}

function escapeCsvValue(value: string | number): string {
  const text = String(value);

  if (
    text.includes(',') ||
    text.includes('"') ||
    text.includes('\n')
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export default function DashboardPage() {
  const router = useRouter();

  const storageSnapshot = useSyncExternalStore(
    subscribeToStorageChanges,
    getStorageSnapshot,
    getServerStorageSnapshot,
  );

  const [period, setPeriod] = useState<PeriodFilter>('30');
  const [plant, setPlant] = useState('ALL');
  const [location, setLocation] = useState('ALL');
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [manualRefreshVersion, setManualRefreshVersion] =
    useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(
    () => new Date(),
  );

  const sourceRecords = useMemo(
    () => parseStorageSnapshot(storageSnapshot),
    [storageSnapshot, manualRefreshVersion],
  );

  const assignedPlants = useMemo(() => {
    if (!sourceRecords.currentUser) {
      return [];
    }

    return getStringsFromUnknown(
      sourceRecords.currentUser.assignedPlants ??
        sourceRecords.currentUser.plants,
    );
  }, [sourceRecords.currentUser]);

  const assignedLocations = useMemo(() => {
    if (!sourceRecords.currentUser) {
      return [];
    }

    return getStringsFromUnknown(
      sourceRecords.currentUser.assignedLocations ??
        sourceRecords.currentUser.locations,
    );
  }, [sourceRecords.currentUser]);

  const plantOptions = useMemo(() => {
    const plants = new Set<string>();

    const allRecords = [
      ...sourceRecords.inventory,
      ...sourceRecords.salesOrders,
      ...sourceRecords.outbound,
      ...sourceRecords.adjustments,
      ...sourceRecords.transfers,
      ...sourceRecords.purchaseOrders,
      ...sourceRecords.inbound,
      ...sourceRecords.stockMovements,
    ];

    allRecords.forEach((record) => {
      const recordPlant = getString(record, [
        'plant',
        'plantCode',
        'warehouse',
        'warehouseCode',
        'site',
      ]);

      if (
        recordPlant &&
        (assignedPlants.length === 0 ||
          assignedPlants.includes(recordPlant))
      ) {
        plants.add(recordPlant);
      }
    });

    assignedPlants.forEach((assignedPlant) =>
      plants.add(assignedPlant),
    );

    return [
      { label: 'All authorised plants', value: 'ALL' },
      ...Array.from(plants)
        .sort()
        .map((value) => ({ label: value, value })),
    ];
  }, [sourceRecords, assignedPlants]);

  const locationOptions = useMemo(() => {
    const locations = new Set<string>();

    const allRecords = [
      ...sourceRecords.inventory,
      ...sourceRecords.salesOrders,
      ...sourceRecords.outbound,
      ...sourceRecords.adjustments,
      ...sourceRecords.transfers,
      ...sourceRecords.inbound,
      ...sourceRecords.stockMovements,
    ];

    allRecords.forEach((record) => {
      const recordPlant = getString(record, [
        'plant',
        'plantCode',
        'warehouse',
        'warehouseCode',
        'site',
      ]);

      const recordLocation = getString(record, [
        'location',
        'locationCode',
        'storageLocation',
        'binLocation',
        'fromLocation',
      ]);

      const selectedPlantMatches =
        plant === 'ALL' ||
        !recordPlant ||
        recordPlant === plant;

      const authorisedLocation =
        assignedLocations.length === 0 ||
        assignedLocations.includes(recordLocation);

      if (
        recordLocation &&
        selectedPlantMatches &&
        authorisedLocation
      ) {
        locations.add(recordLocation);
      }
    });

    assignedLocations.forEach((assignedLocation) =>
      locations.add(assignedLocation),
    );

    return [
      { label: 'All authorised locations', value: 'ALL' },
      ...Array.from(locations)
        .sort()
        .map((value) => ({ label: value, value })),
    ];
  }, [
    sourceRecords,
    plant,
    assignedLocations,
  ]);

  const filters = useMemo<DashboardFilters>(
    () => ({
      period,
      plant,
      location,
    }),
    [period, plant, location],
  );

  const analytics = useMemo(
    () => buildAnalytics(sourceRecords, filters),
    [sourceRecords, filters],
  );

  const maximumTrendValue = Math.max(
    ...analytics.trend.map((trend) => trend.value),
    1,
  );

  const executiveSummary = useMemo(() => {
    const findings: string[] = [];

    findings.push(
      `Overall operational health is ${analytics.executiveScore.toFixed(
        1,
      )}/100 and is classified as ${analytics.status}.`,
    );

    if (
      analytics.orderFulfilmentRate <
      TARGETS.orderFulfilment
    ) {
      findings.push(
        `Sales order fulfilment is ${analytics.orderFulfilmentRate.toFixed(
          1,
        )}%, below the ${TARGETS.orderFulfilment}% management target.`,
      );
    } else {
      findings.push(
        `Sales order fulfilment is meeting target at ${analytics.orderFulfilmentRate.toFixed(
          1,
        )}%.`,
      );
    }

    if (analytics.inventory.expiredCount > 0) {
      findings.push(
        `${analytics.inventory.expiredCount} expired inventory batches require immediate control action.`,
      );
    }

    if (analytics.inventory.nearExpiryCount > 0) {
      findings.push(
        `${analytics.inventory.nearExpiryCount} batches are approaching expiry within 30 days.`,
      );
    }

    if (analytics.inventory.lowStockCount > 0) {
      findings.push(
        `${analytics.inventory.lowStockCount} SKUs are at or below minimum stock level.`,
      );
    }

    if (analytics.pendingCount > 0) {
      findings.push(
        `${analytics.pendingCount} transactions or controls remain pending across the operational modules.`,
      );
    }

    if (analytics.inventory.missingCostCount > 0) {
      findings.push(
        `Financial confidence is reduced because ${analytics.inventory.missingCostCount} inventory records have no unit cost.`,
      );
    }

    if (
      analytics.criticalCount === 0 &&
      analytics.highRiskCount === 0
    ) {
      findings.push(
        'No critical or high-priority management exceptions are currently detected.',
      );
    }

    return findings;
  }, [analytics]);

  const handleRefresh = useCallback(() => {
    setManualRefreshVersion((current) => current + 1);
    setLastRefreshedAt(new Date());
    window.dispatchEvent(new Event('wms-data-updated'));
  }, []);

  const handleExport = useCallback(() => {
    const rows: Array<Array<string | number>> = [
      ['Executive WMS Dashboard Report'],
      ['Generated At', new Date().toISOString()],
      ['Period', period === 'all' ? 'All time' : `${period} days`],
      ['Plant', plant],
      ['Location', location],
      [],
      ['Executive KPI', 'Actual', 'Target / Description'],
      [
        'Executive Health Score',
        analytics.executiveScore.toFixed(1),
        '90',
      ],
      [
        'Data Confidence',
        analytics.confidence.toFixed(1),
        '95',
      ],
      [
        'Inventory Value',
        analytics.inventory.inventoryValue.toFixed(2),
        'MYR',
      ],
      [
        'Order Fulfilment',
        analytics.orderFulfilmentRate.toFixed(1),
        TARGETS.orderFulfilment,
      ],
      [
        'Outbound Completion',
        analytics.outboundCompletionRate.toFixed(1),
        TARGETS.outboundCompletion,
      ],
      [
        'Inventory Health',
        analytics.inventory.healthScore.toFixed(1),
        TARGETS.inventoryHealth,
      ],
      [],
      [
        'Module',
        'Score',
        'Target',
        'Completed',
        'Pending',
        'Critical',
      ],
      ...analytics.achievements.map((achievement) => [
        achievement.module,
        achievement.score.toFixed(1),
        achievement.target,
        achievement.completed,
        achievement.pending,
        achievement.critical,
      ]),
      [],
      [
        'Severity',
        'Module',
        'Risk',
        'Impact',
        'Reference',
        'Owner',
        'Recommendation',
      ],
      ...analytics.risks.map((risk) => [
        risk.severity,
        risk.module,
        risk.title,
        risk.impact,
        risk.reference,
        risk.owner,
        risk.recommendation,
      ]),
    ];

    const csvContent = rows
      .map((row) =>
        row.map((value) => escapeCsvValue(value)).join(','),
      )
      .join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = downloadUrl;
    anchor.download = `executive-wms-dashboard-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(downloadUrl);
  }, [analytics, location, period, plant]);

  const activityColumns: ColumnsType<RecentActivity> = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 130,
    },
    {
      title: 'Module',
      dataIndex: 'module',
      key: 'module',
      width: 170,
      render: (value: string) => (
        <Tag color="blue">{value}</Tag>
      ),
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference',
      width: 170,
      render: (value: string, record) => (
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={() => router.push(record.route)}
        >
          {value}
        </Button>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (value: string) => (
        <Tag color={getStatusColor(value)}>{value}</Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: (_, record) => (
        <Tooltip title="Open module">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => router.push(record.route)}
          />
        </Tooltip>
      ),
    },
  ];

  const riskColumns: ColumnsType<DashboardRisk> = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 110,
      render: (value: RiskSeverity) => (
        <Tag color={getSeverityColor(value)}>{value}</Tag>
      ),
    },
    {
      title: 'Module',
      dataIndex: 'module',
      key: 'module',
      width: 150,
    },
    {
      title: 'Management Exception',
      dataIndex: 'title',
      key: 'title',
      render: (value: string, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.description}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Impact',
      dataIndex: 'impact',
      key: 'impact',
      width: 160,
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: 'Age',
      dataIndex: 'ageDays',
      key: 'ageDays',
      width: 90,
      render: (value: number) =>
        value > 0 ? `${value} days` : 'Current',
    },
    {
      title: 'Owner',
      dataIndex: 'owner',
      key: 'owner',
      width: 190,
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => router.push(record.route)}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <Space
      orientation="vertical"
      size={24}
      style={{ width: '100%' }}
    >
      {/* Executive header */}
      <Card
        styles={{
          body: {
            background:
              'linear-gradient(135deg, #061b3a 0%, #0d47a1 55%, #1677ff 100%)',
            borderRadius: 8,
          },
        }}
      >
        <Flex
          justify="space-between"
          align="flex-start"
          gap={20}
          wrap="wrap"
        >
          <div>
            <Space>
              <DashboardOutlined
                style={{ color: '#69b1ff', fontSize: 28 }}
              />
              <Title
                level={2}
                style={{ color: '#ffffff', margin: 0 }}
              >
                Executive WMS Command Center
              </Title>
            </Space>

            <Paragraph
              style={{
                color: 'rgba(255,255,255,0.78)',
                marginTop: 8,
                marginBottom: 4,
                maxWidth: 760,
              }}
            >
              Management overview of warehouse performance,
              inventory exposure, fulfilment, procurement, inbound,
              outbound, transfers, and operational risk.
            </Paragraph>

            <Text style={{ color: 'rgba(255,255,255,0.65)' }}>
              Last refreshed: {lastRefreshedAt.toLocaleString()}
              {' • '}
              {analytics.totalRecords.toLocaleString()} source records
              analysed
            </Text>
          </div>

          <Space wrap>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
            >
              Refresh
            </Button>

            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
            >
              Export Report
            </Button>

            <Button
              type="primary"
              ghost
              icon={<RobotOutlined />}
              onClick={() => setAiModalOpen(true)}
            >
              AI Executive Briefing
            </Button>
          </Space>
        </Flex>

        <Divider
          style={{
            borderColor: 'rgba(255,255,255,0.18)',
            marginBlock: 18,
          }}
        />

        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Text style={{ color: 'rgba(255,255,255,0.75)' }}>
              Reporting period
            </Text>
            <Select
              value={period}
              style={{ width: '100%', marginTop: 6 }}
              onChange={(value: PeriodFilter) => setPeriod(value)}
              options={[
                { label: 'Last 7 days', value: '7' },
                { label: 'Last 30 days', value: '30' },
                { label: 'Last 90 days', value: '90' },
                { label: 'Last 12 months', value: '365' },
                { label: 'All available data', value: 'all' },
              ]}
            />
          </Col>

          <Col xs={24} md={8}>
            <Text style={{ color: 'rgba(255,255,255,0.75)' }}>
              Plant
            </Text>
            <Select
              showSearch
              value={plant}
              style={{ width: '100%', marginTop: 6 }}
              options={plantOptions}
              onChange={(value: string) => {
                setPlant(value);
                setLocation('ALL');
              }}
            />
          </Col>

          <Col xs={24} md={8}>
            <Text style={{ color: 'rgba(255,255,255,0.75)' }}>
              Location
            </Text>
            <Select
              showSearch
              value={location}
              style={{ width: '100%', marginTop: 6 }}
              options={locationOptions}
              onChange={setLocation}
            />
          </Col>
        </Row>
      </Card>

      {/* Executive KPI cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card style={{ height: '100%' }}>
            <Flex justify="space-between" align="flex-start">
              <Statistic
                title="Executive Health"
                value={analytics.executiveScore}
                precision={1}
                suffix="/ 100"
                valueStyle={{
                  color: getScoreColor(
                    analytics.executiveScore,
                  ),
                }}
              />

              <Progress
                type="circle"
                size={66}
                percent={Math.round(
                  analytics.executiveScore,
                )}
                strokeColor={getScoreColor(
                  analytics.executiveScore,
                )}
              />
            </Flex>

            <Tag
              color={
                analytics.executiveScore >= 80
                  ? 'success'
                  : analytics.executiveScore >= 70
                    ? 'warning'
                    : 'error'
              }
              style={{ marginTop: 12 }}
            >
              {analytics.status}
            </Tag>
          </Card>
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <Card
            hoverable
            style={{ height: '100%' }}
            onClick={() =>
              router.push(MODULE_ROUTES.inventory)
            }
          >
            <Statistic
              title="Estimated Inventory Value"
              value={analytics.inventory.inventoryValue}
              precision={0}
              prefix={<DollarOutlined />}
              formatter={(value) =>
                formatCurrency(Number(value))
              }
              valueStyle={{ color: '#1677ff' }}
            />

            <Text type="secondary">
              {analytics.inventory.missingCostCount > 0
                ? `${analytics.inventory.missingCostCount} records missing cost`
                : 'Valuation data complete'}
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <Card
            hoverable
            style={{ height: '100%' }}
            onClick={() =>
              router.push(MODULE_ROUTES.salesOrders)
            }
          >
            <Statistic
              title="Order Fulfilment"
              value={analytics.orderFulfilmentRate}
              precision={1}
              suffix="%"
              prefix={<FileDoneOutlined />}
              valueStyle={{
                color: getScoreColor(
                  analytics.orderFulfilmentRate,
                ),
              }}
            />

            <Progress
              percent={Math.round(
                analytics.orderFulfilmentRate,
              )}
              showInfo={false}
              strokeColor={getScoreColor(
                analytics.orderFulfilmentRate,
              )}
            />

            <Text type="secondary">
              Target: {TARGETS.orderFulfilment}%
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <Card
            hoverable
            style={{ height: '100%' }}
            onClick={() =>
              router.push(MODULE_ROUTES.outbound)
            }
          >
            <Statistic
              title="Outbound Completion"
              value={analytics.outboundCompletionRate}
              precision={1}
              suffix="%"
              prefix={<TruckOutlined />}
              valueStyle={{
                color: getScoreColor(
                  analytics.outboundCompletionRate,
                ),
              }}
            />

            <Progress
              percent={Math.round(
                analytics.outboundCompletionRate,
              )}
              showInfo={false}
              strokeColor={getScoreColor(
                analytics.outboundCompletionRate,
              )}
            />

            <Text type="secondary">
              Target: {TARGETS.outboundCompletion}%
            </Text>
          </Card>
        </Col>
      </Row>

      {/* AI summary */}
      <Alert
        type={
          analytics.criticalCount > 0
            ? 'error'
            : analytics.highRiskCount > 0
              ? 'warning'
              : 'success'
        }
        showIcon
        icon={<RobotOutlined />}
        title={
          <Flex
            justify="space-between"
            align="center"
            wrap="wrap"
            gap={12}
          >
            <Text strong>AI Executive Summary</Text>

            <Button
              size="small"
              type="primary"
              icon={<BulbOutlined />}
              onClick={() => setAiModalOpen(true)}
            >
              Open Full Briefing
            </Button>
          </Flex>
        }
        description={
          executiveSummary.slice(0, 3).join(' ')
        }
      />

      {/* Inventory health and operational trend */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <Card
            title={
              <Space>
                <SafetyCertificateOutlined />
                Inventory Health and Exposure
              </Space>
            }
            extra={
              <Button
                type="link"
                onClick={() =>
                  router.push(MODULE_ROUTES.inventory)
                }
              >
                View inventory
              </Button>
            }
            style={{ height: '100%' }}
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Available Quantity"
                  value={analytics.inventory.availableQuantity}
                  formatter={(value) =>
                    formatNumber(Number(value))
                  }
                />
              </Col>

              <Col span={12}>
                <Statistic
                  title="Allocated Quantity"
                  value={analytics.inventory.allocatedQuantity}
                  formatter={(value) =>
                    formatNumber(Number(value))
                  }
                />
              </Col>

              <Col span={12}>
                <Statistic
                  title="Near-expiry Exposure"
                  value={analytics.inventory.nearExpiryValue}
                  formatter={(value) =>
                    formatCurrency(Number(value))
                  }
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Col>

              <Col span={12}>
                <Statistic
                  title="Expired Exposure"
                  value={analytics.inventory.expiredValue}
                  formatter={(value) =>
                    formatCurrency(Number(value))
                  }
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
            </Row>

            <Divider />

            <Space
              orientation="vertical"
              size={14}
              style={{ width: '100%' }}
            >
              <div>
                <Flex justify="space-between">
                  <Text>Availability rate</Text>
                  <Text strong>
                    {analytics.inventory.availabilityRate.toFixed(
                      1,
                    )}
                    %
                  </Text>
                </Flex>
                <Progress
                  percent={Math.round(
                    analytics.inventory.availabilityRate,
                  )}
                  showInfo={false}
                />
              </div>

              <div>
                <Flex justify="space-between">
                  <Text>Healthy SKUs</Text>
                  <Text strong>
                    {analytics.inventory.healthyCount}
                  </Text>
                </Flex>
                <Progress
                  percent={Math.round(
                    percentage(
                      analytics.inventory.healthyCount,
                      analytics.inventory.totalSkuCount,
                    ),
                  )}
                  showInfo={false}
                  strokeColor="#52c41a"
                />
              </div>

              <div>
                <Flex justify="space-between">
                  <Text>Low-stock SKUs</Text>
                  <Text strong>
                    {analytics.inventory.lowStockCount}
                  </Text>
                </Flex>
                <Progress
                  percent={Math.round(
                    percentage(
                      analytics.inventory.lowStockCount,
                      analytics.inventory.totalSkuCount,
                    ),
                  )}
                  showInfo={false}
                  strokeColor="#faad14"
                />
              </div>

              <div>
                <Flex justify="space-between">
                  <Text>Out-of-stock SKUs</Text>
                  <Text strong>
                    {analytics.inventory.outOfStockCount}
                  </Text>
                </Flex>
                <Progress
                  percent={Math.round(
                    percentage(
                      analytics.inventory.outOfStockCount,
                      analytics.inventory.totalSkuCount,
                    ),
                  )}
                  showInfo={false}
                  strokeColor="#ff4d4f"
                />
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card
            title={
              <Space>
                <LineChartOutlined />
                Six-week Operational Activity
              </Space>
            }
            extra={
              <Tag color="blue">
                {analytics.activities.length} recent activities
              </Tag>
            }
            style={{ height: '100%' }}
          >
            <div
              style={{
                minHeight: 270,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 16,
                paddingTop: 30,
              }}
            >
              {analytics.trend.map((trendPoint) => {
                const height = Math.max(
                  (trendPoint.value / maximumTrendValue) * 190,
                  trendPoint.value > 0 ? 12 : 2,
                );

                return (
                  <div
                    key={trendPoint.label}
                    style={{
                      flex: 1,
                      minWidth: 45,
                      textAlign: 'center',
                    }}
                  >
                    <Text strong>{trendPoint.value}</Text>

                    <Tooltip
                      title={`${trendPoint.value} recorded activities`}
                    >
                      <div
                        style={{
                          height,
                          marginTop: 8,
                          marginBottom: 10,
                          borderRadius: '8px 8px 2px 2px',
                          background:
                            'linear-gradient(180deg, #69b1ff 0%, #1677ff 100%)',
                          transition: 'height 0.3s ease',
                        }}
                      />
                    </Tooltip>

                    <Text
                      type="secondary"
                      style={{ fontSize: 12 }}
                    >
                      {trendPoint.label}
                    </Text>
                  </div>
                );
              })}
            </div>

            <Divider />

            <Row gutter={[12, 12]}>
              <Col xs={12} md={6}>
                <Statistic
                  title="Purchase Orders"
                  value={analytics.purchaseOrderCount}
                  prefix={<ShoppingCartOutlined />}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Inbound"
                  value={analytics.inboundCount}
                  prefix={<InboxOutlined />}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Transfers"
                  value={analytics.transferCount}
                  prefix={<SwapOutlined />}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Movements"
                  value={analytics.movementCount}
                  prefix={<BarChartOutlined />}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Module achievement */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            Operational Achievement by Module
          </Space>
        }
        extra={
          <Text type="secondary">
            Actual performance compared with management targets
          </Text>
        }
      >
        <Row gutter={[16, 16]}>
          {analytics.achievements.map((achievement) => (
            <Col
              xs={24}
              sm={12}
              lg={8}
              key={achievement.key}
            >
              <Card
                hoverable
                size="small"
                onClick={() =>
                  router.push(achievement.route)
                }
                style={{ height: '100%' }}
              >
                <Flex
                  justify="space-between"
                  align="flex-start"
                  gap={12}
                >
                  <Space align="start">
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        display: 'grid',
                        placeItems: 'center',
                        color: '#ffffff',
                        fontSize: 18,
                        background: achievement.color,
                      }}
                    >
                      {achievement.icon}
                    </div>

                    <div>
                      <Text strong>{achievement.module}</Text>
                      <div>
                        <Text
                          type="secondary"
                          style={{ fontSize: 12 }}
                        >
                          {achievement.description}
                        </Text>
                      </div>
                    </div>
                  </Space>

                  <Tag
                    color={
                      achievement.score >= achievement.target
                        ? 'success'
                        : achievement.score >=
                            achievement.target - 10
                          ? 'warning'
                          : 'error'
                    }
                  >
                    {achievement.score.toFixed(1)}%
                  </Tag>
                </Flex>

                <Progress
                  percent={Math.round(achievement.score)}
                  strokeColor={getScoreColor(
                    achievement.score,
                  )}
                  style={{ marginTop: 14 }}
                />

                <Flex
                  justify="space-between"
                  style={{ marginBottom: 12 }}
                >
                  <Text type="secondary">
                    Target: {achievement.target}%
                  </Text>

                  <Text
                    type={
                      achievement.trend >= 0
                        ? 'success'
                        : 'danger'
                    }
                  >
                    {achievement.trend >= 0 ? '+' : ''}
                    {achievement.trend.toFixed(1)}%
                  </Text>
                </Flex>

                <Row gutter={8}>
                  <Col span={8}>
                    <Statistic
                      title="Complete"
                      value={achievement.completed}
                      valueStyle={{
                        fontSize: 18,
                        color: '#52c41a',
                      }}
                    />
                  </Col>

                  <Col span={8}>
                    <Statistic
                      title="Pending"
                      value={achievement.pending}
                      valueStyle={{
                        fontSize: 18,
                        color: '#faad14',
                      }}
                    />
                  </Col>

                  <Col span={8}>
                    <Statistic
                      title="Critical"
                      value={achievement.critical}
                      valueStyle={{
                        fontSize: 18,
                        color: '#ff4d4f',
                      }}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Risk centre */}
      <Card
        title={
          <Space>
            <WarningOutlined style={{ color: '#ff4d4f' }} />
            Executive Risk and Exception Center
          </Space>
        }
        extra={
          <Space>
            <Tag color="red">
              {analytics.criticalCount} Critical
            </Tag>
            <Tag color="volcano">
              {analytics.highRiskCount} High
            </Tag>
          </Space>
        }
      >
        {analytics.risks.length > 0 ? (
          <Table
            rowKey="key"
            columns={riskColumns}
            dataSource={analytics.risks}
            pagination={{
              pageSize: 8,
              showSizeChanger: false,
            }}
            scroll={{ x: 1200 }}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No significant management exceptions detected"
          >
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Operations currently within control
            </Tag>
          </Empty>
        )}
      </Card>

      {/* Recent activity */}
      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            Recent High-impact Activities
          </Space>
        }
      >
        {analytics.activities.length > 0 ? (
          <Table
            rowKey="key"
            columns={activityColumns}
            dataSource={analytics.activities}
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
            }}
            scroll={{ x: 950 }}
          />
        ) : (
          <Empty description="No recent activities were found for the selected filters" />
        )}
      </Card>

      {/* AI Executive Briefing modal */}
      <Modal
        title={
          <Space>
            <RobotOutlined style={{ color: '#1677ff' }} />
            AI Executive Management Briefing
          </Space>
        }
        open={aiModalOpen}
        width={980}
        onCancel={() => setAiModalOpen(false)}
        footer={[
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            Export Report
          </Button>,
          <Button
            key="close"
            type="primary"
            onClick={() => setAiModalOpen(false)}
          >
            Close Briefing
          </Button>,
        ]}
      >
        <Alert
          type={
            analytics.executiveScore >= 80
              ? 'success'
              : analytics.executiveScore >= 70
                ? 'warning'
                : 'error'
          }
          showIcon
          title={`Operational Health: ${analytics.executiveScore.toFixed(
            1,
          )}/100 — ${analytics.status}`}
          description={`The assessment has ${analytics.confidence.toFixed(
            1,
          )}% data confidence and is based on ${analytics.totalRecords.toLocaleString()} source records.`}
        />

        <Divider titlePlacement="left">
          Executive assessment
        </Divider>

        <List
          dataSource={executiveSummary}
          renderItem={(finding, index) => (
            <List.Item>
              <Space align="start">
                {index === 0 ? (
                  <RobotOutlined
                    style={{ color: '#1677ff', marginTop: 4 }}
                  />
                ) : analytics.criticalCount > 0 &&
                  index <= 2 ? (
                  <ExclamationCircleOutlined
                    style={{ color: '#ff4d4f', marginTop: 4 }}
                  />
                ) : (
                  <CheckCircleOutlined
                    style={{ color: '#52c41a', marginTop: 4 }}
                  />
                )}

                <Text>{finding}</Text>
              </Space>
            </List.Item>
          )}
        />

        <Divider titlePlacement="left">
          Management scorecard
        </Divider>

        <Descriptions
          bordered
          size="small"
          column={{ xs: 1, sm: 2, md: 3 }}
        >
          <Descriptions.Item label="Executive score">
            <Text
              strong
              style={{
                color: getScoreColor(
                  analytics.executiveScore,
                ),
              }}
            >
              {analytics.executiveScore.toFixed(1)}/100
            </Text>
          </Descriptions.Item>

          <Descriptions.Item label="Data confidence">
            {analytics.confidence.toFixed(1)}%
          </Descriptions.Item>

          <Descriptions.Item label="Inventory health">
            {analytics.inventory.healthScore.toFixed(1)}%
          </Descriptions.Item>

          <Descriptions.Item label="Order fulfilment">
            {analytics.orderFulfilmentRate.toFixed(1)}%
          </Descriptions.Item>

          <Descriptions.Item label="Outbound completion">
            {analytics.outboundCompletionRate.toFixed(1)}%
          </Descriptions.Item>

          <Descriptions.Item label="Purchase completion">
            {analytics.purchaseCompletionRate.toFixed(1)}%
          </Descriptions.Item>

          <Descriptions.Item label="Inbound completion">
            {analytics.inboundCompletionRate.toFixed(1)}%
          </Descriptions.Item>

          <Descriptions.Item label="Transfer completion">
            {analytics.transferCompletionRate.toFixed(1)}%
          </Descriptions.Item>

          <Descriptions.Item label="Movement integrity">
            {analytics.movementIntegrityRate.toFixed(1)}%
          </Descriptions.Item>
        </Descriptions>

        <Divider titlePlacement="left">
          Prioritised recommendations
        </Divider>

        {analytics.risks.length > 0 ? (
          <List
            dataSource={analytics.risks.slice(0, 8)}
            renderItem={(risk) => (
              <List.Item
                actions={[
                  <Button
                    key="open"
                    type="link"
                    onClick={() => {
                      setAiModalOpen(false);
                      router.push(risk.route);
                    }}
                  >
                    Open module
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Tag color={getSeverityColor(risk.severity)}>
                      {risk.severity}
                    </Tag>
                  }
                  title={
                    <Space wrap>
                      <Text strong>{risk.title}</Text>
                      <Tag>{risk.module}</Tag>
                    </Space>
                  }
                  description={
                    <Space
                      orientation="vertical"
                      size={4}
                      style={{ width: '100%' }}
                    >
                      <Text>{risk.recommendation}</Text>
                      <Text type="secondary">
                        Owner: {risk.owner}
                        {' • '}
                        Impact: {risk.impact}
                        {' • '}
                        Reference: {risk.reference}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Alert
            type="success"
            showIcon
            title="No immediate corrective recommendations"
            description="The available operational data does not currently indicate a critical or high-priority management exception."
          />
        )}

        <Divider titlePlacement="left">
          Data quality notice
        </Divider>

        <Paragraph type="secondary">
          This intelligent briefing is generated from the WMS data
          currently available in browser storage. It does not invent
          missing financial or operational values. Missing costs,
          dates, statuses, quantities, plants, or locations reduce the
          confidence score and should be corrected in the source
          modules.
        </Paragraph>
      </Modal>
    </Space>
  );
}