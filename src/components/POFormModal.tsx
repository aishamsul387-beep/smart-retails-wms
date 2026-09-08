'use client';

import { useEffect, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Row,
  Col,
  InputNumber,
  Divider,
  Typography,
  Space,
  message,
  Card,
  AutoComplete,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;
const { TextArea } = Input;

type POStatus =
  | 'Draft'
  | 'Approved'
  | 'Partial Received'
  | 'Received'
  | 'Cancelled';

interface POItem {
  id: string;

  /**
   * productCode is kept for backward compatibility.
   * In the new PO module, productSku is the main product identifier.
   */
  productCode?: string;
  productSku: string;
  productName: string;
  productBarcode?: string;

  uom: string;
  qty: number;
  receivedQty: number;
  outstandingQty: number;
  unitPrice: number;
  totalPrice: number;

  /**
   * Plant/location are stored per item for traceability,
   * but selected at PO header level.
   */
  plant: string;
  location: string;
}

interface PurchaseOrder {
  id: string;
  poNo: string;

  /**
   * supplier is kept for backward compatibility.
   * supplierCode is the new preferred field.
   */
  supplier?: string;
  supplierCode: string;
  supplierName: string;
  paymentTerm: string;

  poDate: string;
  expectedDate: string;

  plant: string;
  location: string;

  status: POStatus | string;
  remarks: string;

  items: POItem[];

  subtotal?: number;
  grandTotal?: number;
  totalAmount?: number;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface POFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (po: PurchaseOrder) => void;
  editingPO: PurchaseOrder | null;
  products: any[];
  suppliers: any[];
  plants: any[];
  locations: any[];
  uoms: any[];
}

function safeString(value: unknown): string {
  return String(value ?? '').trim();
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uid(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function getMasterValue(record: any, keys: string[]): string {
  for (const key of keys) {
    const value = safeString(record?.[key]);
    if (value) return value;
  }

  return '';
}

function getCurrentUserName(): string {
  try {
    const stored = localStorage.getItem('wms_current_user');

    if (!stored) return 'Admin';

    const parsed = JSON.parse(stored);

    return (
      safeString(parsed?.name) ||
      safeString(parsed?.username) ||
      safeString(parsed?.email) ||
      'Admin'
    );
  } catch {
    return 'Admin';
  }
}

function generatePONo(): string {
  return `PO-${dayjs().format('YYYYMMDD-HHmmss')}`;
}

function toDateString(value: any): string {
  if (!value) return '';

  if (dayjs.isDayjs(value)) {
    return value.format('YYYY-MM-DD');
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

function removeDuplicateOptions<T extends { value: string }>(options: T[]): T[] {
  const seen = new Set<string>();

  return options.filter((option) => {
    const key = safeString(option.value).toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export default function POFormModal({
  open,
  onClose,
  onSave,
  editingPO,
  products,
  suppliers,
  plants,
  locations,
  uoms,
}: POFormModalProps) {
  const [form] = Form.useForm();
  const watchedItems = Form.useWatch('items', form) || [];

  /**
   * Supplier master normalized options.
   */
  const supplierMasterOptions = useMemo(() => {
    const options = suppliers.map((supplier, index) => {
      const supplierCode =
        getMasterValue(supplier, [
          'supplierCode',
          'supplierNo',
          'vendorCode',
          'vendorNo',
          'code',
          'supplier',
          'id',
          'key',
        ]) || `SUP-${index + 1}`;

      const supplierName =
        getMasterValue(supplier, [
          'supplierName',
          'vendorName',
          'companyName',
          'displayName',
          'name',
          'description',
        ]) || supplierCode;

      const paymentTerm =
        getMasterValue(supplier, [
          'paymentTerm',
          'paymentTerms',
          'term',
          'terms',
          'creditTerm',
          'creditTerms',
        ]) || '';

      return {
        value: supplierCode,
        label:
          supplierCode && supplierName && supplierCode !== supplierName
            ? `${supplierCode} - ${supplierName}`
            : supplierName,
        supplierCode,
        supplierName,
        paymentTerm,
      };
    });

    return removeDuplicateOptions(options);
  }, [suppliers]);

  const supplierCodeOptions = useMemo(() => {
    return supplierMasterOptions.map((supplier) => ({
      value: supplier.supplierCode,
      label: supplier.label,
    }));
  }, [supplierMasterOptions]);

  const supplierNameOptions = useMemo(() => {
    const options = supplierMasterOptions.map((supplier) => ({
      value: supplier.supplierName,
      label:
        supplier.supplierCode && supplier.supplierName
          ? `${supplier.supplierName} (${supplier.supplierCode})`
          : supplier.supplierName,
    }));

    return removeDuplicateOptions(options);
  }, [supplierMasterOptions]);

  const paymentTermOptions = useMemo(() => {
    const defaultTerms = [
      'COD',
      'Cash',
      '7 Days',
      '14 Days',
      '30 Days',
      '45 Days',
      '60 Days',
      '90 Days',
    ];

    const supplierTerms = supplierMasterOptions
      .map((supplier) => supplier.paymentTerm)
      .filter(Boolean);

    const options = [...defaultTerms, ...supplierTerms].map((term) => ({
      value: term,
      label: term,
    }));

    return removeDuplicateOptions(options);
  }, [supplierMasterOptions]);

  /**
   * Product master normalized options.
   */
  const productMasterOptions = useMemo(() => {
    const options = products.map((product, index) => {
      const productSku =
        getMasterValue(product, [
          'productSku',
          'productSKU',
          'sku',
          'itemSku',
          'itemSKU',
          'productCode',
          'itemCode',
          'code',
          'id',
        ]) || `SKU-${index + 1}`;

      const productName =
        getMasterValue(product, [
          'productName',
          'itemName',
          'name',
          'description',
          'displayName',
        ]) || productSku;

      const productBarcode =
        getMasterValue(product, [
          'productBarcode',
          'barcode',
          'barCode',
          'ean',
          'upc',
          'gtin',
        ]) || '';

      const uom =
        getMasterValue(product, [
          'uom',
          'baseUom',
          'baseUOM',
          'uomCode',
          'unit',
          'unitOfMeasure',
        ]) || 'PCS';

      const unitPrice = safeNumber(
        getMasterValue(product, [
          'unitPrice',
          'price',
          'purchasePrice',
          'cost',
          'standardCost',
        ])
      );

      return {
        value: productSku,
        label:
          productSku && productName && productSku !== productName
            ? `${productSku} - ${productName}`
            : productName,
        productSku,
        productCode: productSku,
        productName,
        productBarcode,
        uom,
        unitPrice,
      };
    });

    return removeDuplicateOptions(options);
  }, [products]);

  const productSkuOptions = useMemo(() => {
    const options = productMasterOptions.map((product) => ({
      value: product.productSku,
      label:
        product.productName && product.productSku
          ? `${product.productSku} - ${product.productName}`
          : product.productSku,
    }));

    return removeDuplicateOptions(options);
  }, [productMasterOptions]);

  const productNameOptions = useMemo(() => {
    const options = productMasterOptions.map((product) => ({
      value: product.productName,
      label:
        product.productSku && product.productName
          ? `${product.productName} (${product.productSku})`
          : product.productName,
    }));

    return removeDuplicateOptions(options);
  }, [productMasterOptions]);

  const productBarcodeOptions = useMemo(() => {
    const options = productMasterOptions
      .filter((product) => product.productBarcode)
      .map((product) => ({
        value: product.productBarcode,
        label:
          product.productSku && product.productName
            ? `${product.productBarcode} - ${product.productSku} - ${product.productName}`
            : product.productBarcode,
      }));

    return removeDuplicateOptions(options);
  }, [productMasterOptions]);

  const plantOptions = useMemo(() => {
    return plants.map((plant) => {
      const code =
        getMasterValue(plant, ['plantCode', 'code', 'plant']) ||
        getMasterValue(plant, ['id']);

      const name =
        getMasterValue(plant, ['plantName', 'name', 'description']) || code;

      return {
        value: code,
        label: `${code} - ${name}`,
      };
    });
  }, [plants]);

  const locationOptions = useMemo(() => {
    return locations.map((location) => {
      const code =
        getMasterValue(location, ['locationCode', 'code', 'location']) ||
        getMasterValue(location, ['id']);

      const name =
        getMasterValue(location, ['locationName', 'name', 'description']) ||
        code;

      return {
        value: code,
        label: `${code} - ${name}`,
      };
    });
  }, [locations]);

  const uomOptions = useMemo(() => {
    const masterOptions = uoms.map((uom) => {
      const code =
        getMasterValue(uom, ['uomCode', 'code', 'uom']) ||
        getMasterValue(uom, ['id']);

      const name =
        getMasterValue(uom, ['uomName', 'name', 'description']) || code;

      return {
        value: code,
        label: `${code} - ${name}`,
      };
    });

    if (masterOptions.length > 0) return masterOptions;

    return [
      { value: 'PCS', label: 'PCS' },
      { value: 'BOX', label: 'BOX' },
      { value: 'CTN', label: 'CTN' },
      { value: 'KG', label: 'KG' },
      { value: 'L', label: 'L' },
    ];
  }, [uoms]);

  const grandTotal = useMemo(() => {
    return watchedItems.reduce((sum: number, item: any) => {
      const qty = safeNumber(item?.qty);
      const unitPrice = safeNumber(item?.unitPrice);

      return sum + qty * unitPrice;
    }, 0);
  }, [watchedItems]);

  useEffect(() => {
    if (!open) return;

    if (editingPO) {
      const headerPlant =
        safeString((editingPO as any).plant) ||
        safeString(editingPO.items?.[0]?.plant) ||
        plantOptions[0]?.value ||
        'MAIN';

      const headerLocation =
        safeString((editingPO as any).location) ||
        safeString(editingPO.items?.[0]?.location) ||
        locationOptions[0]?.value ||
        'RECEIVING';

      const supplierCode =
        safeString((editingPO as any).supplierCode) ||
        safeString((editingPO as any).supplier);

      form.setFieldsValue({
        ...editingPO,
        supplierCode,
        supplier: supplierCode,
        supplierName: safeString(editingPO.supplierName),
        paymentTerm: safeString((editingPO as any).paymentTerm),
        poDate: editingPO.poDate ? dayjs(editingPO.poDate) : null,
        expectedDate: editingPO.expectedDate
          ? dayjs(editingPO.expectedDate)
          : null,
        plant: headerPlant,
        location: headerLocation,
        items:
          editingPO.items?.map((item) => {
            const productSku =
              safeString((item as any).productSku) ||
              safeString((item as any).productCode);

            const qty = safeNumber(item.qty);
            const receivedQty = safeNumber(item.receivedQty);
            const unitPrice = safeNumber(item.unitPrice);

            return {
              ...item,
              productSku,
              productCode: productSku,
              productName: safeString(item.productName),
              productBarcode: safeString((item as any).productBarcode),
              uom: safeString(item.uom) || 'PCS',
              qty,
              receivedQty,
              outstandingQty: Math.max(qty - receivedQty, 0),
              unitPrice,
              totalPrice: qty * unitPrice,
              plant: safeString(item.plant) || headerPlant,
              location: safeString(item.location) || headerLocation,
            };
          }) || [],
      });
    } else {
      const defaultPlant = plantOptions[0]?.value || 'MAIN';
      const defaultLocation = locationOptions[0]?.value || 'RECEIVING';

      form.setFieldsValue({
        poNo: generatePONo(),
        supplier: '',
        supplierCode: '',
        supplierName: '',
        paymentTerm: '',
        poDate: dayjs(),
        expectedDate: null,
        plant: defaultPlant,
        location: defaultLocation,
        status: 'Draft',
        remarks: '',
        items: [
          {
            id: uid('po-item'),
            productCode: '',
            productSku: '',
            productName: '',
            productBarcode: '',
            uom: 'PCS',
            qty: 1,
            receivedQty: 0,
            outstandingQty: 1,
            unitPrice: 0,
            totalPrice: 0,
            plant: defaultPlant,
            location: defaultLocation,
          },
        ],
      });
    }
  }, [open, editingPO, form, plantOptions, locationOptions]);

  const filterOption = (input: string, option?: any) => {
    return String(option?.label ?? option?.value ?? '')
      .toLowerCase()
      .includes(input.toLowerCase());
  };

  const findSupplierByValue = (value: string) => {
    const input = safeString(value).toLowerCase();

    return supplierMasterOptions.find((supplier) => {
      return (
        supplier.supplierCode.toLowerCase() === input ||
        supplier.supplierName.toLowerCase() === input ||
        supplier.label.toLowerCase() === input
      );
    });
  };

  const handleSupplierFieldChange = (
    field: 'supplierCode' | 'supplierName',
    value: string
  ) => {
    const selected = findSupplierByValue(value);

    if (selected) {
      form.setFieldsValue({
        supplier: selected.supplierCode,
        supplierCode: selected.supplierCode,
        supplierName: selected.supplierName,
        paymentTerm:
          selected.paymentTerm || safeString(form.getFieldValue('paymentTerm')),
      });

      return;
    }

    form.setFieldsValue({
      [field]: value,
      supplier:
        field === 'supplierCode'
          ? value
          : safeString(form.getFieldValue('supplierCode')),
    });
  };

  const findProductByValue = (value: string) => {
    const input = safeString(value).toLowerCase();

    return productMasterOptions.find((product) => {
      return (
        product.productSku.toLowerCase() === input ||
        product.productName.toLowerCase() === input ||
        product.productBarcode.toLowerCase() === input ||
        product.label.toLowerCase() === input
      );
    });
  };

  const handleProductFieldChange = (
    rowIndex: number,
    field: 'productSku' | 'productName' | 'productBarcode',
    value: string
  ) => {
    const selected = findProductByValue(value);

    const currentItems = [...(form.getFieldValue('items') || [])];
    const currentRow = currentItems[rowIndex] || {};

    if (selected) {
      currentItems[rowIndex] = {
        ...currentRow,
        productCode: selected.productSku,
        productSku: selected.productSku,
        productName: selected.productName,
        productBarcode: selected.productBarcode,
        uom: selected.uom || currentRow.uom || 'PCS',
        unitPrice:
          selected.unitPrice && selected.unitPrice > 0
            ? selected.unitPrice
            : safeNumber(currentRow.unitPrice),
      };
    } else {
      currentItems[rowIndex] = {
        ...currentRow,
        [field]: value,
        productCode:
          field === 'productSku'
            ? value
            : safeString(currentRow.productSku || currentRow.productCode),
      };
    }

    form.setFieldsValue({
      items: currentItems,
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const now = new Date().toISOString();
      const currentUser = getCurrentUserName();

      const headerPlant = safeString(values.plant) || 'MAIN';
      const headerLocation = safeString(values.location) || 'RECEIVING';

      const cleanedItems: POItem[] = (values.items || [])
        .filter((item: any) => {
          return (
            safeString(item?.productSku) ||
            safeString(item?.productCode) ||
            safeString(item?.productName)
          );
        })
        .map((item: any, index: number) => {
          const productSku =
            safeString(item.productSku) || safeString(item.productCode);

          const qty = safeNumber(item.qty);
          const receivedQty = safeNumber(item.receivedQty);
          const unitPrice = safeNumber(item.unitPrice);
          const totalPrice = qty * unitPrice;
          const outstandingQty = Math.max(qty - receivedQty, 0);

          return {
            id:
              safeString(item.id) ||
              editingPO?.items?.[index]?.id ||
              uid('po-item'),

            productCode: productSku,
            productSku,
            productName: safeString(item.productName) || productSku,
            productBarcode: safeString(item.productBarcode),

            uom: safeString(item.uom) || 'PCS',
            qty,
            receivedQty,
            outstandingQty,
            unitPrice,
            totalPrice,

            plant: headerPlant,
            location: headerLocation,
          };
        });

      if (!cleanedItems.length) {
        message.error('Please add at least one PO item');
        return;
      }

      const subtotal = cleanedItems.reduce((sum, item) => {
        return sum + safeNumber(item.totalPrice);
      }, 0);

      const supplierCode = safeString(values.supplierCode || values.supplier);

      const finalPO: PurchaseOrder = {
        id: editingPO?.id || uid('po'),
        poNo: safeString(values.poNo),

        supplier: supplierCode,
        supplierCode,
        supplierName: safeString(values.supplierName),
        paymentTerm: safeString(values.paymentTerm),

        poDate: toDateString(values.poDate),
        expectedDate: toDateString(values.expectedDate),

        plant: headerPlant,
        location: headerLocation,

        status: values.status || 'Draft',
        remarks: safeString(values.remarks),

        items: cleanedItems,

        subtotal,
        grandTotal: subtotal,
        totalAmount: subtotal,

        createdBy: editingPO?.createdBy || currentUser,
        createdAt: editingPO?.createdAt || now,
        updatedAt: now,
      };

      onSave(finalPO);
      form.resetFields();
    } catch (error) {
      console.error('PO form validation error:', error);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <ShoppingCartOutlined />
          <span>{editingPO ? 'Edit Purchase Order' : 'Create Purchase Order'}</span>
        </Space>
      }
      open={open}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={handleSubmit}
      okText={editingPO ? 'Update PO' : 'Create PO'}
      width={1300}
      destroyOnHidden
      mask={{ closable: false }}
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={8}>
              <Form.Item
                label="PO No."
                name="poNo"
                rules={[{ required: true, message: 'PO No. is required' }]}
              >
                <Input placeholder="PO No." />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="PO Date"
                name="poDate"
                rules={[{ required: true, message: 'PO Date is required' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Expected Date" name="expectedDate">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Supplier Code"
                name="supplierCode"
                rules={[
                  { required: true, message: 'Supplier code is required' },
                ]}
              >
                <AutoComplete
                  placeholder="Select or type supplier code"
                  options={supplierCodeOptions}
                  filterOption={filterOption}
                  onSelect={(value) =>
                    handleSupplierFieldChange('supplierCode', value)
                  }
                  onChange={(value) =>
                    handleSupplierFieldChange('supplierCode', value)
                  }
                />
              </Form.Item>

              <Form.Item name="supplier" hidden>
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Supplier Name"
                name="supplierName"
                rules={[
                  { required: true, message: 'Supplier name is required' },
                ]}
              >
                <AutoComplete
                  placeholder="Select or type supplier name"
                  options={supplierNameOptions}
                  filterOption={filterOption}
                  onSelect={(value) =>
                    handleSupplierFieldChange('supplierName', value)
                  }
                  onChange={(value) =>
                    handleSupplierFieldChange('supplierName', value)
                  }
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Payment Term"
                name="paymentTerm"
                rules={[
                  { required: true, message: 'Payment term is required' },
                ]}
              >
                <AutoComplete
                  placeholder="Select or type payment term"
                  options={paymentTermOptions}
                  filterOption={filterOption}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item
                label="Plant"
                name="plant"
                rules={[{ required: true, message: 'Plant is required' }]}
              >
                <Select
                  showSearch
                  placeholder="Select plant"
                  options={plantOptions}
                  filterOption={filterOption}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item
                label="Location"
                name="location"
                rules={[
                  { required: true, message: 'Location is required' },
                ]}
              >
                <Select
                  showSearch
                  placeholder="Select location"
                  options={locationOptions}
                  filterOption={filterOption}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item
                label="Status"
                name="status"
                rules={[{ required: true, message: 'Status is required' }]}
              >
                <Select
                  options={[
                    { value: 'Draft', label: 'Draft' },
                    { value: 'Approved', label: 'Approved' },
                    {
                      value: 'Partial Received',
                      label: 'Partial Received',
                      disabled: !editingPO,
                    },
                    {
                      value: 'Received',
                      label: 'Received',
                      disabled: !editingPO,
                    },
                    { value: 'Cancelled', label: 'Cancelled' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Grand Total">
                <Input
                  readOnly
                  value={`$${grandTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label="Remarks" name="remarks">
                <TextArea rows={2} placeholder="Remarks / notes" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Divider titlePlacement="left">PO Items</Divider>

        <Form.List
          name="items"
          rules={[
            {
              validator: async (_, value) => {
                if (!value || value.length < 1) {
                  return Promise.reject(new Error('Please add at least one item'));
                }

                return Promise.resolve();
              },
            },
          ]}
        >
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name }) => {
                const currentItem = watchedItems?.[name] || {};
                const qty = safeNumber(currentItem.qty);
                const receivedQty = safeNumber(currentItem.receivedQty);
                const unitPrice = safeNumber(currentItem.unitPrice);
                const totalPrice = qty * unitPrice;
                const outstandingQty = Math.max(qty - receivedQty, 0);

                return (
                  <Card
                    key={key}
                    size="small"
                    style={{ marginBottom: 12 }}
                    styles={{ body: { paddingBottom: 8 } }}
                  >
                    <Form.Item name={[name, 'id']} hidden>
                      <Input />
                    </Form.Item>

                    <Form.Item name={[name, 'productCode']} hidden>
                      <Input />
                    </Form.Item>

                    <Row gutter={[12, 0]}>
                      <Col xs={24} md={6}>
                        <Form.Item
                          label="Product SKU"
                          name={[name, 'productSku']}
                          rules={[
                            {
                              required: true,
                              message: 'Product SKU is required',
                            },
                          ]}
                        >
                          <AutoComplete
                            placeholder="Select or type SKU"
                            options={productSkuOptions}
                            filterOption={filterOption}
                            onSelect={(value) =>
                              handleProductFieldChange(
                                name,
                                'productSku',
                                value
                              )
                            }
                            onChange={(value) =>
                              handleProductFieldChange(
                                name,
                                'productSku',
                                value
                              )
                            }
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          label="Product Name"
                          name={[name, 'productName']}
                          rules={[
                            {
                              required: true,
                              message: 'Product name is required',
                            },
                          ]}
                        >
                          <AutoComplete
                            placeholder="Select or type product name"
                            options={productNameOptions}
                            filterOption={filterOption}
                            onSelect={(value) =>
                              handleProductFieldChange(
                                name,
                                'productName',
                                value
                              )
                            }
                            onChange={(value) =>
                              handleProductFieldChange(
                                name,
                                'productName',
                                value
                              )
                            }
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item
                          label="Product Barcode"
                          name={[name, 'productBarcode']}
                        >
                          <AutoComplete
                            placeholder="Select or type barcode"
                            options={productBarcodeOptions}
                            filterOption={filterOption}
                            onSelect={(value) =>
                              handleProductFieldChange(
                                name,
                                'productBarcode',
                                value
                              )
                            }
                            onChange={(value) =>
                              handleProductFieldChange(
                                name,
                                'productBarcode',
                                value
                              )
                            }
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={12} md={4}>
                        <Form.Item
                          label="UOM"
                          name={[name, 'uom']}
                          rules={[
                            {
                              required: true,
                              message: 'UOM is required',
                            },
                          ]}
                        >
                          <Select
                            showSearch
                            placeholder="UOM"
                            options={uomOptions}
                            filterOption={filterOption}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={12} md={4}>
                        <Form.Item
                          label="Order Qty"
                          name={[name, 'qty']}
                          rules={[
                            {
                              required: true,
                              message: 'Qty is required',
                            },
                          ]}
                        >
                          <InputNumber min={0.0001} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>

                      <Col xs={12} md={4}>
                        <Form.Item label="Received" name={[name, 'receivedQty']}>
                          <InputNumber
                            min={0}
                            disabled
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={12} md={4}>
                        <Form.Item label="Outstanding">
                          <InputNumber
                            value={outstandingQty}
                            disabled
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={12} md={4}>
                        <Form.Item label="Unit Price" name={[name, 'unitPrice']}>
                          <InputNumber
                            min={0}
                            precision={2}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={12} md={4}>
                        <Form.Item label="Line Total">
                          <Input
                            readOnly
                            value={`$${totalPrice.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={4}>
                        <Form.Item label=" ">
                          <Button
                            danger
                            block
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                          >
                            Remove
                          </Button>
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                );
              })}

              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => {
                  const headerPlant =
                    safeString(form.getFieldValue('plant')) ||
                    plantOptions[0]?.value ||
                    'MAIN';

                  const headerLocation =
                    safeString(form.getFieldValue('location')) ||
                    locationOptions[0]?.value ||
                    'RECEIVING';

                  add({
                    id: uid('po-item'),
                    productCode: '',
                    productSku: '',
                    productName: '',
                    productBarcode: '',
                    uom: 'PCS',
                    qty: 1,
                    receivedQty: 0,
                    outstandingQty: 1,
                    unitPrice: 0,
                    totalPrice: 0,
                    plant: headerPlant,
                    location: headerLocation,
                  });
                }}
                block
              >
                Add Item
              </Button>
            </>
          )}
        </Form.List>

        <Divider />

        <Row justify="end">
          <Col>
            <Text strong>
              Grand Total:{' '}
              {`$${grandTotal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
            </Text>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}