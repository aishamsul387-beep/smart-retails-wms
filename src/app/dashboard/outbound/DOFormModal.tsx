'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Table,
  Space,
  Popconfirm,
  Row,
  Col,
  Divider,
  Typography,
  Tag,
  message,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Text } = Typography;

export type DOFormMode = 'create' | 'edit' | 'view';

export interface DeliveryOrderItem {
  id?: string;
  lineNo?: number;
  inventoryId?: string;
  sku?: string;
  productCode?: string;
  productDescription?: string;
  description?: string;
  batchNo?: string;
  plant?: string;
  location?: string;
  expiryDate?: string;
  qty?: number;
  uom?: string;
  availableQty?: number;
}

export interface DeliveryOrderFormValue {
  id?: string;
  doNo?: string;
  deliveryOrderNo?: string;
  referenceNo?: string;
  customerCode?: string;
  customerName?: string;
  shipTo?: string;
  deliveryAddress?: string;
  status?: string;
  requiredDate?: string;
  remarks?: string;
  items?: DeliveryOrderItem[];
  createdAt?: string;
  updatedAt?: string;
}

interface DOFormModalProps {
  open: boolean;
  mode: DOFormMode;
  initialData?: DeliveryOrderFormValue | null;
  onCancel: () => void;
  onSubmit: (values: DeliveryOrderFormValue) => void | Promise<void>;
}

/**
 * DO / Outbound item source of truth:
 * Inventory only.
 *
 * Batch No, Plant, Location, Expiry Date, UOM and Available Qty are operational
 * inventory attributes. They are not read from Product Master here.
 */
const INVENTORY_KEYS = [
  'wms_inventory',
  'wms_inventory_management',
  'wms_inventory_data',
  'inventoryData',
  'wms_inventory_items',
  'inventory_items',
  'inventory_data',
  'inventory',
  'stockData',
  'stock_data',
  'wms_stock',
];

const STATUS_OPTIONS = ['Draft', 'Confirmed', 'Picked', 'Packed', 'Shipped', 'Cancelled'];

interface NormalizedInventoryRecord {
  raw: any;
  id: string;
  sku: string;
  productCode: string;
  productDescription: string;
  batchNo: string;
  plant: string;
  location: string;
  expiryDate: string;
  qty: number;
  uom: string;
  status: string;
}

function safeJsonParse<T = any>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.inventory)) return value.inventory;
  return [];
}

function readFirstLocalStorageArray(keys: string[]): any[] {
  if (typeof window === 'undefined') return [];

  for (const key of keys) {
    const parsed = safeJsonParse<any>(window.localStorage.getItem(key), []);
    const arr = toArray(parsed);
    if (arr.length > 0) return arr;
  }

  return [];
}

function getValue(record: any, keys: string[], defaultValue = ''): any {
  for (const key of keys) {
    if (record && record[key] !== undefined && record[key] !== null && String(record[key]).trim() !== '') {
      return record[key];
    }
  }

  return defaultValue;
}

function normalizeText(value: any): string {
  return String(value ?? '').trim();
}

function normalizeUpper(value: any): string {
  return normalizeText(value).toUpperCase();
}

function normalizeCode(value: any): string {
  return normalizeText(value)
    .toUpperCase()
    .replace(/^SKU[\s\-_]*/i, '')
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function normalizeQty(value: any): number {
  const raw = String(value ?? '0').replace(/,/g, '');
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateDONo(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  return `DO-${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

function getInventoryAvailableQty(record: any): number {
  const value = getValue(
    record,
    [
      'availableQty',
      'Available Qty',
      'availableQuantity',
      'Available Quantity',
      'balanceQty',
      'Balance Qty',
      'balanceInventory',
      'Balance Inventory',
      'qtyAvailable',
      'Qty Available',
      'stockBalance',
      'Stock Balance',
      'onHandQty',
      'On Hand Qty',
      'remainingQty',
      'Remaining Qty',
      'currentStock',
      'Current Stock',
      'balance',
      'Balance',
    ],
    '',
  );

  if (value !== '') return normalizeQty(value);

  return normalizeQty(
    getValue(record, ['qty', 'Qty', 'quantity', 'Quantity', 'batchQty', 'Batch Qty', 'stockQty', 'Stock Qty'], '0'),
  );
}

function normalizeInventoryRecord(record: any): NormalizedInventoryRecord {
  const productCode = normalizeText(
    getValue(record, [
      'productCode',
      'Product Code',
      'product_code',
      'sku',
      'SKU',
      'skuCode',
      'SKU Code',
      'itemCode',
      'Item Code',
      'materialCode',
      'Material Code',
      'material',
      'Material',
    ]),
  );

  const sku = normalizeText(
    getValue(
      record,
      [
        'sku',
        'SKU',
        'skuCode',
        'SKU Code',
        'productCode',
        'Product Code',
        'product_code',
        'itemCode',
        'Item Code',
        'materialCode',
        'Material Code',
        'material',
        'Material',
      ],
      productCode,
    ),
  );

  const qty = getInventoryAvailableQty(record);

  const expiryDate = normalizeText(
    getValue(record, ['expiryDate', 'Expiry Date', 'expiry', 'Expiry', 'expDate', 'Exp Date', 'expirationDate'], ''),
  );

  let status = normalizeText(getValue(record, ['status', 'Status', 'stockStatus', 'Stock Status'], 'Available'));

  if (qty <= 0) status = 'Out of Stock';
  if (expiryDate && expiryDate < todayDate()) status = 'Expired';

  return {
    raw: record,
    id: normalizeText(getValue(record, ['id', 'ID', 'key', 'Key'], generateId('inv'))),
    sku: sku || productCode,
    productCode: productCode || sku,
    productDescription: normalizeText(
      getValue(record, [
        'productDescription',
        'Product Description',
        'description',
        'Description',
        'productName',
        'Product Name',
        'itemName',
        'Item Name',
      ]),
    ),
    batchNo: normalizeText(getValue(record, ['batchNo', 'Batch No', 'batch', 'Batch', 'lotNo', 'Lot No'])),
    plant: normalizeText(getValue(record, ['plant', 'Plant', 'plantCode', 'Plant Code', 'warehouse', 'Warehouse'])),
    location: normalizeText(
      getValue(record, ['location', 'Location', 'locationCode', 'Location Code', 'bin', 'Bin', 'storageLocation', 'Storage Location']),
    ),
    expiryDate,
    qty,
    uom: normalizeText(getValue(record, ['uom', 'UOM', 'unit', 'Unit', 'baseUom', 'Base UOM'], 'PCS')) || 'PCS',
    status,
  };
}

function isInventoryUsable(row: NormalizedInventoryRecord): boolean {
  const status = normalizeText(row.status).toLowerCase();

  if (row.qty <= 0) return false;
  if (row.expiryDate && row.expiryDate < todayDate()) return false;

  return ![
    'hold',
    'blocked',
    'damage',
    'damaged',
    'expired',
    'out of stock',
    'quarantine',
    'cancelled',
    'inactive',
  ].includes(status);
}

function findBestInventorySource(): any[] {
  if (typeof window === 'undefined') return [];

  let bestData: any[] = [];
  let bestScore = -1;

  for (const key of INVENTORY_KEYS) {
    const parsed = safeJsonParse<any>(window.localStorage.getItem(key), []);
    const arr = toArray(parsed);
    if (!arr.length) continue;

    let score = 0;

    for (const row of arr.slice(0, 30)) {
      const normalized = normalizeInventoryRecord(row);

      if (normalized.sku) score += 5;
      if (normalized.batchNo) score += 5;
      if (normalized.plant) score += 4;
      if (normalized.qty > 0) score += 4;
      if (normalized.location) score += 2;
      if (normalized.expiryDate) score += 2;
      if (normalized.uom) score += 1;
    }

    if (key === 'wms_inventory') score += 30;
    if (key === 'wms_inventory_management') score += 25;

    if (score > bestScore) {
      bestScore = score;
      bestData = arr;
    }
  }

  return bestData;
}

function uniqueOptions(values: any[]) {
  const map = new Map<string, { label: string; value: string }>();

  values.forEach((value) => {
    const text = normalizeText(value);
    if (!text) return;

    const key = normalizeUpper(text);

    if (!map.has(key)) {
      map.set(key, {
        label: text,
        value: text,
      });
    }
  });

  return Array.from(map.values());
}

function initialItem(): DeliveryOrderItem {
  return {
    id: generateId('do_item'),
    lineNo: 1,
    inventoryId: '',
    sku: '',
    productCode: '',
    productDescription: '',
    batchNo: '',
    plant: '',
    location: '',
    expiryDate: '',
    qty: 1,
    uom: 'PCS',
    availableQty: 0,
  };
}

export default function DOFormModal({ open, mode, initialData, onCancel, onSubmit }: DOFormModalProps) {
  const [form] = Form.useForm<DeliveryOrderFormValue>();

  const [items, setItems] = useState<DeliveryOrderItem[]>([initialItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [inventoryData, setInventoryData] = useState<any[]>([]);

  const isView = mode === 'view';

  useEffect(() => {
    if (!open) return;

    const bestInventory = findBestInventorySource();
    setInventoryData(bestInventory);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (mode === 'create') {
      const doNo = generateDONo();

      form.setFieldsValue({
        doNo,
        deliveryOrderNo: doNo,
        referenceNo: doNo,
        customerCode: '',
        customerName: '',
        shipTo: '',
        deliveryAddress: '',
        status: 'Draft',
        requiredDate: '',
        remarks: '',
      });

      setItems([{ ...initialItem(), lineNo: 1 }]);
      return;
    }

    if (initialData) {
      const resolvedDONo = initialData.doNo || initialData.deliveryOrderNo || initialData.referenceNo || '';

      form.setFieldsValue({
        ...initialData,
        doNo: resolvedDONo,
        deliveryOrderNo: resolvedDONo,
        referenceNo: resolvedDONo,
        shipTo: initialData.shipTo || initialData.deliveryAddress || '',
        deliveryAddress: initialData.deliveryAddress || initialData.shipTo || '',
        status: initialData.status || 'Draft',
      });

      const existingItems = Array.isArray(initialData.items) && initialData.items.length > 0 ? initialData.items : [initialItem()];

      setItems(
        existingItems.map((item, index) => ({
          ...initialItem(),
          ...item,
          id: item.id || generateId('do_item'),
          lineNo: index + 1,
          sku: item.sku || item.productCode || '',
          productCode: item.productCode || item.sku || '',
          productDescription: item.productDescription || item.description || '',
          qty: Number(item.qty || 0),
        })),
      );
    }
  }, [open, mode, initialData, form]);

  const normalizedInventory = useMemo(() => inventoryData.map(normalizeInventoryRecord), [inventoryData]);

  const usableInventory = useMemo(() => normalizedInventory.filter(isInventoryUsable), [normalizedInventory]);

  const skuOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; searchText: string; availableQty: number }>();

    usableInventory.forEach((row) => {
      const sku = row.sku || row.productCode;
      if (!sku) return;

      const key = normalizeCode(sku);
      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          value: sku,
          label: `${sku} - ${row.productDescription || '-'} / Available ${row.qty}`,
          searchText: `${sku} ${row.productCode} ${row.productDescription} ${row.batchNo} ${row.plant} ${row.location} ${row.expiryDate}`,
          availableQty: row.qty,
        });
      } else {
        existing.availableQty += row.qty;
        existing.label = `${sku} - ${row.productDescription || '-'} / Available ${existing.availableQty}`;
      }
    });

    return Array.from(map.values());
  }, [usableInventory]);

  const plantOptions = useMemo(() => uniqueOptions(usableInventory.map((row) => row.plant)), [usableInventory]);

  const locationOptions = useMemo(() => uniqueOptions(usableInventory.map((row) => row.location)), [usableInventory]);

  const uomOptions = useMemo(() => uniqueOptions(usableInventory.map((row) => row.uom)), [usableInventory]);

  const getBatchOptions = (item?: DeliveryOrderItem) => {
    const skuKey = normalizeCode(item?.sku || item?.productCode);

    const rows = usableInventory.filter((row) => !skuKey || normalizeCode(row.sku || row.productCode) === skuKey);

    const map = new Map<string, { label: string; value: string }>();

    rows.forEach((row) => {
      if (!row.batchNo) return;

      const key = normalizeUpper(row.batchNo);

      if (!map.has(key)) {
        map.set(key, {
          value: row.batchNo,
          label: `${row.batchNo} / ${row.plant || '-'} / ${row.location || '-'} / ${row.expiryDate || '-'} / Avl ${row.qty}`,
        });
      }
    });

    return Array.from(map.values());
  };

  const updateItem = (index: number, patch: Partial<DeliveryOrderItem>) => {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              ...patch,
              lineNo: idx + 1,
            }
          : item,
      ),
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        ...initialItem(),
        lineNo: prev.length + 1,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((item, idx) => ({
          ...item,
          lineNo: idx + 1,
        })),
    );
  };

  const findBestInventoryMatch = (patch: Partial<DeliveryOrderItem>, currentItem?: DeliveryOrderItem) => {
    const target = {
      ...currentItem,
      ...patch,
    };

    const skuKey = normalizeCode(target.sku || target.productCode);
    const batchKey = normalizeUpper(target.batchNo);
    const plantKey = normalizeUpper(target.plant);
    const locationKey = normalizeUpper(target.location);
    const expiryKey = normalizeUpper(target.expiryDate);

    let candidates = usableInventory;

    if (patch.inventoryId) {
      const exact = candidates.find((row) => row.id === patch.inventoryId);
      if (exact) return exact;
    }

    if (skuKey) {
      candidates = candidates.filter((row) => normalizeCode(row.sku || row.productCode) === skuKey);
    }

    if (batchKey) {
      candidates = candidates.filter((row) => normalizeUpper(row.batchNo) === batchKey);
    }

    if (plantKey) {
      candidates = candidates.filter((row) => normalizeUpper(row.plant) === plantKey);
    }

    /**
     * Flexible location:
     * - if DO location blank, do not restrict
     * - if inventory location blank, it can match any DO location
     */
    if (locationKey) {
      candidates = candidates.filter((row) => {
        const invLoc = normalizeUpper(row.location);
        return !invLoc || invLoc === locationKey;
      });
    }

    /**
     * Flexible expiry:
     * - if DO expiry blank, FEFO
     * - if inventory expiry blank, it can match
     */
    if (expiryKey) {
      candidates = candidates.filter((row) => {
        const invExp = normalizeUpper(row.expiryDate);
        return !invExp || invExp === expiryKey;
      });
    }

    return candidates.sort((a, b) => {
      const aExpiry = a.expiryDate || '9999-12-31';
      const bExpiry = b.expiryDate || '9999-12-31';
      const expirySort = aExpiry.localeCompare(bExpiry);

      if (expirySort !== 0) return expirySort;
      return b.qty - a.qty;
    })[0];
  };

  const autoFillFromInventory = (index: number, patch: Partial<DeliveryOrderItem>) => {
    const currentItem = items[index];
    const match = findBestInventoryMatch(patch, currentItem);

    const next: Partial<DeliveryOrderItem> = {
      ...patch,
    };

    if (match) {
      next.inventoryId = match.id;
      next.sku = match.sku || match.productCode;
      next.productCode = match.productCode || match.sku;
      next.productDescription = match.productDescription;
      next.batchNo = match.batchNo;
      next.plant = match.plant;
      next.location = match.location;
      next.expiryDate = match.expiryDate;
      next.uom = match.uom || 'PCS';
      next.availableQty = match.qty;
    } else if (next.sku) {
      next.productCode = next.sku;
    }

    updateItem(index, next);
  };

  const validateInventoryAvailability = (validItems: DeliveryOrderItem[]) => {
    const errors: string[] = [];

    validItems.forEach((item) => {
      const match = findBestInventoryMatch(item, item);
      const lineNo = item.lineNo || 0;

      if (!match) {
        errors.push(`Line ${lineNo}: No usable inventory match for SKU ${item.sku}, Batch ${item.batchNo}, Plant ${item.plant}.`);
        return;
      }

      if (match.qty < Number(item.qty || 0)) {
        errors.push(
          `Line ${lineNo}: Insufficient inventory for SKU ${item.sku}. Required ${Number(item.qty || 0)}, available ${match.qty}.`,
        );
      }
    });

    return errors;
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      const values = await form.validateFields();

      const validItems = items
        .map((item, index) => ({
          ...item,
          id: item.id || generateId('do_item'),
          lineNo: index + 1,
          inventoryId: normalizeText(item.inventoryId),
          sku: normalizeText(item.sku || item.productCode),
          productCode: normalizeText(item.productCode || item.sku),
          productDescription: normalizeText(item.productDescription || item.description),
          batchNo: normalizeText(item.batchNo),
          plant: normalizeText(item.plant),
          location: normalizeText(item.location),
          expiryDate: normalizeText(item.expiryDate),
          qty: Number(item.qty || 0),
          uom: normalizeText(item.uom || 'PCS'),
          availableQty: Number(item.availableQty || 0),
        }))
        .filter((item) => item.sku || item.batchNo || item.qty > 0);

      if (validItems.length === 0) {
        message.warning('Please add at least one delivery order item.');
        return;
      }

      const invalidItem = validItems.find((item) => !item.sku || !item.batchNo || !item.plant || !item.qty || item.qty <= 0);

      if (invalidItem) {
        message.warning('Please ensure each item has SKU, Batch No, Plant, and Qty greater than 0.');
        return;
      }

      const inventoryErrors = validateInventoryAvailability(validItems);

      if (inventoryErrors.length) {
        Modal.error({
          title: 'Inventory validation failed',
          content: (
            <ul style={{ paddingLeft: 20 }}>
              {inventoryErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ),
        });
        return;
      }

      const resolvedDONo = values.doNo || values.deliveryOrderNo || values.referenceNo || generateDONo();
      const now = new Date().toISOString();

      const payload: DeliveryOrderFormValue = {
        ...initialData,
        ...values,
        id: initialData?.id || generateId('do'),
        doNo: resolvedDONo,
        deliveryOrderNo: resolvedDONo,
        referenceNo: resolvedDONo,
        shipTo: values.shipTo || values.deliveryAddress || '',
        deliveryAddress: values.deliveryAddress || values.shipTo || '',
        status: values.status || initialData?.status || 'Draft',
        items: validItems,
        createdAt: initialData?.createdAt || now,
        updatedAt: now,
      };

      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  const columns: TableColumnsType<DeliveryOrderItem> = [
    {
      title: '#',
      dataIndex: 'lineNo',
      width: 55,
      render: (_value, _record, index) => index + 1,
    },
    {
      title: 'SKU / Product Code',
      dataIndex: 'sku',
      width: 230,
      render: (_value, record, index) => (
        <Select
          showSearch
          allowClear
          disabled={isView}
          value={record.sku || undefined}
          placeholder="Select SKU from Inventory"
          optionFilterProp="label"
          options={skuOptions}
          data-testid="do-item-sku"
          style={{ width: '100%' }}
          filterOption={(input, option: any) =>
            String(option?.searchText || option?.label || '').toLowerCase().includes(input.toLowerCase())
          }
          onChange={(value) =>
            autoFillFromInventory(index, {
              sku: value || '',
              productCode: value || '',
            })
          }
          onSearch={(value) =>
            updateItem(index, {
              sku: value,
              productCode: value,
            })
          }
          onBlur={() =>
            autoFillFromInventory(index, {
              sku: record.sku || record.productCode || '',
              productCode: record.productCode || record.sku || '',
            })
          }
        />
      ),
    },
    {
      title: 'Description',
      dataIndex: 'productDescription',
      width: 230,
      render: (_value, record, index) => (
        <Input
          disabled={isView}
          value={record.productDescription}
          placeholder="From inventory"
          data-testid="do-item-description"
          onChange={(event) =>
            updateItem(index, {
              productDescription: event.target.value,
            })
          }
        />
      ),
    },
    {
      title: 'Batch No',
      dataIndex: 'batchNo',
      width: 210,
      render: (_value, record, index) => (
        <Select
          showSearch
          allowClear
          disabled={isView}
          value={record.batchNo || undefined}
          placeholder="Batch No from Inventory"
          optionFilterProp="label"
          options={getBatchOptions(record)}
          data-testid="do-item-batch-no"
          style={{ width: '100%' }}
          onChange={(value) =>
            autoFillFromInventory(index, {
              batchNo: value || '',
            })
          }
          onSearch={(value) =>
            updateItem(index, {
              batchNo: value,
            })
          }
          onBlur={() =>
            autoFillFromInventory(index, {
              batchNo: record.batchNo || '',
            })
          }
        />
      ),
    },
    {
      title: 'Plant',
      dataIndex: 'plant',
      width: 160,
      render: (_value, record, index) => (
        <Select
          showSearch
          allowClear
          disabled={isView}
          value={record.plant || undefined}
          placeholder="Plant"
          optionFilterProp="label"
          options={plantOptions}
          data-testid="do-item-plant"
          style={{ width: '100%' }}
          onChange={(value) =>
            autoFillFromInventory(index, {
              plant: value || '',
            })
          }
          onSearch={(value) =>
            updateItem(index, {
              plant: value,
            })
          }
        />
      ),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      width: 160,
      render: (_value, record, index) => (
        <Select
          showSearch
          allowClear
          disabled={isView}
          value={record.location || undefined}
          placeholder="Blank = flexible"
          optionFilterProp="label"
          options={locationOptions}
          data-testid="do-item-location"
          style={{ width: '100%' }}
          onChange={(value) =>
            autoFillFromInventory(index, {
              location: value || '',
            })
          }
          onSearch={(value) =>
            updateItem(index, {
              location: value,
            })
          }
        />
      ),
    },
    {
      title: 'Expiry Date',
      dataIndex: 'expiryDate',
      width: 150,
      render: (_value, record, index) => (
        <Input
          disabled={isView}
          value={record.expiryDate}
          placeholder="Blank = FEFO"
          data-testid="do-item-expiry-date"
          onChange={(event) =>
            autoFillFromInventory(index, {
              expiryDate: event.target.value,
            })
          }
        />
      ),
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      width: 120,
      align: 'right',
      render: (_value, record, index) => (
        <InputNumber
          disabled={isView}
          min={0}
          precision={3}
          value={Number(record.qty || 0)}
          placeholder="Qty"
          data-testid="do-item-qty"
          style={{ width: '100%' }}
          onChange={(value) =>
            updateItem(index, {
              qty: Number(value || 0),
            })
          }
        />
      ),
    },
    {
      title: 'UOM',
      dataIndex: 'uom',
      width: 130,
      render: (_value, record, index) => (
        <Select
          showSearch
          allowClear
          disabled={isView}
          value={record.uom || undefined}
          placeholder="UOM"
          optionFilterProp="label"
          options={uomOptions}
          data-testid="do-item-uom"
          style={{ width: '100%' }}
          onChange={(value) =>
            updateItem(index, {
              uom: value || '',
            })
          }
          onSearch={(value) =>
            updateItem(index, {
              uom: value,
            })
          }
        />
      ),
    },
    {
      title: 'Available',
      dataIndex: 'availableQty',
      width: 120,
      align: 'right',
      render: (_value, record) => {
        const availableQty = Number(record.availableQty || 0);
        const requestedQty = Number(record.qty || 0);

        if (!availableQty) return <Text type="secondary">-</Text>;

        return <Tag color={availableQty >= requestedQty ? 'green' : 'red'}>{availableQty}</Tag>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: (_value, _record, index) => {
        if (isView) return null;

        return (
          <Popconfirm
            title="Remove item?"
            okText="Yes"
            cancelText="No"
            onConfirm={() => removeItem(index)}
            disabled={items.length <= 1}
          >
            <Button danger size="small" icon={<DeleteOutlined />} disabled={items.length <= 1} data-testid="btn-delete-do-item" />
          </Popconfirm>
        );
      },
    },
  ];

  const modalTitle = mode === 'create' ? 'Create Delivery Order' : mode === 'edit' ? 'Edit Delivery Order' : 'View Delivery Order';

  return (
    <Modal
      open={open}
      title={modalTitle}
      onCancel={onCancel}
      width="95%"
      style={{ top: 24 }}
      footer={null}
      destroyOnHidden
      data-testid="modal-do-form"
    >
      <Form form={form} layout="vertical" disabled={isView} preserve={false}>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="DO No" name="doNo" rules={[{ required: true, message: 'Please enter DO No' }]}>
              <Input data-testid="do-no" placeholder="Auto generated or enter DO No" disabled={isView || mode === 'edit'} />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item label="Customer Code" name="customerCode" rules={[{ required: true, message: 'Please enter customer code' }]}>
              <Input data-testid="do-customer-code" placeholder="Enter customer code" disabled={isView} />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item label="Customer Name" name="customerName" rules={[{ required: true, message: 'Please enter customer name' }]}>
              <Input data-testid="do-customer-name" placeholder="Enter customer name" disabled={isView} />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item label="Status" name="status" rules={[{ required: true, message: 'Please select status' }]}>
              <Select
                data-testid="do-status"
                placeholder="Select status"
                disabled={isView || mode === 'create'}
                options={STATUS_OPTIONS.map((status) => ({
                  label: status,
                  value: status,
                }))}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item label="Required Date" name="requiredDate">
              <Input data-testid="do-required-date" placeholder="YYYY-MM-DD" disabled={isView} />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item label="Ship To" name="shipTo">
              <TextArea data-testid="do-ship-to" placeholder="Enter delivery address" rows={1} disabled={isView} />
            </Form.Item>
          </Col>

          <Col xs={24}>
            <Form.Item label="Remarks" name="remarks">
              <TextArea data-testid="do-remarks" placeholder="Enter remarks" rows={2} disabled={isView} />
            </Form.Item>
          </Col>
        </Row>

        <Divider titlePlacement="start">Delivery Order Items - Inventory Based</Divider>

        {!isView && (
          <Space style={{ marginBottom: 12 }} wrap>
            <Button icon={<PlusOutlined />} onClick={addItem} data-testid="btn-add-do-item">
              Add Item
            </Button>
            <Text type="secondary">
              Match rule: SKU + Batch No + Plant required. Location and Expiry are flexible. Source: Inventory.
            </Text>
            <Tag color="blue">Inventory rows loaded: {normalizedInventory.length}</Tag>
            <Tag color="green">Usable rows: {usableInventory.length}</Tag>
          </Space>
        )}

        <Table
          rowKey={(record) => record.id || String(record.lineNo)}
          columns={columns}
          dataSource={items}
          pagination={false}
          size="small"
          scroll={{ x: 1650 }}
          data-testid="table-do-items"
        />

        <Divider />

        <Row justify="end">
          <Space>
            <Button icon={<CloseOutlined />} onClick={onCancel} data-testid="btn-cancel-do">
              {isView ? 'Close' : 'Cancel'}
            </Button>

            {!isView && (
              <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSubmit} data-testid="btn-save-do">
                Save DO
              </Button>
            )}
          </Space>
        </Row>
      </Form>
    </Modal>
  );
}

