'use client';

import React, { useEffect, useMemo } from 'react';
import {
  Modal,
  Form,
  Select,
  InputNumber,
  Input,
  DatePicker,
  Alert,
  message,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const DEFAULT_PLANT = 'Plant A';

export type MovementType =
  | 'Stock In'
  | 'Stock Transfer'
  | 'Stock Adjustment'
  | 'Stock Depletion';

export interface InventoryBatch {
  batchNo: string;
  expiryDate?: string;
  qty: number;
  status?: string;
  plant?: string;
  location?: string;
}

export interface InventoryProduct {
  id?: string;
  key?: string;
  sku: string;
  productName?: string;
  name?: string;
  status?: string;
  location?: string;
  batches?: InventoryBatch[];
}

export interface StockMovementRecord {
  id: string;
  date: string;
  sku: string;
  productName: string;
  batchNo: string;
  type: MovementType;
  qty: number;
  reason?: string;
  referenceNo?: string;
  previousQty: number;
  newQty: number;
  expiryDate?: string;
  plant?: string;
  location?: string;
  fromPlant?: string;
  toPlant?: string;
  fromLocation?: string;
  toLocation?: string;
  destinationPreviousQty?: number;
  destinationNewQty?: number;
}

interface StockMovementModalProps {
  open: boolean;
  inventory: InventoryProduct[];
  onCancel: () => void;
  onSubmit: (record: StockMovementRecord) => void;
}

interface StockMovementFormValues {
  type: MovementType;
  sku: string;
  batchNo: string;
  qty: number;
  date?: Dayjs;
  expiryDate?: Dayjs;
  reason?: string;
  referenceNo?: string;
  stockInSource?: string;
  fromPlant?: string;
  toPlant?: string;
  fromLocation?: string;
  toLocation?: string;
}

function toNumber(value: unknown) {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed;
}

function getProductName(product?: InventoryProduct) {
  return product?.productName || product?.name || '';
}

function getBatchPlant(batch?: InventoryBatch) {
  return batch?.plant || DEFAULT_PLANT;
}

function getBatchLocation(product?: InventoryProduct, batch?: InventoryBatch) {
  return batch?.location || product?.location || '';
}

function getUniqueOptions(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  ).sort();
}

function formatExpiryDate(value: unknown) {
  if (!value) {
    return '';
  }

  if (dayjs.isDayjs(value)) {
    return value.format('YYYYMMDD');
  }

  return String(value);
}

export default function StockMovementModal({
  open,
  inventory,
  onCancel,
  onSubmit,
}: StockMovementModalProps) {
  const [form] = Form.useForm<StockMovementFormValues>();

  const movementType =
    (Form.useWatch('type', form) as MovementType | undefined) || 'Stock In';

  const selectedSku = Form.useWatch('sku', form) as string | undefined;
  const selectedBatchNo = Form.useWatch('batchNo', form) as string | undefined;
  const fromPlant = Form.useWatch('fromPlant', form) as string | undefined;
  const fromLocation = Form.useWatch('fromLocation', form) as string | undefined;
  const toPlant = Form.useWatch('toPlant', form) as string | undefined;
  const toLocation = Form.useWatch('toLocation', form) as string | undefined;

  const isStockIn = movementType === 'Stock In';
  const isTransfer = movementType === 'Stock Transfer';
  const isAdjustment = movementType === 'Stock Adjustment';
  const isDepletion = movementType === 'Stock Depletion';

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        type: 'Stock In',
        date: dayjs(),
        toPlant: DEFAULT_PLANT,
      });
    }
  }, [open, form]);

  const selectedProduct = useMemo(() => {
    return inventory.find((item) => item.sku === selectedSku);
  }, [inventory, selectedSku]);

  const globalPlantOptions = useMemo(() => {
    const plants = inventory.flatMap((product) =>
      (product.batches || []).map((batch) => getBatchPlant(batch))
    );

    return getUniqueOptions([DEFAULT_PLANT, ...plants]);
  }, [inventory]);

  const globalLocationOptions = useMemo(() => {
    const locations = inventory.flatMap((product) => [
      product.location,
      ...(product.batches || []).map((batch) =>
        getBatchLocation(product, batch)
      ),
    ]);

    return getUniqueOptions(locations);
  }, [inventory]);

  const sourcePlantOptions = useMemo(() => {
    if (!selectedProduct) {
      return globalPlantOptions;
    }

    const plants = (selectedProduct.batches || []).map((batch) =>
      getBatchPlant(batch)
    );

    return getUniqueOptions([DEFAULT_PLANT, ...plants]);
  }, [selectedProduct, globalPlantOptions]);

  const sourceLocationOptions = useMemo(() => {
    if (!selectedProduct) {
      return globalLocationOptions;
    }

    const locations = (selectedProduct.batches || [])
      .filter((batch) => {
        if (!fromPlant) {
          return true;
        }

        return getBatchPlant(batch) === fromPlant;
      })
      .map((batch) => getBatchLocation(selectedProduct, batch));

    return getUniqueOptions([selectedProduct.location, ...locations]);
  }, [selectedProduct, fromPlant, globalLocationOptions]);

  const sourceBatches = useMemo(() => {
    if (!selectedProduct || isStockIn) {
      return [];
    }

    return (selectedProduct.batches || []).filter((batch) => {
      const batchPlant = getBatchPlant(batch);
      const batchLocation = getBatchLocation(selectedProduct, batch);

      const plantMatched = fromPlant ? batchPlant === fromPlant : true;
      const locationMatched = fromLocation ? batchLocation === fromLocation : true;

      if (!plantMatched || !locationMatched) {
        return false;
      }

      if ((isTransfer || isDepletion) && Number(batch.qty || 0) <= 0) {
        return false;
      }

      return true;
    });
  }, [
    selectedProduct,
    isStockIn,
    isTransfer,
    isDepletion,
    fromPlant,
    fromLocation,
  ]);

  const selectedSourceBatch = useMemo(() => {
    if (!selectedBatchNo) {
      return undefined;
    }

    return sourceBatches.find((batch) => batch.batchNo === selectedBatchNo);
  }, [sourceBatches, selectedBatchNo]);

  const existingStockInBatch = useMemo(() => {
    if (!selectedProduct || !selectedBatchNo || !toPlant || !toLocation) {
      return undefined;
    }

    return (selectedProduct.batches || []).find((batch) => {
      return (
        batch.batchNo === selectedBatchNo &&
        getBatchPlant(batch) === toPlant &&
        getBatchLocation(selectedProduct, batch) === toLocation
      );
    });
  }, [selectedProduct, selectedBatchNo, toPlant, toLocation]);

  const destinationBatch = useMemo(() => {
    if (
      !selectedProduct ||
      !selectedBatchNo ||
      !toPlant ||
      !toLocation ||
      !isTransfer
    ) {
      return undefined;
    }

    return (selectedProduct.batches || []).find((batch) => {
      return (
        batch.batchNo === selectedBatchNo &&
        getBatchPlant(batch) === toPlant &&
        getBatchLocation(selectedProduct, batch) === toLocation
      );
    });
  }, [selectedProduct, selectedBatchNo, toPlant, toLocation, isTransfer]);

  const currentQty = isStockIn
    ? Number(existingStockInBatch?.qty || 0)
    : Number(selectedSourceBatch?.qty || 0);

  const resetMovementFields = () => {
    form.setFieldsValue({
      batchNo: undefined,
      qty: undefined,
      referenceNo: undefined,
      reason: undefined,
      stockInSource: undefined,
      expiryDate: undefined,
      fromPlant: undefined,
      fromLocation: undefined,
      toPlant: DEFAULT_PLANT,
      toLocation: undefined,
    });
  };

  const handleFinish = (values: StockMovementFormValues) => {
    const product = inventory.find((item) => item.sku === values.sku);

    if (!product) {
      message.error('Selected product was not found.');
      return;
    }

    const qty = toNumber(values.qty);
    const batchNo = String(values.batchNo || '').trim();
    const type = values.type;

    if (!batchNo) {
      message.error('Batch number is required.');
      return;
    }

    const movementDate = values.date
      ? values.date.format('YYYY-MM-DD')
      : dayjs().format('YYYY-MM-DD');

    const baseRecord = {
      id: `MOV-${Date.now()}`,
      date: movementDate,
      sku: product.sku,
      productName: getProductName(product),
      batchNo,
      type,
      qty,
      referenceNo: values.referenceNo || '',
    };

    if (type === 'Stock In') {
      const stockInPlant = values.toPlant || DEFAULT_PLANT;
      const stockInLocation = values.toLocation || product.location || '';

      const existingBatch = (product.batches || []).find((batch) => {
        return (
          batch.batchNo === batchNo &&
          getBatchPlant(batch) === stockInPlant &&
          getBatchLocation(product, batch) === stockInLocation
        );
      });

      const previousQty = Number(existingBatch?.qty || 0);
      const newQty = previousQty + qty;
      const stockInSource = values.stockInSource || '';
      const manualReason = values.reason || '';

      const record: StockMovementRecord = {
        ...baseRecord,
        previousQty,
        newQty,
        expiryDate:
          formatExpiryDate(values.expiryDate) || existingBatch?.expiryDate || '',
        plant: stockInPlant,
        location: stockInLocation,
        toPlant: stockInPlant,
        toLocation: stockInLocation,
        reason: [stockInSource, manualReason].filter(Boolean).join(' - '),
      };

      onSubmit(record);
      return;
    }

    if (type === 'Stock Transfer') {
      const sourceBatch = (product.batches || []).find((batch) => {
        return (
          batch.batchNo === batchNo &&
          getBatchPlant(batch) === values.fromPlant &&
          getBatchLocation(product, batch) === values.fromLocation
        );
      });

      if (!sourceBatch) {
        message.error('Source batch was not found.');
        return;
      }

      const previousQty = Number(sourceBatch.qty || 0);
      const newQty = previousQty - qty;

      const existingDestinationBatch = (product.batches || []).find((batch) => {
        return (
          batch.batchNo === batchNo &&
          getBatchPlant(batch) === values.toPlant &&
          getBatchLocation(product, batch) === values.toLocation
        );
      });

      const destinationPreviousQty = Number(existingDestinationBatch?.qty || 0);
      const destinationNewQty = destinationPreviousQty + qty;

      const record: StockMovementRecord = {
        ...baseRecord,
        previousQty,
        newQty,
        expiryDate: sourceBatch.expiryDate || '',
        fromPlant: values.fromPlant,
        fromLocation: values.fromLocation,
        toPlant: values.toPlant,
        toLocation: values.toLocation,
        destinationPreviousQty,
        destinationNewQty,
        reason: values.reason || '',
      };

      onSubmit(record);
      return;
    }

    if (type === 'Stock Adjustment') {
      const batch = (product.batches || []).find((item) => {
        return (
          item.batchNo === batchNo &&
          getBatchPlant(item) === values.fromPlant &&
          getBatchLocation(product, item) === values.fromLocation
        );
      });

      if (!batch) {
        message.error('Batch was not found for adjustment.');
        return;
      }

      const previousQty = Number(batch.qty || 0);
      const newQty = qty;

      const record: StockMovementRecord = {
        ...baseRecord,
        previousQty,
        newQty,
        expiryDate: batch.expiryDate || '',
        plant: values.fromPlant,
        location: values.fromLocation,
        fromPlant: values.fromPlant,
        fromLocation: values.fromLocation,
        reason: values.reason || '',
      };

      onSubmit(record);
      return;
    }

    if (type === 'Stock Depletion') {
      const batch = (product.batches || []).find((item) => {
        return (
          item.batchNo === batchNo &&
          getBatchPlant(item) === values.fromPlant &&
          getBatchLocation(product, item) === values.fromLocation
        );
      });

      if (!batch) {
        message.error('Batch was not found for depletion.');
        return;
      }

      const previousQty = Number(batch.qty || 0);
      const newQty = previousQty - qty;

      const record: StockMovementRecord = {
        ...baseRecord,
        previousQty,
        newQty,
        expiryDate: batch.expiryDate || '',
        plant: values.fromPlant,
        location: values.fromLocation,
        fromPlant: values.fromPlant,
        fromLocation: values.fromLocation,
        reason: values.reason || '',
      };

      onSubmit(record);
    }
  };

  return (
    <Modal
      title="Stock Movement"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="Save Movement"
      destroyOnHidden
      width={760}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          label="Movement Type"
          name="type"
          rules={[{ required: true, message: 'Please select movement type' }]}
        >
          <Select
            onChange={() => {
              resetMovementFields();
            }}
          >
            <Option value="Stock In">Stock In</Option>
            <Option value="Stock Transfer">Stock Transfer</Option>
            <Option value="Stock Adjustment">Stock Adjustment</Option>
            <Option value="Stock Depletion">Stock Depletion</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Product"
          name="sku"
          rules={[{ required: true, message: 'Please select product' }]}
        >
          <Select
            showSearch
            placeholder="Select product"
            optionFilterProp="children"
            onChange={() => {
              form.setFieldsValue({
                batchNo: undefined,
                qty: undefined,
                fromPlant: undefined,
                fromLocation: undefined,
                toPlant: DEFAULT_PLANT,
                toLocation: undefined,
                expiryDate: undefined,
              });
            }}
          >
            {inventory.map((item) => (
              <Option key={item.sku} value={item.sku}>
                {item.sku} - {getProductName(item)}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {!isStockIn && (
          <>
            <Form.Item
              label="From Plant"
              name="fromPlant"
              rules={[
                { required: true, message: 'Please select source plant' },
              ]}
            >
              <Select
                placeholder="Select source plant"
                disabled={!selectedProduct}
                onChange={() => {
                  form.setFieldsValue({
                    fromLocation: undefined,
                    batchNo: undefined,
                    qty: undefined,
                  });
                }}
              >
                {sourcePlantOptions.map((plant) => (
                  <Option key={plant} value={plant}>
                    {plant}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="From Location"
              name="fromLocation"
              rules={[
                { required: true, message: 'Please select source location' },
              ]}
            >
              <Select
                placeholder="Select source location"
                disabled={!selectedProduct || !fromPlant}
                onChange={() => {
                  form.setFieldsValue({
                    batchNo: undefined,
                    qty: undefined,
                  });
                }}
              >
                {sourceLocationOptions.map((location) => (
                  <Option key={location} value={location}>
                    {location}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </>
        )}

        {isStockIn && (
          <>
            <Form.Item
              label="To Plant"
              name="toPlant"
              rules={[
                { required: true, message: 'Please select receiving plant' },
              ]}
            >
              <Select
                placeholder="Select receiving plant"
                disabled={!selectedProduct}
                onChange={() => {
                  form.setFieldsValue({
                    qty: undefined,
                  });
                }}
              >
                {globalPlantOptions.map((plant) => (
                  <Option key={plant} value={plant}>
                    {plant}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="To Location"
              name="toLocation"
              rules={[
                { required: true, message: 'Please select receiving location' },
              ]}
            >
              <Select
                showSearch
                placeholder="Select receiving location"
                disabled={!selectedProduct}
                optionFilterProp="children"
                onChange={() => {
                  form.setFieldsValue({
                    qty: undefined,
                  });
                }}
              >
                {globalLocationOptions.map((location) => (
                  <Option key={location} value={location}>
                    {location}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </>
        )}

        {isTransfer && (
          <>
            <Form.Item
              label="To Plant"
              name="toPlant"
              rules={[
                { required: true, message: 'Please select destination plant' },
              ]}
            >
              <Select
                placeholder="Select destination plant"
                disabled={!selectedProduct}
                onChange={() => {
                  form.validateFields(['qty']).catch(() => undefined);
                }}
              >
                {globalPlantOptions.map((plant) => (
                  <Option key={plant} value={plant}>
                    {plant}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="To Location"
              name="toLocation"
              rules={[
                {
                  required: true,
                  message: 'Please select destination location',
                },
              ]}
            >
              <Select
                showSearch
                placeholder="Select destination location"
                disabled={!selectedProduct}
                optionFilterProp="children"
                onChange={() => {
                  form.validateFields(['qty']).catch(() => undefined);
                }}
              >
                {globalLocationOptions.map((location) => (
                  <Option key={location} value={location}>
                    {location}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </>
        )}

        {isStockIn ? (
          <Form.Item
            label="Batch No."
            name="batchNo"
            rules={[{ required: true, message: 'Please enter batch number' }]}
          >
            <Input placeholder="Enter batch number, e.g. GRN-B001" />
          </Form.Item>
        ) : (
          <Form.Item
            label="Batch No."
            name="batchNo"
            rules={[{ required: true, message: 'Please select batch' }]}
          >
            <Select
              placeholder="Select batch"
              disabled={!selectedProduct || !fromPlant || !fromLocation}
              onChange={() => {
                form.setFieldsValue({ qty: undefined });
              }}
            >
              {sourceBatches.map((batch, index) => (
                <Option key={`${batch.batchNo}-${index}`} value={batch.batchNo}>
                  {batch.batchNo} | Qty: {batch.qty}
                  {batch.expiryDate ? ` | Exp: ${batch.expiryDate}` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        {isStockIn && (
          <Form.Item label="Expiry Date" name="expiryDate">
            <DatePicker style={{ width: '100%' }} format="YYYYMMDD" />
          </Form.Item>
        )}

        {selectedProduct && selectedBatchNo && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={
              isStockIn
                ? `Current quantity at destination: ${currentQty}`
                : `Current source batch quantity: ${currentQty}`
            }
          />
        )}

        {isTransfer &&
          fromPlant &&
          fromLocation &&
          toPlant &&
          toLocation &&
          fromPlant === toPlant &&
          fromLocation === toLocation && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Destination plant/location is same as source. Please choose a different destination."
            />
          )}

        {isTransfer && destinationBatch && (
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
            message={`Destination already has this batch. Current destination quantity: ${destinationBatch.qty}`}
          />
        )}

        {isStockIn && (
          <Form.Item
            label="Stock In Source"
            name="stockInSource"
            rules={[
              { required: true, message: 'Please select stock in source' },
            ]}
          >
            <Select placeholder="Select source">
              <Option value="GRN">GRN</Option>
              <Option value="FOC">FOC</Option>
              <Option value="Rebate">Rebate</Option>
              <Option value="Customer Return">Customer Return</Option>
              <Option value="Manual Stock In">Manual Stock In</Option>
            </Select>
          </Form.Item>
        )}

        <Form.Item
          label={
            isAdjustment
              ? 'New Final Quantity'
              : isDepletion
                ? 'Depletion Quantity'
                : 'Movement Quantity'
          }
          name="qty"
          rules={[
            { required: true, message: 'Please enter quantity' },
            {
              validator: (_, value) => {
                const qty = Number(value);

                if (isAdjustment) {
                  if (Number.isNaN(qty) || qty < 0) {
                    return Promise.reject(
                      new Error('New final quantity cannot be negative')
                    );
                  }

                  return Promise.resolve();
                }

                if (Number.isNaN(qty) || qty <= 0) {
                  return Promise.reject(
                    new Error('Quantity must be greater than 0')
                  );
                }

                if ((isTransfer || isDepletion) && !selectedSourceBatch) {
                  return Promise.reject(
                    new Error('Please select a valid source batch')
                  );
                }

                if ((isTransfer || isDepletion) && qty > currentQty) {
                  return Promise.reject(
                    new Error(
                      'Quantity cannot exceed current source batch quantity'
                    )
                  );
                }

                if (
                  isTransfer &&
                  fromPlant &&
                  fromLocation &&
                  toPlant &&
                  toLocation &&
                  fromPlant === toPlant &&
                  fromLocation === toLocation
                ) {
                  return Promise.reject(
                    new Error('Destination must be different from source')
                  );
                }

                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber
            min={isAdjustment ? 0 : 1}
            style={{ width: '100%' }}
            placeholder={
              isAdjustment
                ? 'Enter new final quantity'
                : 'Enter movement quantity'
            }
          />
        </Form.Item>

        <Form.Item
          label="Movement Date"
          name="date"
          rules={[{ required: true, message: 'Please select date' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="Reference No." name="referenceNo">
          <Input placeholder="Example: GRN-001, TRF-001, SO-001, ADJ-001" />
        </Form.Item>

        <Form.Item label="Reason / Note" name="reason">
          <TextArea rows={3} placeholder="Enter reason or note" />
        </Form.Item>
      </Form>
    </Modal>
  );
}