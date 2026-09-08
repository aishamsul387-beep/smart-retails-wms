'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
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
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  ExportOutlined,
  EyeOutlined,
  FileAddOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/* ============================================================================
 * Storage
 * ========================================================================== */

const PO_STORAGE_KEY = 'wms_purchase_orders';
const INBOUND_STORAGE_KEY = 'wms_inbound_receipts';

const PRODUCT_MASTER_KEYS = [
  'wms_product_master',
  'wms_products',
  'wms_products_master',
  'wms_sku_master',
  'wms_product_sku_master',
  'wms_master_products',
  'master_products_v1',
];

const SUPPLIER_MASTER_KEYS = [
  'wms_suppliers',
  'wms_supplier_master',
  'wms_master_suppliers',
  'master_suppliers_v1',
];

/* ============================================================================
 * Types
 * ========================================================================== */

type POStatus =
  | 'Draft'
  | 'Approved'
  | 'Partially Received'
  | 'Closed'
  | 'Cancelled';

type AIStatus =
  | 'Ready'
  | 'Ready with Warning'
  | 'Needs Approval'
  | 'Blocked';

type ModalMode = 'create' | 'edit' | 'view';

type PurchaseOrderItem = {
  id: string;
  lineNo: number;
  productCode: string;
  sku: string;
  productName: string;
  category?: string;
  storageType?: string;
  plant: string;
  location?: string;
  uom: string;
  orderQty: number;
  receivedQty: number;
  remarks?: string;
};

type PurchaseOrder = {
  id: string;
  poNo: string;
  supplierCode: string;
  supplierName: string;
  poDate: string;
  expectedDate?: string;
  status: POStatus;
  remarks?: string;
  items: PurchaseOrderItem[];

  aiStatus?: AIStatus;
  aiScore?: number;
  aiIssues?: string[];
  aiWarnings?: string[];
  aiRecommendations?: string[];
  aiReviewedAt?: string;

  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  closedAt?: string;
  cancelledAt?: string;
};

type ProductMasterItem = {
  id?: string;
  productCode: string;
  sku: string;
  productName: string;
  uom: string;
  category?: string;
  storageType?: string;

  /*
   * These controls remain in Product Master.
   * They are NOT displayed or entered in the Purchase Order.
   * They are used only when preparing an Inbound Receipt.
   */
  batchControlled?: boolean;
  expiryControlled?: boolean;

  status?: string;
  defaultPlant?: string;
  defaultLocation?: string;
  preferredSupplierCode?: string;
  minimumOrderQty?: number;
  raw?: any;
};

type SupplierMasterItem = {
  id?: string;
  supplierCode: string;
  supplierName: string;
  status?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  raw?: any;
};

type MasterOption = {
  value: string;
  label: string;
  raw?: any;
};

type POFormValues = {
  poNo: string;
  supplierCode: string;
  supplierName: string;
  poDate?: Dayjs;
  expectedDate?: Dayjs;
  status: POStatus;
  remarks?: string;
  items: PurchaseOrderItem[];
};

type AIReviewResult = {
  status: AIStatus;
  score: number;
  issues: string[];
  warnings: string[];
  recommendations: string[];
};

type ImportResult = {
  purchaseOrders: PurchaseOrder[];
  errors: string[];
  warnings: string[];
};

/* ============================================================================
 * Constants
 * ========================================================================== */

const PO_STATUS_OPTIONS: POStatus[] = [
  'Draft',
  'Approved',
  'Partially Received',
  'Closed',
  'Cancelled',
];

const statusColor: Record<POStatus, string> = {
  Draft: 'default',
  Approved: 'blue',
  'Partially Received': 'orange',
  Closed: 'green',
  Cancelled: 'red',
};

const aiStatusColor: Record<AIStatus, string> = {
  Ready: 'success',
  'Ready with Warning': 'warning',
  'Needs Approval': 'processing',
  Blocked: 'error',
};

/* ============================================================================
 * Generic Helpers
 * ========================================================================== */

const makeId = () =>
  `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const today = () => dayjs().format('YYYY-MM-DD');

const buildPONo = () =>
  `PO-${dayjs().format('YYYYMMDD-HHmmss')}-${Math.floor(
    100 + Math.random() * 900,
  )}`;

const buildInboundNo = () =>
  `IR-${dayjs().format('YYYYMMDD-HHmmss')}-${Math.floor(
    100 + Math.random() * 900,
  )}`;

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeLower(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeCode(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function normalizeKey(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeDate(value: unknown) {
  if (!value) return '';

  const parsed = dayjs(value as any);
  return parsed.isValid()
    ? parsed.format('YYYY-MM-DD')
    : normalizeText(value);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return 0;

  const parsed = Number(
    String(value).replace(/,/g, '').trim(),
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value: unknown, fallback = false) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return fallback;
  }

  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const text = normalizeLower(value);

  if (
    [
      'true',
      'yes',
      'y',
      '1',
      'controlled',
      'required',
      'active',
    ].includes(text)
  ) {
    return true;
  }

  if (
    [
      'false',
      'no',
      'n',
      '0',
      'not controlled',
      'optional',
      'inactive',
    ].includes(text)
  ) {
    return false;
  }

  return fallback;
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

function findArrayDeep<T>(
  value: any,
  depth = 0,
): T[] {
  if (!value || depth > 7) return [];

  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === 'object') {
    const preferredKeys = [
      'data',
      'rows',
      'items',
      'records',
      'list',
      'products',
      'productMaster',
      'suppliers',
      'supplierMaster',
    ];

    for (const key of preferredKeys) {
      const found = findArrayDeep<T>(
        value[key],
        depth + 1,
      );

      if (found.length > 0) return found;
    }

    for (const key of Object.keys(value)) {
      const found = findArrayDeep<T>(
        value[key],
        depth + 1,
      );

      if (found.length > 0) return found;
    }
  }

  return [];
}

function readStorageArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];

  const parsed = safeJsonParse<any>(
    localStorage.getItem(key),
    [],
  );

  return findArrayDeep<T>(parsed);
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '');

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadTextFile(
  filename: string,
  content: string,
) {
  const blob = new Blob([content], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function parseCsv(
  text: string,
): Record<string, string>[] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let insideQuotes = false;

  const cleanText = String(text || '').replace(
    /^\uFEFF/,
    '',
  );

  for (
    let index = 0;
    index < cleanText.length;
    index += 1
  ) {
    const char = cleanText[index];
    const next = cleanText[index + 1];

    if (
      char === '"' &&
      insideQuotes &&
      next === '"'
    ) {
      current += '"';
      index += 1;
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

    if (
      (char === '\n' || char === '\r') &&
      !insideQuotes
    ) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }

      row.push(current);

      if (
        row.some((cell) => cell.trim() !== '')
      ) {
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

  if (rows.length === 0) return [];

  const headers = rows[0].map((header) =>
    header.trim(),
  );

  return rows.slice(1).map((cells, rowIndex) => {
    const record: Record<string, string> = {
      __csvRowNo: String(rowIndex + 2),
    };

    headers.forEach((header, index) => {
      record[header] =
        cells[index]?.trim() ?? '';
    });

    return record;
  });
}

function isActiveStatus(status?: string) {
  const normalized = normalizeLower(
    status || 'Active',
  );

  return ![
    'inactive',
    'disabled',
    'blocked',
    'deleted',
    'cancelled',
    'canceled',
    'discontinued',
  ].includes(normalized);
}

function getPoCompletion(po: PurchaseOrder) {
  const orderQty = po.items.reduce(
    (sum, item) => sum + toNumber(item.orderQty),
    0,
  );

  const receivedQty = po.items.reduce(
    (sum, item) =>
      sum + toNumber(item.receivedQty),
    0,
  );

  if (orderQty <= 0) return 0;

  return Math.min(
    100,
    Math.round((receivedQty / orderQty) * 100),
  );
}

function defaultItem(
  lineNo = 1,
): PurchaseOrderItem {
  return {
    id: makeId(),
    lineNo,
    productCode: '',
    sku: '',
    productName: '',
    category: '',
    storageType: '',
    plant: '',
    location: '',
    uom: 'PCS',
    orderQty: 1,
    receivedQty: 0,
    remarks: '',
  };
}

/* ============================================================================
 * Master Data Normalization
 * ========================================================================== */

function normalizeProductMasterItem(
  raw: any,
): ProductMasterItem | null {
  const productCode = normalizeCode(
    readAny(raw, [
      'productCode',
      'Product Code',
      'itemCode',
      'Item Code',
      'materialCode',
      'Material Code',
      'code',
      'Code',
      'sku',
      'SKU',
    ]),
  );

  const sku = normalizeCode(
    readAny(
      raw,
      [
        'sku',
        'SKU',
        'productCode',
        'Product Code',
        'itemCode',
        'Item Code',
        'materialCode',
        'Material Code',
        'code',
        'Code',
      ],
      productCode,
    ),
  );

  if (!productCode && !sku) return null;

  const finalProductCode = productCode || sku;
  const finalSku = sku || productCode;

  return {
    id: normalizeText(
      readAny(raw, ['id', 'ID'], ''),
    ),
    productCode: finalProductCode,
    sku: finalSku,
    productName: normalizeText(
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
    ),
    uom:
      normalizeCode(
        readAny(
          raw,
          [
            'uom',
            'UOM',
            'baseUom',
            'Base UOM',
            'unit',
            'Unit',
            'unitOfMeasure',
          ],
          'PCS',
        ),
      ) || 'PCS',
    category: normalizeText(
      readAny(
        raw,
        [
          'category',
          'Category',
          'productCategory',
          'Product Category',
          'group',
          'Group',
        ],
        '',
      ),
    ),
    storageType: normalizeText(
      readAny(
        raw,
        [
          'storageType',
          'Storage Type',
          'storageCondition',
          'Storage Condition',
          'storage',
          'Storage',
        ],
        '',
      ),
    ),

    /*
     * Control configuration is read from Product Master only.
     * It is used later by Inbound Receiving.
     */
    batchControlled: toBoolean(
      readAny(raw, [
        'batchControlled',
        'Batch Controlled',
        'isBatchControlled',
        'Is Batch Controlled',
        'batchControl',
        'Batch Control',
      ]),
      false,
    ),
    expiryControlled: toBoolean(
      readAny(raw, [
        'expiryControlled',
        'Expiry Controlled',
        'isExpiryControlled',
        'Is Expiry Controlled',
        'expiryControl',
        'Expiry Control',
        'shelfLifeControlled',
        'Shelf Life Controlled',
      ]),
      false,
    ),

    status: normalizeText(
      readAny(
        raw,
        [
          'status',
          'Status',
          'activeStatus',
          'Active Status',
        ],
        'Active',
      ),
    ),
    defaultPlant: normalizeCode(
      readAny(
        raw,
        [
          'defaultPlant',
          'Default Plant',
          'plant',
          'Plant',
        ],
        '',
      ),
    ),
    defaultLocation: normalizeText(
      readAny(
        raw,
        [
          'defaultLocation',
          'Default Location',
          'location',
          'Location',
        ],
        '',
      ),
    ),
    preferredSupplierCode: normalizeCode(
      readAny(
        raw,
        [
          'preferredSupplierCode',
          'Preferred Supplier Code',
          'supplierCode',
          'Supplier Code',
          'vendorCode',
          'Vendor Code',
        ],
        '',
      ),
    ),
    minimumOrderQty: toNumber(
      readAny(
        raw,
        [
          'minimumOrderQty',
          'Minimum Order Qty',
          'minOrderQty',
          'MOQ',
        ],
        0,
      ),
    ),
    raw,
  };
}

function normalizeSupplierMasterItem(
  raw: any,
): SupplierMasterItem | null {
  const supplierCode = normalizeCode(
    readAny(raw, [
      'supplierCode',
      'Supplier Code',
      'vendorCode',
      'Vendor Code',
      'code',
      'Code',
      'supplierId',
      'Supplier ID',
    ]),
  );

  if (!supplierCode) return null;

  return {
    id: normalizeText(
      readAny(raw, ['id', 'ID'], ''),
    ),
    supplierCode,
    supplierName: normalizeText(
      readAny(raw, [
        'supplierName',
        'Supplier Name',
        'vendorName',
        'Vendor Name',
        'name',
        'Name',
        'companyName',
        'Company Name',
      ]),
    ),
    status: normalizeText(
      readAny(
        raw,
        [
          'status',
          'Status',
          'activeStatus',
          'Active Status',
        ],
        'Active',
      ),
    ),
    contactPerson: normalizeText(
      readAny(
        raw,
        ['contactPerson', 'Contact Person'],
        '',
      ),
    ),
    phone: normalizeText(
      readAny(
        raw,
        ['phone', 'Phone', 'mobile', 'Mobile'],
        '',
      ),
    ),
    email: normalizeText(
      readAny(raw, ['email', 'Email'], ''),
    ),
    raw,
  };
}

/*
 * Legacy batch/expiry fields are intentionally not returned.
 * Existing PO records are automatically cleaned when loaded and saved.
 */
function normalizePOItem(
  raw: any,
  index: number,
): PurchaseOrderItem {
  return {
    id: normalizeText(
      readAny(raw, ['id', 'ID'], makeId()),
    ),
    lineNo:
      toNumber(
        readAny(
          raw,
          ['lineNo', 'Line No', 'line', 'Line'],
          index + 1,
        ),
      ) || index + 1,
    productCode: normalizeCode(
      readAny(raw, [
        'productCode',
        'Product Code',
        'itemCode',
        'Item Code',
        'sku',
        'SKU',
      ]),
    ),
    sku: normalizeCode(
      readAny(raw, [
        'sku',
        'SKU',
        'productCode',
        'Product Code',
      ]),
    ),
    productName: normalizeText(
      readAny(raw, [
        'productName',
        'Product Name',
        'description',
        'Description',
      ]),
    ),
    category: normalizeText(
      readAny(
        raw,
        [
          'category',
          'Category',
          'productCategory',
        ],
        '',
      ),
    ),
    storageType: normalizeText(
      readAny(
        raw,
        [
          'storageType',
          'Storage Type',
          'storageCondition',
          'Storage Condition',
        ],
        '',
      ),
    ),
    plant: normalizeCode(
      readAny(
        raw,
        [
          'plant',
          'Plant',
          'plantCode',
          'Plant Code',
        ],
        '',
      ),
    ),
    location: normalizeText(
      readAny(
        raw,
        [
          'location',
          'Location',
          'storageLocation',
          'Storage Location',
          'bin',
          'Bin',
        ],
        '',
      ),
    ),
    uom:
      normalizeCode(
        readAny(
          raw,
          ['uom', 'UOM', 'unit', 'Unit'],
          'PCS',
        ),
      ) || 'PCS',
    orderQty: toNumber(
      readAny(
        raw,
        [
          'orderQty',
          'Order Qty',
          'qty',
          'Qty',
          'quantity',
          'Quantity',
        ],
        0,
      ),
    ),
    receivedQty: toNumber(
      readAny(
        raw,
        ['receivedQty', 'Received Qty'],
        0,
      ),
    ),
    remarks: normalizeText(
      readAny(
        raw,
        [
          'remarks',
          'Remarks',
          'remark',
          'Remark',
        ],
        '',
      ),
    ),
  };
}

/* ============================================================================
 * Main Component
 * ========================================================================== */

export default function PurchaseOrdersPage() {
  const [form] = Form.useForm<POFormValues>();

  /*
   * Ant Design hook modal avoids static Modal context warnings.
   */
  const [modalApi, modalContextHolder] =
    Modal.useModal();

  const [purchaseOrders, setPurchaseOrders] =
    useState<PurchaseOrder[]>([]);

  const [productMaster, setProductMaster] =
    useState<ProductMasterItem[]>([]);

  const [supplierMaster, setSupplierMaster] =
    useState<SupplierMasterItem[]>([]);

  const [searchText, setSearchText] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState<'All' | POStatus>('All');

  const [modalOpen, setModalOpen] =
    useState(false);

  const [modalMode, setModalMode] =
    useState<ModalMode>('create');

  const [activePO, setActivePO] =
    useState<PurchaseOrder | null>(null);

  const [aiOpen, setAiOpen] =
    useState(false);

  const [aiReview, setAiReview] =
    useState<AIReviewResult | null>(null);

  const [aiPurchaseOrder, setAiPurchaseOrder] =
    useState<PurchaseOrder | null>(null);

  const isViewMode = modalMode === 'view';

  useEffect(() => {
    loadPurchaseOrders();
    loadMasters(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ==========================================================================
   * Persistence
   * ======================================================================== */

  function loadPurchaseOrders() {
    const stored = safeJsonParse<PurchaseOrder[]>(
      localStorage.getItem(PO_STORAGE_KEY),
      [],
    );

    const normalized = Array.isArray(stored)
      ? stored.map((po) => ({
          ...po,
          items: Array.isArray(po.items)
            ? po.items.map((item, index) =>
                normalizePOItem(item, index),
              )
            : [],
        }))
      : [];

    setPurchaseOrders(normalized);
  }

  function persistPOs(next: PurchaseOrder[]) {
    setPurchaseOrders(next);

    localStorage.setItem(
      PO_STORAGE_KEY,
      JSON.stringify(next),
    );
  }

  function showSuccess(
    title: string,
    content?: React.ReactNode,
  ) {
    modalApi.success({
      title,
      content,
      width: 520,
    });
  }

  function showWarning(
    title: string,
    content?: React.ReactNode,
  ) {
    modalApi.warning({
      title,
      content,
      width: 560,
    });
  }

  function showError(
    title: string,
    content?: React.ReactNode,
  ) {
    modalApi.error({
      title,
      content,
      width: 720,
    });
  }

  /* ==========================================================================
   * Master Data
   * ======================================================================== */

  function readProductMasterFromStorage() {
    if (typeof window === 'undefined') return [];

    const map =
      new Map<string, ProductMasterItem>();

    PRODUCT_MASTER_KEYS.forEach((key) => {
      const rows = readStorageArray<any>(key);

      rows.forEach((row) => {
        const normalized =
          normalizeProductMasterItem(row);

        if (!normalized) return;

        const keys = [
          normalized.productCode,
          normalized.sku,
        ]
          .filter(Boolean)
          .map(normalizeCode);

        keys.forEach((mapKey) => {
          const existing = map.get(mapKey);

          map.set(
            mapKey,
            existing
              ? {
                  ...existing,
                  ...normalized,
                  raw:
                    normalized.raw ||
                    existing.raw,
                }
              : normalized,
          );
        });
      });
    });

    const unique =
      new Map<string, ProductMasterItem>();

    Array.from(map.values()).forEach(
      (product) => {
        const key = normalizeCode(
          product.productCode || product.sku,
        );

        if (!unique.has(key)) {
          unique.set(key, product);
        }
      },
    );

    return Array.from(unique.values()).sort(
      (a, b) =>
        a.productCode.localeCompare(
          b.productCode,
        ),
    );
  }

  function readSupplierMasterFromStorage() {
    if (typeof window === 'undefined') return [];

    const map =
      new Map<string, SupplierMasterItem>();

    SUPPLIER_MASTER_KEYS.forEach((key) => {
      const rows = readStorageArray<any>(key);

      rows.forEach((row) => {
        const normalized =
          normalizeSupplierMasterItem(row);

        if (!normalized) return;

        const mapKey = normalizeCode(
          normalized.supplierCode,
        );

        const existing = map.get(mapKey);

        map.set(
          mapKey,
          existing
            ? {
                ...existing,
                ...normalized,
                raw:
                  normalized.raw ||
                  existing.raw,
              }
            : normalized,
        );
      });
    });

    return Array.from(map.values()).sort(
      (a, b) =>
        a.supplierCode.localeCompare(
          b.supplierCode,
        ),
    );
  }

  function loadMasters(
    showConfirmation = true,
  ) {
    const products =
      readProductMasterFromStorage();

    const suppliers =
      readSupplierMasterFromStorage();

    setProductMaster(products);
    setSupplierMaster(suppliers);

    if (showConfirmation) {
      showSuccess(
        'Master Data Refreshed',
        `${products.length} product(s) and ${suppliers.length} supplier(s) loaded.`,
      );
    }
  }

  function getProductByCodeOrSku(
    value: unknown,
  ) {
    const target = normalizeCode(value);

    if (!target) return null;

    return (
      productMaster.find(
        (product) =>
          normalizeCode(
            product.productCode,
          ) === target ||
          normalizeCode(product.sku) ===
            target ||
          normalizeCode(
            readAny(
              product.raw,
              [
                'productCode',
                'Product Code',
                'sku',
                'SKU',
                'code',
                'Code',
              ],
              '',
            ),
          ) === target,
      ) || null
    );
  }

  function getSupplierByCode(value: unknown) {
    const target = normalizeCode(value);

    if (!target) return null;

    return (
      supplierMaster.find(
        (supplier) =>
          normalizeCode(
            supplier.supplierCode,
          ) === target,
      ) || null
    );
  }

  function enrichItemFromProductMaster(
    item: PurchaseOrderItem,
  ): PurchaseOrderItem {
    const product = getProductByCodeOrSku(
      item.productCode || item.sku,
    );

    if (!product) return item;

    return {
      ...item,
      productCode:
        item.productCode ||
        product.productCode,
      sku:
        item.sku ||
        product.sku ||
        product.productCode,
      productName:
        item.productName ||
        product.productName,
      uom: item.uom || product.uom || 'PCS',
      category:
        item.category ||
        product.category ||
        '',
      storageType:
        item.storageType ||
        product.storageType ||
        '',
      plant:
        item.plant ||
        product.defaultPlant ||
        '',
      location:
        item.location ||
        product.defaultLocation ||
        '',
    };
  }

  /* ==========================================================================
   * Options
   * ======================================================================== */

  const productCodeOptions: MasterOption[] =
    useMemo(() => {
      const map =
        new Map<string, MasterOption>();

      productMaster
        .filter((product) =>
          isActiveStatus(product.status),
        )
        .forEach((product) => {
          map.set(
            normalizeCode(
              product.productCode,
            ),
            {
              value: product.productCode,
              label: product.productName
                ? `${product.productCode} - ${product.productName}`
                : product.productCode,
              raw: product,
            },
          );
        });

      purchaseOrders.forEach((po) => {
        po.items.forEach((item) => {
          if (!item.productCode) return;

          const key = normalizeCode(
            item.productCode,
          );

          if (!map.has(key)) {
            map.set(key, {
              value: item.productCode,
              label: item.productName
                ? `${item.productCode} - ${item.productName}`
                : item.productCode,
              raw: item,
            });
          }
        });
      });

      return Array.from(map.values());
    }, [productMaster, purchaseOrders]);

  const skuOptions: MasterOption[] =
    useMemo(() => {
      const map =
        new Map<string, MasterOption>();

      productMaster
        .filter((product) =>
          isActiveStatus(product.status),
        )
        .forEach((product) => {
          const sku =
            product.sku ||
            product.productCode;

          map.set(normalizeCode(sku), {
            value: sku,
            label: product.productName
              ? `${sku} - ${product.productName}`
              : sku,
            raw: product,
          });
        });

      purchaseOrders.forEach((po) => {
        po.items.forEach((item) => {
          if (!item.sku) return;

          const key = normalizeCode(item.sku);

          if (!map.has(key)) {
            map.set(key, {
              value: item.sku,
              label: item.productName
                ? `${item.sku} - ${item.productName}`
                : item.sku,
              raw: item,
            });
          }
        });
      });

      return Array.from(map.values());
    }, [productMaster, purchaseOrders]);

  const supplierOptions: MasterOption[] =
    useMemo(() => {
      const map =
        new Map<string, MasterOption>();

      supplierMaster
        .filter((supplier) =>
          isActiveStatus(supplier.status),
        )
        .forEach((supplier) => {
          map.set(
            normalizeCode(
              supplier.supplierCode,
            ),
            {
              value: supplier.supplierCode,
              label: supplier.supplierName
                ? `${supplier.supplierCode} - ${supplier.supplierName}`
                : supplier.supplierCode,
              raw: supplier,
            },
          );
        });

      purchaseOrders.forEach((po) => {
        if (!po.supplierCode) return;

        const key = normalizeCode(
          po.supplierCode,
        );

        if (!map.has(key)) {
          map.set(key, {
            value: po.supplierCode,
            label: po.supplierName
              ? `${po.supplierCode} - ${po.supplierName}`
              : po.supplierCode,
            raw: po,
          });
        }
      });

      return Array.from(map.values());
    }, [purchaseOrders, supplierMaster]);

  const uomOptions = useMemo(() => {
    const values = new Set<string>();

    productMaster.forEach((product) => {
      if (product.uom) values.add(product.uom);
    });

    purchaseOrders.forEach((po) => {
      po.items.forEach((item) => {
        if (item.uom) values.add(item.uom);
      });
    });

    [
      'PCS',
      'CTN',
      'KG',
      'L',
      'M',
      'BOX',
      'PALLET',
    ].forEach((uom) => values.add(uom));

    return Array.from(values).map((value) => ({
      value,
      label: value,
    }));
  }, [productMaster, purchaseOrders]);

  const plantOptions = useMemo(() => {
    const values = new Set<string>();

    productMaster.forEach((product) => {
      if (product.defaultPlant) {
        values.add(product.defaultPlant);
      }
    });

    purchaseOrders.forEach((po) => {
      po.items.forEach((item) => {
        if (item.plant) {
          values.add(item.plant);
        }
      });
    });

    ['PLANT-01', 'PLANT-02'].forEach(
      (plant) => values.add(plant),
    );

    return Array.from(values).map((value) => ({
      value,
      label: value,
    }));
  }, [productMaster, purchaseOrders]);

  /* ==========================================================================
   * Search and Summary
   * ======================================================================== */

  const filteredPOs = useMemo(() => {
    const query = normalizeLower(searchText);

    return purchaseOrders.filter((po) => {
      const statusMatches =
        statusFilter === 'All' ||
        po.status === statusFilter;

      const searchMatches =
        !query ||
        [
          po.poNo,
          po.supplierCode,
          po.supplierName,
          po.status,
          po.remarks,
          po.aiStatus,
          ...po.items.flatMap((item) => [
            item.productCode,
            item.sku,
            item.productName,
            item.category,
            item.storageType,
            item.plant,
            item.location,
            item.uom,
          ]),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);

      return statusMatches && searchMatches;
    });
  }, [
    purchaseOrders,
    searchText,
    statusFilter,
  ]);

  const summary = useMemo(() => {
    const total = purchaseOrders.length;

    const draft = purchaseOrders.filter(
      (po) => po.status === 'Draft',
    ).length;

    const approved = purchaseOrders.filter(
      (po) => po.status === 'Approved',
    ).length;

    const partial = purchaseOrders.filter(
      (po) =>
        po.status === 'Partially Received',
    ).length;

    const aiRisk = purchaseOrders.filter(
      (po) =>
        po.aiStatus === 'Blocked' ||
        po.aiStatus === 'Needs Approval',
    ).length;

    const openQty = purchaseOrders.reduce(
      (sum, po) => {
        if (
          ['Closed', 'Cancelled'].includes(
            po.status,
          )
        ) {
          return sum;
        }

        return (
          sum +
          po.items.reduce(
            (lineSum, item) =>
              lineSum +
              Math.max(
                0,
                toNumber(item.orderQty) -
                  toNumber(item.receivedQty),
              ),
            0,
          )
        );
      },
      0,
    );

    return {
      total,
      draft,
      approved,
      partial,
      aiRisk,
      openQty,
    };
  }, [purchaseOrders]);

  /* ==========================================================================
   * AI Review
   * ======================================================================== */

  function analyzePurchaseOrder(
    po: PurchaseOrder,
  ): AIReviewResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    let score = 100;
    let needsApproval = false;

    const supplier = getSupplierByCode(
      po.supplierCode,
    );

    if (!po.poNo) {
      issues.push(
        'Header: PO number is missing.',
      );
      score -= 15;
    }

    if (!po.supplierCode) {
      issues.push(
        'Header: Supplier Code is missing.',
      );
      score -= 15;
    }

    if (!po.supplierName) {
      issues.push(
        'Header: Supplier Name is missing.',
      );
      score -= 10;
    }

    if (
      supplier &&
      !isActiveStatus(supplier.status)
    ) {
      issues.push(
        `Header: Supplier ${supplier.supplierCode} is inactive or blocked.`,
      );
      score -= 25;
    }

    if (
      !supplier &&
      supplierMaster.length > 0
    ) {
      warnings.push(
        `Header: Supplier ${
          po.supplierCode || '-'
        } was not found in Supplier Master.`,
      );
      score -= 5;
    }

    if (!po.poDate) {
      issues.push(
        'Header: PO Date is missing.',
      );
      score -= 10;
    }

    if (
      po.expectedDate &&
      po.poDate &&
      dayjs(po.expectedDate).isBefore(
        dayjs(po.poDate),
        'day',
      )
    ) {
      issues.push(
        'Header: Expected Date cannot be earlier than PO Date.',
      );
      score -= 15;
    }

    if (
      po.expectedDate &&
      dayjs(po.expectedDate).isBefore(
        dayjs(),
        'day',
      ) &&
      !['Closed', 'Cancelled'].includes(
        po.status,
      ) &&
      getPoCompletion(po) < 100
    ) {
      warnings.push(
        'Header: PO expected date is overdue.',
      );

      recommendations.push(
        'Follow up with the supplier and update the expected delivery date.',
      );

      score -= 8;
    }

    if (
      !Array.isArray(po.items) ||
      po.items.length === 0
    ) {
      issues.push(
        'Header: PO has no line items.',
      );
      score -= 30;
    }

    const duplicateLineKeys =
      new Map<string, number[]>();

    po.items.forEach((item, index) => {
      const rowNo = index + 1;

      const product = getProductByCodeOrSku(
        item.productCode || item.sku,
      );

      const orderQty = toNumber(
        item.orderQty,
      );

      const receivedQty = toNumber(
        item.receivedQty,
      );

      if (!item.productCode) {
        issues.push(
          `Line ${rowNo}: Product Code is missing.`,
        );
        score -= 12;
      }

      if (!item.sku) {
        issues.push(
          `Line ${rowNo}: SKU is missing.`,
        );
        score -= 12;
      }

      if (!item.productName) {
        issues.push(
          `Line ${rowNo}: Product Name is missing.`,
        );
        score -= 8;
      }

      if (!item.plant) {
        issues.push(
          `Line ${rowNo}: Plant is missing.`,
        );
        score -= 10;
      }

      if (!item.uom) {
        issues.push(
          `Line ${rowNo}: UOM is missing.`,
        );
        score -= 8;
      }

      if (orderQty <= 0) {
        issues.push(
          `Line ${rowNo}: Order Qty must be greater than zero.`,
        );
        score -= 15;
      }

      if (receivedQty < 0) {
        issues.push(
          `Line ${rowNo}: Received Qty cannot be negative.`,
        );
        score -= 15;
      }

      if (receivedQty > orderQty) {
        issues.push(
          `Line ${rowNo}: Received Qty cannot exceed Order Qty.`,
        );
        score -= 20;
      }

      if (
        !product &&
        productMaster.length > 0
      ) {
        warnings.push(
          `Line ${rowNo}: Product ${
            item.productCode || item.sku
          } was not found in Product Master.`,
        );
        score -= 5;
      }

      if (
        product &&
        !isActiveStatus(product.status)
      ) {
        issues.push(
          `Line ${rowNo}: Product ${product.productCode} is inactive or blocked.`,
        );
        score -= 20;
      }

      if (
        product?.uom &&
        item.uom &&
        normalizeCode(product.uom) !==
          normalizeCode(item.uom)
      ) {
        warnings.push(
          `Line ${rowNo}: UOM differs from Product Master. Master=${product.uom}, PO=${item.uom}.`,
        );
        score -= 5;
      }

      if (
        product?.preferredSupplierCode &&
        po.supplierCode &&
        normalizeCode(
          product.preferredSupplierCode,
        ) !== normalizeCode(po.supplierCode)
      ) {
        warnings.push(
          `Line ${rowNo}: Supplier differs from the product's preferred supplier ${product.preferredSupplierCode}.`,
        );
        score -= 4;
      }

      if (
        product?.minimumOrderQty &&
        orderQty > 0 &&
        orderQty <
          product.minimumOrderQty
      ) {
        warnings.push(
          `Line ${rowNo}: Order Qty ${orderQty} is below MOQ ${product.minimumOrderQty}.`,
        );
        score -= 4;
      }

      if (orderQty >= 10000) {
        warnings.push(
          `Line ${rowNo}: High quantity purchase requires additional review.`,
        );
        needsApproval = true;
        score -= 5;
      }

      /*
       * Batch and expiry are intentionally not part
       * of the PO duplicate-line key.
       */
      const duplicateKey = [
        normalizeCode(
          item.productCode || item.sku,
        ),
        normalizeCode(item.plant),
        normalizeText(item.location),
        normalizeCode(item.uom),
      ].join('|');

      const duplicateRows =
        duplicateLineKeys.get(
          duplicateKey,
        ) || [];

      duplicateRows.push(rowNo);

      duplicateLineKeys.set(
        duplicateKey,
        duplicateRows,
      );
    });

    duplicateLineKeys.forEach((rows) => {
      if (rows.length > 1) {
        warnings.push(
          `Potential duplicate PO lines detected at lines ${rows.join(
            ', ',
          )}.`,
        );

        recommendations.push(
          `Review lines ${rows.join(
            ', ',
          )} and consolidate them if they represent the same requirement.`,
        );

        score -= 6;
      }
    });

    const completion = getPoCompletion(po);

    if (
      po.status === 'Closed' &&
      completion < 100
    ) {
      warnings.push(
        `PO is Closed but completion is only ${completion}%.`,
      );
      score -= 8;
    }

    if (
      po.status === 'Approved' &&
      completion >= 100
    ) {
      warnings.push(
        'PO is fully received but remains in Approved status.',
      );

      recommendations.push(
        'Close the PO after confirming all inbound postings are complete.',
      );

      score -= 5;
    }

    if (
      po.status === 'Partially Received' &&
      completion === 0
    ) {
      warnings.push(
        'PO is Partially Received but no received quantity is recorded.',
      );
      score -= 5;
    }

    if (issues.length > 0) {
      recommendations.push(
        'Correct all blocking issues before approving or creating an inbound draft.',
      );
    }

    if (warnings.length > 0) {
      recommendations.push(
        'Procurement or warehouse personnel should review all warnings.',
      );
    }

    if (po.items.length > 1) {
      recommendations.push(
        `Confirm that all ${po.items.length} lines are included in supplier acknowledgement and inbound planning.`,
      );
    }

    /*
     * Inbound recommendation replaces PO batch/expiry validation.
     */
    const inboundControlledLines =
      po.items.filter((item) => {
        const product =
          getProductByCodeOrSku(
            item.productCode || item.sku,
          );

        return Boolean(
          product?.batchControlled ||
            product?.expiryControlled,
        );
      });

    if (inboundControlledLines.length > 0) {
      recommendations.push(
        `${inboundControlledLines.length} line(s) require batch and/or expiry information from Product Master. Enter the actual Batch No and Expiry Date during Inbound Receiving.`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Purchase Order is ready for the normal approval and inbound workflow.',
      );
    }

    score = Math.max(
      0,
      Math.min(100, Math.round(score)),
    );

    let status: AIStatus = 'Ready';

    if (issues.length > 0) {
      status = 'Blocked';
    } else if (needsApproval) {
      status = 'Needs Approval';
    } else if (warnings.length > 0) {
      status = 'Ready with Warning';
    }

    return {
      status,
      score,
      issues,
      warnings,
      recommendations: Array.from(
        new Set(recommendations),
      ),
    };
  }

  function applyAIReview(
    po: PurchaseOrder,
    review: AIReviewResult,
  ): PurchaseOrder {
    return {
      ...po,
      aiStatus: review.status,
      aiScore: review.score,
      aiIssues: review.issues,
      aiWarnings: review.warnings,
      aiRecommendations:
        review.recommendations,
      aiReviewedAt:
        new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  function openAIReview(po: PurchaseOrder) {
    const review = analyzePurchaseOrder(po);

    const reviewedPO = applyAIReview(
      po,
      review,
    );

    persistPOs(
      purchaseOrders.map((record) =>
        record.id === po.id
          ? reviewedPO
          : record,
      ),
    );

    setActivePO((current) =>
      current?.id === po.id
        ? reviewedPO
        : current,
    );

    setAiPurchaseOrder(reviewedPO);
    setAiReview(review);
    setAiOpen(true);
  }

  function reviewAllPurchaseOrders() {
    const reviewed = purchaseOrders.map(
      (po) =>
        applyAIReview(
          po,
          analyzePurchaseOrder(po),
        ),
    );

    persistPOs(reviewed);

    showSuccess(
      'AI Review Completed',
      `${reviewed.length} purchase order(s) were reviewed.`,
    );
  }

  /* ==========================================================================
   * Form and CRUD
   * ======================================================================== */

  function openCreateModal() {
    setModalMode('create');
    setActivePO(null);

    form.resetFields();

    form.setFieldsValue({
      poNo: buildPONo(),
      supplierCode: '',
      supplierName: '',
      poDate: dayjs(),
      expectedDate: dayjs().add(7, 'day'),
      status: 'Draft',
      remarks: '',
      items: [defaultItem()],
    });

    setModalOpen(true);
  }

  function setPOForm(po: PurchaseOrder) {
    form.resetFields();

    form.setFieldsValue({
      ...po,
      poDate: po.poDate
        ? dayjs(po.poDate)
        : undefined,
      expectedDate: po.expectedDate
        ? dayjs(po.expectedDate)
        : undefined,
      items: po.items.map((item, index) => ({
        ...normalizePOItem(item, index),
        lineNo: item.lineNo || index + 1,
      })),
    });
  }

  function openEditModal(po: PurchaseOrder) {
    setModalMode('edit');
    setActivePO(po);
    setPOForm(po);
    setModalOpen(true);
  }

  function openViewModal(po: PurchaseOrder) {
    setModalMode('view');
    setActivePO(po);
    setPOForm(po);
    setModalOpen(true);
  }

  function handleSupplierSelect(
    value: string,
  ) {
    const supplier =
      getSupplierByCode(value);

    if (!supplier) return;

    form.setFieldsValue({
      supplierCode:
        supplier.supplierCode,
      supplierName:
        supplier.supplierName,
    });

    if (!isActiveStatus(supplier.status)) {
      showWarning(
        'Supplier Warning',
        `Supplier ${supplier.supplierCode} is inactive or blocked.`,
      );
    }
  }

  function handleProductSelect(
    lineIndex: number,
    value: string,
  ) {
    const product =
      getProductByCodeOrSku(value);

    if (!product) return;

    const items =
      form.getFieldValue('items') || [];

    const current =
      items[lineIndex] ||
      defaultItem(lineIndex + 1);

    items[lineIndex] = {
      ...current,
      productCode: product.productCode,
      sku:
        product.sku ||
        product.productCode,
      productName: product.productName,
      uom: product.uom || 'PCS',
      category: product.category || '',
      storageType:
        product.storageType || '',
      plant:
        current.plant ||
        product.defaultPlant ||
        '',
      location:
        current.location ||
        product.defaultLocation ||
        '',
    };

    form.setFieldsValue({ items });

    if (!isActiveStatus(product.status)) {
      showWarning(
        'Product Warning',
        `Product ${product.productCode} is inactive or blocked.`,
      );
    }
  }

  function validatePayload(
    values: POFormValues,
  ) {
    const errors: string[] = [];

    if (!normalizeText(values.poNo)) {
      errors.push('PO No is required.');
    }

    if (!normalizeText(values.supplierCode)) {
      errors.push(
        'Supplier Code is required.',
      );
    }

    if (!normalizeText(values.supplierName)) {
      errors.push(
        'Supplier Name is required.',
      );
    }

    if (!values.poDate) {
      errors.push('PO Date is required.');
    }

    if (
      values.expectedDate &&
      values.poDate &&
      dayjs(values.expectedDate).isBefore(
        dayjs(values.poDate),
        'day',
      )
    ) {
      errors.push(
        'Expected Date cannot be earlier than PO Date.',
      );
    }

    const supplier = getSupplierByCode(
      values.supplierCode,
    );

    if (
      supplier &&
      !isActiveStatus(supplier.status)
    ) {
      errors.push(
        'Selected supplier is inactive or blocked.',
      );
    }

    if (
      !Array.isArray(values.items) ||
      values.items.length === 0
    ) {
      errors.push(
        'At least one PO item is required.',
      );
    }

    values.items?.forEach(
      (item, index) => {
        const line = index + 1;

        const productCode = normalizeCode(
          item.productCode,
        );

        const sku = normalizeCode(item.sku);

        const product =
          getProductByCodeOrSku(
            productCode || sku,
          );

        if (!productCode) {
          errors.push(
            `Line ${line}: Product Code is required.`,
          );
        }

        if (!sku) {
          errors.push(
            `Line ${line}: SKU is required.`,
          );
        }

        if (
          !normalizeText(item.productName)
        ) {
          errors.push(
            `Line ${line}: Product Name is required.`,
          );
        }

        if (!normalizeText(item.plant)) {
          errors.push(
            `Line ${line}: Plant is required.`,
          );
        }

        if (!normalizeText(item.uom)) {
          errors.push(
            `Line ${line}: UOM is required.`,
          );
        }

        if (toNumber(item.orderQty) <= 0) {
          errors.push(
            `Line ${line}: Order Qty must be greater than 0.`,
          );
        }

        if (
          toNumber(item.receivedQty) < 0
        ) {
          errors.push(
            `Line ${line}: Received Qty cannot be negative.`,
          );
        }

        if (
          toNumber(item.receivedQty) >
          toNumber(item.orderQty)
        ) {
          errors.push(
            `Line ${line}: Received Qty cannot exceed Order Qty.`,
          );
        }

        if (
          product &&
          !isActiveStatus(product.status)
        ) {
          errors.push(
            `Line ${line}: Product ${product.productCode} is inactive or blocked.`,
          );
        }
      },
    );

    const duplicatePO =
      purchaseOrders.some(
        (po) =>
          normalizeCode(po.poNo) ===
            normalizeCode(values.poNo) &&
          po.id !== activePO?.id,
      );

    if (duplicatePO) {
      errors.push('PO No already exists.');
    }

    return errors;
  }

  async function handleSave() {
    try {
      const values =
        await form.validateFields();

      const errors =
        validatePayload(values);

      if (errors.length > 0) {
        showError(
          'Validation Failed',
          <div
            style={{
              maxHeight: 360,
              overflow: 'auto',
            }}
          >
            <ul style={{ paddingLeft: 20 }}>
              {errors.map((error, index) => (
                <li
                  key={`${error}-${index}`}
                >
                  {error}
                </li>
              ))}
            </ul>
          </div>,
        );

        return;
      }

      const now = new Date().toISOString();

      const items: PurchaseOrderItem[] =
        values.items.map((item, index) => {
          const normalized: PurchaseOrderItem =
            {
              id: item.id || makeId(),
              lineNo: index + 1,
              productCode: normalizeCode(
                item.productCode,
              ),
              sku: normalizeCode(item.sku),
              productName: normalizeText(
                item.productName,
              ),
              category: normalizeText(
                item.category,
              ),
              storageType: normalizeText(
                item.storageType,
              ),
              plant: normalizeCode(
                item.plant,
              ),
              location: normalizeText(
                item.location,
              ),
              uom:
                normalizeCode(
                  item.uom || 'PCS',
                ) || 'PCS',
              orderQty: toNumber(
                item.orderQty,
              ),
              receivedQty: toNumber(
                item.receivedQty,
              ),
              remarks: normalizeText(
                item.remarks,
              ),
            };

          return enrichItemFromProductMaster(
            normalized,
          );
        });

      const base: PurchaseOrder = {
        id: activePO?.id || makeId(),
        poNo: normalizeCode(values.poNo),
        supplierCode: normalizeCode(
          values.supplierCode,
        ),
        supplierName: normalizeText(
          values.supplierName,
        ),
        poDate: values.poDate
          ? dayjs(values.poDate).format(
              'YYYY-MM-DD',
            )
          : today(),
        expectedDate: values.expectedDate
          ? dayjs(
              values.expectedDate,
            ).format('YYYY-MM-DD')
          : '',
        status: values.status || 'Draft',
        remarks: normalizeText(
          values.remarks,
        ),
        items,
        createdAt:
          activePO?.createdAt || now,
        updatedAt: now,
        approvedAt:
          activePO?.approvedAt,
        closedAt: activePO?.closedAt,
        cancelledAt:
          activePO?.cancelledAt,
      };

      const review =
        analyzePurchaseOrder(base);

      const reviewedPO = applyAIReview(
        base,
        review,
      );

      const next =
        modalMode === 'create'
          ? [
              reviewedPO,
              ...purchaseOrders,
            ]
          : purchaseOrders.map((po) =>
              po.id === reviewedPO.id
                ? reviewedPO
                : po,
            );

      persistPOs(next);
      setModalOpen(false);

      showSuccess(
        modalMode === 'create'
          ? 'Purchase Order Created'
          : 'Purchase Order Updated',
        `${reviewedPO.poNo} saved with ${reviewedPO.items.length} line item(s).`,
      );
    } catch {
      showError(
        'Required Fields Missing',
        'Please review all required fields before saving.',
      );
    }
  }

  function updateStatus(
    po: PurchaseOrder,
    status: POStatus,
  ) {
    if (status === 'Approved') {
      const review =
        analyzePurchaseOrder(po);

      if (review.status === 'Blocked') {
        setAiPurchaseOrder(po);
        setAiReview(review);
        setAiOpen(true);

        showError(
          'AI Approval Blocked',
          <div>
            <p>
              Resolve the following blocking
              issues before approving this
              Purchase Order:
            </p>

            <ul style={{ paddingLeft: 20 }}>
              {review.issues.map(
                (issue, index) => (
                  <li
                    key={`${issue}-${index}`}
                  >
                    {issue}
                  </li>
                ),
              )}
            </ul>
          </div>,
        );

        return;
      }
    }

    const now = new Date().toISOString();

    const next = purchaseOrders.map(
      (record) => {
        if (record.id !== po.id) {
          return record;
        }

        const updated: PurchaseOrder = {
          ...record,
          status,
          updatedAt: now,
          approvedAt:
            status === 'Approved'
              ? now
              : record.approvedAt,
          closedAt:
            status === 'Closed'
              ? now
              : record.closedAt,
          cancelledAt:
            status === 'Cancelled'
              ? now
              : record.cancelledAt,
        };

        return applyAIReview(
          updated,
          analyzePurchaseOrder(updated),
        );
      },
    );

    persistPOs(next);

    showSuccess(
      'Purchase Order Status Updated',
      `${po.poNo} was marked as ${status}.`,
    );
  }

  function deletePO(po: PurchaseOrder) {
    persistPOs(
      purchaseOrders.filter(
        (record) => record.id !== po.id,
      ),
    );

    showSuccess(
      'Purchase Order Deleted',
      `${po.poNo} was deleted.`,
    );
  }

  function duplicatePO(po: PurchaseOrder) {
    const now = new Date().toISOString();

    const copied: PurchaseOrder = {
      ...po,
      id: makeId(),
      poNo: buildPONo(),
      status: 'Draft',
      items: po.items.map(
        (item, index) => ({
          ...normalizePOItem(item, index),
          id: makeId(),
          lineNo: index + 1,
          receivedQty: 0,
        }),
      ),
      aiStatus: undefined,
      aiScore: undefined,
      aiIssues: undefined,
      aiWarnings: undefined,
      aiRecommendations: undefined,
      aiReviewedAt: undefined,
      createdAt: now,
      updatedAt: now,
      approvedAt: undefined,
      closedAt: undefined,
      cancelledAt: undefined,
    };

    const reviewedCopy = applyAIReview(
      copied,
      analyzePurchaseOrder(copied),
    );

    persistPOs([
      reviewedCopy,
      ...purchaseOrders,
    ]);

    showSuccess(
      'Purchase Order Duplicated',
      `${reviewedCopy.poNo} was created as Draft with ${reviewedCopy.items.length} line(s).`,
    );
  }

  /* ==========================================================================
   * CSV Export and Template
   * ======================================================================== */

  const csvHeaders = [
    'PO No',
    'Supplier Code',
    'Supplier Name',
    'PO Date',
    'Expected Date',
    'Status',
    'Line No',
    'Product Code',
    'SKU',
    'Product Name',
    'Category',
    'Storage Type',
    'Plant',
    'Location',
    'UOM',
    'Order Qty',
    'Received Qty',
    'Remarks',
  ];

  function exportPOs() {
    const lines = filteredPOs.flatMap(
      (po) =>
        po.items.map((item) =>
          [
            po.poNo,
            po.supplierCode,
            po.supplierName,
            po.poDate,
            po.expectedDate,
            po.status,
            item.lineNo,
            item.productCode,
            item.sku,
            item.productName,
            item.category || '',
            item.storageType || '',
            item.plant,
            item.location || '',
            item.uom,
            item.orderQty,
            item.receivedQty,
            item.remarks ||
              po.remarks ||
              '',
          ]
            .map(escapeCsv)
            .join(','),
        ),
    );

    downloadTextFile(
      `purchase_orders_${dayjs().format(
        'YYYYMMDD_HHmmss',
      )}.csv`,
      [
        csvHeaders.join(','),
        ...lines,
      ].join('\n'),
    );
  }

  function downloadTemplate() {
    const sampleLines = [
      [
        'PO-20250101-0001',
        'SUP-001',
        'ABC Supplier Sdn Bhd',
        '2025-01-01',
        '2025-01-08',
        'Draft',
        '1',
        'SKU-RAW-001',
        'SKU-RAW-001',
        'Raw Material A',
        'Raw Material',
        'Ambient',
        'PLANT-01',
        'RM-AREA',
        'KG',
        '100',
        '0',
        'First PO line',
      ],
      [
        'PO-20250101-0001',
        'SUP-001',
        'ABC Supplier Sdn Bhd',
        '2025-01-01',
        '2025-01-08',
        'Draft',
        '2',
        'SKU-RAW-002',
        'SKU-RAW-002',
        'Raw Material B',
        'Raw Material',
        'Ambient',
        'PLANT-01',
        'RM-AREA',
        'KG',
        '200',
        '0',
        'Second PO line',
      ],
      [
        '',
        '',
        '',
        '',
        '',
        '',
        '3',
        'SKU-PKG-001',
        'SKU-PKG-001',
        'Packaging Material',
        'Packaging',
        'Ambient',
        'PLANT-01',
        'PKG-AREA',
        'PCS',
        '500',
        '0',
        'Blank PO No continues the previous PO',
      ],
    ];

    downloadTextFile(
      'purchase_order_import_template.csv',
      [
        csvHeaders.join(','),
        ...sampleLines.map((row) =>
          row.map(escapeCsv).join(','),
        ),
      ].join('\n'),
    );
  }

  /* ==========================================================================
   * Multi-Line CSV Import
   * ======================================================================== */

  function buildImportResult(
    rows: Record<string, string>[],
  ): ImportResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const imported: PurchaseOrder[] = [];

    const grouped = new Map<
      string,
      Record<string, string>[]
    >();

    let currentPONo = '';

    rows.forEach((row) => {
      const csvRowNo = readAny(
        row,
        ['__csvRowNo'],
        '?',
      );

      const suppliedPONo = normalizeCode(
        readAny(row, [
          'PO No',
          'poNo',
          'Purchase Order No',
        ]),
      );

      if (suppliedPONo) {
        currentPONo = suppliedPONo;
      }

      if (!currentPONo) {
        errors.push(
          `CSV row ${csvRowNo}: PO No is required on the first row of each PO.`,
        );
        return;
      }

      if (!grouped.has(currentPONo)) {
        grouped.set(currentPONo, []);
      }

      grouped.get(currentPONo)?.push(row);
    });

    const existingPONos = new Set(
      purchaseOrders.map((po) =>
        normalizeCode(po.poNo),
      ),
    );

    grouped.forEach(
      (groupRows, poNo) => {
        if (existingPONos.has(poNo)) {
          errors.push(
            `${poNo}: PO No already exists.`,
          );
          return;
        }

        const headerValue = (
          keys: string[],
          fallback = '',
        ) => {
          for (const row of groupRows) {
            const value = readAny(
              row,
              keys,
              '',
            );

            if (normalizeText(value)) {
              return value;
            }
          }

          return fallback;
        };

        const supplierCode = normalizeCode(
          headerValue([
            'Supplier Code',
            'supplierCode',
          ]),
        );

        let supplierName = normalizeText(
          headerValue([
            'Supplier Name',
            'supplierName',
          ]),
        );

        const supplier =
          getSupplierByCode(supplierCode);

        if (supplier && !supplierName) {
          supplierName =
            supplier.supplierName;
        }

        if (!supplierCode) {
          errors.push(
            `${poNo}: Supplier Code is required.`,
          );
        }

        if (!supplierName) {
          errors.push(
            `${poNo}: Supplier Name is required.`,
          );
        }

        if (
          supplier &&
          !isActiveStatus(supplier.status)
        ) {
          errors.push(
            `${poNo}: Supplier is inactive or blocked.`,
          );
        }

        if (
          !supplier &&
          supplierMaster.length > 0
        ) {
          warnings.push(
            `${poNo}: Supplier ${
              supplierCode || '-'
            } was not found in Supplier Master.`,
          );
        }

        const rawItems = groupRows.map(
          (row, rowIndex) => {
            const csvRowNo = readAny(
              row,
              ['__csvRowNo'],
              rowIndex + 2,
            );

            const importedLineNo =
              toNumber(
                readAny(row, [
                  'Line No',
                  'lineNo',
                  'Line',
                ]),
              ) ||
              rowIndex + 1;

            const rawProductCode =
              normalizeCode(
                readAny(row, [
                  'Product Code',
                  'productCode',
                  'Item Code',
                  'itemCode',
                ]),
              );

            const rawSku = normalizeCode(
              readAny(
                row,
                ['SKU', 'sku'],
                rawProductCode,
              ),
            );

            const product =
              getProductByCodeOrSku(
                rawProductCode || rawSku,
              );

            let item: PurchaseOrderItem = {
              id: makeId(),
              lineNo: importedLineNo,
              productCode:
                rawProductCode ||
                product?.productCode ||
                rawSku,
              sku:
                rawSku ||
                product?.sku ||
                rawProductCode,
              productName: normalizeText(
                readAny(row, [
                  'Product Name',
                  'productName',
                ]),
              ),
              category: normalizeText(
                readAny(row, [
                  'Category',
                  'category',
                ]),
              ),
              storageType: normalizeText(
                readAny(row, [
                  'Storage Type',
                  'storageType',
                ]),
              ),
              plant: normalizeCode(
                readAny(row, [
                  'Plant',
                  'plant',
                ]),
              ),
              location: normalizeText(
                readAny(row, [
                  'Location',
                  'location',
                ]),
              ),
              uom:
                normalizeCode(
                  readAny(
                    row,
                    ['UOM', 'uom'],
                    product?.uom || 'PCS',
                  ),
                ) || 'PCS',
              orderQty: toNumber(
                readAny(row, [
                  'Order Qty',
                  'orderQty',
                ]),
              ),
              receivedQty: toNumber(
                readAny(row, [
                  'Received Qty',
                  'receivedQty',
                ]),
              ),
              remarks: normalizeText(
                readAny(row, [
                  'Remarks',
                  'remarks',
                ]),
              ),
            };

            item =
              enrichItemFromProductMaster(
                item,
              );

            const lineLabel = `${poNo} Line ${item.lineNo} (CSV row ${csvRowNo})`;

            if (!item.productCode) {
              errors.push(
                `${lineLabel}: Product Code is required.`,
              );
            }

            if (!item.sku) {
              errors.push(
                `${lineLabel}: SKU is required.`,
              );
            }

            if (!item.productName) {
              errors.push(
                `${lineLabel}: Product Name is required.`,
              );
            }

            if (!item.plant) {
              errors.push(
                `${lineLabel}: Plant is required.`,
              );
            }

            if (!item.uom) {
              errors.push(
                `${lineLabel}: UOM is required.`,
              );
            }

            if (item.orderQty <= 0) {
              errors.push(
                `${lineLabel}: Order Qty must be greater than 0.`,
              );
            }

            if (item.receivedQty < 0) {
              errors.push(
                `${lineLabel}: Received Qty cannot be negative.`,
              );
            }

            if (
              item.receivedQty >
              item.orderQty
            ) {
              errors.push(
                `${lineLabel}: Received Qty cannot exceed Order Qty.`,
              );
            }

            if (
              !product &&
              productMaster.length > 0
            ) {
              warnings.push(
                `${lineLabel}: Product ${
                  rawProductCode ||
                  rawSku ||
                  '-'
                } was not found in Product Master.`,
              );
            }

            if (
              product &&
              !isActiveStatus(product.status)
            ) {
              errors.push(
                `${lineLabel}: Product ${product.productCode} is inactive or blocked.`,
              );
            }

            return {
              item,
              originalIndex: rowIndex,
            };
          },
        );

        rawItems.sort((a, b) => {
          const lineDifference =
            a.item.lineNo -
            b.item.lineNo;

          return lineDifference !== 0
            ? lineDifference
            : a.originalIndex -
                b.originalIndex;
        });

        const items = rawItems.map(
          ({ item }, index) => ({
            ...item,
            lineNo:
              item.lineNo || index + 1,
          }),
        );

        const rawStatus = normalizeText(
          headerValue(
            ['Status', 'status'],
            'Draft',
          ),
        ) as POStatus;

        const status =
          PO_STATUS_OPTIONS.includes(
            rawStatus,
          )
            ? rawStatus
            : 'Draft';

        const now =
          new Date().toISOString();

        const importedPO: PurchaseOrder = {
          id: makeId(),
          poNo,
          supplierCode,
          supplierName,
          poDate:
            normalizeDate(
              headerValue(
                ['PO Date', 'poDate'],
                today(),
              ),
            ) || today(),
          expectedDate: normalizeDate(
            headerValue([
              'Expected Date',
              'expectedDate',
            ]),
          ),
          status,
          remarks: normalizeText(
            headerValue([
              'Remarks',
              'remarks',
            ]),
          ),
          items,
          createdAt: now,
          updatedAt: now,
          approvedAt:
            status === 'Approved'
              ? now
              : undefined,
          closedAt:
            status === 'Closed'
              ? now
              : undefined,
          cancelledAt:
            status === 'Cancelled'
              ? now
              : undefined,
        };

        const review =
          analyzePurchaseOrder(
            importedPO,
          );

        imported.push(
          applyAIReview(
            importedPO,
            review,
          ),
        );
      },
    );

    return {
      purchaseOrders: imported,
      errors,
      warnings,
    };
  }

  function importFromCsvText(text: string) {
    const rows = parseCsv(text);

    if (rows.length === 0) {
      showError(
        'CSV File Is Empty',
        'No data rows were found in the selected CSV file.',
      );
      return;
    }

    const result =
      buildImportResult(rows);

    if (result.errors.length > 0) {
      showError(
        'CSV Import Validation Failed',
        <div
          style={{
            maxHeight: 420,
            overflow: 'auto',
          }}
        >
          <Alert
            type="error"
            showIcon
            title={`${result.errors.length} validation error(s) found`}
            style={{ marginBottom: 16 }}
          />

          <ul style={{ paddingLeft: 20 }}>
            {result.errors.map(
              (error, index) => (
                <li
                  key={`${error}-${index}`}
                >
                  {error}
                </li>
              ),
            )}
          </ul>
        </div>,
      );

      return;
    }

    persistPOs([
      ...result.purchaseOrders,
      ...purchaseOrders,
    ]);

    modalApi.success({
      title:
        'Purchase Order Import Completed',
      width: 720,
      content: (
        <Space
          orientation="vertical"
          style={{ width: '100%' }}
        >
          <Text>
            {
              result.purchaseOrders.length
            }{' '}
            purchase order(s) imported.
          </Text>

          <ul
            style={{
              paddingLeft: 20,
              marginBottom: 0,
            }}
          >
            {result.purchaseOrders.map(
              (po) => (
                <li key={po.id}>
                  <strong>
                    {po.poNo}
                  </strong>
                  : {po.items.length} line
                  item(s)
                </li>
              ),
            )}
          </ul>

          {result.warnings.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={`${result.warnings.length} import warning(s)`}
              description={
                <ul
                  style={{
                    paddingLeft: 20,
                    marginBottom: 0,
                  }}
                >
                  {result.warnings
                    .slice(0, 50)
                    .map(
                      (
                        warning,
                        index,
                      ) => (
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
        </Space>
      ),
    });
  }

  const uploadProps: UploadProps = {
    accept: '.csv,text/csv',
    showUploadList: false,
    beforeUpload: async (file) => {
      const text = await file.text();
      importFromCsvText(text);
      return false;
    },
  };

  /* ==========================================================================
   * Demo
   * ======================================================================== */

  function loadDemoData() {
    const now = new Date().toISOString();

    const demo: PurchaseOrder[] = [
      {
        id: makeId(),
        poNo: `PO-DEMO-${dayjs().format(
          'YYYYMMDD-HHmmss',
        )}`,
        supplierCode: 'SUP-001',
        supplierName:
          'ABC Supplier Sdn Bhd',
        poDate: today(),
        expectedDate: dayjs()
          .add(7, 'day')
          .format('YYYY-MM-DD'),
        status: 'Approved',
        remarks:
          'Demo multi-line approved purchase order.',
        createdAt: now,
        updatedAt: now,
        approvedAt: now,
        items: [
          {
            id: makeId(),
            lineNo: 1,
            productCode: 'SKU-RAW-001',
            sku: 'SKU-RAW-001',
            productName:
              'Raw Material A',
            category: 'Raw Material',
            storageType: 'Ambient',
            plant: 'PLANT-01',
            location: 'RM-AREA',
            uom: 'KG',
            orderQty: 500,
            receivedQty: 0,
            remarks: '',
          },
          {
            id: makeId(),
            lineNo: 2,
            productCode: 'SKU-RAW-002',
            sku: 'SKU-RAW-002',
            productName:
              'Raw Material B',
            category: 'Raw Material',
            storageType: 'Ambient',
            plant: 'PLANT-01',
            location: 'RM-AREA',
            uom: 'KG',
            orderQty: 300,
            receivedQty: 0,
            remarks: '',
          },
        ],
      },
      {
        id: makeId(),
        poNo: `PO-DEMO-DRAFT-${dayjs().format(
          'YYYYMMDD-HHmmss',
        )}`,
        supplierCode: 'SUP-002',
        supplierName:
          'Global Packaging Supplies',
        poDate: today(),
        expectedDate: dayjs()
          .add(10, 'day')
          .format('YYYY-MM-DD'),
        status: 'Draft',
        remarks:
          'Demo draft purchase order.',
        createdAt: now,
        updatedAt: now,
        items: [
          {
            id: makeId(),
            lineNo: 1,
            productCode: 'SKU-PKG-001',
            sku: 'SKU-PKG-001',
            productName:
              'Carton Box Large',
            category: 'Packaging',
            storageType: 'Ambient',
            plant: 'PLANT-01',
            location: 'PKG-AREA',
            uom: 'PCS',
            orderQty: 1000,
            receivedQty: 0,
            remarks: '',
          },
        ],
      },
    ];

    const reviewedDemo = demo.map((po) =>
      applyAIReview(
        po,
        analyzePurchaseOrder(po),
      ),
    );

    persistPOs([
      ...reviewedDemo,
      ...purchaseOrders,
    ]);

    showSuccess(
      'Demo Purchase Orders Loaded',
      `${reviewedDemo.length} demo Purchase Orders were created.`,
    );
  }

  /* ==========================================================================
   * Inbound Draft
   * ======================================================================== */

  function createInboundDraft(
    po: PurchaseOrder,
  ) {
    if (
      ![
        'Approved',
        'Partially Received',
      ].includes(po.status)
    ) {
      showWarning(
        'Inbound Draft Not Allowed',
        'Only Approved or Partially Received Purchase Orders can create an inbound draft.',
      );
      return;
    }

    const review =
      analyzePurchaseOrder(po);

    if (review.status === 'Blocked') {
      setAiPurchaseOrder(po);
      setAiReview(review);
      setAiOpen(true);

      showError(
        'AI Inbound Creation Blocked',
        'Resolve the blocking Purchase Order issues before creating an inbound draft.',
      );

      return;
    }

    const openItems = po.items.filter(
      (item) =>
        toNumber(item.orderQty) >
        toNumber(item.receivedQty),
    );

    if (openItems.length === 0) {
      showWarning(
        'No Open Quantity',
        'This Purchase Order has no open quantity to receive.',
      );
      return;
    }

    const inboundReceipts =
      safeJsonParse<any[]>(
        localStorage.getItem(
          INBOUND_STORAGE_KEY,
        ),
        [],
      );

    const inboundNo = buildInboundNo();
    const now = new Date().toISOString();

    const inboundDraft = {
      id: makeId(),
      receiptNo: inboundNo,
      inboundNo,
      sourceType: 'Purchase Order',
      sourceModule: 'Purchase Orders',
      sourceNo: po.poNo,
      sourceId: po.id,
      referenceType: 'Purchase Order',
      referenceNo: po.poNo,
      poNo: po.poNo,
      supplierCode: po.supplierCode,
      supplierName: po.supplierName,
      receiptDate: today(),
      expectedDate:
        po.expectedDate || today(),
      status: 'Draft',
      remarks: `Created from ${po.poNo}`,
      createdAt: now,
      updatedAt: now,

      items: openItems.map(
        (item, index) => {
          const product =
            getProductByCodeOrSku(
              item.productCode ||
                item.sku,
            );

          const openQty = Math.max(
            0,
            toNumber(item.orderQty) -
              toNumber(
                item.receivedQty,
              ),
          );

          const batchControlled =
            Boolean(
              product?.batchControlled,
            );

          const expiryControlled =
            Boolean(
              product?.expiryControlled,
            );

          return {
            id: makeId(),
            lineNo: index + 1,
            productCode:
              item.productCode,
            sku: item.sku,
            SKU:
              item.sku ||
              item.productCode,
            productName:
              item.productName,
            category:
              item.category ||
              product?.category ||
              '',
            storageType:
              item.storageType ||
              product?.storageType ||
              '',

            /*
             * Controls come from Product Master.
             * Actual values start from Inbound.
             */
            batchControlled,
            expiryControlled,
            isBatchControlled:
              batchControlled,
            isExpiryControlled:
              expiryControlled,
            requiresBatchEntry:
              batchControlled,
            requiresExpiryEntry:
              expiryControlled,

            /*
             * Never copy batch or expiry values
             * from a legacy Purchase Order.
             */
            batchNo: '',
            batchNumber: '',
            expiryDate: '',
            expiry: '',

            plant: item.plant,
            location: item.location || '',
            uom: item.uom,
            UOM: item.uom,
            orderedQty: item.orderQty,
            poQty: item.orderQty,
            openQty,

            /*
             * This is the proposed receipt quantity.
             * The inbound user may edit it before posting.
             */
            receivedQty: openQty,
            qty: openQty,
            quantity: openQty,

            remarks: item.remarks || '',
            sourceLineId: item.id,
            purchaseOrderLineId:
              item.id,
            poLineId: item.id,
          };
        },
      ),
    };

    localStorage.setItem(
      INBOUND_STORAGE_KEY,
      JSON.stringify([
        inboundDraft,
        ...inboundReceipts,
      ]),
    );

    showSuccess(
      'Inbound Draft Created',
      `${inboundNo} was created from ${po.poNo} with ${inboundDraft.items.length} line(s). Batch No and Expiry Date must be entered in Inbound Receiving where required.`,
    );
  }

  /* ==========================================================================
   * Main Table
   * ======================================================================== */

  const columns: ColumnsType<PurchaseOrder> =
    [
      {
        title: 'PO No',
        dataIndex: 'poNo',
        key: 'poNo',
        fixed: 'left',
        width: 190,
        render: (value, record) => (
          <Button
            type="link"
            style={{
              padding: 0,
              height: 'auto',
            }}
            onClick={() =>
              openViewModal(record)
            }
          >
            <Space
              orientation="vertical"
              size={0}
              align="start"
            >
              <Text strong>{value}</Text>

              <Text
                type="secondary"
                style={{ fontSize: 12 }}
              >
                {record.poDate}
              </Text>
            </Space>
          </Button>
        ),
        sorter: (a, b) =>
          a.poNo.localeCompare(b.poNo),
      },
      {
        title: 'Supplier',
        key: 'supplier',
        width: 250,
        render: (_, record) => (
          <Space
            orientation="vertical"
            size={0}
          >
            <Text>
              {record.supplierName}
            </Text>

            <Text
              type="secondary"
              style={{ fontSize: 12 }}
            >
              {record.supplierCode}
            </Text>
          </Space>
        ),
        sorter: (a, b) =>
          a.supplierName.localeCompare(
            b.supplierName,
          ),
      },
      {
        title: 'Expected Date',
        dataIndex: 'expectedDate',
        key: 'expectedDate',
        width: 140,
        render: (value) => value || '-',
        sorter: (a, b) =>
          String(
            a.expectedDate || '',
          ).localeCompare(
            String(b.expectedDate || ''),
          ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 160,
        render: (status: POStatus) => (
          <Tag color={statusColor[status]}>
            {status}
          </Tag>
        ),
        sorter: (a, b) =>
          a.status.localeCompare(b.status),
      },
      {
        title: 'AI Readiness',
        key: 'aiReadiness',
        width: 185,
        render: (_, record) => (
          <Space
            orientation="vertical"
            size={0}
          >
            <Tag
              icon={<RobotOutlined />}
              color={
                record.aiStatus
                  ? aiStatusColor[
                      record.aiStatus
                    ]
                  : 'default'
              }
            >
              {record.aiStatus ||
                'Not Checked'}
            </Tag>

            {record.aiScore !==
              undefined && (
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
        title: 'Lines',
        key: 'lines',
        width: 90,
        render: (_, record) =>
          record.items.length,
      },
      {
        title: 'Order Qty',
        key: 'orderQty',
        width: 120,
        align: 'right',
        render: (_, record) =>
          record.items
            .reduce(
              (sum, item) =>
                sum +
                toNumber(item.orderQty),
              0,
            )
            .toLocaleString(),
      },
      {
        title: 'Received Qty',
        key: 'receivedQty',
        width: 130,
        align: 'right',
        render: (_, record) =>
          record.items
            .reduce(
              (sum, item) =>
                sum +
                toNumber(
                  item.receivedQty,
                ),
              0,
            )
            .toLocaleString(),
      },
      {
        title: 'Completion',
        key: 'completion',
        width: 150,
        render: (_, record) => (
          <Progress
            percent={getPoCompletion(record)}
            size="small"
          />
        ),
        sorter: (a, b) =>
          getPoCompletion(a) -
          getPoCompletion(b),
      },
      {
        title: 'Actions',
        key: 'actions',
        fixed: 'right',
        width: 365,
        render: (_, record) => (
          <Space wrap>
            <Tooltip title="View">
              <Button
                icon={<EyeOutlined />}
                onClick={() =>
                  openViewModal(record)
                }
              />
            </Tooltip>

            <Tooltip title="AI Purchase Order Review">
              <Button
                icon={<RobotOutlined />}
                onClick={() =>
                  openAIReview(record)
                }
              />
            </Tooltip>

            <Tooltip title="Edit">
              <Button
                icon={<EditOutlined />}
                disabled={[
                  'Closed',
                  'Cancelled',
                ].includes(record.status)}
                onClick={() =>
                  openEditModal(record)
                }
              />
            </Tooltip>

            <Tooltip title="Duplicate">
              <Button
                icon={<CopyOutlined />}
                onClick={() =>
                  duplicatePO(record)
                }
              />
            </Tooltip>

            <Tooltip title="Approve">
              <Button
                icon={
                  <CheckCircleOutlined />
                }
                disabled={
                  record.status !== 'Draft'
                }
                onClick={() =>
                  updateStatus(
                    record,
                    'Approved',
                  )
                }
              />
            </Tooltip>

            <Tooltip title="Create Inbound Draft">
              <Button
                icon={<FileAddOutlined />}
                disabled={
                  ![
                    'Approved',
                    'Partially Received',
                  ].includes(
                    record.status,
                  )
                }
                onClick={() =>
                  createInboundDraft(
                    record,
                  )
                }
              />
            </Tooltip>

            <Tooltip title="Cancel PO">
              <Button
                icon={
                  <CloseCircleOutlined />
                }
                disabled={[
                  'Closed',
                  'Cancelled',
                ].includes(record.status)}
                onClick={() =>
                  updateStatus(
                    record,
                    'Cancelled',
                  )
                }
              />
            </Tooltip>

            <Popconfirm
              title="Delete Purchase Order?"
              description="This action cannot be undone."
              onConfirm={() =>
                deletePO(record)
              }
            >
              <Button
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Space>
        ),
      },
    ];

  /* ==========================================================================
   * Render
   * ======================================================================== */

  return (
    <div style={{ padding: 24 }}>
      {modalContextHolder}

      <Space
        orientation="vertical"
        size="large"
        style={{ width: '100%' }}
      >
        <Row
          justify="space-between"
          align="middle"
          gutter={[16, 16]}
        >
          <Col>
            <Title
              level={3}
              style={{ margin: 0 }}
            >
              🧾 Purchase Orders
            </Title>

            <Text type="secondary">
              Manage supplier Purchase
              Orders, multi-line CSV imports,
              inbound preparation, and AI
              readiness review.
            </Text>
          </Col>

          <Col>
            <Space wrap>
              <Button
                icon={<RobotOutlined />}
                onClick={
                  reviewAllPurchaseOrders
                }
              >
                AI Review All
              </Button>

              <Button
                icon={<DownloadOutlined />}
                onClick={downloadTemplate}
              >
                Template
              </Button>

              <Upload {...uploadProps}>
                <Button
                  icon={<ImportOutlined />}
                >
                  Import CSV
                </Button>
              </Upload>

              <Button
                icon={<ExportOutlined />}
                onClick={exportPOs}
              >
                Export CSV
              </Button>

              <Button
                icon={<ReloadOutlined />}
                onClick={() =>
                  loadMasters(true)
                }
              >
                Refresh Masters
              </Button>

              <Button
                icon={
                  <AppstoreOutlined />
                }
                onClick={() => {
                  window.location.href =
                    '/dashboard/master/product';
                }}
              >
                Product Master
              </Button>

              <Button
                icon={<ReloadOutlined />}
                onClick={loadDemoData}
              >
                Demo Data
              </Button>

              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
              >
                New PO
              </Button>
            </Space>
          </Col>
        </Row>

        <Alert
          type="info"
          showIcon
          title="Purchase Order and Inbound workflow"
          description="Purchase Orders contain supplier, product, plant, location, quantity, and UOM information. Batch No and Expiry Date are not entered in the Purchase Order. These values must be entered during Inbound Receiving based on the controls configured in Product Master."
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic
                title="Total POs"
                value={summary.total}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic
                title="Draft"
                value={summary.draft}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic
                title="Approved"
                value={summary.approved}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic
                title="Partially Received"
                value={summary.partial}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic
                title="Open Qty"
                value={summary.openQty}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic
                title="AI Risk"
                value={summary.aiRisk}
                styles={{
                  content: {
                    color:
                      summary.aiRisk > 0
                        ? '#cf1322'
                        : undefined,
                  },
                }}
              />
            </Card>
          </Col>
        </Row>

        <Card>
          <Row
            gutter={[16, 16]}
            align="middle"
          >
            <Col xs={24} md={12}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Search PO no, supplier, SKU, product, plant, location..."
                value={searchText}
                onChange={(event) =>
                  setSearchText(
                    event.target.value,
                  )
                }
              />
            </Col>

            <Col xs={24} md={6}>
              <Select
                style={{ width: '100%' }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  {
                    value: 'All',
                    label: 'All Status',
                  },
                  ...PO_STATUS_OPTIONS.map(
                    (status) => ({
                      value: status,
                      label: status,
                    }),
                  ),
                ]}
              />
            </Col>

            <Col xs={24} md={6}>
              <Text type="secondary">
                Showing {filteredPOs.length}{' '}
                of {purchaseOrders.length}
              </Text>
            </Col>
          </Row>
        </Card>

        <Card>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredPOs}
            scroll={{ x: 1850 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) =>
                `${total} record(s)`,
            }}
            expandable={{
              expandedRowRender: (record) => (
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  dataSource={record.items}
                  scroll={{ x: 1100 }}
                  columns={[
                    {
                      title: 'Line',
                      dataIndex: 'lineNo',
                      width: 70,
                    },
                    {
                      title: 'Product Code',
                      dataIndex:
                        'productCode',
                    },
                    {
                      title: 'SKU',
                      dataIndex: 'sku',
                    },
                    {
                      title: 'Product Name',
                      dataIndex:
                        'productName',
                    },
                    {
                      title: 'Category',
                      dataIndex: 'category',
                    },
                    {
                      title: 'Storage',
                      dataIndex:
                        'storageType',
                    },
                    {
                      title: 'Plant',
                      dataIndex: 'plant',
                    },
                    {
                      title: 'Location',
                      dataIndex: 'location',
                    },
                    {
                      title: 'UOM',
                      dataIndex: 'uom',
                      width: 80,
                    },
                    {
                      title: 'Order Qty',
                      dataIndex: 'orderQty',
                      align: 'right',
                      render: (
                        value: number,
                      ) =>
                        Number(
                          value || 0,
                        ).toLocaleString(),
                    },
                    {
                      title: 'Received Qty',
                      dataIndex:
                        'receivedQty',
                      align: 'right',
                      render: (
                        value: number,
                      ) =>
                        Number(
                          value || 0,
                        ).toLocaleString(),
                    },
                  ]}
                />
              ),
            }}
          />
        </Card>
      </Space>

      {/* Create / Edit / View Modal */}
      <Modal
        open={modalOpen}
        title={
          modalMode === 'create'
            ? 'Create Purchase Order'
            : modalMode === 'edit'
              ? 'Edit Purchase Order'
              : 'View Purchase Order'
        }
        width={1200}
        onCancel={() =>
          setModalOpen(false)
        }
        destroyOnHidden
        footer={
          isViewMode
            ? [
                <Button
                  key="ai"
                  icon={<RobotOutlined />}
                  onClick={() => {
                    if (activePO) {
                      openAIReview(activePO);
                    }
                  }}
                >
                  AI Review
                </Button>,
                <Button
                  key="close"
                  onClick={() =>
                    setModalOpen(false)
                  }
                >
                  Close
                </Button>,
              ]
            : [
                <Button
                  key="cancel"
                  onClick={() =>
                    setModalOpen(false)
                  }
                >
                  Cancel
                </Button>,
                <Button
                  key="save"
                  type="primary"
                  onClick={handleSave}
                >
                  Save
                </Button>,
              ]
        }
      >
        <Form
          form={form}
          layout="vertical"
          disabled={isViewMode}
        >
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item
                name="poNo"
                label="PO No"
                rules={[
                  {
                    required: true,
                    message:
                      'PO No is required',
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item
                name="supplierCode"
                label="Supplier Code"
                rules={[
                  {
                    required: true,
                    message:
                      'Supplier Code is required',
                  },
                ]}
              >
                <AutoComplete
                  allowClear
                  virtual={false}
                  options={supplierOptions}
                  placeholder="Select supplier"
                  onSelect={
                    handleSupplierSelect
                  }
                  onBlur={() => {
                    const value =
                      form.getFieldValue(
                        'supplierCode',
                      );

                    if (value) {
                      handleSupplierSelect(
                        value,
                      );
                    }
                  }}
                  filterOption={(
                    inputValue,
                    option,
                  ) =>
                    normalizeLower(
                      option?.label,
                    ).includes(
                      normalizeLower(
                        inputValue,
                      ),
                    ) ||
                    normalizeLower(
                      option?.value,
                    ).includes(
                      normalizeLower(
                        inputValue,
                      ),
                    )
                  }
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="supplierName"
                label="Supplier Name"
                rules={[
                  {
                    required: true,
                    message:
                      'Supplier Name is required',
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item
                name="poDate"
                label="PO Date"
                rules={[
                  {
                    required: true,
                    message:
                      'PO Date is required',
                  },
                ]}
              >
                <DatePicker
                  style={{
                    width: '100%',
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item
                name="expectedDate"
                label="Expected Date"
              >
                <DatePicker
                  style={{
                    width: '100%',
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item
                name="status"
                label="Status"
              >
                <Select
                  options={PO_STATUS_OPTIONS.map(
                    (status) => ({
                      value: status,
                      label: status,
                    }),
                  )}
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name="remarks"
                label="Remarks"
              >
                <TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="start">
            PO Items
          </Divider>

          <Alert
            type="info"
            showIcon
            title="Batch and expiry information"
            description="Batch No and Expiry Date are intentionally not entered in the Purchase Order. Warehouse personnel will enter these values during Inbound Receiving."
            style={{ marginBottom: 16 }}
          />

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <Space
                orientation="vertical"
                style={{ width: '100%' }}
              >
                {!isViewMode && (
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add(
                        defaultItem(
                          fields.length + 1,
                        ),
                      )
                    }
                  >
                    Add Item
                  </Button>
                )}

                {fields.map(
                  (field, index) => (
                    <Card
                      key={field.key}
                      size="small"
                      title={`Line ${
                        index + 1
                      }`}
                      extra={
                        !isViewMode &&
                        fields.length > 1 ? (
                          <Button
  danger
  size="small"
  onClick={() => remove(field.name)}
>
  Remove
</Button>
) : null
}
>
<Form.Item name={[field.name, 'id']} hidden>
  <Input />
</Form.Item>

<Form.Item name={[field.name, 'lineNo']} hidden>
  <InputNumber />
</Form.Item>

<Row gutter={16}>
  <Col xs={24} md={4}>
    <Form.Item
      name={[field.name, 'productCode']}
      label="Product Code"
      rules={[
        {
          required: true,
          message: 'Required',
        },
      ]}
    >
      <AutoComplete
        allowClear
        virtual={false}
        options={productCodeOptions}
        placeholder="Select product"
        onSelect={(value) =>
          handleProductSelect(field.name, value)
        }
        onBlur={() => {
          const value = form.getFieldValue([
            'items',
            field.name,
            'productCode',
          ]);

          if (value) {
            handleProductSelect(field.name, value);
          }
        }}
        filterOption={(inputValue, option) =>
          normalizeLower(option?.label).includes(
            normalizeLower(inputValue),
          ) ||
          normalizeLower(option?.value).includes(
            normalizeLower(inputValue),
          )
        }
      />
    </Form.Item>
  </Col>

  <Col xs={24} md={4}>
    <Form.Item
      name={[field.name, 'sku']}
      label="SKU"
      rules={[
        {
          required: true,
          message: 'Required',
        },
      ]}
    >
      <AutoComplete
        allowClear
        virtual={false}
        options={skuOptions}
        placeholder="Select SKU"
        onSelect={(value) =>
          handleProductSelect(field.name, value)
        }
        onBlur={() => {
          const value = form.getFieldValue([
            'items',
            field.name,
            'sku',
          ]);

          if (value) {
            handleProductSelect(field.name, value);
          }
        }}
        filterOption={(inputValue, option) =>
          normalizeLower(option?.label).includes(
            normalizeLower(inputValue),
          ) ||
          normalizeLower(option?.value).includes(
            normalizeLower(inputValue),
          )
        }
      />
    </Form.Item>
  </Col>

  <Col xs={24} md={6}>
    <Form.Item
      name={[field.name, 'productName']}
      label="Product Name"
      rules={[
        {
          required: true,
          message: 'Required',
        },
      ]}
    >
      <Input />
    </Form.Item>
  </Col>

  <Col xs={24} md={3}>
    <Form.Item
      name={[field.name, 'category']}
      label="Category"
    >
      <Input placeholder="Auto-fill" />
    </Form.Item>
  </Col>

  <Col xs={24} md={3}>
    <Form.Item
      name={[field.name, 'storageType']}
      label="Storage"
    >
      <Input placeholder="Ambient" />
    </Form.Item>
  </Col>

  <Col xs={24} md={3}>
    <Form.Item
      name={[field.name, 'plant']}
      label="Plant"
      rules={[
        {
          required: true,
          message: 'Required',
        },
      ]}
    >
      <AutoComplete
        allowClear
        virtual={false}
        options={plantOptions}
        placeholder="Plant"
        filterOption={(inputValue, option) =>
          normalizeLower(option?.label).includes(
            normalizeLower(inputValue),
          ) ||
          normalizeLower(option?.value).includes(
            normalizeLower(inputValue),
          )
        }
      />
    </Form.Item>
  </Col>

  <Col xs={24} md={3}>
    <Form.Item
      name={[field.name, 'location']}
      label="Location"
    >
      <Input />
    </Form.Item>
  </Col>

  <Col xs={24} md={3}>
    <Form.Item
      name={[field.name, 'uom']}
      label="UOM"
      rules={[
        {
          required: true,
          message: 'Required',
        },
      ]}
    >
      <AutoComplete
        allowClear
        virtual={false}
        options={uomOptions}
        placeholder="UOM"
        filterOption={(inputValue, option) =>
          normalizeLower(option?.label).includes(
            normalizeLower(inputValue),
          ) ||
          normalizeLower(option?.value).includes(
            normalizeLower(inputValue),
          )
        }
      />
    </Form.Item>
  </Col>

  <Col xs={24} md={4}>
    <Form.Item
      name={[field.name, 'orderQty']}
      label="Order Qty"
      rules={[
        {
          required: true,
          message: 'Required',
        },
      ]}
    >
      <InputNumber
        min={0}
        precision={3}
        style={{ width: '100%' }}
      />
    </Form.Item>
  </Col>

  <Col xs={24} md={4}>
    <Form.Item
      name={[field.name, 'receivedQty']}
      label="Received Qty"
    >
      <InputNumber
        min={0}
        precision={3}
        style={{ width: '100%' }}
      />
    </Form.Item>
  </Col>

  <Col xs={24} md={10}>
    <Form.Item
      name={[field.name, 'remarks']}
      label="Line Remarks"
    >
      <Input />
    </Form.Item>
  </Col>
</Row>
</Card>
),
)}
</Space>
)}
</Form.List>
</Form>

{isViewMode && activePO && (
<>
  <Divider titlePlacement="start">
    Document Audit
  </Divider>

  <Descriptions bordered size="small" column={2}>
    <Descriptions.Item label="AI Status">
      <Tag
        color={
          activePO.aiStatus
            ? aiStatusColor[activePO.aiStatus]
            : 'default'
        }
      >
        {activePO.aiStatus || 'Not Checked'}
      </Tag>
    </Descriptions.Item>

    <Descriptions.Item label="AI Score">
      {activePO.aiScore !== undefined
        ? `${activePO.aiScore}/100`
        : '-'}
    </Descriptions.Item>

    <Descriptions.Item label="Created At">
      {activePO.createdAt}
    </Descriptions.Item>

    <Descriptions.Item label="Updated At">
      {activePO.updatedAt}
    </Descriptions.Item>

    <Descriptions.Item label="Approved At">
      {activePO.approvedAt || '-'}
    </Descriptions.Item>

    <Descriptions.Item label="Closed At">
      {activePO.closedAt || '-'}
    </Descriptions.Item>

    <Descriptions.Item label="Cancelled At">
      {activePO.cancelledAt || '-'}
    </Descriptions.Item>

    <Descriptions.Item label="AI Reviewed At">
      {activePO.aiReviewedAt || '-'}
    </Descriptions.Item>
  </Descriptions>
</>
)}
</Modal>

{/* AI Review Modal */}
<Modal
open={aiOpen}
title={
  <Space>
    <RobotOutlined />
    AI Purchase Order Assistant
  </Space>
}
width={900}
destroyOnHidden
onCancel={() => setAiOpen(false)}
footer={[
  <Button
    key="close"
    onClick={() => setAiOpen(false)}
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
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} md={8}>
          <Statistic
            title="AI Readiness"
            value={aiReview.status}
            prefix={<RobotOutlined />}
            styles={{
              content: {
                fontSize: 18,
                color:
                  aiReview.status === 'Blocked'
                    ? '#cf1322'
                    : aiReview.status === 'Ready'
                      ? '#3f8600'
                      : '#fa8c16',
              },
            }}
          />
        </Col>

        <Col xs={24} md={16}>
          <Text strong>Readiness Score</Text>

          <Progress
            percent={aiReview.score}
            status={
              aiReview.status === 'Blocked'
                ? 'exception'
                : aiReview.status === 'Ready'
                  ? 'success'
                  : 'active'
            }
          />
        </Col>
      </Row>
    </Card>

    {aiPurchaseOrder && (
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="PO No">
          {aiPurchaseOrder.poNo}
        </Descriptions.Item>

        <Descriptions.Item label="Status">
          <Tag color={statusColor[aiPurchaseOrder.status]}>
            {aiPurchaseOrder.status}
          </Tag>
        </Descriptions.Item>

        <Descriptions.Item label="Supplier">
          {aiPurchaseOrder.supplierCode} -{' '}
          {aiPurchaseOrder.supplierName}
        </Descriptions.Item>

        <Descriptions.Item label="Lines">
          {aiPurchaseOrder.items.length}
        </Descriptions.Item>

        <Descriptions.Item label="PO Date">
          {aiPurchaseOrder.poDate}
        </Descriptions.Item>

        <Descriptions.Item label="Expected Date">
          {aiPurchaseOrder.expectedDate || '-'}
        </Descriptions.Item>
      </Descriptions>
    )}

    {aiReview.issues.length > 0 && (
      <Alert
        type="error"
        showIcon
        icon={<ExclamationCircleOutlined />}
        title="Blocking Issues"
        description={
          <ul
            style={{
              marginBottom: 0,
              paddingLeft: 20,
            }}
          >
            {aiReview.issues.map((issue, index) => (
              <li key={`${issue}-${index}`}>
                {issue}
              </li>
            ))}
          </ul>
        }
      />
    )}

    {aiReview.warnings.length > 0 && (
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        title="Warnings"
        description={
          <ul
            style={{
              marginBottom: 0,
              paddingLeft: 20,
            }}
          >
            {aiReview.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>
                {warning}
              </li>
            ))}
          </ul>
        }
      />
    )}

    <Alert
      type="info"
      showIcon
      icon={<RobotOutlined />}
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
              <li key={`${recommendation}-${index}`}>
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
      The AI assistant checks supplier status, Product
      Master linkage, quantity consistency, UOM,
      duplicate lines, dates, overdue risk, receiving
      progress, approval readiness, and inbound creation
      readiness. Batch No and Expiry Date are validated
      only during Inbound Receiving.
    </Paragraph>
  </Space>
) : (
  <Alert
    type="info"
    showIcon
    title="No AI review result"
    description="Run the AI Purchase Order review to display readiness results."
  />
)}
</Modal>
</div>
);
}