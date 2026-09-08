'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Row,
  Col,
  Divider,
  Space,
  AutoComplete,
  Alert,
  message,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

export type InventoryModalMode = 'add' | 'edit' | 'view';

export interface BatchInfo {
  batchNo: string;
  expiryDate?: string;
  qty: number;
  plant: string;
  location: string;
}

export interface InventoryFormValues {
  sku: string;
  name: string;
  category: string;
  location: string;
  qty: number;
  minQty: number;
  status: string;
  uom?: string;
  batches?: BatchInfo[];
}

interface InventoryFormModalProps {
  open: boolean;
  mode: InventoryModalMode;
  initialValues?: Partial<InventoryFormValues>;
  onCancel: () => void;
  onSubmit: (values: InventoryFormValues) => void;
}

interface MasterProduct {
  sku: string;
  name: string;
  category?: string;
  uom?: string;
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

const UOM_STORAGE_KEYS = ['wms_uom_master', 'uom_master', 'uoms', 'wms_uoms'];

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

const fallbackCategoryOptions = [
  {
    label: 'Electronics',
    value: 'Electronics',
  },
  {
    label: 'Accessories',
    value: 'Accessories',
  },
  {
    label: 'Hardware',
    value: 'Hardware',
  },
  {
    label: 'Office Supplies',
    value: 'Office Supplies',
  },
  {
    label: 'Packaging',
    value: 'Packaging',
  },
  {
    label: 'Other',
    value: 'Other',
  },
];

const statusOptions = [
  {
    label: 'Active',
    value: 'Active',
  },
  {
    label: 'Inactive',
    value: 'Inactive',
  },
];

const fallbackUomOptions = [
  {
    label: 'PCS - Pieces',
    value: 'PCS',
  },
  {
    label: 'CTN - Carton',
    value: 'CTN',
  },
  {
    label: 'KG - Kilogram',
    value: 'KG',
  },
  {
    label: 'L - Liter',
    value: 'L',
  },
];

const emptyBatch: BatchInfo = {
  batchNo: '',
  expiryDate: '',
  qty: 0,
  plant: '',
  location: '',
};

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
    'uoms',
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

  const name = normalizeText(
    item?.name ??
      item?.productName ??
      item?.product_name ??
      item?.description ??
      ''
  );

  if (!sku && !name) return null;

  return {
    sku,
    name: name || sku,
    category: normalizeText(item?.category ?? item?.productCategory ?? ''),
    uom: normalizeText(
      item?.uom ??
        item?.UOM ??
        item?.baseUom ??
        item?.baseUOM ??
        item?.base_uom ??
        item?.purchaseUom ??
        item?.purchaseUOM ??
        ''
    ),
    status: normalizeText(item?.status || 'Active'),
  };
}

function normalizeSimpleMaster(item: any): SimpleMaster | null {
  const code = normalizeText(
    item?.code ??
      item?.plantCode ??
      item?.locationCode ??
      item?.uomCode ??
      item?.uom ??
      item?.UOM ??
      item?.name ??
      ''
  );

  const name = normalizeText(
    item?.name ??
      item?.plantName ??
      item?.locationName ??
      item?.uomName ??
      item?.description ??
      code
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
    const key = normalizeText(record.code).toUpperCase();

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
    const key = normalizeText(record.sku).toUpperCase();

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

function normalizeBatchRows(
  batches?: Partial<BatchInfo>[],
  fallbackLocation?: string,
  fallbackQty?: number
): BatchInfo[] {
  if (batches && batches.length > 0) {
    return batches.map((batch) => ({
      batchNo: normalizeText(batch.batchNo),
      expiryDate: normalizeText(batch.expiryDate),
      qty: Number(batch.qty || 0),
      plant: normalizeText(batch.plant),
      location: normalizeText(batch.location || fallbackLocation),
    }));
  }

  return [
    {
      ...emptyBatch,
      qty: Number(fallbackQty || 0),
      location: normalizeText(fallbackLocation),
    },
  ];
}

export default function InventoryFormModal({
  open,
  mode,
  initialValues,
  onCancel,
  onSubmit,
}: InventoryFormModalProps) {
  const [form] = Form.useForm<InventoryFormValues>();

  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [uoms, setUoms] = useState<SimpleMaster[]>([]);
  const [plants, setPlants] = useState<SimpleMaster[]>([]);
  const [locations, setLocations] = useState<SimpleMaster[]>([]);

  const isViewMode = mode === 'view';

  const watchedBatches = Form.useWatch('batches', form);

  const modalTitle =
    mode === 'add'
      ? '➕ Add Inventory Product'
      : mode === 'edit'
        ? '✏️ Edit Inventory Product'
        : '👁️ View Inventory Product';

  useEffect(() => {
    if (!open) return;

    const productRows = readArrayFromStorage(PRODUCT_STORAGE_KEYS, [
      'products',
      'data',
    ]);

    const uomRows = readArrayFromStorage(UOM_STORAGE_KEYS, ['uoms', 'data']);

    const plantRows = readArrayFromStorage(PLANT_STORAGE_KEYS, [
      'plants',
      'data',
    ]);

    const locationRows = readArrayFromStorage(LOCATION_STORAGE_KEYS, [
      'locations',
      'data',
    ]);

    const productList = uniqueProducts(
      productRows
        .map(normalizeProduct)
        .filter(isMasterProduct)
        .filter((item) => isActiveRecord(item.status))
    );

    const uomList = uniqueByCode(
      uomRows
        .map(normalizeSimpleMaster)
        .filter(isSimpleMaster)
        .filter((item) => isActiveRecord(item.status))
    );

    const plantList = uniqueByCode(
      plantRows
        .map(normalizeSimpleMaster)
        .filter(isSimpleMaster)
        .filter((item) => isActiveRecord(item.status))
    );

    const locationList = uniqueByCode(
      locationRows
        .map(normalizeSimpleMaster)
        .filter(isSimpleMaster)
        .filter((item) => isActiveRecord(item.status))
    );

    setProducts(productList);
    setUoms(uomList);
    setPlants(plantList);
    setLocations(locationList);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (initialValues) {
      const normalizedBatches = normalizeBatchRows(
        initialValues.batches,
        initialValues.location,
        initialValues.qty
      );

      const totalQty = normalizedBatches.reduce(
        (sum, batch) => sum + Number(batch.qty || 0),
        0
      );

      form.setFieldsValue({
        sku: initialValues.sku || '',
        name: initialValues.name || '',
        category: initialValues.category || '',
        location: initialValues.location || normalizedBatches[0]?.location || '',
        qty: totalQty,
        minQty: Number(initialValues.minQty || 0),
        status: initialValues.status || 'Active',
        uom: initialValues.uom || 'PCS',
        batches: normalizedBatches,
      });
    } else {
      form.resetFields();

      form.setFieldsValue({
        sku: '',
        name: '',
        category: '',
        location: '',
        qty: 0,
        minQty: 0,
        status: 'Active',
        uom: 'PCS',
        batches: [{ ...emptyBatch }],
      });
    }
  }, [open, initialValues, form]);

  useEffect(() => {
    if (!open) return;

    const totalQty = (watchedBatches || []).reduce((sum, batch) => {
      return sum + Number(batch?.qty || 0);
    }, 0);

    form.setFieldsValue({
      qty: totalQty,
      location: normalizeText(watchedBatches?.[0]?.location),
    });
  }, [open, watchedBatches, form]);

  const productOptions = useMemo(() => {
    return products.map((product) => ({
      value: product.sku,
      label: `${product.sku} - ${product.name}`,
    }));
  }, [products]);

  const categoryOptions = useMemo(() => {
    const categoryMap = new Map<string, string>();

    fallbackCategoryOptions.forEach((item) => {
      categoryMap.set(item.value.toUpperCase(), item.value);
    });

    products.forEach((product) => {
      const category = normalizeText(product.category);

      if (category) {
        categoryMap.set(category.toUpperCase(), category);
      }
    });

    return Array.from(categoryMap.values()).map((category) => ({
      label: category,
      value: category,
    }));
  }, [products]);

  const uomOptions = useMemo(() => {
    if (uoms.length === 0) return fallbackUomOptions;

    return uoms.map((uom) => ({
      value: uom.code,
      label: uom.code && uom.code !== uom.name ? `${uom.code} - ${uom.name}` : uom.name,
    }));
  }, [uoms]);

  const plantOptions = useMemo(() => {
    return plants.map((plant) => ({
      value: plant.code,
      label: plant.code && plant.code !== plant.name ? `${plant.code} - ${plant.name}` : plant.name,
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

  const findProduct = (sku?: string) => {
    if (!sku) return undefined;

    return products.find((product) => {
      return (
        normalizeText(product.sku).toUpperCase() ===
        normalizeText(sku).toUpperCase()
      );
    });
  };

  const handleSkuSelect = (sku?: string) => {
    const product = findProduct(sku);

    if (!product) return;

    form.setFieldsValue({
      sku: product.sku,
      name: product.name,
      category: product.category || form.getFieldValue('category') || '',
      uom: product.uom || form.getFieldValue('uom') || 'PCS',
      status: product.status || form.getFieldValue('status') || 'Active',
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const cleanedBatches = (values.batches || [])
        .filter((batch) => {
          return (
            normalizeText(batch?.batchNo) ||
            normalizeText(batch?.expiryDate) ||
            Number(batch?.qty || 0) > 0 ||
            normalizeText(batch?.plant) ||
            normalizeText(batch?.location)
          );
        })
        .map((batch) => ({
          batchNo: normalizeText(batch.batchNo),
          expiryDate: normalizeText(batch.expiryDate),
          qty: Number(batch.qty || 0),
          plant: normalizeText(batch.plant),
          location: normalizeText(batch.location),
        }));

      if (cleanedBatches.length === 0) {
        message.error('Please add at least one batch/location row.');
        return;
      }

      const totalQty = cleanedBatches.reduce(
        (sum, batch) => sum + Number(batch.qty || 0),
        0
      );

      const firstLocation = cleanedBatches[0]?.location || '';

      const payload: InventoryFormValues = {
        sku: normalizeText(values.sku),
        name: normalizeText(values.name),
        category: normalizeText(values.category),
        location: firstLocation,
        qty: totalQty,
        minQty: Number(values.minQty || 0),
        status: normalizeText(values.status || 'Active'),
        uom: normalizeText(values.uom || 'PCS'),
        batches: cleanedBatches,
      };

      onSubmit(payload);

      form.resetFields();
    } catch (error) {
      console.error('Inventory form validation failed:', error);
    }
  };

  return (
    <Modal
      title={modalTitle}
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText={mode === 'add' ? 'Add Product' : 'Save Changes'}
      cancelText="Cancel"
      width={1000}
      destroyOnHidden
      footer={
        isViewMode
          ? [
              <Button key="close" onClick={onCancel}>
                Close
              </Button>,
            ]
          : undefined
      }
    >
      <Form form={form} layout="vertical" disabled={isViewMode}>
        <title
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Inventory Batch / Location Management"
          description="Total quantity is automatically calculated from all batch/location rows below."
        />

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item
              label="SKU"
              name="sku"
              rules={[
                {
                  required: true,
                  message: 'Please enter SKU',
                },
              ]}
            >
              <AutoComplete
                options={productOptions}
                placeholder="Example: SKU-001"
                onSelect={(value) => handleSkuSelect(String(value))}
                onBlur={() => {
                  const sku = form.getFieldValue('sku');
                  handleSkuSelect(sku);
                }}
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
              label="Product Name"
              name="name"
              rules={[
                {
                  required: true,
                  message: 'Please enter product name',
                },
              ]}
            >
              <Input placeholder="Example: Wireless Mouse" />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item
              label="Category"
              name="category"
              rules={[
                {
                  required: true,
                  message: 'Please select category',
                },
              ]}
            >
              <Select
                placeholder="Select category"
                options={categoryOptions}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={6}>
            <Form.Item
              label="UOM"
              name="uom"
              rules={[
                {
                  required: true,
                  message: 'Please select UOM',
                },
              ]}
            >
              <Select
                placeholder="Select UOM"
                options={uomOptions}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={6}>
            <Form.Item
              label="Total Quantity"
              name="qty"
              rules={[
                {
                  required: true,
                  message: 'Please enter quantity',
                },
              ]}
            >
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                placeholder="Auto-calculated"
                disabled
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={6}>
            <Form.Item
              label="Minimum Quantity"
              name="minQty"
              rules={[
                {
                  required: true,
                  message: 'Please enter minimum quantity',
                },
              ]}
            >
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                placeholder="Example: 10"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={6}>
            <Form.Item
              label="Status"
              name="status"
              rules={[
                {
                  required: true,
                  message: 'Please select status',
                },
              ]}
            >
              <Select
                placeholder="Select status"
                options={statusOptions}
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="location" hidden>
          <Input />
        </Form.Item>

        <Divider orientation="left">Batch / Expiry / Plant / Location</Divider>

        <Form.List name="batches">
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
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <strong>Batch Row #{index + 1}</strong>

                    {!isViewMode && (
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
                        label="Batch No."
                        name={[field.name, 'batchNo']}
                        rules={[
                          {
                            required: true,
                            message: 'Please enter batch no.',
                          },
                        ]}
                      >
                        <Input placeholder="Example: BATCH-001" />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Expiry Date"
                        name={[field.name, 'expiryDate']}
                      >
                        <Input type="date" />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Batch Quantity"
                        name={[field.name, 'qty']}
                        rules={[
                          {
                            required: true,
                            message: 'Please enter batch quantity',
                          },
                          {
                            validator: async (_, value) => {
                              if (Number(value) >= 0) return;

                              throw new Error('Batch quantity cannot be negative');
                            },
                          },
                        ]}
                      >
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          placeholder="Example: 100"
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Plant"
                        name={[field.name, 'plant']}
                        rules={[
                          {
                            required: true,
                            message: 'Please enter plant',
                          },
                        ]}
                      >
                        <AutoComplete
                          options={plantOptions}
                          placeholder="Example: PLANT-01"
                          filterOption={(inputValue, option) =>
                            String(option?.label ?? option?.value ?? '')
                              .toUpperCase()
                              .includes(inputValue.toUpperCase())
                          }
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item
                        label="Location"
                        name={[field.name, 'location']}
                        rules={[
                          {
                            required: true,
                            message: 'Please enter location',
                          },
                        ]}
                      >
                        <AutoComplete
                          options={locationOptions}
                          placeholder="Example: A-01-01"
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

              {!isViewMode && (
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ ...emptyBatch })}
                  block
                >
                  Add Batch / Location Row
                </Button>
              )}
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}