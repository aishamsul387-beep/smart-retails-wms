'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Space,
  Row,
  Col,
  Divider,
  AutoComplete,
  Alert,
  message,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

export type GRNStatus =
  | 'Draft'
  | 'Pending'
  | 'Inspecting'
  | 'Received'
  | 'Cancelled';

export interface GRNItem {
  productCode: string;
  productName: string;
  batchNo: string;
  expiryDate?: string;
  qty: number;
  uom?: string;
  plant: string;
  location: string;
}

export interface GRNRecord {
  id: string;
  grnNo: string;
  supplier: string;
  poNo?: string;
  doNo?: string;
  invoiceNo?: string;
  referenceNo?: string;
  grnDate: string;
  status: GRNStatus;
  remarks?: string;
  items: GRNItem[];

  posted?: boolean;
  postedAt?: string;
  postedBy?: string;

  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;

  managerEdited?: boolean;
  managerEditedAt?: string;
  managerEditedBy?: string;
  managerEditReason?: string;
}

interface GRNFormModalProps {
  open: boolean;
  mode: 'create' | 'edit' | 'view';
  initialValues?: GRNRecord | null;
  currentUserLoginId?: string;
  requireManagerEditReason?: boolean;
  onCancel: () => void;
  onSubmit: (values: GRNRecord) => void;
}

interface MasterProduct {
  sku: string;
  productName: string;
  baseUom?: string;
  purchaseUom?: string;
  salesUom?: string;
  batchRequired?: boolean;
  expiryRequired?: boolean;
  status?: string;
}

interface SimpleMaster {
  code: string;
  name: string;
  status?: string;
  plant?: string;
}

const PRODUCT_STORAGE_KEYS = [
  'wms_product_master',
  'product_master',
  'products',
  'wms_products',
];

const INVENTORY_STORAGE_KEYS = [
  'inventory_records',
  'wms_inventory',
  'inventory',
  'wms_inventory_items',
];

const UOM_STORAGE_KEYS = ['wms_uom_master', 'uom_master', 'uoms', 'wms_uoms'];

const SUPPLIER_STORAGE_KEYS = [
  'wms_supplier_master',
  'supplier_master',
  'suppliers',
  'wms_suppliers',
];

const PLANT_STORAGE_KEYS = [
  'wms_plant_master',
  'plant_master',
  'plants',
  'wms_plants',
];

const LOCATION_STORAGE_KEYS = [
  'wms_location_master',
  'location_master',
  'locations',
  'wms_locations',
];

const emptyItem: GRNItem = {
  productCode: '',
  productName: '',
  batchNo: '',
  expiryDate: '',
  qty: 1,
  uom: 'PCS',
  plant: '',
  location: '',
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function nowIsoString() {
  return new Date().toISOString();
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function readArrayFromStorage(keys: string[], nestedKeys: string[] = []) {
  if (typeof window === 'undefined') return [];

  const defaultNestedKeys = [
    'data',
    'records',
    'items',
    'products',
    'inventory',
    'uoms',
    'suppliers',
    'plants',
    'locations',
  ];

  const allNestedKeys = Array.from(new Set([...nestedKeys, ...defaultNestedKeys]));

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);

      if (!raw) continue;

      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        return parsed;
      }

      for (const nestedKey of allNestedKeys) {
        if (Array.isArray(parsed?.[nestedKey])) {
          return parsed[nestedKey];
        }
      }
    } catch (error) {
      console.error(`Failed to read localStorage key: ${key}`, error);
    }
  }

  return [];
}

function normalizeBool(value: unknown) {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'number') return value === 1;

  const text = String(value || '').trim().toLowerCase();

  return ['yes', 'y', 'true', '1', 'required', 'enable', 'enabled'].includes(
    text
  );
}

function isActiveRecord(status?: string) {
  if (!status) return true;

  return String(status).trim().toLowerCase() !== 'inactive';
}

function normalizeProduct(item: any): MasterProduct | null {
  const sku = normalizeText(
    item?.sku ??
      item?.SKU ??
      item?.productCode ??
      item?.product_code ??
      item?.code ??
      item?.itemCode ??
      ''
  );

  const productName = normalizeText(
    item?.productName ??
      item?.product_name ??
      item?.name ??
      item?.description ??
      ''
  );

  if (!sku && !productName) return null;

  return {
    sku,
    productName: productName || sku,
    baseUom: normalizeText(
      item?.baseUom ??
        item?.baseUOM ??
        item?.base_uom ??
        item?.uom ??
        item?.UOM ??
        ''
    ),
    purchaseUom: normalizeText(
      item?.purchaseUom ??
        item?.purchaseUOM ??
        item?.purchase_uom ??
        item?.buyUom ??
        item?.buyUOM ??
        ''
    ),
    salesUom: normalizeText(
      item?.salesUom ??
        item?.salesUOM ??
        item?.sales_uom ??
        item?.sellUom ??
        item?.sellUOM ??
        ''
    ),
    batchRequired: normalizeBool(
      item?.batchRequired ??
        item?.batchControl ??
        item?.batch_control ??
        item?.batch ??
        item?.isBatch
    ),
    expiryRequired: normalizeBool(
      item?.expiryRequired ??
        item?.expiryControl ??
        item?.expiry_control ??
        item?.expiry ??
        item?.isExpiry
    ),
    status: normalizeText(item?.status || 'Active'),
  };
}

function normalizeUom(item: any): SimpleMaster | null {
  const code = normalizeText(
    item?.code ?? item?.uomCode ?? item?.uom ?? item?.UOM ?? item?.name ?? ''
  );

  const name = normalizeText(item?.name ?? item?.uomName ?? item?.description ?? code);

  if (!code) return null;

  return {
    code,
    name: name || code,
    status: normalizeText(item?.status || 'Active'),
  };
}

function normalizeSupplier(item: any): SimpleMaster | null {
  const code = normalizeText(item?.supplierCode ?? item?.code ?? item?.id ?? '');

  const name = normalizeText(
    item?.supplierName ?? item?.name ?? item?.companyName ?? ''
  );

  if (!code && !name) return null;

  return {
    code: code || name,
    name: name || code,
    status: normalizeText(item?.status || 'Active'),
  };
}

function normalizePlant(item: any): SimpleMaster | null {
  const code = normalizeText(
    item?.plantCode ?? item?.code ?? item?.plant ?? item?.name ?? ''
  );

  const name = normalizeText(item?.plantName ?? item?.name ?? item?.description ?? code);

  if (!code) return null;

  return {
    code,
    name: name || code,
    status: normalizeText(item?.status || 'Active'),
  };
}

function normalizeLocation(item: any): SimpleMaster | null {
  const code = normalizeText(
    item?.locationCode ?? item?.code ?? item?.location ?? item?.name ?? ''
  );

  const name = normalizeText(
    item?.locationName ?? item?.name ?? item?.description ?? code
  );

  const plant = normalizeText(item?.plantCode ?? item?.plant ?? item?.plantName ?? '');

  if (!code) return null;

  return {
    code,
    name: name || code,
    plant,
    status: normalizeText(item?.status || 'Active'),
  };
}

function uniqueByCode<T extends { code: string }>(records: T[]) {
  const map = new Map<string, T>();

  records.forEach((record) => {
    const key = String(record.code || '').trim().toUpperCase();

    if (!key) return;

    if (!map.has(key)) {
      map.set(key, record);
    }
  });

  return Array.from(map.values());
}

function uniqueProducts(records: MasterProduct[]) {
  const map = new Map<string, MasterProduct>();

  records.forEach((record) => {
    const key = String(record.sku || '').trim().toUpperCase();

    if (!key) return;

    if (!map.has(key)) {
      map.set(key, record);
    }
  });

  return Array.from(map.values());
}

function isMasterProduct(value: MasterProduct | null): value is MasterProduct {
  return Boolean(value);
}

function isSimpleMaster(value: SimpleMaster | null): value is SimpleMaster {
  return Boolean(value);
}

export default function GRNFormModal({
  open,
  mode,
  initialValues,
  currentUserLoginId,
  requireManagerEditReason = false,
  onCancel,
  onSubmit,
}: GRNFormModalProps) {
  const [form] = Form.useForm<GRNRecord>();

  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [uoms, setUoms] = useState<SimpleMaster[]>([]);
  const [suppliers, setSuppliers] = useState<SimpleMaster[]>([]);
  const [plants, setPlants] = useState<SimpleMaster[]>([]);
  const [locations, setLocations] = useState<SimpleMaster[]>([]);

  const isView = mode === 'view';

  const isPostedEdit =
    mode === 'edit' &&
    (initialValues?.status === 'Received' ||
      initialValues?.posted === true ||
      Boolean((initialValues as any)?.inventoryPosted));

  useEffect(() => {
    if (!open) return;

    const productRows = [
      ...readArrayFromStorage(PRODUCT_STORAGE_KEYS, ['products', 'data']),
      ...readArrayFromStorage(INVENTORY_STORAGE_KEYS, ['inventory', 'data']),
    ];

    const productList = uniqueProducts(
      productRows
        .map(normalizeProduct)
        .filter(isMasterProduct)
        .filter((item) => isActiveRecord(item.status))
    );

    const uomRows = readArrayFromStorage(UOM_STORAGE_KEYS, ['uoms', 'data']);

    const supplierRows = readArrayFromStorage(SUPPLIER_STORAGE_KEYS, [
      'suppliers',
      'data',
    ]);

    const plantRows = readArrayFromStorage(PLANT_STORAGE_KEYS, [
      'plants',
      'data',
    ]);

    const locationRows = readArrayFromStorage(LOCATION_STORAGE_KEYS, [
      'locations',
      'data',
    ]);

    const uomList = uniqueByCode(
      uomRows
        .map(normalizeUom)
        .filter(isSimpleMaster)
        .filter((item) => isActiveRecord(item.status))
    );

    const supplierList = uniqueByCode(
      supplierRows
        .map(normalizeSupplier)
        .filter(isSimpleMaster)
        .filter((item) => isActiveRecord(item.status))
    );

    const plantList = uniqueByCode(
      plantRows
        .map(normalizePlant)
        .filter(isSimpleMaster)
        .filter((item) => isActiveRecord(item.status))
    );

    const locationList = uniqueByCode(
      locationRows
        .map(normalizeLocation)
        .filter(isSimpleMaster)
        .filter((item) => isActiveRecord(item.status))
    );

    setProducts(productList);

    setUoms(
      uomList.length > 0
        ? uomList
        : [
            { code: 'PCS', name: 'Pieces' },
            { code: 'CTN', name: 'Carton' },
            { code: 'KG', name: 'Kilogram' },
            { code: 'L', name: 'Liter' },
          ]
    );

    setSuppliers(supplierList);
    setPlants(plantList);
    setLocations(locationList);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (initialValues) {
      form.setFieldsValue({
        ...initialValues,
        managerEditReason: requireManagerEditReason
          ? ''
          : initialValues.managerEditReason,
        items:
          initialValues.items && initialValues.items.length > 0
            ? initialValues.items
            : [{ ...emptyItem }],
      });
    } else {
      form.setFieldsValue({
        id: '',
        grnNo: '',
        supplier: '',
        poNo: '',
        doNo: '',
        invoiceNo: '',
        referenceNo: '',
        grnDate: todayString(),
        status: 'Draft',
        remarks: '',
        managerEditReason: '',
        items: [{ ...emptyItem }],
      });
    }
  }, [open, initialValues, requireManagerEditReason, form]);

  const productOptions = useMemo(() => {
    return products.map((product) => ({
      value: product.sku,
      label: `${product.sku} - ${product.productName}`,
    }));
  }, [products]);

  const supplierOptions = useMemo(() => {
    return suppliers.map((supplier) => ({
      value: supplier.name,
      label:
        supplier.code && supplier.code !== supplier.name
          ? `${supplier.code} - ${supplier.name}`
          : supplier.name,
    }));
  }, [suppliers]);

  const plantOptions = useMemo(() => {
    return plants.map((plant) => ({
      value: plant.code,
      label:
        plant.code && plant.code !== plant.name
          ? `${plant.code} - ${plant.name}`
          : plant.name,
    }));
  }, [plants]);

  const locationOptions = useMemo(() => {
    return locations.map((location) => ({
      value: location.code,
      label: location.plant
        ? `${location.code} - ${location.name} (${location.plant})`
        : location.code && location.code !== location.name
          ? `${location.code} - ${location.name}`
          : location.name,
    }));
  }, [locations]);

  const uomOptions = useMemo(() => {
    return uoms.map((uom) => ({
      value: uom.code,
      label: uom.code && uom.code !== uom.name ? `${uom.code} - ${uom.name}` : uom.name,
    }));
  }, [uoms]);

  const findProduct = (sku?: string) => {
    if (!sku) return undefined;

    return products.find((product) => {
      return (
        String(product.sku).trim().toUpperCase() ===
        String(sku).trim().toUpperCase()
      );
    });
  };

  const handleProductSelect = (rowIndex: number, sku?: string) => {
    if (!sku) return;

    const product = findProduct(sku);
    const items = form.getFieldValue('items') || [];

    const selectedUom =
      product?.purchaseUom || product?.baseUom || product?.salesUom || 'PCS';

    items[rowIndex] = {
      ...items[rowIndex],
      productCode: sku,
      productName: product?.productName || items[rowIndex]?.productName || '',
      uom: selectedUom,
      batchNo: items[rowIndex]?.batchNo || '',
      expiryDate: items[rowIndex]?.expiryDate || '',
      qty: items[rowIndex]?.qty || 1,
      plant: items[rowIndex]?.plant || '',
      location: items[rowIndex]?.location || '',
    };

    form.setFieldsValue({ items });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const cleanedItems = (values.items || [])
        .filter((item) => {
          return (
            normalizeText(item.productCode) ||
            normalizeText(item.productName) ||
            normalizeText(item.batchNo) ||
            normalizeText(item.plant) ||
            normalizeText(item.location)
          );
        })
        .map((item) => ({
          ...item,
          productCode: normalizeText(item.productCode),
          productName: normalizeText(item.productName),
          batchNo: normalizeText(item.batchNo),
          expiryDate: normalizeText(item.expiryDate),
          qty: Number(item.qty || 0),
          uom: normalizeText(item.uom || 'PCS'),
          plant: normalizeText(item.plant),
          location: normalizeText(item.location),
        }));

      if (cleanedItems.length === 0) {
        message.error('Please add at least one GRN item.');
        return;
      }

      const now = nowIsoString();

      const payload: GRNRecord = {
        ...values,
        id: values.id || initialValues?.id || `grn-${Date.now()}`,
        supplier: normalizeText(values.supplier),
        poNo: normalizeText(values.poNo),
        doNo: normalizeText(values.doNo),
        invoiceNo: normalizeText(values.invoiceNo),
        referenceNo: normalizeText(values.referenceNo),
        remarks: normalizeText(values.remarks),
        items: cleanedItems,
        createdAt:
          mode === 'create' ? initialValues?.createdAt || now : initialValues?.createdAt,
        createdBy:
          mode === 'create'
            ? initialValues?.createdBy || currentUserLoginId || ''
            : initialValues?.createdBy,
        updatedAt: mode === 'edit' ? now : initialValues?.updatedAt,
        updatedBy: mode === 'edit' ? currentUserLoginId || '' : initialValues?.updatedBy,
        managerEdited:
          requireManagerEditReason || initialValues?.managerEdited || false,
        managerEditedAt: requireManagerEditReason
          ? now
          : initialValues?.managerEditedAt,
        managerEditedBy: requireManagerEditReason
          ? currentUserLoginId || ''
          : initialValues?.managerEditedBy,
        managerEditReason: normalizeText(values.managerEditReason),
      };

      onSubmit(payload);
    } catch (error) {
      console.error('GRN validation failed:', error);
    }
  };

  return (
    <Modal
      open={open}
      title={
        mode === 'create'
          ? '➕ New GRN'
          : mode === 'edit' && isPostedEdit
            ? '🔐 Manager Edit Posted GRN'
            : mode === 'edit'
              ? '✏️ Edit GRN'
              : '👁️ View GRN'
      }
      onCancel={onCancel}
      width={1200}
      destroyOnHidden
      footer={
        isView
          ? [
              <Button key="close" onClick={onCancel}>
                Close
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={onCancel}>
                Cancel
              </Button>,
              <Button key="submit" type="primary" onClick={handleSubmit}>
                Save GRN
              </Button>,
            ]
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item name="id" hidden>
          <Input />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item
              label="GRN No."
              name="grnNo"
              rules={[{ required: true, message: 'Please enter GRN No.' }]}
            >
              <Input placeholder="GRN-001" disabled={isView} />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item
              label="Supplier"
              name="supplier"
              rules={[{ required: true, message: 'Please enter supplier' }]}
            >
              <AutoComplete
                options={supplierOptions}
                placeholder="Select or enter supplier"
                disabled={isView}
                filterOption={(inputValue, option) =>
                  String(option?.label ?? option?.value ?? '')
                    .toUpperCase()
                    .includes(inputValue.toUpperCase())
                }
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item
              label="GRN Date"
              name="grnDate"
              rules={[{ required: true, message: 'Please select GRN date' }]}
            >
              <Input type="date" disabled={isView} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={6}>
            <Form.Item label="PO No." name="poNo">
              <Input placeholder="PO No." disabled={isView} />
            </Form.Item>
          </Col>

          <Col xs={24} md={6}>
            <Form.Item label="DO No." name="doNo">
              <Input placeholder="DO No." disabled={isView} />
            </Form.Item>
          </Col>

          <Col xs={24} md={6}>
            <Form.Item label="Invoice No." name="invoiceNo">
              <Input placeholder="Invoice No." disabled={isView} />
            </Form.Item>
          </Col>

          <Col xs={24} md={6}>
            <Form.Item label="Reference No." name="referenceNo">
              <Input placeholder="Reference No." disabled={isView} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={6}>
            <Form.Item
              label="Status"
              name="status"
              rules={[{ required: true, message: 'Please select status' }]}
            >
              <Select disabled={isView}>
                <Select.Option value="Draft">Draft</Select.Option>
                <Select.Option value="Pending">Pending</Select.Option>
                <Select.Option value="Inspecting">Inspecting</Select.Option>
                <Select.Option value="Received">Received</Select.Option>
                <Select.Option value="Cancelled">Cancelled</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Divider titlePlacement="start">GRN Items / Batch Details</Divider>

        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => (
                <div
                  key={field.key}
                  style={{
                    border: '1px solid #f0f0f0',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 12,
                    background: '#fafafa',
                  }}
                >
                  <Space
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <strong>Item #{index + 1}</strong>

                    {!isView && (
                      <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(field.name)}
                      >
                        Remove
                      </Button>
                    )}
                  </Space>

                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item
                        label="SKU / Product Code"
                        name={[field.name, 'productCode']}
                        rules={[{ required: true, message: 'Enter product code' }]}
                      >
                        <AutoComplete
                          options={productOptions}
                          placeholder="Select or enter SKU"
                          disabled={isView}
                          onSelect={(value) =>
                            handleProductSelect(field.name, String(value))
                          }
                          onBlur={() => {
                            const sku = form.getFieldValue([
                              'items',
                              field.name,
                              'productCode',
                            ]);

                            handleProductSelect(field.name, sku);
                          }}
                          filterOption={(inputValue, option) =>
                            String(option?.label ?? option?.value ?? '')
                              .toUpperCase()
                              .includes(inputValue.toUpperCase())
                          }
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Product Name"
                        name={[field.name, 'productName']}
                        rules={[{ required: true, message: 'Enter product name' }]}
                      >
                        <Input
                          placeholder="Auto-filled from Product Master"
                          disabled={isView}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Batch No."
                        name={[field.name, 'batchNo']}
                        rules={[{ required: true, message: 'Enter batch no.' }]}
                      >
                        <Input placeholder="BATCH-001" disabled={isView} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Expiry Date" name={[field.name, 'expiryDate']}>
                        <Input type="date" disabled={isView} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Qty"
                        name={[field.name, 'qty']}
                        rules={[
                          { required: true, message: 'Enter qty' },
                          {
                            validator: async (_, value) => {
                              if (Number(value) > 0) return;

                              throw new Error('Qty must be greater than 0');
                            },
                          },
                        ]}
                      >
                        <InputNumber
                          min={1}
                          style={{ width: '100%' }}
                          disabled={isView}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        label="UOM"
                        name={[field.name, 'uom']}
                        rules={[{ required: true, message: 'Select UOM' }]}
                      >
                        <Select
                          showSearch
                          placeholder="Select UOM"
                          disabled={isView}
                          options={uomOptions}
                          optionFilterProp="label"
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Plant"
                        name={[field.name, 'plant']}
                        rules={[{ required: true, message: 'Enter plant' }]}
                      >
                        <AutoComplete
                          options={plantOptions}
                          placeholder="Select or enter plant"
                          disabled={isView}
                          filterOption={(inputValue, option) =>
                            String(option?.label ?? option?.value ?? '')
                              .toUpperCase()
                              .includes(inputValue.toUpperCase())
                          }
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Location"
                        name={[field.name, 'location']}
                        rules={[{ required: true, message: 'Enter location' }]}
                      >
                        <AutoComplete
                          options={locationOptions}
                          placeholder="Select or enter location"
                          disabled={isView}
                          filterOption={(inputValue, option) =>
                            String(option?.label ?? option?.value ?? '')
                              .toUpperCase()
                              .includes(inputValue.toUpperCase())
                          }
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              ))}

              {!isView && (
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ ...emptyItem })}
                  block
                >
                  Add Item / Batch Row
                </Button>
              )}
            </>
          )}
        </Form.List>

        <Divider />

        {requireManagerEditReason && (
          <>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Posted GRN Manager Edit"
              description={`This GRN has already been Received / Posted. You are editing using Manager permission${
                currentUserLoginId ? ` as ${currentUserLoginId}` : ''
              }. Please enter the correction reason for audit traceability.`}
            />

            <Form.Item
              label="Manager Edit Reason"
              name="managerEditReason"
              rules={[
                {
                  required: true,
                  message: 'Please enter manager edit reason',
                },
              ]}
            >
              <Input.TextArea
                rows={3}
                placeholder="Example: Correct received qty / batch no. / expiry date / location..."
                disabled={isView}
              />
            </Form.Item>
          </>
        )}

        <Form.Item label="Remarks" name="remarks">
          <Input.TextArea rows={3} placeholder="Remarks..." disabled={isView} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
