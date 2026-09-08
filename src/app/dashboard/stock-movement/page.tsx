'use client';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Input,
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
  DeleteOutlined,
  ExclamationCircleOutlined,
  ExportOutlined,
  EyeOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const MOVEMENT_STORAGE_KEY =
  'wms_stock_movements';
const MOVEMENT_COMPAT_STORAGE_KEY =
  'wms_inventory_movements';

const INVENTORY_STORAGE_KEY = 'wms_inventory';
const INVENTORY_COMPAT_STORAGE_KEY =
  'wms_inventory_management';

const PRODUCT_MASTER_KEYS = [
  'wms_product_master',
  'wms_products',
  'master_products_v1',
  'products',
  'productData',
];

type MovementDirection =
  | 'IN'
  | 'OUT'
  | 'ADJUSTMENT'
  | 'TRANSFER'
  | string;

type AIStatus = 'Healthy' | 'Review' | 'Critical';

interface StockMovement {
  id: string;
  movementNo: string;
  type: string;
  movementType: string;
  direction: MovementDirection;
  referenceType: string;
  referenceNo: string;
  sourceModule: string;
  sourceId: string;
  sourceLineId: string;
  productCode: string;
  sku: string;
  productName: string;
  batchNo: string;
  plant: string;
  location: string;
  expiryDate: string;
  uom: string;
  qty: number;
  remarks: string;
  createdAt: string;
  movementDate: string;
  date: string;

  aiStatus?: AIStatus;
  aiScore?: number;
  aiIssues?: string[];
  aiWarnings?: string[];
  aiRecommendations?: string[];
  aiReviewedAt?: string;

  raw?: any;
}

interface ProductMasterRecord {
  productCode: string;
  sku: string;
  productName: string;
  status: string;
  uom: string;
  baseUom: string;
  purchaseUom: string;
  salesUom: string;
  batchControlled: boolean;
  expiryControlled: boolean;
}

interface InventoryRecord {
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
}

interface MovementAIReview {
  status: AIStatus;
  score: number;
  issues: string[];
  warnings: string[];
  recommendations: string[];
  positives: string[];
  reviewedAt: string;
}

interface LedgerAIReview extends MovementAIReview {
  totalMovements: number;
  healthyMovements: number;
  reviewMovements: number;
  criticalMovements: number;
  duplicateGroups: number;
  missingReferences: number;
  unusualQtyMovements: number;
  adjustmentRatio: number;
  expiredMovements: number;
  directionMismatch: number;
  transferPairingWarnings: number;
  negativeInventoryRows: number;
  movementResults: Record<
    string,
    MovementAIReview
  >;
}

function uid(prefix = 'MOV') {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
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

  const directMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})/,
  );

  if (directMatch) {
    return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;
  }

  const slashMatch = text.match(
    /^(\d{4})\/(\d{2})\/(\d{2})/,
  );

  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2]}-${slashMatch[3]}`;
  }

  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toISOString().slice(0, 10);
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

function asBoolean(
  value: any,
  fallback = false,
) {
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
    ['true', 'yes', 'y', '1', 'active'].includes(
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
  if (!obj || typeof obj !== 'object') {
    return fallback;
  }

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
    const value = normalizedMap.get(
      normalizeKey(key),
    );

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

  const blob = new Blob([content], {
    type: mime,
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

function inferDirection(type: string) {
  const normalized = normalizeText(type);

  if (
    normalized.includes('transfer') ||
    normalized.includes('relocation')
  ) {
    return 'TRANSFER';
  }

  if (
    normalized.includes('adjust') ||
    normalized.includes('shrink') ||
    normalized.includes('write-off') ||
    normalized.includes('write off') ||
    normalized.includes('count variance')
  ) {
    return 'ADJUSTMENT';
  }

  if (
    normalized.includes('issue') ||
    normalized.includes('outbound') ||
    normalized.includes('shipment') ||
    normalized.includes('ship') ||
    normalized.includes('dispatch') ||
    normalized.includes('pick')
  ) {
    return 'OUT';
  }

  if (
    normalized.includes('receipt') ||
    normalized.includes('inbound') ||
    normalized.includes('receive') ||
    normalized.includes('goods receipt') ||
    normalized.includes('putaway')
  ) {
    return 'IN';
  }

  return 'IN';
}

function normalizeDirection(
  direction: any,
  movementType: string,
) {
  const value = normalizeText(direction);

  if (
    value === 'in' ||
    value === 'inbound' ||
    value === 'receipt'
  ) {
    return 'IN';
  }

  if (
    value === 'out' ||
    value === 'outbound' ||
    value === 'issue'
  ) {
    return 'OUT';
  }

  if (
    value === 'transfer' ||
    value === 'move'
  ) {
    return 'TRANSFER';
  }

  if (
    value === 'adjustment' ||
    value === 'adjust'
  ) {
    return 'ADJUSTMENT';
  }

  return String(
    direction || inferDirection(movementType),
  )
    .trim()
    .toUpperCase();
}

function normalizeMovement(raw: any): StockMovement {
  const now = new Date().toISOString();

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

  const movementType = String(
    readAny(
      raw,
      [
        'movementType',
        'Movement Type',
        'type',
        'Type',
      ],
      'Stock Movement',
    ),
  ).trim();

  const direction = normalizeDirection(
    readAny(
      raw,
      ['direction', 'Direction'],
      inferDirection(movementType),
    ),
    movementType,
  );

  const qty = asNumber(
    readAny(
      raw,
      [
        'qty',
        'Qty',
        'quantity',
        'Quantity',
        'movementQty',
        'Movement Qty',
      ],
      0,
    ),
    0,
  );

  const movementDate = String(
    readAny(
      raw,
      [
        'movementDate',
        'Movement Date',
        'date',
        'Date',
        'createdAt',
        'Created At',
      ],
      now,
    ),
  ).trim();

  const aiStatusValue = String(
    readAny(raw, ['aiStatus', 'AI Status'], ''),
  ).trim() as AIStatus;

  return {
    id: String(
      readAny(raw, ['id', 'ID'], uid('MOV')),
    ).trim(),

    movementNo:
      String(
        readAny(
          raw,
          ['movementNo', 'Movement No'],
          '',
        ),
      ).trim() || uid('MOV-NO'),

    type:
      String(
        readAny(
          raw,
          ['type', 'Type'],
          movementType,
        ),
      ).trim() || movementType,

    movementType,
    direction,

    referenceType: String(
      readAny(raw, [
        'referenceType',
        'Reference Type',
        'refType',
        'Ref Type',
      ]),
    ).trim(),

    referenceNo: String(
      readAny(raw, [
        'referenceNo',
        'Reference No',
        'refNo',
        'Ref No',
      ]),
    ).trim(),

    sourceModule: String(
      readAny(raw, [
        'sourceModule',
        'Source Module',
      ]),
    ).trim(),

    sourceId: String(
      readAny(raw, ['sourceId', 'Source ID']),
    ).trim(),

    sourceLineId: String(
      readAny(raw, [
        'sourceLineId',
        'Source Line ID',
      ]),
    ).trim(),

    productCode,
    sku,

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
        'storageLocation',
        'Storage Location',
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

    qty,

    remarks: String(
      readAny(
        raw,
        ['remarks', 'Remarks', 'remark', 'Remark'],
        '',
      ),
    ).trim(),

    createdAt: String(
      readAny(
        raw,
        ['createdAt', 'Created At'],
        movementDate || now,
      ),
    ).trim(),

    movementDate,

    date: String(
      readAny(
        raw,
        ['date', 'Date'],
        movementDate || now,
      ),
    ).trim(),

    aiStatus: [
      'Healthy',
      'Review',
      'Critical',
    ].includes(aiStatusValue)
      ? aiStatusValue
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

    aiReviewedAt: String(
      raw?.aiReviewedAt || '',
    ),

    raw,
  };
}

function normalizeProduct(
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
    ]),
  ).trim();

  const salesUom = String(
    readAny(raw, [
      'salesUom',
      'Sales UOM',
    ]),
  ).trim();

  return {
    productCode,
    sku,

    productName: String(
      readAny(raw, [
        'productName',
        'Product Name',
        'productDescription',
        'Product Description',
        'description',
        'Description',
        'name',
        'Name',
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

    uom:
      purchaseUom ||
      baseUom ||
      String(
        readAny(
          raw,
          ['uom', 'UOM'],
          'PCS',
        ),
      ).trim() ||
      'PCS',

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
      ]),
      false,
    ),
  };
}

function normalizeInventory(
  raw: any,
): InventoryRecord {
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

  const batchQty = asNumber(
    readAny(
      raw,
      [
        'batchQty',
        'Batch Qty',
        'qty',
        'Qty',
        'quantity',
        'Quantity',
        'balanceQty',
        'Balance Qty',
        'onHandQty',
        'On Hand Qty',
      ],
      0,
    ),
    0,
  );

  const availableRaw = readAny(raw, [
    'availableQty',
    'Available Qty',
    'available',
    'Available',
  ]);

  return {
    id: String(
      readAny(raw, ['id', 'ID'], uid('INV')),
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
      readAny(raw, ['plant', 'Plant']),
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
          ['uom', 'UOM'],
          'PCS',
        ),
      ).trim() || 'PCS',

    batchQty,

    availableQty:
      availableRaw === ''
        ? batchQty
        : asNumber(availableRaw, batchQty),

    status:
      String(
        readAny(
          raw,
          ['status', 'Status'],
          'Available',
        ),
      ).trim() || 'Available',
  };
}

function movementDedupKey(
  movement: StockMovement,
) {
  if (movement.id) {
    return `id:${movement.id}`;
  }

  return [
    movement.movementNo,
    movement.referenceNo,
    movement.sourceLineId,
    movement.productCode,
    movement.batchNo,
    movement.plant,
    movement.location,
    movement.expiryDate,
    movement.qty,
  ]
    .map(normalizeText)
    .join('|');
}

function movementBusinessKey(
  movement: StockMovement,
) {
  return [
    movement.movementNo,
    movement.referenceNo,
    movement.sourceLineId,
    movement.productCode,
    movement.batchNo,
    movement.plant,
    movement.location,
    movement.expiryDate,
    movement.direction,
    movement.qty,
  ]
    .map(normalizeText)
    .join('|');
}

function movementDateOnly(value: string) {
  return normalizeDate(value);
}

function movementTimestamp(
  movement: StockMovement,
) {
  const value =
    movement.movementDate ||
    movement.date ||
    movement.createdAt;

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function daysBetween(
  fromDateValue: string,
  toDateValue: string,
) {
  const fromDate = new Date(
    `${normalizeDate(fromDateValue)}T00:00:00`,
  );

  const toDate = new Date(
    `${normalizeDate(toDateValue)}T00:00:00`,
  );

  if (
    Number.isNaN(fromDate.getTime()) ||
    Number.isNaN(toDate.getTime())
  ) {
    return null;
  }

  return Math.floor(
    (toDate.getTime() - fromDate.getTime()) /
      86400000,
  );
}

function directionColor(
  direction: MovementDirection,
) {
  const normalized = normalizeText(direction);

  if (normalized === 'in') return 'green';
  if (normalized === 'out') return 'red';
  if (normalized === 'transfer') return 'blue';
  if (normalized === 'adjustment') return 'orange';

  return 'default';
}

function typeColor(type: string) {
  const normalized = normalizeText(type);

  if (normalized.includes('receipt')) {
    return 'green';
  }

  if (
    normalized.includes('issue') ||
    normalized.includes('shipment')
  ) {
    return 'red';
  }

  if (normalized.includes('transfer')) {
    return 'blue';
  }

  if (
    normalized.includes('adjust') ||
    normalized.includes('shrink') ||
    normalized.includes('write')
  ) {
    return 'orange';
  }

  return 'default';
}

function aiStatusColor(status?: AIStatus) {
  if (status === 'Healthy') return 'green';
  if (status === 'Review') return 'orange';
  if (status === 'Critical') return 'red';

  return 'default';
}

function signedQty(movement: StockMovement) {
  const qty = Number(movement.qty || 0);
  const direction = normalizeText(
    movement.direction,
  );

  if (direction === 'out') {
    return -Math.abs(qty);
  }

  if (direction === 'in') {
    return Math.abs(qty);
  }

  return qty;
}

function median(values: number[]) {
  if (!values.length) return 0;

  const sorted = [...values].sort(
    (a, b) => a - b,
  );

  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (
      (sorted[middle - 1] + sorted[middle]) / 2
    );
  }

  return sorted[middle];
}

function isActiveProduct(
  product?: ProductMasterRecord,
) {
  if (!product) return true;

  return ![
    'inactive',
    'blocked',
    'disabled',
    'deleted',
    'false',
    '0',
  ].includes(normalizeText(product.status));
}

function isAvailableInventory(
  inventory: InventoryRecord,
) {
  return ![
    'blocked',
    'deleted',
    'cancelled',
    'quality hold',
    'hold',
    'quarantine',
  ].includes(normalizeText(inventory.status));
}

function buildCsv(movements: StockMovement[]) {
  const headers = [
    'Movement No',
    'Movement Date',
    'Type',
    'Direction',
    'Reference Type',
    'Reference No',
    'Source Module',
    'Product Code',
    'Product Name',
    'Batch No',
    'Plant',
    'Location',
    'Expiry Date',
    'UOM',
    'Qty',
    'Signed Qty',
    'AI Status',
    'AI Score',
    'AI Issues',
    'AI Warnings',
    'Remarks',
    'Created At',
  ];

  const lines = [headers.join(',')];

  movements.forEach((movement) => {
    lines.push(
      [
        movement.movementNo,
        movementDateOnly(
          movement.movementDate ||
            movement.date ||
            movement.createdAt,
        ),
        movement.movementType || movement.type,
        movement.direction,
        movement.referenceType,
        movement.referenceNo,
        movement.sourceModule,
        movement.productCode,
        movement.productName,
        movement.batchNo,
        movement.plant,
        movement.location,
        movement.expiryDate,
        movement.uom,
        movement.qty,
        signedQty(movement),
        movement.aiStatus || 'Not Checked',
        movement.aiScore ?? '',
        (movement.aiIssues || []).join(' | '),
        (movement.aiWarnings || []).join(' | '),
        movement.remarks,
        movement.createdAt,
      ]
        .map(csvEscape)
        .join(','),
    );
  });

  return lines.join('\n');
}

export default function StockMovementsPage() {
  const [messageApi, contextHolder] =
    message.useMessage();

  const [movements, setMovements] = useState<
    StockMovement[]
  >([]);

  const [
    selectedMovement,
    setSelectedMovement,
  ] = useState<StockMovement | null>(null);

  const [viewOpen, setViewOpen] = useState(false);

  const [searchText, setSearchText] =
    useState('');

  const [directionFilter, setDirectionFilter] =
    useState('All');

  const [typeFilter, setTypeFilter] =
    useState('All');

  const [plantFilter, setPlantFilter] =
    useState('All');

  const [aiFilter, setAiFilter] =
    useState('All');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [productMasters, setProductMasters] =
    useState<ProductMasterRecord[]>([]);

  const [inventory, setInventory] = useState<
    InventoryRecord[]
  >([]);

  const [aiModalOpen, setAiModalOpen] =
    useState(false);

  const [aiReview, setAiReview] =
    useState<MovementAIReview | null>(null);

  const [aiReviewMovement, setAiReviewMovement] =
    useState<StockMovement | null>(null);

  const [ledgerModalOpen, setLedgerModalOpen] =
    useState(false);

  const [ledgerReview, setLedgerReview] =
    useState<LedgerAIReview | null>(null);

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadAllData() {
    loadMovements();
    setProductMasters(readProductMasters());
    setInventory(readInventory());
  }

  function readProductMasters() {
    const map = new Map<
      string,
      ProductMasterRecord
    >();

    PRODUCT_MASTER_KEYS.forEach((key) => {
      const raw = safeJsonParse<any[]>(
        localStorage.getItem(key),
        [],
      );

      if (!Array.isArray(raw)) return;

      raw.forEach((item) => {
        const product = normalizeProduct(item);

        if (!product.productCode && !product.sku) {
          return;
        }

        const mapKey = normalizeText(
          product.productCode || product.sku,
        );

        if (!map.has(mapKey)) {
          map.set(mapKey, product);
        }
      });
    });

    return Array.from(map.values());
  }

  function readInventory() {
    const primary = safeJsonParse<any[]>(
      localStorage.getItem(
        INVENTORY_STORAGE_KEY,
      ),
      [],
    );

    const compat = safeJsonParse<any[]>(
      localStorage.getItem(
        INVENTORY_COMPAT_STORAGE_KEY,
      ),
      [],
    );

    const map = new Map<
      string,
      InventoryRecord
    >();

    [
      ...(Array.isArray(primary) ? primary : []),
      ...(Array.isArray(compat) ? compat : []),
    ].forEach((item) => {
      const normalized = normalizeInventory(item);

      const key =
        normalized.id ||
        [
          normalized.productCode,
          normalized.batchNo,
          normalized.plant,
          normalized.location,
          normalized.expiryDate,
        ]
          .map(normalizeText)
          .join('|');

      map.set(key, normalized);
    });

    return Array.from(map.values());
  }

  function loadMovements() {
    const primary = safeJsonParse<any[]>(
      localStorage.getItem(
        MOVEMENT_STORAGE_KEY,
      ),
      [],
    );

    const compat = safeJsonParse<any[]>(
      localStorage.getItem(
        MOVEMENT_COMPAT_STORAGE_KEY,
      ),
      [],
    );

    const merged = [
      ...(Array.isArray(primary) ? primary : []),
      ...(Array.isArray(compat) ? compat : []),
    ]
      .map(normalizeMovement)
      .filter(
        (movement) =>
          movement.productCode ||
          movement.referenceNo ||
          movement.movementNo,
      );

    const map = new Map<string, StockMovement>();

    merged.forEach((movement) => {
      map.set(
        movementDedupKey(movement),
        movement,
      );
    });

    const normalized = Array.from(
      map.values(),
    ).sort(
      (a, b) =>
        movementTimestamp(b) -
        movementTimestamp(a),
    );

    setMovements(normalized);
  }

  function saveMovements(
    nextMovements: StockMovement[],
  ) {
    const persisted = nextMovements.map(
      ({ raw, ...movement }) => movement,
    );

    localStorage.setItem(
      MOVEMENT_STORAGE_KEY,
      JSON.stringify(persisted),
    );

    localStorage.setItem(
      MOVEMENT_COMPAT_STORAGE_KEY,
      JSON.stringify(persisted),
    );

    setMovements(nextMovements);
  }

  const productLookup = useMemo(() => {
    const map = new Map<
      string,
      ProductMasterRecord
    >();

    productMasters.forEach((product) => {
      if (product.productCode) {
        map.set(
          normalizeText(product.productCode),
          product,
        );
      }

      if (product.sku) {
        map.set(
          normalizeText(product.sku),
          product,
        );
      }
    });

    return map;
  }, [productMasters]);

  function expectedDirection(
    movementType: string,
  ) {
    return inferDirection(movementType);
  }

  function directionMatchesType(
    movement: StockMovement,
  ) {
    const type = normalizeText(
      movement.movementType || movement.type,
    );

    if (
      !type ||
      type === 'stock movement' ||
      type === 'movement'
    ) {
      return true;
    }

    const expected = expectedDirection(type);
    const actual = String(
      movement.direction,
    ).toUpperCase();

    return expected === actual;
  }

  function findDuplicateMovements(
    movement: StockMovement,
    allMovements = movements,
  ) {
    const businessKey =
      movementBusinessKey(movement);

    return allMovements.filter(
      (candidate) =>
        candidate.id !== movement.id &&
        movementBusinessKey(candidate) ===
          businessKey,
    );
  }

  function findSourceLineDuplicates(
    movement: StockMovement,
    allMovements = movements,
  ) {
    if (
      !movement.sourceLineId ||
      !movement.sourceId
    ) {
      return [];
    }

    return allMovements.filter(
      (candidate) =>
        candidate.id !== movement.id &&
        normalizeText(candidate.sourceId) ===
          normalizeText(movement.sourceId) &&
        normalizeText(candidate.sourceLineId) ===
          normalizeText(movement.sourceLineId) &&
        normalizeText(candidate.direction) ===
          normalizeText(movement.direction),
    );
  }

  function isUnusualQuantity(
    movement: StockMovement,
    allMovements = movements,
  ) {
    const comparable = allMovements
      .filter(
        (candidate) =>
          candidate.id !== movement.id &&
          normalizeText(candidate.productCode) ===
            normalizeText(movement.productCode) &&
          normalizeText(candidate.direction) ===
            normalizeText(movement.direction),
      )
      .map((candidate) =>
        Math.abs(Number(candidate.qty || 0)),
      )
      .filter((qty) => qty > 0);

    if (comparable.length < 3) {
      return false;
    }

    const typicalQty = median(comparable);
    const currentQty = Math.abs(
      Number(movement.qty || 0),
    );

    if (typicalQty <= 0) return false;

    return (
      currentQty >= typicalQty * 3 &&
      currentQty > typicalQty
    );
  }

  function hasRapidRepeat(
    movement: StockMovement,
    allMovements = movements,
  ) {
    const timestamp =
      movementTimestamp(movement);

    if (!timestamp) return false;

    return allMovements.some((candidate) => {
      if (candidate.id === movement.id) {
        return false;
      }

      const sameIdentity =
        normalizeText(candidate.productCode) ===
          normalizeText(
            movement.productCode,
          ) &&
        normalizeText(candidate.batchNo) ===
          normalizeText(movement.batchNo) &&
        normalizeText(candidate.plant) ===
          normalizeText(movement.plant) &&
        normalizeText(candidate.location) ===
          normalizeText(movement.location) &&
        normalizeText(candidate.direction) ===
          normalizeText(movement.direction);

      if (!sameIdentity) return false;

      const candidateTimestamp =
        movementTimestamp(candidate);

      return (
        candidateTimestamp > 0 &&
        Math.abs(
          timestamp - candidateTimestamp,
        ) <=
          5 * 60 * 1000
      );
    });
  }

  function findTransferPair(
    movement: StockMovement,
    allMovements = movements,
  ) {
    if (
      normalizeText(movement.direction) !==
      'transfer'
    ) {
      return null;
    }

    return allMovements.find(
      (candidate) =>
        candidate.id !== movement.id &&
        normalizeText(candidate.referenceNo) ===
          normalizeText(movement.referenceNo) &&
        normalizeText(candidate.productCode) ===
          normalizeText(
            movement.productCode,
          ) &&
        normalizeText(candidate.batchNo) ===
          normalizeText(movement.batchNo) &&
        Math.abs(Number(candidate.qty || 0)) ===
          Math.abs(Number(movement.qty || 0)),
    );
  }

  function hasFEFOWarning(
    movement: StockMovement,
  ) {
    if (
      normalizeText(movement.direction) !==
        'out' ||
      !movement.expiryDate
    ) {
      return false;
    }

    const selectedExpiry = normalizeDate(
      movement.expiryDate,
    );

    return inventory.some((item) => {
      if (!isAvailableInventory(item)) {
        return false;
      }

      const sameProduct =
        normalizeText(item.productCode) ===
        normalizeText(movement.productCode);

      const samePlant =
        !movement.plant ||
        normalizeText(item.plant) ===
          normalizeText(movement.plant);

      const earlierExpiry =
        item.expiryDate &&
        normalizeDate(item.expiryDate) <
          selectedExpiry;

      return (
        sameProduct &&
        samePlant &&
        earlierExpiry &&
        Number(item.availableQty || 0) > 0
      );
    });
  }

  function matchingInventoryRows(
    movement: StockMovement,
  ) {
    return inventory.filter((item) => {
      const productMatches =
        normalizeText(item.productCode) ===
          normalizeText(
            movement.productCode,
          ) ||
        normalizeText(item.sku) ===
          normalizeText(movement.sku);

      const batchMatches =
        !movement.batchNo ||
        normalizeText(item.batchNo) ===
          normalizeText(movement.batchNo);

      const plantMatches =
        !movement.plant ||
        normalizeText(item.plant) ===
          normalizeText(movement.plant);

      const locationMatches =
        !movement.location ||
        normalizeText(item.location) ===
          normalizeText(movement.location);

      const expiryMatches =
        !movement.expiryDate ||
        normalizeDate(item.expiryDate) ===
          normalizeDate(movement.expiryDate);

      return (
        productMatches &&
        batchMatches &&
        plantMatches &&
        locationMatches &&
        expiryMatches
      );
    });
  }

  function analyzeMovement(
    movement: StockMovement,
    allMovements = movements,
  ): MovementAIReview {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const positives: string[] = [];

    const movementType =
      movement.movementType ||
      movement.type ||
      '';

    const product =
      productLookup.get(
        normalizeText(movement.productCode),
      ) ||
      productLookup.get(
        normalizeText(movement.sku),
      );

    if (!movement.movementNo) {
      issues.push('Movement No is missing.');
    }

    if (!movement.productCode) {
      issues.push(
        'Product Code / SKU is missing.',
      );
    }

    if (
      !Number.isFinite(Number(movement.qty)) ||
      Number(movement.qty) === 0
    ) {
      issues.push(
        'Movement quantity must not be zero.',
      );
    }

    if (
      normalizeText(movement.direction) ===
        'in' &&
      Number(movement.qty) < 0
    ) {
      warnings.push(
        'IN movement contains a negative quantity.',
      );
    }

    if (
      normalizeText(movement.direction) ===
        'out' &&
      Number(movement.qty) < 0
    ) {
      warnings.push(
        'OUT quantity is already negative. Confirm that the source module is not applying the sign twice.',
      );
    }

    if (!movement.referenceNo) {
      warnings.push(
        'Reference No is missing, reducing audit traceability.',
      );
    }

    if (!movement.referenceType) {
      warnings.push(
        'Reference Type is missing.',
      );
    }

    if (!movement.sourceModule) {
      warnings.push(
        'Source Module is missing.',
      );
    }

    if (!movement.sourceId) {
      warnings.push(
        'Source transaction ID is missing.',
      );
    }

    if (!movement.sourceLineId) {
      warnings.push(
        'Source line ID is missing. Line-level duplicate prevention is limited.',
      );
    }

    if (!movement.plant) {
      issues.push('Plant is missing.');
    }

    if (!movement.location) {
      warnings.push(
        'Location is blank. Bin-level stock traceability is incomplete.',
      );
    }

    if (!movement.uom) {
      issues.push('UOM is missing.');
    }

    if (!directionMatchesType(movement)) {
      issues.push(
        `Movement type "${movementType}" does not agree with direction "${movement.direction}".`,
      );

      recommendations.push(
        `Review the source-module mapping. Expected direction is ${expectedDirection(
          movementType,
        )}.`,
      );
    }

    const movementDate = movementDateOnly(
      movement.movementDate ||
        movement.date ||
        movement.createdAt,
    );

    if (!movementDate) {
      issues.push('Movement Date is missing.');
    } else {
      const futureDays = daysBetween(
        todayDate(),
        movementDate,
      );

      if (
        futureDays !== null &&
        futureDays > 1
      ) {
        issues.push(
          `Movement is future-dated by ${futureDays} days.`,
        );
      }

      const ageDays = daysBetween(
        movementDate,
        todayDate(),
      );

      if (
        ageDays !== null &&
        ageDays > 365
      ) {
        warnings.push(
          `Movement is ${ageDays} days old. Confirm that this is an intentional historical posting.`,
        );
      }
    }

    if (!product) {
      warnings.push(
        `SKU ${movement.productCode || '-'} was not found in Product Master.`,
      );

      recommendations.push(
        'Create or correct the SKU in Product Master to improve audit validation.',
      );
    } else {
      if (!isActiveProduct(product)) {
        issues.push(
          `SKU ${movement.productCode} is inactive or blocked in Product Master.`,
        );
      }

      if (
        product.batchControlled &&
        !movement.batchNo
      ) {
        issues.push(
          `Batch No is required for batch-controlled SKU ${movement.productCode}.`,
        );
      }

      if (
        product.expiryControlled &&
        !movement.expiryDate
      ) {
        issues.push(
          `Expiry Date is required for expiry-controlled SKU ${movement.productCode}.`,
        );
      }

      const allowedUoms = [
        product.uom,
        product.baseUom,
        product.purchaseUom,
        product.salesUom,
      ]
        .filter(Boolean)
        .map(normalizeText);

      if (
        movement.uom &&
        allowedUoms.length > 0 &&
        !allowedUoms.includes(
          normalizeText(movement.uom),
        )
      ) {
        warnings.push(
          `Movement UOM ${movement.uom} does not match Product Master UOM settings.`,
        );
      }
    }

    if (movement.expiryDate) {
      const expiryDifference = daysBetween(
        todayDate(),
        movement.expiryDate,
      );

      if (
        expiryDifference !== null &&
        expiryDifference < 0
      ) {
        issues.push(
          `Movement references stock that expired ${Math.abs(
            expiryDifference,
          )} days ago.`,
        );
      } else if (
        expiryDifference !== null &&
        expiryDifference <= 30
      ) {
        warnings.push(
          `Referenced stock expires in ${expiryDifference} days.`,
        );
      }
    }

    const duplicates = findDuplicateMovements(
      movement,
      allMovements,
    );

    if (duplicates.length > 0) {
      issues.push(
        `${duplicates.length} possible duplicate movement log(s) were detected.`,
      );

      recommendations.push(
        'Verify that inventory was posted only once before deleting or correcting any audit log.',
      );
    }

    const sourceDuplicates =
      findSourceLineDuplicates(
        movement,
        allMovements,
      );

    if (sourceDuplicates.length > 0) {
      issues.push(
        'The same source transaction line appears to have been posted more than once.',
      );
    }

    if (
      isUnusualQuantity(
        movement,
        allMovements,
      )
    ) {
      warnings.push(
        'Movement quantity is unusually high compared with historical movements for this SKU and direction.',
      );

      recommendations.push(
        'Verify UOM conversion, decimal placement and source-document quantity.',
      );
    }

    if (
      hasRapidRepeat(movement, allMovements)
    ) {
      warnings.push(
        'A similar movement was posted within five minutes. Check for accidental repeated processing.',
      );
    }

    if (
      normalizeText(movement.direction) ===
        'transfer' &&
      movement.referenceNo &&
      !findTransferPair(movement, allMovements)
    ) {
      warnings.push(
        'No matching transfer counterpart was found for the same reference, SKU, batch and quantity.',
      );

      recommendations.push(
        'Check whether the transfer issue, in-transit and receipt legs were all posted.',
      );
    }

    if (hasFEFOWarning(movement)) {
      warnings.push(
        'FEFO alert: an earlier-expiry inventory batch appears to remain available for this outbound SKU.',
      );

      recommendations.push(
        'Review batch allocation and prioritize the earliest-expiring eligible stock.',
      );
    }

    const matchingRows =
      matchingInventoryRows(movement);

    if (
      normalizeText(movement.direction) ===
        'in' &&
      matchingRows.length === 0
    ) {
      warnings.push(
        'No current inventory row matches this inbound stock identity.',
      );

      recommendations.push(
        'Check whether the inbound posting created the expected inventory batch and location row.',
      );
    }

    if (
      normalizeText(movement.direction) ===
        'out' &&
      matchingRows.length === 0
    ) {
      warnings.push(
        'No current inventory row matches the outbound movement identity. The stock may be fully depleted or the attributes may not match.',
      );
    }

    const negativeRows = matchingRows.filter(
      (item) =>
        Number(item.batchQty || 0) < 0 ||
        Number(item.availableQty || 0) < 0,
    );

    if (negativeRows.length > 0) {
      issues.push(
        'Matching inventory contains a negative Batch Qty or Available Qty.',
      );

      recommendations.push(
        'Investigate stock posting sequence and perform a controlled inventory reconciliation.',
      );
    }

    if (
      normalizeText(movement.direction) ===
      'adjustment'
    ) {
      if (!movement.remarks) {
        warnings.push(
          'Inventory adjustment has no reason or remarks.',
        );

        recommendations.push(
          'Record an adjustment reason, approval reference and supporting evidence.',
        );
      }

      if (!movement.referenceNo) {
        issues.push(
          'Inventory adjustment has no approval or transaction reference.',
        );
      }
    }

    const createdDate = new Date(
      movement.createdAt,
    );

    if (
      !Number.isNaN(createdDate.getTime()) &&
      (createdDate.getHours() < 5 ||
        createdDate.getHours() >= 23)
    ) {
      warnings.push(
        'Movement was posted outside normal daytime operating hours.',
      );
    }

    if (!issues.length) {
      positives.push(
        'No critical movement-data errors were detected.',
      );
    }

    if (
      movement.referenceNo &&
      movement.sourceModule
    ) {
      positives.push(
        'Movement contains source and reference traceability.',
      );
    }

    if (
      product &&
      isActiveProduct(product)
    ) {
      positives.push(
        'SKU is valid and active in Product Master.',
      );
    }

    if (
      matchingRows.length > 0 &&
      negativeRows.length === 0
    ) {
      positives.push(
        'Matching inventory was found with no negative balance.',
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
          uniqueIssues.length * 16 -
          uniqueWarnings.length * 4,
      ),
    );

    const status: AIStatus =
      uniqueIssues.length > 0
        ? 'Critical'
        : uniqueWarnings.length > 0
          ? 'Review'
          : 'Healthy';

    return {
      status,
      score,
      issues: uniqueIssues,
      warnings: uniqueWarnings,
      recommendations:
        uniqueRecommendations.length > 0
          ? uniqueRecommendations
          : [
              'Movement is consistent with current audit rules. Continue routine monitoring.',
            ],
      positives: uniquePositives,
      reviewedAt: new Date().toISOString(),
    };
  }

  function analyzeLedger(
    sourceMovements = movements,
  ): LedgerAIReview {
    const movementResults: Record<
      string,
      MovementAIReview
    > = {};

    sourceMovements.forEach((movement) => {
      movementResults[movement.id] =
        analyzeMovement(
          movement,
          sourceMovements,
        );
    });

    const reviews = Object.values(
      movementResults,
    );

    const businessKeyCounts = new Map<
      string,
      number
    >();

    sourceMovements.forEach((movement) => {
      const key =
        movementBusinessKey(movement);

      businessKeyCounts.set(
        key,
        (businessKeyCounts.get(key) || 0) + 1,
      );
    });

    const duplicateGroups = Array.from(
      businessKeyCounts.values(),
    ).filter((count) => count > 1).length;

    const adjustmentCount =
      sourceMovements.filter(
        (movement) =>
          normalizeText(movement.direction) ===
          'adjustment',
      ).length;

    const adjustmentRatio =
      sourceMovements.length > 0
        ? (adjustmentCount /
            sourceMovements.length) *
          100
        : 0;

    const missingReferences =
      sourceMovements.filter(
        (movement) => !movement.referenceNo,
      ).length;

    const unusualQtyMovements =
      sourceMovements.filter((movement) =>
        isUnusualQuantity(
          movement,
          sourceMovements,
        ),
      ).length;

    const expiredMovements =
      sourceMovements.filter((movement) => {
        if (!movement.expiryDate) return false;

        const difference = daysBetween(
          todayDate(),
          movement.expiryDate,
        );

        return (
          difference !== null &&
          difference < 0
        );
      }).length;

    const directionMismatch =
      sourceMovements.filter(
        (movement) =>
          !directionMatchesType(movement),
      ).length;

    const transferPairingWarnings =
      sourceMovements.filter(
        (movement) =>
          normalizeText(movement.direction) ===
            'transfer' &&
          movement.referenceNo &&
          !findTransferPair(
            movement,
            sourceMovements,
          ),
      ).length;

    const negativeInventoryRows =
      inventory.filter(
        (item) =>
          Number(item.batchQty || 0) < 0 ||
          Number(item.availableQty || 0) < 0,
      ).length;

    const healthyMovements = reviews.filter(
      (review) => review.status === 'Healthy',
    ).length;

    const reviewMovements = reviews.filter(
      (review) => review.status === 'Review',
    ).length;

    const criticalMovements = reviews.filter(
      (review) =>
        review.status === 'Critical',
    ).length;

    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const positives: string[] = [];

    if (duplicateGroups > 0) {
      issues.push(
        `${duplicateGroups} possible duplicate movement group(s) were detected.`,
      );

      recommendations.push(
        'Reconcile duplicate source references before removing any audit record.',
      );
    }

    if (negativeInventoryRows > 0) {
      issues.push(
        `${negativeInventoryRows} inventory row(s) contain negative balances.`,
      );

      recommendations.push(
        'Prioritize negative-stock reconciliation and review posting sequence.',
      );
    }

    if (directionMismatch > 0) {
      issues.push(
        `${directionMismatch} movement(s) have direction and movement-type mismatches.`,
      );
    }

    if (missingReferences > 0) {
      warnings.push(
        `${missingReferences} movement(s) have no Reference No.`,
      );
    }

    if (unusualQtyMovements > 0) {
      warnings.push(
        `${unusualQtyMovements} movement(s) have unusual quantities compared with SKU history.`,
      );
    }

    if (expiredMovements > 0) {
      warnings.push(
        `${expiredMovements} movement(s) reference expired stock.`,
      );
    }

    if (transferPairingWarnings > 0) {
      warnings.push(
        `${transferPairingWarnings} transfer movement(s) have no matching counterpart.`,
      );
    }

    if (adjustmentRatio > 15) {
      warnings.push(
        `Adjustments represent ${adjustmentRatio.toFixed(
          1,
        )}% of all movements, which may indicate process or inventory-accuracy issues.`,
      );

      recommendations.push(
        'Review cycle-count variance, shrinkage reasons and adjustment approval controls.',
      );
    }

    if (!issues.length) {
      positives.push(
        'No ledger-level critical control failure was detected.',
      );
    }

    if (healthyMovements > 0) {
      positives.push(
        `${healthyMovements} movement(s) passed all current AI audit checks.`,
      );
    }

    const score = sourceMovements.length
      ? Math.round(
          reviews.reduce(
            (sum, review) =>
              sum + review.score,
            0,
          ) / reviews.length,
        )
      : 100;

    const status: AIStatus =
      issues.length > 0 ||
      criticalMovements > 0
        ? 'Critical'
        : warnings.length > 0 ||
            reviewMovements > 0
          ? 'Review'
          : 'Healthy';

    return {
      status,
      score,
      issues,
      warnings,
      recommendations:
        recommendations.length > 0
          ? Array.from(
              new Set(recommendations),
            )
          : [
              'The movement ledger is healthy under the current audit rules.',
            ],
      positives,
      reviewedAt: new Date().toISOString(),
      totalMovements: sourceMovements.length,
      healthyMovements,
      reviewMovements,
      criticalMovements,
      duplicateGroups,
      missingReferences,
      unusualQtyMovements,
      adjustmentRatio,
      expiredMovements,
      directionMismatch,
      transferPairingWarnings,
      negativeInventoryRows,
      movementResults,
    };
  }

  function persistMovementReview(
    movement: StockMovement,
    review: MovementAIReview,
  ) {
    const next = movements.map((item) =>
      item.id === movement.id
        ? {
            ...item,
            aiStatus: review.status,
            aiScore: review.score,
            aiIssues: review.issues,
            aiWarnings: review.warnings,
            aiRecommendations:
              review.recommendations,
            aiReviewedAt: review.reviewedAt,
          }
        : item,
    );

    saveMovements(next);
  }

  function runMovementAI(
    movement: StockMovement,
  ) {
    const review = analyzeMovement(movement);

    setAiReviewMovement(movement);
    setAiReview(review);
    setAiModalOpen(true);

    persistMovementReview(movement, review);
  }

  function runLedgerAI() {
    const review = analyzeLedger(movements);

    const next = movements.map((movement) => {
      const result =
        review.movementResults[movement.id];

      if (!result) return movement;

      return {
        ...movement,
        aiStatus: result.status,
        aiScore: result.score,
        aiIssues: result.issues,
        aiWarnings: result.warnings,
        aiRecommendations:
          result.recommendations,
        aiReviewedAt: result.reviewedAt,
      };
    });

    saveMovements(next);
    setLedgerReview(review);
    setLedgerModalOpen(true);

    messageApi.success(
      `AI reviewed ${review.totalMovements} movement logs`,
    );
  }

  function handleSyncStorage() {
    const normalized = movements.map(
      ({ raw, ...movement }) => movement,
    );

    saveMovements(normalized);

    messageApi.success(
      'Movement storage synced to both movement keys',
    );
  }

  function handleExport() {
    downloadFile(
      `stock-movements-${todayDate()}.csv`,
      buildCsv(filteredMovements),
    );
  }

  function handleView(
    movement: StockMovement,
  ) {
    setSelectedMovement(movement);
    setViewOpen(true);
  }

  function handleDelete(
    movement: StockMovement,
  ) {
    const next = movements.filter(
      (item) => item.id !== movement.id,
    );

    saveMovements(next);

    messageApi.success(
      'Movement log deleted',
    );
  }

  function resetFilters() {
    setSearchText('');
    setDirectionFilter('All');
    setTypeFilter('All');
    setPlantFilter('All');
    setAiFilter('All');
    setFromDate('');
    setToDate('');
  }

  const typeOptions = useMemo(() => {
    const values = new Set<string>();

    movements.forEach((movement) => {
      const value =
        movement.movementType || movement.type;

      if (value) values.add(value);
    });

    return Array.from(values).sort();
  }, [movements]);

  const plantOptions = useMemo(() => {
    const values = new Set<string>();

    movements.forEach((movement) => {
      if (movement.plant) {
        values.add(movement.plant);
      }
    });

    return Array.from(values).sort();
  }, [movements]);

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      const movementType =
        movement.movementType || movement.type;

      const dateOnly = movementDateOnly(
        movement.movementDate ||
          movement.date ||
          movement.createdAt,
      );

      const haystack = [
        movement.movementNo,
        movementType,
        movement.direction,
        movement.referenceType,
        movement.referenceNo,
        movement.sourceModule,
        movement.productCode,
        movement.productName,
        movement.batchNo,
        movement.plant,
        movement.location,
        movement.expiryDate,
        movement.uom,
        movement.qty,
        movement.remarks,
        movement.aiStatus,
        ...(movement.aiIssues || []),
        ...(movement.aiWarnings || []),
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        !searchText ||
        haystack.includes(
          searchText.toLowerCase(),
        );

      const matchesDirection =
        directionFilter === 'All' ||
        normalizeText(movement.direction) ===
          normalizeText(directionFilter);

      const matchesType =
        typeFilter === 'All' ||
        movementType === typeFilter;

      const matchesPlant =
        plantFilter === 'All' ||
        movement.plant === plantFilter;

      const matchesAI =
        aiFilter === 'All' ||
        (aiFilter === 'Not Checked'
          ? !movement.aiStatus
          : movement.aiStatus === aiFilter);

      const matchesFromDate =
        !fromDate || dateOnly >= fromDate;

      const matchesToDate =
        !toDate || dateOnly <= toDate;

      return (
        matchesSearch &&
        matchesDirection &&
        matchesType &&
        matchesPlant &&
        matchesAI &&
        matchesFromDate &&
        matchesToDate
      );
    });
  }, [
    movements,
    searchText,
    directionFilter,
    typeFilter,
    plantFilter,
    aiFilter,
    fromDate,
    toDate,
  ]);

  const summary = useMemo(() => {
    const totalInQty = movements
      .filter(
        (movement) =>
          normalizeText(movement.direction) ===
          'in',
      )
      .reduce(
        (sum, movement) =>
          sum +
          Math.abs(Number(movement.qty || 0)),
        0,
      );

    const totalOutQty = movements
      .filter(
        (movement) =>
          normalizeText(movement.direction) ===
          'out',
      )
      .reduce(
        (sum, movement) =>
          sum +
          Math.abs(Number(movement.qty || 0)),
        0,
      );

    const totalAdjustmentQty = movements
      .filter(
        (movement) =>
          normalizeText(movement.direction) ===
          'adjustment',
      )
      .reduce(
        (sum, movement) =>
          sum +
          Math.abs(Number(movement.qty || 0)),
        0,
      );

    const netQty = movements.reduce(
      (sum, movement) =>
        sum + signedQty(movement),
      0,
    );

    return {
      totalLogs: movements.length,
      totalInQty,
      totalOutQty,
      totalAdjustmentQty,
      netQty,
      healthy: movements.filter(
        (movement) =>
          movement.aiStatus === 'Healthy',
      ).length,
      review: movements.filter(
        (movement) =>
          movement.aiStatus === 'Review',
      ).length,
      critical: movements.filter(
        (movement) =>
          movement.aiStatus === 'Critical',
      ).length,
      notChecked: movements.filter(
        (movement) => !movement.aiStatus,
      ).length,
    };
  }, [movements]);

  const filteredSummary = useMemo(() => {
    const inQty = filteredMovements
      .filter(
        (movement) =>
          normalizeText(movement.direction) ===
          'in',
      )
      .reduce(
        (sum, movement) =>
          sum +
          Math.abs(Number(movement.qty || 0)),
        0,
      );

    const outQty = filteredMovements
      .filter(
        (movement) =>
          normalizeText(movement.direction) ===
          'out',
      )
      .reduce(
        (sum, movement) =>
          sum +
          Math.abs(Number(movement.qty || 0)),
        0,
      );

    const netQty = filteredMovements.reduce(
      (sum, movement) =>
        sum + signedQty(movement),
      0,
    );

    return {
      inQty,
      outQty,
      netQty,
    };
  }, [filteredMovements]);

  const liveLedgerRisk = useMemo(
    () => analyzeLedger(movements),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [movements, productMasters, inventory],
  );

  const columns: ColumnsType<StockMovement> = [
    {
      title: 'Movement No',
      dataIndex: 'movementNo',
      key: 'movementNo',
      width: 190,
      fixed: 'left',
      render: (value, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{value}</Text>

          <Text
            type="secondary"
            style={{ fontSize: 12 }}
          >
            {movementDateOnly(
              record.movementDate ||
                record.date ||
                record.createdAt,
            )}
          </Text>
        </Space>
      ),
      sorter: (a, b) =>
        a.movementNo.localeCompare(
          b.movementNo,
        ),
    },
    {
      title: 'Type',
      key: 'movementType',
      width: 150,
      render: (_, record) => {
        const value =
          record.movementType ||
          record.type ||
          '-';

        return (
          <Tag color={typeColor(value)}>
            {value}
          </Tag>
        );
      },
      sorter: (a, b) =>
        String(
          a.movementType || a.type,
        ).localeCompare(
          String(b.movementType || b.type),
        ),
    },
    {
      title: 'Direction',
      dataIndex: 'direction',
      key: 'direction',
      width: 110,
      render: (value) => (
        <Tag color={directionColor(value)}>
          {value}
        </Tag>
      ),
      sorter: (a, b) =>
        String(a.direction).localeCompare(
          String(b.direction),
        ),
    },
    {
      title: 'AI Audit',
      key: 'aiAudit',
      width: 130,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Tag
            color={aiStatusColor(
              record.aiStatus,
            )}
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
      title: 'Reference',
      key: 'reference',
      width: 190,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>
            {record.referenceNo || '-'}
          </Text>

          <Text
            type="secondary"
            style={{ fontSize: 12 }}
          >
            {record.referenceType ||
              record.sourceModule ||
              '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'SKU',
      dataIndex: 'productCode',
      key: 'productCode',
      width: 150,
      sorter: (a, b) =>
        a.productCode.localeCompare(
          b.productCode,
        ),
    },
    {
      title: 'Product Name',
      dataIndex: 'productName',
      key: 'productName',
      width: 180,
      render: (value) => value || '-',
    },
    {
      title: 'Batch No',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 140,
      render: (value) => value || '-',
    },
    {
      title: 'Plant',
      dataIndex: 'plant',
      key: 'plant',
      width: 120,
      render: (value) => value || '-',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 130,
      render: (value) =>
        value || (
          <Tag color="orange">Blank</Tag>
        ),
    },
    {
      title: 'Expiry Date',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      width: 130,
      render: (value) => value || '-',
    },
    {
      title: 'UOM',
      dataIndex: 'uom',
      key: 'uom',
      width: 90,
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      key: 'qty',
      width: 120,
      align: 'right',
      render: (value) =>
        Number(value || 0).toLocaleString(),
      sorter: (a, b) =>
        Number(a.qty || 0) -
        Number(b.qty || 0),
    },
    {
      title: 'Signed Qty',
      key: 'signedQty',
      width: 130,
      align: 'right',
      render: (_, record) => {
        const value = signedQty(record);

        return (
          <Text
            strong
            style={{
              color:
                value < 0
                  ? '#cf1322'
                  : '#389e0d',
            }}
          >
            {value.toLocaleString()}
          </Text>
        );
      },
      sorter: (a, b) =>
        signedQty(a) - signedQty(b),
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (value) =>
        value
          ? new Date(value).toLocaleString()
          : '-',
      sorter: (a, b) =>
        String(a.createdAt).localeCompare(
          String(b.createdAt),
        ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 155,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            />
          </Tooltip>

          <Tooltip title="AI Movement Audit">
            <Button
              size="small"
              icon={<RobotOutlined />}
              onClick={() =>
                runMovementAI(record)
              }
            />
          </Tooltip>

          <Popconfirm
            title="Delete movement log?"
            description="This removes only the audit log and does not reverse inventory. Verify the source transaction first."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() =>
              handleDelete(record)
            }
          >
            <Tooltip title="Delete Log">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
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
            🔁 Stock Movement Logs
          </Title>

          <Text type="secondary">
            AI-assisted audit trail for inbound
            receipts, outbound issues, transfers and
            inventory adjustments.
          </Text>
        </div>

        <Alert
          type="info"
          showIcon
          icon={<RobotOutlined />}
          title="AI Stock Movement Audit Assistant"
          description="AI checks duplicate postings, unusual quantities, source traceability, direction mapping, Product Master rules, expired stock, FEFO compliance, transfer pairing, negative inventory and adjustment risk."
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Logs"
                value={summary.totalLogs}
                prefix={<SyncOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total IN Qty"
                value={summary.totalInQty}
                valueStyle={{ color: '#389e0d' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total OUT Qty"
                value={summary.totalOutQty}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Net Qty"
                value={summary.netQty}
                valueStyle={{
                  color:
                    summary.netQty < 0
                      ? '#cf1322'
                      : '#1677ff',
                }}
              />
            </Card>
          </Col>
        </Row>

        <Card
          title={
            <Space>
              <RobotOutlined />
              AI Movement Risk Dashboard
            </Space>
          }
          extra={
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={runLedgerAI}
            >
              Run Full AI Audit
            </Button>
          }
        >
          <Row gutter={[16, 16]}>
            <Col xs={12} md={4}>
              <Statistic
                title="Healthy"
                value={summary.healthy}
                valueStyle={{ color: '#389e0d' }}
              />
            </Col>

            <Col xs={12} md={4}>
              <Statistic
                title="Needs Review"
                value={summary.review}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Col>

            <Col xs={12} md={4}>
              <Statistic
                title="Critical"
                value={summary.critical}
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>

            <Col xs={12} md={4}>
              <Statistic
                title="Not Checked"
                value={summary.notChecked}
              />
            </Col>

            <Col xs={12} md={4}>
              <Statistic
                title="Possible Duplicates"
                value={
                  liveLedgerRisk.duplicateGroups
                }
                valueStyle={{
                  color:
                    liveLedgerRisk.duplicateGroups >
                    0
                      ? '#cf1322'
                      : '#389e0d',
                }}
              />
            </Col>

            <Col xs={12} md={4}>
              <Statistic
                title="Negative Inventory"
                value={
                  liveLedgerRisk.negativeInventoryRows
                }
                valueStyle={{
                  color:
                    liveLedgerRisk
                      .negativeInventoryRows > 0
                      ? '#cf1322'
                      : '#389e0d',
                }}
              />
            </Col>
          </Row>

          <Divider />

          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <Statistic
                title="Missing References"
                value={
                  liveLedgerRisk.missingReferences
                }
              />
            </Col>

            <Col xs={12} md={6}>
              <Statistic
                title="Unusual Quantities"
                value={
                  liveLedgerRisk
                    .unusualQtyMovements
                }
              />
            </Col>

            <Col xs={12} md={6}>
              <Statistic
                title="Direction Mismatch"
                value={
                  liveLedgerRisk.directionMismatch
                }
              />
            </Col>

            <Col xs={12} md={6}>
              <Statistic
                title="Adjustment Ratio"
                value={Number(
                  liveLedgerRisk.adjustmentRatio.toFixed(
                    1,
                  ),
                )}
                suffix="%"
                valueStyle={{
                  color:
                    liveLedgerRisk.adjustmentRatio >
                    15
                      ? '#fa8c16'
                      : undefined,
                }}
              />
            </Col>
          </Row>
        </Card>

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
              <Col xs={24} lg={12}>
                <Space wrap>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={loadAllData}
                  >
                    Reload
                  </Button>

                  <Button
                    icon={<SyncOutlined />}
                    onClick={handleSyncStorage}
                  >
                    Sync Storage
                  </Button>

                  <Button
                    icon={<ExportOutlined />}
                    onClick={handleExport}
                  >
                    Export CSV
                  </Button>

                  <Button
                    type="primary"
                    ghost
                    icon={<RobotOutlined />}
                    onClick={runLedgerAI}
                  >
                    AI Audit
                  </Button>
                </Space>
              </Col>

              <Col xs={24} lg={12}>
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
                    placeholder="Search movement, reference, SKU, batch, plant..."
                    value={searchText}
                    onChange={(event) =>
                      setSearchText(
                        event.target.value,
                      )
                    }
                    style={{ width: 360 }}
                  />
                </Space>
              </Col>
            </Row>

            <Row gutter={[12, 12]}>
              <Col xs={24} md={5}>
                <Select
                  value={directionFilter}
                  onChange={setDirectionFilter}
                  style={{ width: '100%' }}
                  options={[
                    {
                      value: 'All',
                      label: 'All Directions',
                    },
                    {
                      value: 'IN',
                      label: 'IN',
                    },
                    {
                      value: 'OUT',
                      label: 'OUT',
                    },
                    {
                      value: 'ADJUSTMENT',
                      label: 'ADJUSTMENT',
                    },
                    {
                      value: 'TRANSFER',
                      label: 'TRANSFER',
                    },
                  ]}
                />
              </Col>

              <Col xs={24} md={5}>
                <Select
                  showSearch
                  value={typeFilter}
                  onChange={setTypeFilter}
                  style={{ width: '100%' }}
                  optionFilterProp="label"
                  options={[
                    {
                      value: 'All',
                      label: 'All Types',
                    },
                    ...typeOptions.map((type) => ({
                      value: type,
                      label: type,
                    })),
                  ]}
                />
              </Col>

              <Col xs={24} md={4}>
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
                    ...plantOptions.map(
                      (plant) => ({
                        value: plant,
                        label: plant,
                      }),
                    ),
                  ]}
                />
              </Col>

              <Col xs={24} md={4}>
                <Select
                  value={aiFilter}
                  onChange={setAiFilter}
                  style={{ width: '100%' }}
                  options={[
                    {
                      value: 'All',
                      label: 'All AI Status',
                    },
                    {
                      value: 'Healthy',
                      label: 'Healthy',
                    },
                    {
                      value: 'Review',
                      label: 'Review',
                    },
                    {
                      value: 'Critical',
                      label: 'Critical',
                    },
                    {
                      value: 'Not Checked',
                      label: 'Not Checked',
                    },
                  ]}
                />
              </Col>

              <Col xs={24} md={3}>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(event) =>
                    setFromDate(
                      event.target.value,
                    )
                  }
                />
              </Col>

              <Col xs={24} md={3}>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(event) =>
                    setToDate(event.target.value)
                  }
                />
              </Col>
            </Row>

            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Text type="secondary">
                    Filtered IN Qty:{' '}
                  </Text>

                  <Text
                    strong
                    style={{ color: '#389e0d' }}
                  >
                    {filteredSummary.inQty.toLocaleString()}
                  </Text>
                </Card>
              </Col>

              <Col xs={24} md={8}>
                <Card size="small">
                  <Text type="secondary">
                    Filtered OUT Qty:{' '}
                  </Text>

                  <Text
                    strong
                    style={{ color: '#cf1322' }}
                  >
                    {filteredSummary.outQty.toLocaleString()}
                  </Text>
                </Card>
              </Col>

              <Col xs={24} md={8}>
                <Card size="small">
                  <Text type="secondary">
                    Filtered Net Qty:{' '}
                  </Text>

                  <Text
                    strong
                    style={{
                      color:
                        filteredSummary.netQty < 0
                          ? '#cf1322'
                          : '#1677ff',
                    }}
                  >
                    {filteredSummary.netQty.toLocaleString()}
                  </Text>
                </Card>
              </Col>
            </Row>

            <Space>
              <Text type="secondary">
                Showing{' '}
                {filteredMovements.length.toLocaleString()}{' '}
                of{' '}
                {movements.length.toLocaleString()}{' '}
                movement logs
              </Text>

              {(searchText ||
                directionFilter !== 'All' ||
                typeFilter !== 'All' ||
                plantFilter !== 'All' ||
                aiFilter !== 'All' ||
                fromDate ||
                toDate) && (
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
              dataSource={filteredMovements}
              scroll={{ x: 2000 }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) =>
                  `${total} movement logs`,
              }}
              locale={{
                emptyText: (
                  <Empty
                    description="No stock movement logs found"
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
        open={viewOpen}
        destroyOnHidden
        width={900}
        title="Movement Log Details"
        footer={[
          selectedMovement && (
            <Button
              key="ai"
              icon={<RobotOutlined />}
              onClick={() =>
                runMovementAI(
                  selectedMovement,
                )
              }
            >
              AI Movement Audit
            </Button>
          ),

          <Button
            key="close"
            type="primary"
            onClick={() =>
              setViewOpen(false)
            }
          >
            Close
          </Button>,
        ].filter(Boolean)}
        onCancel={() => setViewOpen(false)}
      >
        {selectedMovement && (
          <Space
            orientation="vertical"
            size="large"
            style={{ width: '100%' }}
          >
            <Descriptions
              bordered
              size="small"
              column={2}
            >
              <Descriptions.Item label="Movement No">
                {selectedMovement.movementNo}
              </Descriptions.Item>

              <Descriptions.Item label="Movement Date">
                {movementDateOnly(
                  selectedMovement.movementDate ||
                    selectedMovement.date ||
                    selectedMovement.createdAt,
                )}
              </Descriptions.Item>

              <Descriptions.Item label="Type">
                <Tag
                  color={typeColor(
                    selectedMovement.movementType ||
                      selectedMovement.type,
                  )}
                >
                  {selectedMovement.movementType ||
                    selectedMovement.type}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Direction">
                <Tag
                  color={directionColor(
                    selectedMovement.direction,
                  )}
                >
                  {selectedMovement.direction}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="AI Audit Status">
                <Tag
                  color={aiStatusColor(
                    selectedMovement.aiStatus,
                  )}
                  icon={<RobotOutlined />}
                >
                  {selectedMovement.aiStatus ||
                    'Not Checked'}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="AI Score">
                {selectedMovement.aiScore !==
                undefined
                  ? `${selectedMovement.aiScore}/100`
                  : '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Reference Type">
                {selectedMovement.referenceType ||
                  '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Reference No">
                {selectedMovement.referenceNo ||
                  '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Source Module">
                {selectedMovement.sourceModule ||
                  '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Source ID">
                {selectedMovement.sourceId || '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Source Line ID">
                {selectedMovement.sourceLineId ||
                  '-'}
              </Descriptions.Item>

              <Descriptions.Item label="SKU">
                {selectedMovement.productCode ||
                  '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Product Name">
                {selectedMovement.productName ||
                  '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Batch No">
                {selectedMovement.batchNo || '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Plant">
                {selectedMovement.plant || '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Location">
                {selectedMovement.location || '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Expiry Date">
                {selectedMovement.expiryDate ||
                  '-'}
              </Descriptions.Item>

              <Descriptions.Item label="UOM">
                {selectedMovement.uom || '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Qty">
                {Number(
                  selectedMovement.qty || 0,
                ).toLocaleString()}
              </Descriptions.Item>

              <Descriptions.Item label="Signed Qty">
                <Text
                  strong
                  style={{
                    color:
                      signedQty(
                        selectedMovement,
                      ) < 0
                        ? '#cf1322'
                        : '#389e0d',
                  }}
                >
                  {signedQty(
                    selectedMovement,
                  ).toLocaleString()}
                </Text>
              </Descriptions.Item>

              <Descriptions.Item label="Created At">
                {selectedMovement.createdAt
                  ? new Date(
                      selectedMovement.createdAt,
                    ).toLocaleString()
                  : '-'}
              </Descriptions.Item>

              <Descriptions.Item label="AI Reviewed At">
                {selectedMovement.aiReviewedAt
                  ? new Date(
                      selectedMovement.aiReviewedAt,
                    ).toLocaleString()
                  : '-'}
              </Descriptions.Item>

              <Descriptions.Item
                label="Remarks"
                span={2}
              >
                {selectedMovement.remarks || '-'}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Title level={5}>
                Raw Movement JSON
              </Title>

              <Paragraph>
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 6,
                    maxHeight: 300,
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(
                    {
                      ...selectedMovement,
                      raw:
                        selectedMovement.raw ||
                        undefined,
                    },
                    null,
                    2,
                  )}
                </pre>
              </Paragraph>
            </div>
          </Space>
        )}
      </Modal>

      <Modal
        open={aiModalOpen}
        destroyOnHidden
        width={900}
        title={
          <Space>
            <RobotOutlined />
            AI Movement Audit
          </Space>
        }
        onCancel={() =>
          setAiModalOpen(false)
        }
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() =>
              setAiModalOpen(false)
            }
          >
            Close
          </Button>,
        ]}
      >
        {aiReview && aiReviewMovement ? (
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
                    title="AI Audit Result"
                    value={aiReview.status}
                    prefix={<RobotOutlined />}
                    valueStyle={{
                      fontSize: 20,
                      color:
                        aiReview.status ===
                        'Critical'
                          ? '#cf1322'
                          : aiReview.status ===
                              'Healthy'
                            ? '#389e0d'
                            : '#fa8c16',
                    }}
                  />
                </Col>

                <Col xs={24} md={16}>
                  <Text strong>
                    Movement Audit Score
                  </Text>

                  <Progress
                    percent={aiReview.score}
                    status={
                      aiReview.status ===
                      'Critical'
                        ? 'exception'
                        : aiReview.status ===
                            'Healthy'
                          ? 'success'
                          : 'active'
                    }
                  />
                </Col>
              </Row>
            </Card>

            <Descriptions
              bordered
              size="small"
              column={2}
            >
              <Descriptions.Item label="Movement No">
                {aiReviewMovement.movementNo}
              </Descriptions.Item>

              <Descriptions.Item label="Direction">
                <Tag
                  color={directionColor(
                    aiReviewMovement.direction,
                  )}
                >
                  {aiReviewMovement.direction}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="SKU">
                {aiReviewMovement.productCode ||
                  '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Quantity">
                {Number(
                  aiReviewMovement.qty || 0,
                ).toLocaleString()}{' '}
                {aiReviewMovement.uom}
              </Descriptions.Item>

              <Descriptions.Item label="Reference">
                {aiReviewMovement.referenceNo ||
                  '-'}
              </Descriptions.Item>

              <Descriptions.Item label="Source">
                {aiReviewMovement.sourceModule ||
                  '-'}
              </Descriptions.Item>
            </Descriptions>

            {aiReview.issues.length > 0 && (
              <Alert
                type="error"
                showIcon
                icon={
                  <ExclamationCircleOutlined />
                }
                title="Critical Issues"
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
                title="Audit Warnings"
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
          </Space>
        ) : (
          <Empty description="No AI movement review" />
        )}
      </Modal>

      <Modal
        open={ledgerModalOpen}
        destroyOnHidden
        width={1000}
        title={
          <Space>
            <RobotOutlined />
            AI Stock Movement Ledger Audit
          </Space>
        }
        onCancel={() =>
          setLedgerModalOpen(false)
        }
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() =>
              setLedgerModalOpen(false)
            }
          >
            Close
          </Button>,
        ]}
      >
        {ledgerReview ? (
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
                    title="Ledger Health"
                    value={ledgerReview.status}
                    prefix={<RobotOutlined />}
                    valueStyle={{
                      fontSize: 20,
                      color:
                        ledgerReview.status ===
                        'Critical'
                          ? '#cf1322'
                          : ledgerReview.status ===
                              'Healthy'
                            ? '#389e0d'
                            : '#fa8c16',
                    }}
                  />
                </Col>

                <Col xs={24} md={16}>
                  <Text strong>
                    Overall Ledger Score
                  </Text>

                  <Progress
                    percent={ledgerReview.score}
                    status={
                      ledgerReview.status ===
                      'Critical'
                        ? 'exception'
                        : ledgerReview.status ===
                            'Healthy'
                          ? 'success'
                          : 'active'
                    }
                  />
                </Col>
              </Row>
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Healthy"
                    value={
                      ledgerReview.healthyMovements
                    }
                    valueStyle={{
                      color: '#389e0d',
                    }}
                  />
                </Card>
              </Col>

              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Review"
                    value={
                      ledgerReview.reviewMovements
                    }
                    valueStyle={{
                      color: '#fa8c16',
                    }}
                  />
                </Card>
              </Col>

              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Critical"
                    value={
                      ledgerReview.criticalMovements
                    }
                    valueStyle={{
                      color: '#cf1322',
                    }}
                  />
                </Card>
              </Col>

              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Duplicate Groups"
                    value={
                      ledgerReview.duplicateGroups
                    }
                  />
                </Card>
              </Col>
            </Row>

            <Descriptions
              bordered
              size="small"
              column={2}
            >
              <Descriptions.Item label="Movements Reviewed">
                {ledgerReview.totalMovements}
              </Descriptions.Item>

              <Descriptions.Item label="Missing References">
                {ledgerReview.missingReferences}
              </Descriptions.Item>

              <Descriptions.Item label="Unusual Quantities">
                {
                  ledgerReview.unusualQtyMovements
                }
              </Descriptions.Item>

              <Descriptions.Item label="Direction Mismatches">
                {ledgerReview.directionMismatch}
              </Descriptions.Item>

              <Descriptions.Item label="Expired Stock Movements">
                {ledgerReview.expiredMovements}
              </Descriptions.Item>

              <Descriptions.Item label="Transfer Pairing Warnings">
                {
                  ledgerReview.transferPairingWarnings
                }
              </Descriptions.Item>

              <Descriptions.Item label="Negative Inventory Rows">
                {
                  ledgerReview.negativeInventoryRows
                }
              </Descriptions.Item>

              <Descriptions.Item label="Adjustment Ratio">
                {ledgerReview.adjustmentRatio.toFixed(
                  1,
                )}
                %
              </Descriptions.Item>
            </Descriptions>

            {ledgerReview.issues.length > 0 && (
              <Alert
                type="error"
                showIcon
                icon={
                  <ExclamationCircleOutlined />
                }
                title="Critical Ledger Risks"
                description={
                  <ul
                    style={{
                      marginBottom: 0,
                      paddingLeft: 20,
                    }}
                  >
                    {ledgerReview.issues.map(
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

            {ledgerReview.warnings.length > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                title="Ledger Warnings"
                description={
                  <ul
                    style={{
                      marginBottom: 0,
                      paddingLeft: 20,
                    }}
                  >
                    {ledgerReview.warnings.map(
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

            {ledgerReview.positives.length > 0 && (
              <Alert
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                title="Positive Audit Results"
                description={
                  <ul
                    style={{
                      marginBottom: 0,
                      paddingLeft: 20,
                    }}
                  >
                    {ledgerReview.positives.map(
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

            <Alert
              type="info"
              showIcon
              icon={<BulbOutlined />}
              title="Recommended Actions"
              description={
                <ul
                  style={{
                    marginBottom: 0,
                    paddingLeft: 20,
                  }}
                >
                  {ledgerReview.recommendations.map(
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
              AI findings support operational review
              but do not automatically reverse inventory
              or delete audit records. Inventory
              corrections should be completed through
              controlled adjustment, transfer, inbound
              or outbound transactions.
            </Paragraph>
          </Space>
        ) : (
          <Empty description="No ledger audit result" />
        )}
      </Modal>
    </div>
  );
}