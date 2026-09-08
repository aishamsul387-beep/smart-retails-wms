'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
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
  Upload,
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
  EyeOutlined,
  FileAddOutlined,
  FileExcelOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SendOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

/* =========================================================
   LocalStorage Keys
========================================================= */

const SALES_ORDER_KEY = 'wms_sales_orders';
const OUTBOUND_KEY = 'wms_outbound_shipments';

const CUSTOMER_KEYS = [
  'wms_customers',
  'wms_customer_master',
  'master_customers_v1',
  'customers',
];

const PRODUCT_KEYS = [
  'wms_product_master',
  'wms_products',
  'master_products_v1',
  'productMaster',
  'products',
];

const INVENTORY_KEYS = ['wms_inventory', 'wms_inventory_management'];

/* =========================================================
   Types
========================================================= */

type SalesOrderStatus =
  | 'Draft'
  | 'Approved'
  | 'Outbound Created'
  | 'Completed'
  | 'Cancelled';

type AIReadiness = 'Ready' | 'Warning' | 'Blocked';

type AIIssueSeverity = 'error' | 'warning' | 'info';

interface AIIssue {
  id: string;
  severity: AIIssueSeverity;
  category: string;
  message: string;
  lineNo?: number;
}

interface AIAnalysis {
  orderId: string;
  orderNo: string;
  readiness: AIReadiness;
  score: number;
  errors: number;
  warnings: number;
  infos: number;
  shortageQty: number;
  canCreateOutbound: boolean;
  issues: AIIssue[];
  recommendations: string[];
}

interface SalesOrderLine {
  lineId: string;
  productMasterId?: string;
  productCode?: string;
  sku: string;
  productName?: string;
  barcode?: string;
  category?: string;
  brand?: string;
  itemType?: string;
  storageType?: string;
  shelfLifeDays?: number;
  batchControlled?: boolean;
  expiryControlled?: boolean;
  batchNo: string;
  plant: string;
  location?: string;
  expiryDate?: string;
  uom?: string;
  baseUom?: string;
  salesUom?: string;
  purchaseUom?: string;
  salesToBaseFactor?: number;
  purchaseToBaseFactor?: number;
  qty: number;
  unitPrice?: number;
  availableQty?: number;
  remarks?: string;
}

interface SalesOrderRecord {
  id: string;
  orderNo: string;
  customerCode?: string;
  customerName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  orderDate: string;
  requiredShipDate?: string;
  status: SalesOrderStatus;
  remarks?: string;
  items: SalesOrderLine[];
  totalQty: number;
  totalAmount: number;
  outboundShipmentNo?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  cancelledAt?: string;
  completedAt?: string;
}

interface CustomerRecord {
  id: string;
  customerCode: string;
  customerName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  status?: string;
  raw?: any;
}

interface ProductRecord {
  id?: string;
  productCode: string;
  code?: string;
  itemCode?: string;
  sku: string;
  productName: string;
  itemName?: string;
  name?: string;
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
  batchControlled?: boolean;
  expiryControlled?: boolean;
  isBatchControlled?: boolean;
  isExpiryControlled?: boolean;
  status?: string;
  raw?: any;
}

interface InventoryRecord {
  id?: string;
  productCode?: string;
  sku?: string;
  productName?: string;
  batchNo?: string;
  plant?: string;
  location?: string;
  expiryDate?: string;
  uom?: string;
  availableQty?: number;
  status?: string;
  raw?: any;
}

interface SalesOrderFormValues {
  orderNo?: string;
  customerCode?: string;
  customerName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  orderDate?: Dayjs;
  requiredShipDate?: Dayjs;
  remarks?: string;
  items?: SalesOrderLine[];
}

/* =========================================================
   General Helpers
========================================================= */

const nowISO = () => new Date().toISOString();

const today = () => dayjs().format('YYYY-MM-DD');

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const makeOrderNo = () => `SO-${dayjs().format('YYYYMMDD-HHmmss')}`;

const makeShipmentNo = () => `SHP-${dayjs().format('YYYYMMDD-HHmmss')}`;

const normalizeCode = (value?: any) =>
  String(value ?? '')
    .trim()
    .toUpperCase();

const normalizeLower = (value?: any) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const normalizeKey = (value?: any) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/_/g, '')
    .replace(/-/g, '');

const firstNonEmpty = (...values: any[]) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

const toNumber = (value: any, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(num) ? num : fallback;
};

const toOptionalNumber = (value: any): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(num) ? num : undefined;
};

const toBoolean = (value: any, fallback = false) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const text = normalizeLower(value);

  if (
    ['true', 'yes', 'y', '1', 'active', 'controlled', 'required'].includes(text)
  ) {
    return true;
  }

  if (
    ['false', 'no', 'n', '0', 'inactive', 'not controlled', 'optional'].includes(
      text,
    )
  ) {
    return false;
  }

  return fallback;
};

const isActiveStatus = (status?: string) => {
  const value = normalizeLower(status || 'Active');
  return !['inactive', 'disabled', 'blocked', 'deleted'].includes(value);
};

const money = (value: number) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const qtyFmt = (value: number) =>
  Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });

const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  try {
    if (!value) return fallback;
    const parsed = JSON.parse(value);

    if (Array.isArray(fallback)) {
      if (Array.isArray(parsed)) return parsed as T;
      if (Array.isArray(parsed?.data)) return parsed.data as T;
      if (Array.isArray(parsed?.items)) return parsed.items as T;
      if (Array.isArray(parsed?.records)) return parsed.records as T;
      if (Array.isArray(parsed?.list)) return parsed.list as T;
      if (Array.isArray(parsed?.rows)) return parsed.rows as T;
      if (Array.isArray(parsed?.customers)) return parsed.customers as T;
      if (Array.isArray(parsed?.products)) return parsed.products as T;
      return fallback;
    }

    return parsed;
  } catch {
    return fallback;
  }
};

const readArrayFromKeys = <T,>(keys: string[]): T[] => {
  if (typeof window === 'undefined') return [];

  const rows: T[] = [];

  keys.forEach((key) => {
    const parsed = safeJsonParse<any[]>(localStorage.getItem(key), []);
    if (Array.isArray(parsed)) rows.push(...(parsed as T[]));
  });

  return rows;
};

const writeLS = (key: string, value: any) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
};

const readLS = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  return safeJsonParse<T>(localStorage.getItem(key), fallback);
};

const readAny = (obj: any, keys: string[], fallback: any = '') => {
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
};

const cleanDateValue = (value: any) => {
  if (!value) return '';
  if (dayjs.isDayjs(value)) return value.format('YYYY-MM-DD');

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : String(value);
};

const parseDateForForm = (value?: string) => {
  if (!value) return undefined;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : undefined;
};

const statusColor = (status: SalesOrderStatus) => {
  switch (status) {
    case 'Draft':
      return 'default';
    case 'Approved':
      return 'blue';
    case 'Outbound Created':
      return 'purple';
    case 'Completed':
      return 'green';
    case 'Cancelled':
      return 'red';
    default:
      return 'default';
  }
};

const normalizeStatus = (value: any): SalesOrderStatus => {
  const text = normalizeLower(value);

  if (text === 'approved') return 'Approved';
  if (text === 'outbound created' || text === 'outboundcreated') {
    return 'Outbound Created';
  }
  if (text === 'completed' || text === 'closed' || text === 'shipped') {
    return 'Completed';
  }
  if (text === 'cancelled' || text === 'canceled') return 'Cancelled';

  return 'Draft';
};

const calculateTotals = (items: SalesOrderLine[] = []) => {
  const totalQty = items.reduce((sum, item) => sum + toNumber(item.qty), 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + toNumber(item.qty) * toNumber(item.unitPrice),
    0,
  );

  return { totalQty, totalAmount };
};

const aiReadinessColor = (readiness: AIReadiness) => {
  if (readiness === 'Ready') return 'green';
  if (readiness === 'Warning') return 'orange';
  return 'red';
};

const aiScoreStatus = (score: number) => {
  if (score >= 85) return 'success';
  if (score >= 60) return 'normal';
  return 'exception';
};

/* =========================================================
   Normalizers
========================================================= */

const normalizeCustomer = (raw: any, index: number): CustomerRecord => {
  const customerCode = firstNonEmpty(
    readAny(raw, [
      'customerCode',
      'Customer Code',
      'code',
      'customerNo',
      'customerId',
      'customerID',
      'id',
      'key',
    ]),
    `CUST-${String(index + 1).padStart(3, '0')}`,
  );

  const customerName = firstNonEmpty(
    readAny(raw, [
      'customerName',
      'Customer Name',
      'name',
      'companyName',
      'Company Name',
      'customer',
      'businessName',
    ]),
    customerCode,
  );

  return {
    id: firstNonEmpty(readAny(raw, ['id', 'ID']), customerCode, makeId('customer')),
    customerCode,
    customerName,
    contactPerson: firstNonEmpty(
      readAny(raw, ['contactPerson', 'Contact Person', 'contact', 'pic', 'attention']),
    ),
    phone: firstNonEmpty(readAny(raw, ['phone', 'Phone', 'mobile', 'tel', 'contactNo'])),
    email: firstNonEmpty(readAny(raw, ['email', 'Email', 'mail'])),
    address: firstNonEmpty(
      readAny(raw, [
        'address',
        'Address',
        'billingAddress',
        'shippingAddress',
        'deliveryAddress',
        'Delivery Address',
      ]),
    ),
    status: firstNonEmpty(readAny(raw, ['status', 'Status'], 'Active')),
    raw,
  };
};

const normalizeProduct = (raw: any): ProductRecord | null => {
  const productCode = normalizeCode(
    readAny(raw, [
      'productCode',
      'Product Code',
      'product_code',
      'code',
      'Code',
      'itemCode',
      'Item Code',
      'item_code',
      'sku',
      'SKU',
      'materialCode',
      'Material Code',
    ]),
  );

  const sku = normalizeCode(
    readAny(
      raw,
      [
        'sku',
        'SKU',
        'itemCode',
        'Item Code',
        'item_code',
        'productCode',
        'Product Code',
        'product_code',
        'code',
        'Code',
      ],
      productCode,
    ),
  );

  if (!productCode && !sku) return null;

  const productName = firstNonEmpty(
    readAny(raw, [
      'productName',
      'Product Name',
      'product_name',
      'itemName',
      'Item Name',
      'item_name',
      'name',
      'Name',
      'description',
      'Description',
    ]),
    sku || productCode,
  );

  const baseUom =
    normalizeCode(readAny(raw, ['uom', 'UOM', 'baseUom', 'Base UOM', 'unit', 'Unit'], 'PCS')) ||
    'PCS';

  const purchaseUom =
    normalizeCode(readAny(raw, ['purchaseUom', 'Purchase UOM', 'purchase_uom'], baseUom)) ||
    baseUom;

  const salesUom =
    normalizeCode(readAny(raw, ['salesUom', 'Sales UOM', 'sales_uom'], baseUom)) || baseUom;

  const batchControlled = toBoolean(
    readAny(raw, [
      'batchControlled',
      'Batch Controlled',
      'isBatchControlled',
      'Is Batch Controlled',
      'is_batch_controlled',
      'Batch Control',
    ]),
    false,
  );

  const expiryControlled = toBoolean(
    readAny(raw, [
      'expiryControlled',
      'Expiry Controlled',
      'isExpiryControlled',
      'Is Expiry Controlled',
      'is_expiry_controlled',
      'Expiry Control',
    ]),
    false,
  );

  return {
    id: firstNonEmpty(readAny(raw, ['id', 'ID'])),
    productCode: productCode || sku,
    code: firstNonEmpty(readAny(raw, ['code', 'Code']), productCode || sku),
    itemCode: firstNonEmpty(readAny(raw, ['itemCode', 'Item Code']), sku),
    sku: sku || productCode,
    productName,
    itemName: firstNonEmpty(readAny(raw, ['itemName', 'Item Name']), productName),
    name: firstNonEmpty(readAny(raw, ['name', 'Name']), productName),
    barcode: firstNonEmpty(readAny(raw, ['barcode', 'Barcode', 'barCode'])),
    category: firstNonEmpty(
      readAny(raw, ['category', 'Category', 'productCategory', 'Product Category']),
    ),
    brand: firstNonEmpty(readAny(raw, ['brand', 'Brand'])),
    itemType: firstNonEmpty(readAny(raw, ['itemType', 'Item Type', 'item_type'])),
    storageType: firstNonEmpty(
      readAny(raw, [
        'storageType',
        'Storage Type',
        'storage_type',
        'storageCondition',
        'Storage Condition',
      ]),
    ),
    shelfLifeDays: toOptionalNumber(
      readAny(raw, ['shelfLifeDays', 'Shelf Life Days', 'shelf_life_days']),
    ),
    uom: baseUom,
    purchaseUom,
    salesUom,
    purchaseToBaseFactor: toNumber(
      readAny(raw, ['purchaseToBaseFactor', 'Purchase To Base Factor', 'purchase_to_base_factor']),
      1,
    ),
    salesToBaseFactor: toNumber(
      readAny(raw, ['salesToBaseFactor', 'Sales To Base Factor', 'sales_to_base_factor']),
      1,
    ),
    batchControlled,
    expiryControlled,
    isBatchControlled: batchControlled,
    isExpiryControlled: expiryControlled,
    status: firstNonEmpty(readAny(raw, ['status', 'Status'], 'Active')),
    raw,
  };
};

const normalizeInventory = (raw: any): InventoryRecord | null => {
  const productCode = normalizeCode(
    readAny(raw, ['productCode', 'Product Code', 'sku', 'SKU', 'itemCode', 'Item Code']),
  );

  const sku = normalizeCode(
    readAny(raw, ['sku', 'SKU', 'productCode', 'Product Code', 'itemCode', 'Item Code'], productCode),
  );

  if (!productCode && !sku) return null;

  const availableQty = toNumber(
    readAny(raw, [
      'availableQty',
      'Available Qty',
      'availableQuantity',
      'balanceQty',
      'Balance Qty',
      'qtyAvailable',
      'stockQty',
      'Stock Qty',
      'quantity',
      'qty',
      'currentQty',
      'stockBalance',
    ]),
    0,
  );

  return {
    id: firstNonEmpty(readAny(raw, ['id', 'ID'])),
    productCode,
    sku,
    productName: firstNonEmpty(
      readAny(raw, ['productName', 'Product Name', 'itemName', 'Item Name', 'description']),
    ),
    batchNo: firstNonEmpty(readAny(raw, ['batchNo', 'Batch No', 'batchNumber', 'Batch Number'])),
    plant: normalizeCode(readAny(raw, ['plant', 'Plant', 'plantCode', 'Plant Code'])),
    location: firstNonEmpty(
      readAny(raw, ['location', 'Location', 'locationCode', 'Location Code', 'bin', 'Bin']),
    ),
    expiryDate: cleanDateValue(readAny(raw, ['expiryDate', 'Expiry Date', 'expiry', 'Expiry'])),
    uom: normalizeCode(readAny(raw, ['uom', 'UOM', 'unit', 'Unit'], 'PCS')) || 'PCS',
    availableQty,
    status: firstNonEmpty(readAny(raw, ['status', 'Status'], 'Available')),
    raw,
  };
};

const normalizeSalesLine = (raw: any): SalesOrderLine => ({
  lineId: firstNonEmpty(readAny(raw, ['lineId', 'id', 'ID']), makeId('sol')),
  productMasterId: firstNonEmpty(readAny(raw, ['productMasterId', 'Product Master ID'])),
  productCode: normalizeCode(readAny(raw, ['productCode', 'Product Code', 'sku', 'SKU'])),
  sku: normalizeCode(readAny(raw, ['sku', 'SKU', 'productCode', 'Product Code'])),
  productName: firstNonEmpty(readAny(raw, ['productName', 'Product Name', 'description'])),
  barcode: firstNonEmpty(readAny(raw, ['barcode', 'Barcode'])),
  category: firstNonEmpty(readAny(raw, ['category', 'Category'])),
  brand: firstNonEmpty(readAny(raw, ['brand', 'Brand'])),
  itemType: firstNonEmpty(readAny(raw, ['itemType', 'Item Type'])),
  storageType: firstNonEmpty(readAny(raw, ['storageType', 'Storage Type'])),
  shelfLifeDays: toOptionalNumber(readAny(raw, ['shelfLifeDays', 'Shelf Life Days'])),
  batchControlled: toBoolean(readAny(raw, ['batchControlled', 'Batch Controlled']), false),
  expiryControlled: toBoolean(readAny(raw, ['expiryControlled', 'Expiry Controlled']), false),
  batchNo: firstNonEmpty(readAny(raw, ['batchNo', 'Batch No', 'batchNumber', 'Batch Number'])),
  plant: normalizeCode(readAny(raw, ['plant', 'Plant', 'plantCode', 'Plant Code'])),
  location: firstNonEmpty(readAny(raw, ['location', 'Location', 'locationCode', 'Location Code'])),
  expiryDate: cleanDateValue(readAny(raw, ['expiryDate', 'Expiry Date'])),
  uom: normalizeCode(readAny(raw, ['uom', 'UOM', 'unit', 'Unit'], 'PCS')) || 'PCS',
  baseUom: normalizeCode(readAny(raw, ['baseUom', 'Base UOM'])),
  salesUom: normalizeCode(readAny(raw, ['salesUom', 'Sales UOM'])),
  purchaseUom: normalizeCode(readAny(raw, ['purchaseUom', 'Purchase UOM'])),
  salesToBaseFactor: toNumber(readAny(raw, ['salesToBaseFactor', 'Sales To Base Factor']), 1),
  purchaseToBaseFactor: toNumber(readAny(raw, ['purchaseToBaseFactor', 'Purchase To Base Factor']), 1),
  qty: toNumber(readAny(raw, ['qty', 'Qty', 'quantity', 'Quantity', 'orderQty'], 0)),
  unitPrice: toNumber(readAny(raw, ['unitPrice', 'Unit Price', 'price'], 0)),
  availableQty: toNumber(readAny(raw, ['availableQty', 'Available Qty'], 0)),
  remarks: firstNonEmpty(readAny(raw, ['remarks', 'Remarks', 'lineRemarks', 'Line Remarks'])),
});

const normalizeSalesOrder = (raw: any): SalesOrderRecord => {
  const items = Array.isArray(raw?.items) ? raw.items.map(normalizeSalesLine) : [];
  const totals = calculateTotals(items);

  return {
    id: firstNonEmpty(readAny(raw, ['id', 'ID']), makeId('so')),
    orderNo: firstNonEmpty(
      readAny(raw, ['orderNo', 'Order No', 'salesOrderNo', 'Sales Order No']),
      makeOrderNo(),
    ),
    customerCode: firstNonEmpty(readAny(raw, ['customerCode', 'Customer Code'])),
    customerName: firstNonEmpty(readAny(raw, ['customerName', 'Customer Name', 'customer'], '')),
    contactPerson: firstNonEmpty(readAny(raw, ['contactPerson', 'Contact Person'])),
    phone: firstNonEmpty(readAny(raw, ['phone', 'Phone'])),
    email: firstNonEmpty(readAny(raw, ['email', 'Email'])),
    address: firstNonEmpty(readAny(raw, ['address', 'Address', 'deliveryAddress', 'Delivery Address'])),
    orderDate: cleanDateValue(readAny(raw, ['orderDate', 'Order Date'], today())),
    requiredShipDate: cleanDateValue(readAny(raw, ['requiredShipDate', 'Required Ship Date', 'shipDate'])),
    status: normalizeStatus(readAny(raw, ['status', 'Status'], 'Draft')),
    remarks: firstNonEmpty(readAny(raw, ['remarks', 'Remarks'])),
    items,
    totalQty: toNumber(raw?.totalQty, totals.totalQty),
    totalAmount: toNumber(raw?.totalAmount, totals.totalAmount),
    outboundShipmentNo: firstNonEmpty(
      readAny(raw, ['outboundShipmentNo', 'shipmentNo', 'Outbound Shipment No']),
    ),
    createdAt: firstNonEmpty(raw?.createdAt, nowISO()),
    updatedAt: firstNonEmpty(raw?.updatedAt, nowISO()),
    approvedAt: firstNonEmpty(raw?.approvedAt),
    cancelledAt: firstNonEmpty(raw?.cancelledAt),
    completedAt: firstNonEmpty(raw?.completedAt),
  };
};

/* =========================================================
   CSV Helpers
========================================================= */

const CSV_HEADERS = [
  'orderNo',
  'customerCode',
  'customerName',
  'contactPerson',
  'phone',
  'email',
  'address',
  'orderDate',
  'requiredShipDate',
  'status',
  'lineNo',
  'productCode',
  'sku',
  'productName',
  'category',
  'storageType',
  'batchControlled',
  'expiryControlled',
  'batchNo',
  'plant',
  'location',
  'expiryDate',
  'uom',
  'qty',
  'unitPrice',
  'lineRemarks',
  'remarks',
];

const escapeCSV = (value: any) => {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const downloadTextFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

const recordsToCSV = (records: SalesOrderRecord[]) => {
  const lines = [CSV_HEADERS.join(',')];

  records.forEach((order) => {
    order.items.forEach((item, index) => {
      const row = [
        order.orderNo,
        order.customerCode,
        order.customerName,
        order.contactPerson,
        order.phone,
        order.email,
        order.address,
        order.orderDate,
        order.requiredShipDate,
        order.status,
        index + 1,
        item.productCode,
        item.sku,
        item.productName,
        item.category,
        item.storageType,
        item.batchControlled ? 'Yes' : 'No',
        item.expiryControlled ? 'Yes' : 'No',
        item.batchNo,
        item.plant,
        item.location,
        item.expiryDate,
        item.uom,
        item.qty,
        item.unitPrice,
        item.remarks,
        order.remarks,
      ].map(escapeCSV);

      lines.push(row.join(','));
    });
  });

  return lines.join('\n');
};

const parseCSV = (text: string): Record<string, string>[] => {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let insideQuotes = false;

  const cleanText = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < cleanText.length; i += 1) {
    const char = cleanText[i];
    const next = cleanText[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);

      if (row.some((cell) => cell.trim() !== '')) rows.push(row);

      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);

  if (rows.length <= 1) return [];

  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = cells[index]?.trim() ?? '';
      obj[normalizeKey(header)] = cells[index]?.trim() ?? '';
    });
    return obj;
  });
};

const csvValue = (row: Record<string, string>, aliases: string[]) => {
  for (const alias of aliases) {
    const direct = row[alias];
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
      return direct;
    }

    const normalized = row[normalizeKey(alias)];
    if (normalized !== undefined && normalized !== null && String(normalized).trim() !== '') {
      return normalized;
    }
  }

  return '';
};

/* =========================================================
   Demo Data
========================================================= */

const buildDemoSalesOrders = (): SalesOrderRecord[] => [
  {
    id: 'so-demo-001',
    orderNo: 'SO-DEMO-001',
    customerCode: 'CUST-001',
    customerName: 'ABC Retail Sdn Bhd',
    contactPerson: 'Mr Tan',
    phone: '012-3456789',
    email: 'purchase@abcretail.com',
    address: 'Lot 12, Jalan Industri 1, Shah Alam',
    orderDate: today(),
    requiredShipDate: dayjs().add(3, 'day').format('YYYY-MM-DD'),
    status: 'Draft',
    remarks: 'Demo sales order',
    items: [
      {
        lineId: 'sol-demo-001',
        productCode: 'SKU-APPLE',
        sku: 'SKU-APPLE',
        productName: 'Apple Juice 1L',
        category: 'Beverage',
        storageType: 'Ambient',
        batchControlled: true,
        expiryControlled: true,
        batchNo: 'BATCH-A001',
        plant: 'PLANT-A',
        location: 'A01-01',
        expiryDate: dayjs().add(8, 'month').format('YYYY-MM-DD'),
        uom: 'CTN',
        qty: 20,
        unitPrice: 18.5,
        remarks: 'Urgent',
      },
      {
        lineId: 'sol-demo-002',
        productCode: 'SKU-ORANGE',
        sku: 'SKU-ORANGE',
        productName: 'Orange Juice 1L',
        category: 'Beverage',
        storageType: 'Ambient',
        batchControlled: true,
        expiryControlled: true,
        batchNo: 'BATCH-O001',
        plant: 'PLANT-A',
        location: 'A01-02',
        expiryDate: dayjs().add(7, 'month').format('YYYY-MM-DD'),
        uom: 'CTN',
        qty: 15,
        unitPrice: 19,
      },
    ],
    totalQty: 35,
    totalAmount: 655,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: 'so-demo-002',
    orderNo: 'SO-DEMO-002',
    customerCode: 'CUST-002',
    customerName: 'Mega Mart Trading',
    contactPerson: 'Ms Lim',
    phone: '017-8889999',
    email: 'orders@megamart.com',
    address: 'No 8, Jalan Mega, Klang',
    orderDate: today(),
    requiredShipDate: dayjs().add(5, 'day').format('YYYY-MM-DD'),
    status: 'Approved',
    remarks: 'Ready for outbound creation',
    items: [
      {
        lineId: 'sol-demo-003',
        productCode: 'SKU-MILK',
        sku: 'SKU-MILK',
        productName: 'Full Cream Milk 1L',
        category: 'Dairy',
        storageType: 'Chilled',
        batchControlled: true,
        expiryControlled: true,
        batchNo: 'BATCH-M001',
        plant: 'PLANT-B',
        location: 'B02-01',
        expiryDate: dayjs().add(4, 'month').format('YYYY-MM-DD'),
        uom: 'CTN',
        qty: 30,
        unitPrice: 22,
      },
    ],
    totalQty: 30,
    totalAmount: 660,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    approvedAt: nowISO(),
  },
];

/* =========================================================
   Page
========================================================= */

export default function SalesOrdersPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<SalesOrderFormValues>();

  const [orders, setOrders] = useState<SalesOrderRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [customerFilter, setCustomerFilter] = useState<string>('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingRecord, setEditingRecord] = useState<SalesOrderRecord | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<SalesOrderRecord | null>(null);

  const [importOpen, setImportOpen] = useState(false);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiRecord, setAiRecord] = useState<SalesOrderRecord | null>(null);

  /* =========================================================
     Load / Save
  ========================================================= */

  const syncCompletedStatusFromOutbound = (
    sourceOrders: SalesOrderRecord[],
  ): SalesOrderRecord[] => {
    const outbound = readLS<any[]>(OUTBOUND_KEY, []);
    let changed = false;

    const synced = sourceOrders.map((order) => {
      if (!order.outboundShipmentNo) return order;

      const shipment = outbound.find(
        (s) => normalizeCode(s.shipmentNo) === normalizeCode(order.outboundShipmentNo),
      );

      if (
        shipment &&
        ['SHIPPED', 'COMPLETED', 'CLOSED'].includes(normalizeCode(shipment.status)) &&
        order.status !== 'Completed'
      ) {
        changed = true;

        return {
          ...order,
          status: 'Completed' as SalesOrderStatus,
          completedAt: nowISO(),
          updatedAt: nowISO(),
        };
      }

      return order;
    });

    if (changed) writeLS(SALES_ORDER_KEY, synced);

    return synced;
  };

  const saveOrders = (nextOrders: SalesOrderRecord[]) => {
    setOrders(nextOrders);
    writeLS(SALES_ORDER_KEY, nextOrders);
  };

  const loadData = (showMessage = false) => {
    const loadedOrders = readLS<any[]>(SALES_ORDER_KEY, []);
    const normalizedOrders = loadedOrders.map(normalizeSalesOrder);

    const loadedCustomersRaw = readArrayFromKeys<any>(CUSTOMER_KEYS);
    const loadedProductsRaw = readArrayFromKeys<any>(PRODUCT_KEYS);
    const loadedInventoryRaw = readArrayFromKeys<any>(INVENTORY_KEYS);

    const normalizedCustomers = loadedCustomersRaw.map(normalizeCustomer);

    const normalizedProducts = loadedProductsRaw
      .map(normalizeProduct)
      .filter(Boolean) as ProductRecord[];

    const normalizedInventory = loadedInventoryRaw
      .map(normalizeInventory)
      .filter(Boolean) as InventoryRecord[];

    setOrders(syncCompletedStatusFromOutbound(normalizedOrders));
    setCustomers(normalizedCustomers);
    setProducts(normalizedProducts);
    setInventory(normalizedInventory);

    if (showMessage) {
      messageApi.success('Sales orders, customer master, product master and inventory refreshed.');
    }
  };

  useEffect(() => {
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================================================
     Product / Inventory Helpers
  ========================================================= */

  const getProduct = (value?: any) => {
    const target = normalizeCode(value);
    if (!target) return null;

    return (
      products.find(
        (product) =>
          normalizeCode(product.productCode) === target ||
          normalizeCode(product.sku) === target ||
          normalizeCode(product.code) === target ||
          normalizeCode(product.itemCode) === target,
      ) || null
    );
  };

  const getCustomer = (value?: any) => {
    const target = normalizeCode(value);
    if (!target) return null;

    return (
      customers.find(
        (customer) =>
          normalizeCode(customer.customerCode) === target ||
          normalizeCode(customer.customerName) === target,
      ) || null
    );
  };

  const getAvailableQty = (line: Partial<SalesOrderLine>) => {
    const sku = normalizeCode(line.sku || line.productCode);
    const batchNo = normalizeCode(line.batchNo);
    const plant = normalizeCode(line.plant);
    const location = normalizeCode(line.location);
    const expiryDate = cleanDateValue(line.expiryDate);

    if (!sku || !batchNo || !plant) return 0;

    return inventory
      .filter((inv) => {
        const invSku = normalizeCode(inv.sku || inv.productCode);
        const invProductCode = normalizeCode(inv.productCode);
        const invBatch = normalizeCode(inv.batchNo);
        const invPlant = normalizeCode(inv.plant);
        const invLocation = normalizeCode(inv.location);
        const invExpiry = cleanDateValue(inv.expiryDate);

        const skuOk = invSku === sku || invProductCode === sku;
        const batchOk = invBatch === batchNo;
        const plantOk = invPlant === plant;

        // Flexible rules:
        // - If SO location is blank, any inventory location is accepted.
        // - If inventory location is blank, it is also accepted.
        // - If SO expiry is blank, any expiry is accepted.
        // - If inventory expiry is blank, it is also accepted.
        const locationOk = !location || !invLocation || invLocation === location;
        const expiryOk = !expiryDate || !invExpiry || invExpiry === expiryDate;

        const statusOk = !['BLOCKED', 'HOLD', 'DAMAGED', 'EXPIRED'].includes(
          normalizeCode(inv.status),
        );

        return skuOk && batchOk && plantOk && locationOk && expiryOk && statusOk;
      })
      .reduce((sum, inv) => sum + toNumber(inv.availableQty), 0);
  };

  const enrichLineFromProduct = (line: SalesOrderLine): SalesOrderLine => {
    const product = getProduct(line.sku || line.productCode);

    if (!product) {
      return {
        ...line,
        availableQty: getAvailableQty(line),
      };
    }

    const batchControlled =
      !!line.batchControlled || !!product.batchControlled || !!product.isBatchControlled;

    const expiryControlled =
      !!line.expiryControlled || !!product.expiryControlled || !!product.isExpiryControlled;

    const salesUom = firstNonEmpty(product.salesUom, product.uom, line.uom, 'PCS');

    const enriched: SalesOrderLine = {
      ...line,
      productMasterId: firstNonEmpty(line.productMasterId, product.id),
      productCode: firstNonEmpty(line.productCode, product.productCode, product.sku),
      sku: firstNonEmpty(line.sku, product.sku, product.productCode),
      productName: firstNonEmpty(line.productName, product.productName),
      barcode: firstNonEmpty(line.barcode, product.barcode),
      category: firstNonEmpty(line.category, product.category),
      brand: firstNonEmpty(line.brand, product.brand),
      itemType: firstNonEmpty(line.itemType, product.itemType),
      storageType: firstNonEmpty(line.storageType, product.storageType),
      shelfLifeDays: line.shelfLifeDays ?? product.shelfLifeDays,
      baseUom: firstNonEmpty(line.baseUom, product.uom, 'PCS'),
      uom: firstNonEmpty(line.uom, salesUom, 'PCS'),
      salesUom,
      purchaseUom: firstNonEmpty(line.purchaseUom, product.purchaseUom, product.uom),
      salesToBaseFactor: line.salesToBaseFactor ?? product.salesToBaseFactor ?? 1,
      purchaseToBaseFactor: line.purchaseToBaseFactor ?? product.purchaseToBaseFactor ?? 1,
      batchControlled,
      expiryControlled,
    };

    return {
      ...enriched,
      availableQty: getAvailableQty(enriched),
    };
  };

  /* =========================================================
     AI Sales Order Assistant
  ========================================================= */

  const analyzeSalesOrder = (order: SalesOrderRecord): AIAnalysis => {
    const issues: AIIssue[] = [];
    const recommendations = new Set<string>();
    let shortageQty = 0;

    const addIssue = (
      severity: AIIssueSeverity,
      category: string,
      messageText: string,
      lineNo?: number,
    ) => {
      issues.push({
        id: makeId('ai-issue'),
        severity,
        category,
        message: messageText,
        lineNo,
      });
    };

    if (!firstNonEmpty(order.customerName)) {
      addIssue('error', 'Customer', 'Customer name is missing.');
      recommendations.add('Complete customer information before approving or creating outbound.');
    }

    if (order.customerCode) {
      const customer = getCustomer(order.customerCode);
      if (!customer) {
        addIssue(
          'warning',
          'Customer Master',
          `Customer code ${order.customerCode} was not found in Customer Master.`,
        );
        recommendations.add('Review Customer Master linkage for this order.');
      } else if (!isActiveStatus(customer.status)) {
        addIssue(
          'error',
          'Customer Master',
          `Customer ${customer.customerCode} is inactive or blocked.`,
        );
        recommendations.add('Use an active customer before fulfilment.');
      }
    }

    if (!order.items.length) {
      addIssue('error', 'Order Lines', 'Sales order has no item lines.');
      recommendations.add('Add at least one valid SKU line.');
    }

    if (order.requiredShipDate) {
      const required = dayjs(order.requiredShipDate);
      if (required.isValid() && required.isBefore(dayjs().startOf('day'))) {
        addIssue(
          'warning',
          'Ship Date',
          `Required ship date ${order.requiredShipDate} is already past.`,
        );
        recommendations.add('Review required ship date or expedite outbound preparation.');
      }
    }

    const duplicateLineMap = new Map<string, number[]>();

    order.items.forEach((item, index) => {
      const lineNo = index + 1;
      const sku = normalizeCode(item.sku || item.productCode);
      const product = getProduct(sku);
      const qty = toNumber(item.qty);
      const availableQty = getAvailableQty(item);

      const duplicateKey = [
        sku,
        normalizeCode(item.batchNo),
        normalizeCode(item.plant),
        normalizeCode(item.location),
        cleanDateValue(item.expiryDate),
      ].join('|');

      if (!duplicateLineMap.has(duplicateKey)) duplicateLineMap.set(duplicateKey, []);
      duplicateLineMap.get(duplicateKey)!.push(lineNo);

      if (!sku) {
        addIssue('error', 'SKU', 'SKU is missing.', lineNo);
        recommendations.add('Fill in SKU for all sales order lines.');
      }

      if (!product) {
        addIssue(
          'error',
          'Product Master',
          `SKU ${sku || '-'} was not found in Product / SKU Master.`,
          lineNo,
        );
        recommendations.add('Create or correct the SKU in Product Master before fulfilment.');
      } else {
        if (!isActiveStatus(product.status)) {
          addIssue(
            'error',
            'Product Status',
            `SKU ${product.sku || product.productCode} is inactive or blocked.`,
            lineNo,
          );
          recommendations.add('Do not fulfil inactive or blocked products.');
        }

        if (
          item.productName &&
          product.productName &&
          normalizeLower(item.productName) !== normalizeLower(product.productName)
        ) {
          addIssue(
            'warning',
            'Product Name',
            `Product name differs from Product Master. SO: "${item.productName}", Master: "${product.productName}".`,
            lineNo,
          );
          recommendations.add('Consider refreshing line information from Product Master.');
        }

        const allowedUoms = [
          product.uom,
          product.salesUom,
          product.purchaseUom,
          item.baseUom,
          item.salesUom,
          item.purchaseUom,
        ]
          .filter(Boolean)
          .map(normalizeCode);

        if (item.uom && allowedUoms.length && !allowedUoms.includes(normalizeCode(item.uom))) {
          addIssue(
            'warning',
            'UOM',
            `UOM ${item.uom} is not aligned with known UOM settings for SKU ${sku}.`,
            lineNo,
          );
          recommendations.add('Review UOM conversion and sales UOM settings.');
        }
      }

      const batchControlled =
        !!item.batchControlled || !!product?.batchControlled || !!product?.isBatchControlled;

      const expiryControlled =
        !!item.expiryControlled || !!product?.expiryControlled || !!product?.isExpiryControlled;

      if (batchControlled && !firstNonEmpty(item.batchNo)) {
        addIssue(
          'error',
          'Batch Control',
          `SKU ${sku} is batch controlled but Batch No is missing.`,
          lineNo,
        );
        recommendations.add('Enter Batch No for all batch-controlled products.');
      }

      if (expiryControlled && !firstNonEmpty(item.expiryDate)) {
        addIssue(
          'error',
          'Expiry Control',
          `SKU ${sku} is expiry controlled but Expiry Date is missing.`,
          lineNo,
        );
        recommendations.add('Enter Expiry Date for all expiry-controlled products.');
      }

      if (item.expiryDate) {
        const expiry = dayjs(item.expiryDate);
        if (expiry.isValid()) {
          if (expiry.isBefore(dayjs().startOf('day'))) {
            addIssue(
              'error',
              'Expiry',
              `SKU ${sku} has expired date ${item.expiryDate}.`,
              lineNo,
            );
            recommendations.add('Do not fulfil expired stock.');
          } else if (expiry.diff(dayjs(), 'day') <= 30) {
            addIssue(
              'warning',
              'Expiry',
              `SKU ${sku} will expire soon on ${item.expiryDate}.`,
              lineNo,
            );
            recommendations.add('Review FEFO policy and customer acceptance for near-expiry stock.');
          }
        } else {
          addIssue('warning', 'Expiry', `Expiry Date format is invalid: ${item.expiryDate}.`, lineNo);
        }
      }

      if (!firstNonEmpty(item.batchNo)) {
        addIssue('error', 'Batch', 'Batch No is required for inventory matching.', lineNo);
      }

      if (!firstNonEmpty(item.plant)) {
        addIssue('error', 'Plant', 'Plant is required for inventory matching.', lineNo);
      }

      if (qty <= 0) {
        addIssue('error', 'Quantity', 'Qty must be greater than 0.', lineNo);
      }

      if (qty > 0) {
        if (availableQty <= 0) {
          shortageQty += qty;
          addIssue(
            'error',
            'Inventory',
            `No available stock found for SKU ${sku}, Batch ${item.batchNo || '-'}, Plant ${
              item.plant || '-'
            }.`,
            lineNo,
          );
          recommendations.add('Check inventory, wait inbound, split order, or revise allocation criteria.');
        } else if (qty > availableQty) {
          const shortage = qty - availableQty;
          shortageQty += shortage;

          addIssue(
            'warning',
            'Inventory',
            `Order qty ${qtyFmt(qty)} exceeds available qty ${qtyFmt(
              availableQty,
            )}. Shortage: ${qtyFmt(shortage)}.`,
            lineNo,
          );
          recommendations.add('Consider partial fulfilment, split shipment, or replenish stock.');
        } else if (availableQty - qty <= Math.max(1, availableQty * 0.1)) {
          addIssue(
            'info',
            'Inventory',
            `SKU ${sku} can be fulfilled but will leave low remaining stock.`,
            lineNo,
          );
          recommendations.add('Monitor stock level after outbound creation.');
        }
      }
    });

    duplicateLineMap.forEach((lineNos, key) => {
      if (lineNos.length > 1 && key.replace(/\|/g, '') !== '') {
        addIssue(
          'warning',
          'Duplicate Lines',
          `Possible duplicate item allocation detected on lines ${lineNos.join(', ')}.`,
        );
        recommendations.add('Review duplicate SKU / Batch / Plant / Location / Expiry lines.');
      }
    });

    const errors = issues.filter((issue) => issue.severity === 'error').length;
    const warnings = issues.filter((issue) => issue.severity === 'warning').length;
    const infos = issues.filter((issue) => issue.severity === 'info').length;

    const readiness: AIReadiness = errors > 0 ? 'Blocked' : warnings > 0 ? 'Warning' : 'Ready';

    let score = 100;
    score -= errors * 18;
    score -= warnings * 7;
    score -= infos * 2;

    if (shortageQty > 0) score -= 10;

    score = Math.max(0, Math.min(100, score));

    if (readiness === 'Ready') {
      recommendations.add('Sales order is ready for approval or outbound draft creation.');
    }

    if (readiness === 'Warning') {
      recommendations.add('Sales order can continue, but review warning items before outbound.');
    }

    if (readiness === 'Blocked') {
      recommendations.add('Resolve blocking issues before outbound fulfilment.');
    }

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      readiness,
      score,
      errors,
      warnings,
      infos,
      shortageQty,
      canCreateOutbound: order.status === 'Approved' && readiness !== 'Blocked',
      issues,
      recommendations: Array.from(recommendations),
    };
  };

  const getAIAnalysis = (record: SalesOrderRecord) => analyzeSalesOrder(record);

  const openAIModal = (record: SalesOrderRecord) => {
    setAiRecord(record);
    setAiModalOpen(true);
  };

  /* =========================================================
     Derived Data
  ========================================================= */

  const productOptions = useMemo(() => {
    const map = new Map<string, { label: string; value: string; disabled?: boolean }>();

    products.forEach((product) => {
      const value = product.sku || product.productCode;
      if (!value) return;

      const active = isActiveStatus(product.status);
      const salesUom = product.salesUom || product.uom || 'PCS';

      map.set(value, {
        value,
        disabled: !active,
        label: `${value} - ${product.productName} | ${salesUom}${!active ? ' | Inactive' : ''}`,
      });
    });

    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!item.sku) return;

        if (!map.has(item.sku)) {
          map.set(item.sku, {
            value: item.sku,
            label: item.productName ? `${item.sku} - ${item.productName}` : item.sku,
          });
        }
      });
    });

    return Array.from(map.values());
  }, [products, orders]);

  const customerOptions = useMemo(
    () =>
      customers
        .filter((customer) => isActiveStatus(customer.status))
        .map((customer) => ({
          label: `${customer.customerCode} - ${customer.customerName}`,
          value: customer.customerCode,
        })),
    [customers],
  );

  const plantOptions = useMemo(() => {
    const values = new Set<string>();

    inventory.forEach((inv) => inv.plant && values.add(inv.plant));
    orders.forEach((order) => order.items.forEach((item) => item.plant && values.add(item.plant)));

    ['PLANT-A', 'PLANT-B', 'PLANT-01', 'PLANT-02'].forEach((plant) => values.add(plant));

    return Array.from(values).map((value) => ({ label: value, value }));
  }, [inventory, orders]);

  const locationOptions = useMemo(() => {
    const values = new Set<string>();

    inventory.forEach((inv) => inv.location && values.add(inv.location));
    orders.forEach((order) =>
      order.items.forEach((item) => item.location && values.add(item.location)),
    );

    return Array.from(values).map((value) => ({ label: value, value }));
  }, [inventory, orders]);

  const aiMap = useMemo(() => {
    const map = new Map<string, AIAnalysis>();
    orders.forEach((order) => map.set(order.id, analyzeSalesOrder(order)));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, products, customers, inventory]);

  const filteredOrders = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return orders.filter((order) => {
      const statusOk = statusFilter === 'All' || order.status === statusFilter;

      const customerOk =
        customerFilter === 'All' || normalizeCode(order.customerCode) === normalizeCode(customerFilter);

      const searchable = [
        order.orderNo,
        order.customerCode,
        order.customerName,
        order.contactPerson,
        order.phone,
        order.email,
        order.address,
        order.status,
        order.outboundShipmentNo,
        order.remarks,
        ...order.items.flatMap((item) => [
          item.productCode,
          item.sku,
          item.productName,
          item.category,
          item.brand,
          item.itemType,
          item.storageType,
          item.batchNo,
          item.plant,
          item.location,
          item.uom,
          item.remarks,
        ]),
      ]
        .join(' ')
        .toLowerCase();

      const searchOk = !keyword || searchable.includes(keyword);

      return statusOk && customerOk && searchOk;
    });
  }, [orders, searchText, statusFilter, customerFilter]);

  const summary = useMemo(
    () => ({
      totalOrders: orders.length,
      draft: orders.filter((o) => o.status === 'Draft').length,
      approved: orders.filter((o) => o.status === 'Approved').length,
      outboundCreated: orders.filter((o) => o.status === 'Outbound Created').length,
      completed: orders.filter((o) => o.status === 'Completed').length,
      totalQty: orders.reduce((sum, o) => sum + toNumber(o.totalQty), 0),
      totalAmount: orders.reduce((sum, o) => sum + toNumber(o.totalAmount), 0),
    }),
    [orders],
  );

  const aiSummary = useMemo(() => {
    const analyses = Array.from(aiMap.values());

    return {
      ready: analyses.filter((a) => a.readiness === 'Ready').length,
      warning: analyses.filter((a) => a.readiness === 'Warning').length,
      blocked: analyses.filter((a) => a.readiness === 'Blocked').length,
      shortageQty: analyses.reduce((sum, a) => sum + toNumber(a.shortageQty), 0),
      avgScore: analyses.length
        ? Math.round(analyses.reduce((sum, a) => sum + a.score, 0) / analyses.length)
        : 100,
    };
  }, [aiMap]);

  const uniqueCustomerFilters = useMemo(() => {
    const map = new Map<string, string>();

    orders.forEach((order) => {
      if (order.customerCode) {
        map.set(order.customerCode, `${order.customerCode} - ${order.customerName}`);
      }
    });

    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [orders]);

  /* =========================================================
     Modal Actions
  ========================================================= */

  const defaultLine = (): SalesOrderLine => ({
    lineId: makeId('sol'),
    productCode: '',
    sku: '',
    productName: '',
    barcode: '',
    category: '',
    brand: '',
    itemType: '',
    storageType: '',
    batchControlled: false,
    expiryControlled: false,
    batchNo: '',
    plant: '',
    location: '',
    expiryDate: '',
    uom: 'PCS',
    baseUom: 'PCS',
    salesUom: 'PCS',
    purchaseUom: 'PCS',
    salesToBaseFactor: 1,
    purchaseToBaseFactor: 1,
    qty: 1,
    unitPrice: 0,
    availableQty: 0,
    remarks: '',
  });

  const openCreateModal = () => {
    setModalMode('create');
    setEditingRecord(null);

    form.resetFields();
    form.setFieldsValue({
      orderNo: makeOrderNo(),
      orderDate: dayjs(),
      requiredShipDate: dayjs().add(3, 'day'),
      items: [defaultLine()],
    });

    setModalOpen(true);
  };

  const openEditModal = (record: SalesOrderRecord) => {
    if (['Completed', 'Cancelled'].includes(record.status)) {
      messageApi.warning('Completed or cancelled sales order cannot be edited.');
      return;
    }

    setModalMode('edit');
    setEditingRecord(record);

    form.resetFields();
    form.setFieldsValue({
      orderNo: record.orderNo,
      customerCode: record.customerCode,
      customerName: record.customerName,
      contactPerson: record.contactPerson,
      phone: record.phone,
      email: record.email,
      address: record.address,
      orderDate: parseDateForForm(record.orderDate),
      requiredShipDate: parseDateForForm(record.requiredShipDate),
      remarks: record.remarks,
      items: record.items?.length ? record.items.map(enrichLineFromProduct) : [defaultLine()],
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const handleCustomerChange = (customerCode: string) => {
    const customer = customers.find(
      (c) => normalizeCode(c.customerCode) === normalizeCode(customerCode),
    );

    if (!customer) return;

    form.setFieldsValue({
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      contactPerson: customer.contactPerson,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
    });
  };

  const handleProductSelect = (lineIndex: number, value: string) => {
    const product = getProduct(value);
    if (!product) return;

    if (!isActiveStatus(product.status)) {
      messageApi.warning('Selected product is inactive or blocked.');
      return;
    }

    const currentItems = form.getFieldValue('items') || [];

    const nextLine: SalesOrderLine = {
      ...currentItems[lineIndex],
      lineId: currentItems[lineIndex]?.lineId || makeId('sol'),
      productMasterId: product.id,
      productCode: product.productCode || product.sku,
      sku: product.sku || product.productCode,
      productName: product.productName,
      barcode: product.barcode || '',
      category: product.category || '',
      brand: product.brand || '',
      itemType: product.itemType || '',
      storageType: product.storageType || '',
      shelfLifeDays: product.shelfLifeDays,
      batchControlled: !!product.batchControlled || !!product.isBatchControlled,
      expiryControlled: !!product.expiryControlled || !!product.isExpiryControlled,
      baseUom: product.uom || 'PCS',
      uom: product.salesUom || product.uom || 'PCS',
      salesUom: product.salesUom || product.uom || 'PCS',
      purchaseUom: product.purchaseUom || product.uom || 'PCS',
      salesToBaseFactor: product.salesToBaseFactor || 1,
      purchaseToBaseFactor: product.purchaseToBaseFactor || 1,
      batchNo: currentItems[lineIndex]?.batchNo || '',
      plant: currentItems[lineIndex]?.plant || '',
      location: currentItems[lineIndex]?.location || '',
      expiryDate: currentItems[lineIndex]?.expiryDate || '',
      qty: currentItems[lineIndex]?.qty || 1,
      unitPrice: currentItems[lineIndex]?.unitPrice || 0,
      remarks: currentItems[lineIndex]?.remarks || '',
    };

    nextLine.availableQty = getAvailableQty(nextLine);

    currentItems[lineIndex] = nextLine;
    form.setFieldsValue({ items: currentItems });
  };

  const recalcLineAvailability = (lineIndex: number) => {
    const currentItems = form.getFieldValue('items') || [];
    const line = currentItems[lineIndex];

    if (!line) return;

    currentItems[lineIndex] = {
      ...line,
      availableQty: getAvailableQty(line),
    };

    form.setFieldsValue({ items: currentItems });
  };

  const validateOrderBeforeSave = (values: SalesOrderFormValues) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!firstNonEmpty(values.customerName)) {
      errors.push('Customer name is required.');
    }

    if (!values.items || values.items.length === 0) {
      errors.push('At least one item line is required.');
    }

    values.items?.forEach((item, index) => {
      const lineNo = index + 1;
      const product = getProduct(item.sku || item.productCode);

      if (!firstNonEmpty(item.sku, item.productCode)) {
        errors.push(`Line ${lineNo}: SKU is required.`);
      }

      if (!firstNonEmpty(item.batchNo)) {
        errors.push(`Line ${lineNo}: Batch No is required.`);
      }

      if (!firstNonEmpty(item.plant)) {
        errors.push(`Line ${lineNo}: Plant is required.`);
      }

      if (toNumber(item.qty) <= 0) {
        errors.push(`Line ${lineNo}: Qty must be greater than 0.`);
      }

      if (product && !isActiveStatus(product.status)) {
        errors.push(`Line ${lineNo}: Product ${product.sku || product.productCode} is inactive or blocked.`);
      }

      const batchControlled =
        !!item.batchControlled || !!product?.batchControlled || !!product?.isBatchControlled;

      const expiryControlled =
        !!item.expiryControlled || !!product?.expiryControlled || !!product?.isExpiryControlled;

      if (batchControlled && !firstNonEmpty(item.batchNo)) {
        errors.push(`Line ${lineNo}: Batch No is required because SKU is batch controlled.`);
      }

      if (expiryControlled && !firstNonEmpty(item.expiryDate)) {
        errors.push(`Line ${lineNo}: Expiry Date is required because SKU is expiry controlled.`);
      }

      const availableQty = getAvailableQty(item);

      if (availableQty > 0 && toNumber(item.qty) > availableQty) {
        warnings.push(
          `Line ${lineNo}: Order qty ${qtyFmt(toNumber(item.qty))} is greater than estimated available qty ${qtyFmt(
            availableQty,
          )}.`,
        );
      }
    });

    return { errors, warnings };
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const validation = validateOrderBeforeSave(values);

      if (validation.errors.length) {
        Modal.error({
          title: 'Validation Failed',
          width: 720,
          content: (
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
                {validation.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          ),
        });
        return;
      }

      if (validation.warnings.length) {
        await new Promise<void>((resolve, reject) => {
          Modal.confirm({
            title: 'Inventory Availability Warning',
            width: 720,
            content: (
              <div>
                <Text>
                  Some lines exceed current estimated inventory availability. You can still save this sales order,
                  but outbound shipment may fail allocation later.
                </Text>
                <ul style={{ paddingLeft: 20, marginTop: 12 }}>
                  {validation.warnings.map((warn) => (
                    <li key={warn}>{warn}</li>
                  ))}
                </ul>
              </div>
            ),
            okText: 'Continue Save',
            cancelText: 'Review',
            onOk: () => resolve(),
            onCancel: () => reject(new Error('SAVE_CANCELLED_BY_USER')),
          });
        });
      }

      const items: SalesOrderLine[] = (values.items || []).map((item) =>
        enrichLineFromProduct({
          ...item,
          lineId: firstNonEmpty(item.lineId, makeId('sol')),
          productCode: normalizeCode(firstNonEmpty(item.productCode, item.sku)),
          sku: normalizeCode(firstNonEmpty(item.sku, item.productCode)),
          productName: firstNonEmpty(item.productName),
          barcode: firstNonEmpty(item.barcode),
          category: firstNonEmpty(item.category),
          brand: firstNonEmpty(item.brand),
          itemType: firstNonEmpty(item.itemType),
          storageType: firstNonEmpty(item.storageType),
          batchControlled: !!item.batchControlled,
          expiryControlled: !!item.expiryControlled,
          batchNo: firstNonEmpty(item.batchNo),
          plant: normalizeCode(item.plant),
          location: firstNonEmpty(item.location),
          expiryDate: cleanDateValue(item.expiryDate),
          uom: firstNonEmpty(item.uom, item.salesUom, 'PCS'),
          baseUom: firstNonEmpty(item.baseUom),
          salesUom: firstNonEmpty(item.salesUom),
          purchaseUom: firstNonEmpty(item.purchaseUom),
          salesToBaseFactor: toNumber(item.salesToBaseFactor, 1),
          purchaseToBaseFactor: toNumber(item.purchaseToBaseFactor, 1),
          qty: toNumber(item.qty),
          unitPrice: toNumber(item.unitPrice),
          remarks: firstNonEmpty(item.remarks),
        }),
      );

      const totals = calculateTotals(items);
      const timestamp = nowISO();

      if (modalMode === 'create') {
        const newOrder: SalesOrderRecord = {
          id: makeId('so'),
          orderNo: firstNonEmpty(values.orderNo, makeOrderNo()),
          customerCode: firstNonEmpty(values.customerCode),
          customerName: firstNonEmpty(values.customerName),
          contactPerson: firstNonEmpty(values.contactPerson),
          phone: firstNonEmpty(values.phone),
          email: firstNonEmpty(values.email),
          address: firstNonEmpty(values.address),
          orderDate: cleanDateValue(values.orderDate) || today(),
          requiredShipDate: cleanDateValue(values.requiredShipDate),
          status: 'Draft',
          remarks: firstNonEmpty(values.remarks),
          items,
          totalQty: totals.totalQty,
          totalAmount: totals.totalAmount,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const duplicate = orders.some(
          (order) => normalizeCode(order.orderNo) === normalizeCode(newOrder.orderNo),
        );

        if (duplicate) {
          messageApi.error('Sales Order No already exists.');
          return;
        }

        saveOrders([newOrder, ...orders]);
        messageApi.success('Sales order created successfully.');
      } else if (editingRecord) {
        const nextOrders = orders.map((order) => {
          if (order.id !== editingRecord.id) return order;

          return {
            ...order,
            customerCode: firstNonEmpty(values.customerCode),
            customerName: firstNonEmpty(values.customerName),
            contactPerson: firstNonEmpty(values.contactPerson),
            phone: firstNonEmpty(values.phone),
            email: firstNonEmpty(values.email),
            address: firstNonEmpty(values.address),
            orderDate: cleanDateValue(values.orderDate) || today(),
            requiredShipDate: cleanDateValue(values.requiredShipDate),
            remarks: firstNonEmpty(values.remarks),
            items,
            totalQty: totals.totalQty,
            totalAmount: totals.totalAmount,
            updatedAt: timestamp,
          };
        });

        saveOrders(nextOrders);
        messageApi.success('Sales order updated successfully.');
      }

      closeModal();
    } catch (error: any) {
      if (error?.message === 'SAVE_CANCELLED_BY_USER') return;
      messageApi.error('Please check required fields.');
    }
  };

  /* =========================================================
     Record Actions
  ========================================================= */

  const openViewDrawer = (record: SalesOrderRecord) => {
    setViewRecord(record);
    setDrawerOpen(true);
  };

  const handleDelete = (record: SalesOrderRecord) => {
    if (record.status === 'Outbound Created' || record.status === 'Completed') {
      messageApi.warning('Cannot delete sales order after outbound was created or completed.');
      return;
    }

    saveOrders(orders.filter((order) => order.id !== record.id));
    messageApi.success('Sales order deleted.');
  };

  const handleApprove = (record: SalesOrderRecord) => {
    if (record.status !== 'Draft') {
      messageApi.warning('Only Draft sales order can be approved.');
      return;
    }

    const nextOrders = orders.map((order) =>
      order.id === record.id
        ? {
            ...order,
            status: 'Approved' as SalesOrderStatus,
            approvedAt: nowISO(),
            updatedAt: nowISO(),
          }
        : order,
    );

    saveOrders(nextOrders);
    messageApi.success('Sales order approved.');
  };

  const handleCancel = (record: SalesOrderRecord) => {
    if (record.status === 'Completed') {
      messageApi.warning('Completed sales order cannot be cancelled.');
      return;
    }

    if (record.status === 'Outbound Created') {
      messageApi.warning('Outbound already created. Please manage cancellation from outbound module.');
      return;
    }

    const nextOrders = orders.map((order) =>
      order.id === record.id
        ? {
            ...order,
            status: 'Cancelled' as SalesOrderStatus,
            cancelledAt: nowISO(),
            updatedAt: nowISO(),
          }
        : order,
    );

    saveOrders(nextOrders);
    messageApi.success('Sales order cancelled.');
  };

  const handleDuplicate = (record: SalesOrderRecord) => {
    const timestamp = nowISO();

    const copied: SalesOrderRecord = {
      ...record,
      id: makeId('so'),
      orderNo: makeOrderNo(),
      status: 'Draft',
      outboundShipmentNo: undefined,
      approvedAt: undefined,
      cancelledAt: undefined,
      completedAt: undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
      remarks: firstNonEmpty(record.remarks) ? `${record.remarks} (Duplicated)` : 'Duplicated',
      items: record.items.map((item) => ({
        ...item,
        lineId: makeId('sol'),
      })),
    };

    saveOrders([copied, ...orders]);
    messageApi.success('Sales order duplicated as draft.');
  };

  const handleCreateOutbound = (record: SalesOrderRecord) => {
    if (record.status !== 'Approved') {
      messageApi.warning('Only Approved sales order can create outbound draft.');
      return;
    }

    if (record.outboundShipmentNo) {
      messageApi.warning(`Outbound draft already created: ${record.outboundShipmentNo}`);
      return;
    }

    const outboundShipments = readLS<any[]>(OUTBOUND_KEY, []);
    const shipmentNo = makeShipmentNo();
    const timestamp = nowISO();

    const outboundDraft = {
      id: makeId('outbound'),
      shipmentNo,
      sourceType: 'Sales Order',
      sourceModule: 'Sales Orders',
      sourceId: record.id,
      sourceNo: record.orderNo,
      referenceType: 'Sales Order',
      referenceNo: record.orderNo,
      salesOrderId: record.id,
      salesOrderNo: record.orderNo,
      customerCode: record.customerCode,
      customerName: record.customerName,
      contactPerson: record.contactPerson,
      phone: record.phone,
      email: record.email,
      address: record.address,
      shipmentDate: record.requiredShipDate || today(),
      requiredShipDate: record.requiredShipDate || today(),
      status: 'Draft',
      remarks: firstNonEmpty(record.remarks, `Created from Sales Order ${record.orderNo}`),
      totalQty: record.totalQty,
      totalAmount: record.totalAmount,
      items: record.items.map((item, index) => {
        const availableQty = getAvailableQty(item);

        return {
          id: makeId('out-line'),
          lineId: makeId('out-line'),
          sourceLineId: item.lineId,
          salesOrderLineId: item.lineId,
          salesOrderNo: record.orderNo,
          lineNo: index + 1,
          productMasterId: item.productMasterId,
          productCode: firstNonEmpty(item.productCode, item.sku),
          sku: firstNonEmpty(item.sku, item.productCode),
          SKU: firstNonEmpty(item.sku, item.productCode),
          productName: item.productName,
          barcode: item.barcode || '',
          category: item.category || '',
          brand: item.brand || '',
          itemType: item.itemType || '',
          storageType: item.storageType || '',
          shelfLifeDays: item.shelfLifeDays,
          batchControlled: !!item.batchControlled,
          expiryControlled: !!item.expiryControlled,
          batchNo: item.batchNo,
          plant: item.plant,
          location: item.location,
          expiryDate: item.expiryDate,
          uom: item.uom || item.salesUom || 'PCS',
          UOM: item.uom || item.salesUom || 'PCS',
          baseUom: item.baseUom || item.uom || 'PCS',
          salesUom: item.salesUom || item.uom || 'PCS',
          purchaseUom: item.purchaseUom || item.uom || 'PCS',
          salesToBaseFactor: item.salesToBaseFactor || 1,
          purchaseToBaseFactor: item.purchaseToBaseFactor || 1,
          qty: toNumber(item.qty),
          requiredQty: toNumber(item.qty),
          requestedQty: toNumber(item.qty),
          shipmentQty: toNumber(item.qty),
          shippedQty: 0,
          availableQty,
          unitPrice: toNumber(item.unitPrice),
          amount: toNumber(item.qty) * toNumber(item.unitPrice),
          remarks: item.remarks,
          status: 'Draft',
        };
      }),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    writeLS(OUTBOUND_KEY, [outboundDraft, ...outboundShipments]);

    const nextOrders = orders.map((order) =>
      order.id === record.id
        ? {
            ...order,
            status: 'Outbound Created' as SalesOrderStatus,
            outboundShipmentNo: shipmentNo,
            updatedAt: timestamp,
          }
        : order,
    );

    saveOrders(nextOrders);
    messageApi.success(`Outbound draft ${shipmentNo} created successfully.`);
  };

  /* =========================================================
     Import / Export / Demo
  ========================================================= */

  const handleExportFiltered = () => {
    if (!filteredOrders.length) {
      messageApi.warning('No sales orders to export.');
      return;
    }

    downloadTextFile(
      `sales-orders-${dayjs().format('YYYYMMDD-HHmmss')}.csv`,
      recordsToCSV(filteredOrders),
    );

    messageApi.success('Sales orders exported.');
  };

  const handleDownloadTemplate = () => {
    const sample = [
      CSV_HEADERS.join(','),
      [
        'SO-SAMPLE-001',
        'CUST-001',
        'ABC Retail Sdn Bhd',
        'Mr Tan',
        '0123456789',
        'purchase@example.com',
        'Sample delivery address',
        today(),
        dayjs().add(3, 'day').format('YYYY-MM-DD'),
        'Draft',
        '1',
        'SKU-APPLE',
        'SKU-APPLE',
        'Apple Juice 1L',
        'Beverage',
        'Ambient',
        'Yes',
        'Yes',
        'BATCH-A001',
        'PLANT-A',
        'A01-01',
        dayjs().add(8, 'month').format('YYYY-MM-DD'),
        'CTN',
        '10',
        '18.50',
        'Line remark',
        'Order remark',
      ]
        .map(escapeCSV)
        .join(','),
    ].join('\n');

    downloadTextFile('sales-order-import-template.csv', sample);
    messageApi.success('Template downloaded.');
  };

  const csvRowsToOrders = (rows: Record<string, string>[]) => {
    const grouped = new Map<string, SalesOrderRecord>();
    const errors: string[] = [];
    const warnings: string[] = [];

    rows.forEach((row, index) => {
      const rowNo = index + 2;
      const rowErrors: string[] = [];

      const orderNo = firstNonEmpty(csvValue(row, ['orderNo', 'Order No']), makeOrderNo());
      const customerCode = firstNonEmpty(csvValue(row, ['customerCode', 'Customer Code']));

      let customerName = firstNonEmpty(csvValue(row, ['customerName', 'Customer Name']));

      const customer = customers.find(
        (c) => normalizeCode(c.customerCode) === normalizeCode(customerCode),
      );

      if (customer && !customerName) customerName = customer.customerName;

      const productCode = firstNonEmpty(
        csvValue(row, ['productCode', 'Product Code']),
        csvValue(row, ['sku', 'SKU']),
      );

      const sku = firstNonEmpty(csvValue(row, ['sku', 'SKU']), productCode);
      const product = getProduct(sku || productCode);
      const batchNo = firstNonEmpty(csvValue(row, ['batchNo', 'Batch No']));
      const plant = firstNonEmpty(csvValue(row, ['plant', 'Plant']));
      const qty = toNumber(csvValue(row, ['qty', 'Qty']));

      if (!customerName) rowErrors.push(`Row ${rowNo}: customerName is required.`);
      if (!sku) rowErrors.push(`Row ${rowNo}: sku is required.`);
      if (!batchNo) rowErrors.push(`Row ${rowNo}: batchNo is required.`);
      if (!plant) rowErrors.push(`Row ${rowNo}: plant is required.`);
      if (qty <= 0) rowErrors.push(`Row ${rowNo}: qty must be greater than 0.`);

      if (product && !isActiveStatus(product.status)) {
        rowErrors.push(`Row ${rowNo}: Product ${sku} is inactive or blocked.`);
      }

      if (!product) {
        warnings.push(`Row ${rowNo}: Product/SKU ${sku || productCode} not found in Product Master.`);
      }

      if (rowErrors.length) {
        errors.push(...rowErrors);
        return;
      }

      if (!grouped.has(orderNo)) {
        grouped.set(orderNo, {
          id: makeId('so'),
          orderNo,
          customerCode,
          customerName,
          contactPerson: firstNonEmpty(csvValue(row, ['contactPerson', 'Contact Person']), customer?.contactPerson),
          phone: firstNonEmpty(csvValue(row, ['phone', 'Phone']), customer?.phone),
          email: firstNonEmpty(csvValue(row, ['email', 'Email']), customer?.email),
          address: firstNonEmpty(csvValue(row, ['address', 'Address']), customer?.address),
          orderDate: cleanDateValue(firstNonEmpty(csvValue(row, ['orderDate', 'Order Date']), today())),
          requiredShipDate: cleanDateValue(csvValue(row, ['requiredShipDate', 'Required Ship Date'])),
          status: normalizeStatus(firstNonEmpty(csvValue(row, ['status', 'Status']), 'Draft')),
          remarks: firstNonEmpty(csvValue(row, ['remarks', 'Remarks'])),
          items: [],
          totalQty: 0,
          totalAmount: 0,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        });
      }

      const order = grouped.get(orderNo)!;

      const line: SalesOrderLine = enrichLineFromProduct({
        lineId: makeId('sol'),
        productCode: normalizeCode(firstNonEmpty(productCode, product?.productCode)),
        sku: normalizeCode(firstNonEmpty(sku, product?.sku, product?.productCode)),
        productName: firstNonEmpty(csvValue(row, ['productName', 'Product Name']), product?.productName),
        category: firstNonEmpty(csvValue(row, ['category', 'Category']), product?.category),
        storageType: firstNonEmpty(csvValue(row, ['storageType', 'Storage Type']), product?.storageType),
        batchControlled: toBoolean(
          csvValue(row, ['batchControlled', 'Batch Controlled']),
          !!product?.batchControlled || !!product?.isBatchControlled,
        ),
        expiryControlled: toBoolean(
          csvValue(row, ['expiryControlled', 'Expiry Controlled']),
          !!product?.expiryControlled || !!product?.isExpiryControlled,
        ),
        batchNo,
        plant: normalizeCode(plant),
        location: firstNonEmpty(csvValue(row, ['location', 'Location'])),
        expiryDate: cleanDateValue(csvValue(row, ['expiryDate', 'Expiry Date'])),
        uom: firstNonEmpty(csvValue(row, ['uom', 'UOM']), product?.salesUom, product?.uom, 'PCS'),
        qty,
        unitPrice: toNumber(csvValue(row, ['unitPrice', 'Unit Price'])),
        remarks: firstNonEmpty(csvValue(row, ['lineRemarks', 'Line Remarks'])),
      });

      order.items.push(line);
    });

    const ordersFromCsv = Array.from(grouped.values()).map((order) => {
      const totals = calculateTotals(order.items);

      return {
        ...order,
        totalQty: totals.totalQty,
        totalAmount: totals.totalAmount,
      };
    });

    return { orders: ordersFromCsv, errors, warnings };
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result || '');
      const rows = parseCSV(text);
      const result = csvRowsToOrders(rows);

      if (result.errors.length) {
        Modal.error({
          title: 'CSV Import Validation Failed',
          width: 720,
          content: (
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              <ul style={{ paddingLeft: 20 }}>
                {result.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          ),
        });
        return;
      }

      if (!result.orders.length) {
        messageApi.warning('No valid rows found in CSV file.');
        return;
      }

      const existingOrderNos = new Set(orders.map((order) => normalizeCode(order.orderNo)));

      const duplicates = result.orders.filter((order) =>
        existingOrderNos.has(normalizeCode(order.orderNo)),
      );

      if (duplicates.length) {
        Modal.error({
          title: 'Duplicate Sales Order No',
          content: (
            <div>
              <Text>These order numbers already exist. Please remove or change them:</Text>
              <ul style={{ marginTop: 8 }}>
                {duplicates.map((order) => (
                  <li key={order.orderNo}>{order.orderNo}</li>
                ))}
              </ul>
            </div>
          ),
        });
        return;
      }

      const doImport = () => {
        saveOrders([...result.orders, ...orders]);
        setImportOpen(false);
        messageApi.success(`${result.orders.length} sales order(s) imported.`);
      };

      if (result.warnings.length) {
        Modal.confirm({
          title: 'CSV Import Warnings',
          width: 720,
          content: (
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              <Text>Import can continue, but please review these warnings:</Text>
              <ul style={{ paddingLeft: 20, marginTop: 12 }}>
                {result.warnings.map((warn) => (
                  <li key={warn}>{warn}</li>
                ))}
              </ul>
            </div>
          ),
          okText: 'Continue Import',
          cancelText: 'Cancel',
          onOk: doImport,
        });
      } else {
        doImport();
      }
    };

    reader.onerror = () => {
      messageApi.error('Failed to read CSV file.');
    };

    reader.readAsText(file);
  };

  const handleLoadDemo = () => {
    const existingNos = new Set(orders.map((o) => normalizeCode(o.orderNo)));

    const demosToAdd = buildDemoSalesOrders()
      .filter((demo) => !existingNos.has(normalizeCode(demo.orderNo)))
      .map((demo) => ({
        ...demo,
        id: makeId('so'),
        items: demo.items.map((item) => ({
          ...item,
          lineId: makeId('sol'),
          availableQty: getAvailableQty(item),
        })),
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }));

    if (!demosToAdd.length) {
      messageApi.info('Demo sales orders already exist.');
      return;
    }

    saveOrders([...demosToAdd, ...orders]);
    messageApi.success('Demo sales orders loaded.');
  };

  const handleRefresh = () => {
    loadData(true);
  };

  /* =========================================================
     Table Columns
  ========================================================= */

  const columns: ColumnsType<SalesOrderRecord> = [
    {
      title: 'Sales Order',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 170,
      fixed: 'left',
      render: (value: string, record) => (
        <Space orientation="vertical" size={0}>
          <Button type="link" style={{ padding: 0 }} onClick={() => openViewDrawer(record)}>
            {value}
          </Button>
          {record.outboundShipmentNo && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Outbound: {record.outboundShipmentNo}
            </Text>
          )}
        </Space>
      ),
      sorter: (a, b) => a.orderNo.localeCompare(b.orderNo),
    },
    {
      title: 'Customer',
      key: 'customer',
      width: 260,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.customerName}</Text>
          <Text type="secondary">
            {record.customerCode || '-'} {record.phone ? ` | ${record.phone}` : ''}
          </Text>
        </Space>
      ),
      sorter: (a, b) => a.customerName.localeCompare(b.customerName),
    },
    {
      title: 'Order Date',
      dataIndex: 'orderDate',
      key: 'orderDate',
      width: 120,
    },
    {
      title: 'Required Ship',
      dataIndex: 'requiredShipDate',
      key: 'requiredShipDate',
      width: 130,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Lines',
      key: 'lines',
      width: 80,
      align: 'right',
      render: (_, record) => record.items.length,
    },
    {
      title: 'Total Qty',
      dataIndex: 'totalQty',
      key: 'totalQty',
      width: 110,
      align: 'right',
      render: (value: number) => qtyFmt(value),
    },
    {
      title: 'Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      align: 'right',
      render: (value: number) => money(value),
      sorter: (a, b) => a.totalAmount - b.totalAmount,
    },
    {
      title: 'AI',
      key: 'ai',
      width: 135,
      render: (_, record) => {
        const analysis = aiMap.get(record.id) || getAIAnalysis(record);

        return (
          <Space orientation="vertical" size={2}>
            <Tag color={aiReadinessColor(analysis.readiness)} icon={<RobotOutlined />}>
              {analysis.readiness}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Score {analysis.score}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: SalesOrderStatus) => <Tag color={statusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 380,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Tooltip title="View">
            <Button icon={<EyeOutlined />} onClick={() => openViewDrawer(record)} />
          </Tooltip>

          <Tooltip title="AI Check">
            <Button icon={<RobotOutlined />} onClick={() => openAIModal(record)} />
          </Tooltip>

          <Tooltip title="Edit">
            <Button
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
              disabled={['Completed', 'Cancelled'].includes(record.status)}
            />
          </Tooltip>

          <Tooltip title="Approve">
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApprove(record)}
              disabled={record.status !== 'Draft'}
            />
          </Tooltip>

          <Tooltip title="Create Outbound Draft">
            <Button
              icon={<SendOutlined />}
              onClick={() => handleCreateOutbound(record)}
              disabled={record.status !== 'Approved'}
            />
          </Tooltip>

          <Tooltip title="Duplicate">
            <Button icon={<CopyOutlined />} onClick={() => handleDuplicate(record)} />
          </Tooltip>

          <Popconfirm
            title="Delete sales order?"
            description="This action cannot be undone."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record)}
          >
            <Tooltip title="Delete">
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={['Outbound Created', 'Completed'].includes(record.status)}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const itemColumns: ColumnsType<SalesOrderLine> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 150,
      render: (value, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.productName || record.productCode || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Control',
      key: 'control',
      width: 120,
      render: (_, record) => (
        <Space size={4} wrap>
          {record.batchControlled && <Tag color="purple">Batch</Tag>}
          {record.expiryControlled && <Tag color="cyan">Expiry</Tag>}
          {!record.batchControlled && !record.expiryControlled && <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    {
      title: 'Batch',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 130,
    },
    {
      title: 'Plant',
      dataIndex: 'plant',
      key: 'plant',
      width: 110,
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 110,
      render: (value) => value || '-',
    },
    {
      title: 'Expiry',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      width: 120,
      render: (value) => value || '-',
    },
    {
      title: 'UOM',
      dataIndex: 'uom',
      key: 'uom',
      width: 80,
      render: (value) => value || 'PCS',
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      key: 'qty',
      width: 100,
      align: 'right',
      render: (value) => qtyFmt(value),
    },
    {
      title: 'Avail.',
      dataIndex: 'availableQty',
      key: 'availableQty',
      width: 100,
      align: 'right',
      render: (value) => qtyFmt(value || 0),
    },
    {
      title: 'Unit Price',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 110,
      align: 'right',
      render: (value) => money(value || 0),
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 120,
      align: 'right',
      render: (_, record) => money(toNumber(record.qty) * toNumber(record.unitPrice)),
    },
  ];

  const aiModalAnalysis = aiRecord ? getAIAnalysis(aiRecord) : null;

  /* =========================================================
     Render
  ========================================================= */

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}

      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              🧾 Sales Orders
            </Title>
            <Text type="secondary">
              Customer order management with Product / SKU Master, inventory reference and AI fulfilment readiness.
            </Text>
          </Col>

          <Col>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                Refresh
              </Button>

              <Button
                icon={<RobotOutlined />}
                onClick={() => {
                  if (!filteredOrders.length) {
                    messageApi.warning('No sales orders available for AI review.');
                    return;
                  }
                  messageApi.success(
                    `AI reviewed ${filteredOrders.length} sales order(s). Ready: ${aiSummary.ready}, Warning: ${aiSummary.warning}, Blocked: ${aiSummary.blocked}.`,
                  );
                }}
              >
                AI Review
              </Button>

              <Button icon={<FileExcelOutlined />} onClick={handleDownloadTemplate}>
                Template
              </Button>

              <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                Import CSV
              </Button>

              <Button icon={<DownloadOutlined />} onClick={handleExportFiltered}>
                Export
              </Button>

              <Button icon={<InboxOutlined />} onClick={handleLoadDemo}>
                Load Demo
              </Button>

              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                New Sales Order
              </Button>
            </Space>
          </Col>
        </Row>

        <Alert
          type="info"
          showIcon
          title="Sales Order module is connected to Customer Master, Product / SKU Master, Inventory reference and AI Sales Order Assistant."
          description="Creating outbound draft does not deduct inventory. Inventory deduction is handled by the Outbound Shipment module when shipment is posted/shipped."
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Card>
              <Statistic title="Total Orders" value={summary.totalOrders} />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6} lg={4}>
            <Card>
              <Statistic title="Draft" value={summary.draft} />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6} lg={4}>
            <Card>
              <Statistic title="Approved" value={summary.approved} />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6} lg={4}>
            <Card>
              <Statistic title="Outbound Created" value={summary.outboundCreated} />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6} lg={4}>
            <Card>
              <Statistic title="Completed" value={summary.completed} />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6} lg={4}>
            <Card>
              <Statistic title="Total Qty" value={summary.totalQty} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="AI Ready"
                value={aiSummary.ready}
                prefix={<SafetyCertificateOutlined style={{ color: '#52c41a' }} />}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="AI Warning"
                value={aiSummary.warning}
                prefix={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="AI Blocked"
                value={aiSummary.blocked}
                prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="AI Shortage Qty"
                value={aiSummary.shortageQty}
                prefix={<ThunderboltOutlined />}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Avg AI Score: {aiSummary.avgScore}
              </Text>
            </Card>
          </Col>
        </Row>

        <Card>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={10}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Search order no, customer, SKU, batch, plant..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Col>

            <Col xs={24} md={6}>
              <Select
                style={{ width: '100%' }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'All', label: 'All Status' },
                  { value: 'Draft', label: 'Draft' },
                  { value: 'Approved', label: 'Approved' },
                  { value: 'Outbound Created', label: 'Outbound Created' },
                  { value: 'Completed', label: 'Completed' },
                  { value: 'Cancelled', label: 'Cancelled' },
                ]}
              />
            </Col>

            <Col xs={24} md={8}>
              <Select
                showSearch
                allowClear
                style={{ width: '100%' }}
                value={customerFilter === 'All' ? undefined : customerFilter}
                placeholder="Filter customer"
                onChange={(value) => setCustomerFilter(value || 'All')}
                options={uniqueCustomerFilters}
                filterOption={(input, option) =>
                  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Col>
          </Row>
        </Card>

        <Card>
          <Table<SalesOrderRecord>
            rowKey="id"
            columns={columns}
            dataSource={filteredOrders}
            scroll={{ x: 1720 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `${total} sales order(s)`,
            }}
            expandable={{
              expandedRowRender: (record) => (
                <Table<SalesOrderLine>
                  rowKey="lineId"
                  size="small"
                  columns={itemColumns}
                  dataSource={record.items}
                  pagination={false}
                  scroll={{ x: 1200 }}
                />
              ),
            }}
            locale={{
              emptyText: (
                <Empty description="No sales orders found">
                  <Button type="primary" onClick={openCreateModal}>
                    Create Sales Order
                  </Button>
                </Empty>
              ),
            }}
          />
        </Card>
      </Space>

      <Modal
        open={modalOpen}
        title={modalMode === 'create' ? 'Create Sales Order' : `Edit Sales Order - ${editingRecord?.orderNo}`}
        width={1180}
        onCancel={closeModal}
        onOk={handleSave}
        okText={modalMode === 'create' ? 'Create' : 'Save'}
        mask={{ closable: false }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Divider titlePlacement="left">Order Information</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Sales Order No"
                name="orderNo"
                rules={[{ required: true, message: 'Sales Order No is required' }]}
              >
                <Input disabled={modalMode === 'edit'} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Order Date"
                name="orderDate"
                rules={[{ required: true, message: 'Order date is required' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Required Ship Date" name="requiredShipDate">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left">Customer Information</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Customer From Master" name="customerCode">
                <Select
                  showSearch
                  allowClear
                  placeholder="Select customer"
                  options={customerOptions}
                  onChange={handleCustomerChange}
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Customer Name"
                name="customerName"
                rules={[{ required: true, message: 'Customer name is required' }]}
              >
                <Input placeholder="Customer name" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Contact Person" name="contactPerson">
                <Input placeholder="Contact person" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Phone" name="phone">
                <Input placeholder="Phone" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Email" name="email">
                <Input placeholder="Email" />
              </Form.Item>
            </Col>

            <Col xs={24} md={24}>
              <Form.Item label="Delivery Address" name="address">
                <TextArea rows={2} placeholder="Delivery address" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left">Order Lines</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                {fields.map((field, index) => {
                  const line = form.getFieldValue(['items', field.name]) || {};
                  const availableQty = toNumber(line.availableQty);
                  const lineQty = toNumber(line.qty);
                  const lineAmount = lineQty * toNumber(line.unitPrice);

                  return (
                    <Card
                      key={field.key}
                      size="small"
                      title={
                        <Space wrap>
                          <Text strong>Line {index + 1}</Text>
                          {line.batchControlled && <Tag color="purple">Batch Controlled</Tag>}
                          {line.expiryControlled && <Tag color="cyan">Expiry Controlled</Tag>}
                          {availableQty > 0 && lineQty > availableQty && (
                            <Tag color="red">Over Available</Tag>
                          )}
                        </Space>
                      }
                      extra={
                        <Button
                          danger
                          size="small"
                          onClick={() => remove(field.name)}
                          disabled={fields.length <= 1}
                        >
                          Remove
                        </Button>
                      }
                    >
                      <Form.Item name={[field.name, 'lineId']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, 'productMasterId']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, 'barcode']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, 'category']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, 'brand']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, 'itemType']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, 'storageType']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, 'shelfLifeDays']} hidden>
                        <InputNumber />
                      </Form.Item>
                      <Form.Item name={[field.name, 'baseUom']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, 'salesUom']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, 'purchaseUom']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, 'salesToBaseFactor']} hidden>
                        <InputNumber />
                      </Form.Item>
                      <Form.Item name={[field.name, 'purchaseToBaseFactor']} hidden>
                        <InputNumber />
                      </Form.Item>
                      <Form.Item name={[field.name, 'batchControlled']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[field.name, 'expiryControlled']} hidden>
                        <Input />
                      </Form.Item>

                      <Row gutter={12}>
                        <Col xs={24} md={6}>
                          <Form.Item
                            label="SKU"
                            name={[field.name, 'sku']}
                            rules={[{ required: true, message: 'SKU required' }]}
                          >
                            <Select
                              showSearch
                              allowClear
                              placeholder="Select SKU"
                              options={productOptions}
                              onChange={(value) => handleProductSelect(field.name, value)}
                              onBlur={() => recalcLineAvailability(field.name)}
                              filterOption={(input, option) =>
                                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                              }
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={6}>
                          <Form.Item label="Product Code" name={[field.name, 'productCode']}>
                            <Input placeholder="Product code" />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={6}>
                          <Form.Item label="Product Name" name={[field.name, 'productName']}>
                            <Input placeholder="Product name" />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={6}>
                          <Form.Item
                            label="Batch No"
                            name={[field.name, 'batchNo']}
                            rules={[{ required: true, message: 'Batch No required' }]}
                          >
                            <Input placeholder="Batch No" onBlur={() => recalcLineAvailability(field.name)} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={5}>
                          <Form.Item
                            label="Plant"
                            name={[field.name, 'plant']}
                            rules={[{ required: true, message: 'Plant required' }]}
                          >
                            <Select
                              showSearch
                              allowClear
                              placeholder="Plant"
                              options={plantOptions}
                              onChange={() => recalcLineAvailability(field.name)}
                              filterOption={(input, option) =>
                                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                              }
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={5}>
                          <Form.Item label="Location" name={[field.name, 'location']}>
                            <Select
                              showSearch
                              allowClear
                              placeholder="Location"
                              options={locationOptions}
                              onChange={() => recalcLineAvailability(field.name)}
                              filterOption={(input, option) =>
                                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                              }
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={5}>
                          <Form.Item label="Expiry Date" name={[field.name, 'expiryDate']}>
                            <Input placeholder="YYYY-MM-DD" onBlur={() => recalcLineAvailability(field.name)} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={3}>
                          <Form.Item label="UOM" name={[field.name, 'uom']}>
                            <Input placeholder="PCS" />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={3}>
                          <Form.Item
                            label="Qty"
                            name={[field.name, 'qty']}
                            rules={[{ required: true, message: 'Qty required' }]}
                          >
                            <InputNumber min={0.0001} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={3}>
                          <Form.Item label="Unit Price" name={[field.name, 'unitPrice']}>
                            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={3}>
                          <Form.Item label="Available" name={[field.name, 'availableQty']}>
                            <InputNumber disabled style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={4}>
                          <Form.Item label="Line Amount">
                            <Input value={money(lineAmount)} disabled />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={24}>
                          <Form.Item label="Line Remarks" name={[field.name, 'remarks']}>
                            <Input placeholder="Line remarks" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  );
                })}

                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add(defaultLine())}>
                  Add Line
                </Button>
              </Space>
            )}
          </Form.List>

          <Divider titlePlacement="left">Remarks</Divider>

          <Form.Item label="Order Remarks" name="remarks">
            <TextArea rows={3} placeholder="Sales order remarks" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        open={drawerOpen}
        title={`Sales Order Details ${viewRecord ? `- ${viewRecord.orderNo}` : ''}`}
        size={980}
        onClose={() => {
          setDrawerOpen(false);
          setViewRecord(null);
        }}
      >
        {viewRecord ? (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            {(() => {
              const analysis = getAIAnalysis(viewRecord);

              return (
                <Alert
                  showIcon
                  type={
                    analysis.readiness === 'Ready'
                      ? 'success'
                      : analysis.readiness === 'Warning'
                        ? 'warning'
                        : 'error'
                  }
                  title={
                    <Space wrap>
                      <RobotOutlined />
                      <Text strong>AI Sales Order Assistant:</Text>
                      <Tag color={aiReadinessColor(analysis.readiness)}>{analysis.readiness}</Tag>
                      <Text>Score {analysis.score}/100</Text>
                    </Space>
                  }
                  description={
                    analysis.recommendations[0] ||
                    'AI review completed for customer, product, inventory and outbound readiness.'
                  }
                  action={
                    <Button size="small" icon={<RobotOutlined />} onClick={() => openAIModal(viewRecord)}>
                      View AI Check
                    </Button>
                  }
                />
              );
            })()}

            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Sales Order No">{viewRecord.orderNo}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColor(viewRecord.status)}>{viewRecord.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Customer Code">{viewRecord.customerCode || '-'}</Descriptions.Item>
              <Descriptions.Item label="Customer Name">{viewRecord.customerName}</Descriptions.Item>
              <Descriptions.Item label="Contact">{viewRecord.contactPerson || '-'}</Descriptions.Item>
              <Descriptions.Item label="Phone">{viewRecord.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="Email">{viewRecord.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="Order Date">{viewRecord.orderDate}</Descriptions.Item>
              <Descriptions.Item label="Required Ship Date">
                {viewRecord.requiredShipDate || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Outbound Shipment">
                {viewRecord.outboundShipmentNo || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Total Qty">{qtyFmt(viewRecord.totalQty)}</Descriptions.Item>
              <Descriptions.Item label="Total Amount">{money(viewRecord.totalAmount)}</Descriptions.Item>
              <Descriptions.Item label="Address" span={2}>
                {viewRecord.address || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Remarks" span={2}>
                {viewRecord.remarks || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Table<SalesOrderLine>
              rowKey="lineId"
              columns={itemColumns}
              dataSource={viewRecord.items}
              scroll={{ x: 1200 }}
              pagination={false}
            />

            <Space wrap>
              <Button icon={<RobotOutlined />} onClick={() => openAIModal(viewRecord)}>
                AI Check
              </Button>

              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setDrawerOpen(false);
                  openEditModal(viewRecord);
                }}
                disabled={['Completed', 'Cancelled'].includes(viewRecord.status)}
              >
                Edit
              </Button>

              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(viewRecord)}
                disabled={viewRecord.status !== 'Draft'}
              >
                Approve
              </Button>

              <Button
                icon={<SendOutlined />}
                onClick={() => handleCreateOutbound(viewRecord)}
                disabled={viewRecord.status !== 'Approved'}
              >
                Create Outbound Draft
              </Button>

              <Button icon={<CopyOutlined />} onClick={() => handleDuplicate(viewRecord)}>
                Duplicate
              </Button>

              <Popconfirm
                title="Cancel sales order?"
                okText="Cancel Order"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleCancel(viewRecord)}
              >
                <Button
                  danger
                  disabled={['Outbound Created', 'Completed', 'Cancelled'].includes(viewRecord.status)}
                >
                  Cancel Order
                </Button>
              </Popconfirm>
            </Space>
          </Space>
        ) : (
          <Empty />
        )}
      </Drawer>

      <Modal
        open={importOpen}
        title="Import Sales Orders from CSV"
        onCancel={() => setImportOpen(false)}
        footer={[
          <Button key="template" icon={<FileAddOutlined />} onClick={handleDownloadTemplate}>
            Download Template
          </Button>,
          <Button key="close" onClick={() => setImportOpen(false)}>
            Close
          </Button>,
        ]}
        destroyOnHidden
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Text>
            Upload CSV using the provided template. Multiple lines with the same <Text strong>orderNo</Text> will be
            grouped into one sales order.
          </Text>

          <Upload.Dragger
            accept=".csv"
            multiple={false}
            showUploadList={false}
            beforeUpload={(file) => {
              handleImportFile(file);
              return false;
            }}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">Click or drag CSV file to upload</p>
            <p className="ant-upload-hint">Required fields: customerName, sku, batchNo, plant, qty</p>
          </Upload.Dragger>
        </Space>
      </Modal>

      <Modal
        open={aiModalOpen}
        title={
          <Space>
            <RobotOutlined />
            AI Sales Order Assistant
            {aiRecord && <Text type="secondary">— {aiRecord.orderNo}</Text>}
          </Space>
        }
        width={900}
        onCancel={() => {
          setAiModalOpen(false);
          setAiRecord(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setAiModalOpen(false);
              setAiRecord(null);
            }}
          >
            Close
          </Button>,
          aiRecord && (
            <Button
              key="outbound"
              type="primary"
              icon={<SendOutlined />}
              disabled={aiRecord.status !== 'Approved'}
              onClick={() => {
                handleCreateOutbound(aiRecord);
                setAiModalOpen(false);
              }}
            >
              Create Outbound Draft
            </Button>
          ),
        ]}
        destroyOnHidden
      >
        {aiRecord && aiModalAnalysis ? (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <Alert
              showIcon
              type={
                aiModalAnalysis.readiness === 'Ready'
                  ? 'success'
                  : aiModalAnalysis.readiness === 'Warning'
                    ? 'warning'
                    : 'error'
              }
              title={
                <Space wrap>
                  <Text strong>AI Readiness:</Text>
                  <Tag color={aiReadinessColor(aiModalAnalysis.readiness)}>{aiModalAnalysis.readiness}</Tag>
                  <Badge count={`${aiModalAnalysis.errors} Errors`} style={{ backgroundColor: '#ff4d4f' }} />
                  <Badge count={`${aiModalAnalysis.warnings} Warnings`} style={{ backgroundColor: '#faad14' }} />
                  <Badge count={`${aiModalAnalysis.infos} Info`} style={{ backgroundColor: '#1890ff' }} />
                </Space>
              }
              description={
                aiModalAnalysis.readiness === 'Ready'
                  ? 'This sales order is ready for fulfilment based on current master data and inventory reference.'
                  : aiModalAnalysis.readiness === 'Warning'
                    ? 'This sales order can continue, but AI recommends reviewing warning items before outbound.'
                    : 'This sales order has blocking issues that should be resolved before fulfilment.'
              }
            />

            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Card>
                  <Statistic
                    title="AI Score"
                    value={aiModalAnalysis.score}
                    suffix="/100"
                    prefix={<RobotOutlined />}
                  />
                  <Progress
                    percent={aiModalAnalysis.score}
                    status={aiScoreStatus(aiModalAnalysis.score) as any}
                    showInfo={false}
                  />
                </Card>
              </Col>

              <Col xs={24} md={8}>
                <Card>
                  <Statistic
                    title="Shortage Qty"
                    value={aiModalAnalysis.shortageQty}
                    prefix={<ThunderboltOutlined />}
                  />
                </Card>
              </Col>

              <Col xs={24} md={8}>
                <Card>
                  <Statistic
                    title="Outbound Ready"
                    value={aiModalAnalysis.canCreateOutbound ? 'Yes' : 'No'}
                    prefix={<SafetyCertificateOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            <Card
              size="small"
              title={
                <Space>
                  <ExclamationCircleOutlined />
                  AI Issues
                </Space>
              }
            >
              {aiModalAnalysis.issues.length ? (
                <List
                  dataSource={aiModalAnalysis.issues}
                  renderItem={(issue) => (
                    <List.Item>
                      <Space align="start">
                        <Tag
                          color={
                            issue.severity === 'error'
                              ? 'red'
                              : issue.severity === 'warning'
                                ? 'orange'
                                : 'blue'
                          }
                        >
                          {issue.severity.toUpperCase()}
                        </Tag>
                        <div>
                          <Text strong>
                            {issue.category}
                            {issue.lineNo ? ` | Line ${issue.lineNo}` : ''}
                          </Text>
                          <br />
                          <Text>{issue.message}</Text>
                        </div>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="No AI issues found." />
              )}
            </Card>

            <Card
              size="small"
              title={
                <Space>
                  <BulbOutlined />
                  AI Recommendations
                </Space>
              }
            >
              <List
                dataSource={aiModalAnalysis.recommendations}
                renderItem={(item) => (
                  <List.Item>
                    <Space align="start">
                      <BulbOutlined style={{ color: '#faad14' }} />
                      <Text>{item}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Space>
        ) : (
          <Empty />
        )}
      </Modal>
    </div>
  );
}