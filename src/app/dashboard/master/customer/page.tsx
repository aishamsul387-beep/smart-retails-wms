'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
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
import type { UploadProps } from 'antd';
import {
  ClearOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const STORAGE_KEY = 'wms_customers';

type CustomerStatus = 'Active' | 'Inactive' | 'Blocked';
type CustomerGroup = 'Member' | 'Non Member';
type CustomerScore = 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

interface CustomerRecord {
  id: string;

  /**
   * Kept as customerCode internally for compatibility with existing modules.
   * Displayed everywhere as Customer ID.
   */
  customerCode: string;
  customerName: string;

  /**
   * Compatibility aliases for Sales Order / Outbound Shipment modules.
   */
  customerId?: string;
  code?: string;
  name?: string;
  type?: string;
  customerType?: string;

  customerGroup: CustomerGroup;
  customerScore: CustomerScore;

  contactPerson: string;
  phone: string;
  email: string;

  billingAddress: string;
  shippingAddress: string;
  city: string;
  country: string;

  taxNo: string;
  paymentTerms: string;

  status: CustomerStatus;
  remarks: string;

  createdAt: string;
  updatedAt: string;
}

interface CustomerFormValues {
  customerCode: string;
  customerName: string;
  customerGroup?: CustomerGroup;
  customerScore?: CustomerScore;
  contactPerson?: string;
  phone?: string;
  email?: string;
  billingAddress?: string;
  shippingAddress?: string;
  city?: string;
  country?: string;
  taxNo?: string;
  paymentTerms?: string;
  status?: CustomerStatus;
  remarks?: string;
}

const DEMO_CUSTOMERS: CustomerRecord[] = [
  {
    id: 'CUST-DEMO-001',
    customerCode: 'CUS-1001',
    customerId: 'CUS-1001',
    code: 'CUS-1001',
    customerName: 'FreshMart Retail Ltd',
    name: 'FreshMart Retail Ltd',
    type: 'Member',
    customerType: 'Member',
    customerGroup: 'Member',
    customerScore: 'Gold',
    contactPerson: 'Ahmed Khan',
    phone: '+971501112233',
    email: 'orders@freshmart.example',
    billingAddress: 'Business Bay, Dubai',
    shippingAddress: 'Warehouse 4, Al Quoz, Dubai',
    city: 'Dubai',
    country: 'UAE',
    taxNo: 'TRN100100100',
    paymentTerms: 'Net 30',
    status: 'Active',
    remarks: 'Priority retail customer',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'CUST-DEMO-002',
    customerCode: 'CUS-1002',
    customerId: 'CUS-1002',
    code: 'CUS-1002',
    customerName: 'Gulf Hypermarket LLC',
    name: 'Gulf Hypermarket LLC',
    type: 'Member',
    customerType: 'Member',
    customerGroup: 'Member',
    customerScore: 'Platinum',
    contactPerson: 'Sara Ali',
    phone: '+971502224455',
    email: 'supply@gulfhyper.example',
    billingAddress: 'Mussafah, Abu Dhabi',
    shippingAddress: 'Distribution Center 2, Abu Dhabi',
    city: 'Abu Dhabi',
    country: 'UAE',
    taxNo: 'TRN200200200',
    paymentTerms: 'Net 45',
    status: 'Active',
    remarks: 'Large volume outbound orders',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'CUST-DEMO-003',
    customerCode: 'CUS-1003',
    customerId: 'CUS-1003',
    code: 'CUS-1003',
    customerName: 'Quick Basket Trading',
    name: 'Quick Basket Trading',
    type: 'Non Member',
    customerType: 'Non Member',
    customerGroup: 'Non Member',
    customerScore: 'Silver',
    contactPerson: 'John Mathew',
    phone: '+971503336677',
    email: 'procurement@quickbasket.example',
    billingAddress: 'Sharjah Industrial Area',
    shippingAddress: 'Sharjah Industrial Area 6',
    city: 'Sharjah',
    country: 'UAE',
    taxNo: 'TRN300300300',
    paymentTerms: 'COD',
    status: 'Inactive',
    remarks: 'Temporarily inactive',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const CSV_HEADERS = [
  'Customer ID',
  'Customer Name',
  'Customer Group',
  'Customer Score',
  'Contact Person',
  'Phone',
  'Email',
  'Billing Address',
  'Shipping Address',
  'City',
  'Country',
  'Tax No',
  'Payment Terms',
  'Status',
  'Remarks',
];

function generateId() {
  return `CUST-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalize(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeCode(value: unknown) {
  return normalize(value).toUpperCase();
}

function normalizeHeader(value: unknown) {
  return normalize(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    const text = normalize(value);
    if (text) return text;
  }

  return '';
}

function normalizeCustomerGroup(value: unknown): CustomerGroup {
  const raw = normalize(value).toLowerCase();

  if (raw === 'member') return 'Member';

  if (raw === 'non member' || raw === 'non-member' || raw === 'nonmember') {
    return 'Non Member';
  }

  return 'Non Member';
}

function normalizeCustomerScore(value: unknown): CustomerScore {
  const raw = normalize(value).toLowerCase();

  if (raw === 'gold') return 'Gold';
  if (raw === 'platinum') return 'Platinum';
  if (raw === 'diamond') return 'Diamond';

  return 'Silver';
}

function normalizeStatus(value: unknown): CustomerStatus {
  const raw = normalize(value).toLowerCase();

  if (raw === 'inactive') return 'Inactive';
  if (raw === 'blocked') return 'Blocked';

  return 'Active';
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '');

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function buildCsv(records: CustomerRecord[]) {
  const rows = records.map((item) => [
    item.customerCode,
    item.customerName,
    item.customerGroup,
    item.customerScore,
    item.contactPerson,
    item.phone,
    item.email,
    item.billingAddress,
    item.shippingAddress,
    item.city,
    item.country,
    item.taxNo,
    item.paymentTerms,
    item.status,
    item.remarks,
  ]);

  return [CSV_HEADERS, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let insideQuotes = false;

  const cleanText = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < cleanText.length; i += 1) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i += 1;
      }

      row.push(current.trim());

      if (row.some((cell) => cell !== '')) {
        rows.push(row);
      }

      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current.trim());

  if (row.some((cell) => cell !== '')) {
    rows.push(row);
  }

  return rows;
}

function createHeaderMap(headers: string[]) {
  const headerMap = new Map<string, number>();

  headers.forEach((header, index) => {
    headerMap.set(normalizeHeader(header), index);
  });

  return headerMap;
}

function getCsvValue(
  row: string[],
  headerMap: Map<string, number> | undefined,
  possibleHeaders: string[],
  fallbackIndex: number
) {
  if (headerMap) {
    for (const header of possibleHeaders) {
      const index = headerMap.get(normalizeHeader(header));

      if (typeof index === 'number') {
        return row[index] ?? '';
      }
    }
  }

  return row[fallbackIndex] ?? '';
}

function mapCsvRowToCustomer(
  row: string[],
  existing?: CustomerRecord,
  headerMap?: Map<string, number>
): CustomerRecord {
  const now = new Date().toISOString();

  const customerCode = normalizeCode(
    getCsvValue(
      row,
      headerMap,
      ['Customer ID', 'Customer Code', 'CustomerCode', 'Code', 'customerCode'],
      0
    )
  );

  const customerName = normalize(
    getCsvValue(row, headerMap, ['Customer Name', 'CustomerName', 'Name', 'customerName'], 1)
  );

  const customerGroupRaw = getCsvValue(
    row,
    headerMap,
    ['Customer Group', 'CustomerGroup', 'Group', 'Type', 'Customer Type'],
    2
  );

  const customerScoreRaw = getCsvValue(row, headerMap, ['Customer Score', 'CustomerScore', 'Score'], 3);

  const contactPerson = getCsvValue(
    row,
    headerMap,
    ['Contact Person', 'ContactPerson', 'Contact'],
    4
  );

  const phone = getCsvValue(row, headerMap, ['Phone', 'Mobile', 'Tel'], 5);
  const email = getCsvValue(row, headerMap, ['Email', 'E-mail'], 6);

  const billingAddress = getCsvValue(
    row,
    headerMap,
    ['Billing Address', 'BillingAddress', 'Address'],
    7
  );

  const shippingAddress = getCsvValue(
    row,
    headerMap,
    ['Shipping Address', 'ShippingAddress', 'Delivery Address'],
    8
  );

  const city = getCsvValue(row, headerMap, ['City'], 9);
  const country = getCsvValue(row, headerMap, ['Country'], 10);

  const taxNo = getCsvValue(
    row,
    headerMap,
    ['Tax No', 'TaxNo', 'Tax No / TRN', 'TRN', 'VAT No'],
    11
  );

  const paymentTerms = getCsvValue(
    row,
    headerMap,
    ['Payment Terms', 'PaymentTerms', 'Terms'],
    12
  );

  const statusRaw = getCsvValue(row, headerMap, ['Status'], 13);
  const remarks = getCsvValue(row, headerMap, ['Remarks', 'Notes'], 14);

  const normalizedGroup = normalizeCustomerGroup(customerGroupRaw);

  return {
    id: existing?.id || generateId(),

    customerCode,
    customerId: customerCode,
    code: customerCode,

    customerName,
    name: customerName,

    type: normalizedGroup,
    customerType: normalizedGroup,
    customerGroup: normalizedGroup,

    customerScore: normalizeCustomerScore(customerScoreRaw),

    contactPerson: normalize(contactPerson),
    phone: normalize(phone),
    email: normalize(email),

    billingAddress: normalize(billingAddress),
    shippingAddress: normalize(shippingAddress),
    city: normalize(city),
    country: normalize(country),

    taxNo: normalize(taxNo),
    paymentTerms: normalize(paymentTerms),

    status: normalizeStatus(statusRaw),
    remarks: normalize(remarks),

    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function normalizeLoadedCustomer(item: any): CustomerRecord {
  const now = new Date().toISOString();

  const customerCode = normalizeCode(
    firstNonEmpty(
      item.customerCode,
      item.customerId,
      item.code,
      item.customer_code,
      item.CustomerCode,
      item['Customer ID'],
      item['Customer Code']
    )
  );

  const customerName = normalize(
    firstNonEmpty(
      item.customerName,
      item.name,
      item.customer_name,
      item.CustomerName,
      item['Customer Name']
    )
  );

  const customerGroup = normalizeCustomerGroup(
    firstNonEmpty(item.customerGroup, item.customerType, item.type, item.group, item['Customer Group'])
  );

  return {
    id: normalize(item.id) || generateId(),

    customerCode,
    customerId: customerCode,
    code: customerCode,

    customerName,
    name: customerName,

    type: customerGroup,
    customerType: customerGroup,
    customerGroup,

    customerScore: normalizeCustomerScore(
      firstNonEmpty(item.customerScore, item.score, item['Customer Score'])
    ),

    contactPerson: normalize(
      firstNonEmpty(item.contactPerson, item.contact, item.contact_person, item['Contact Person'])
    ),

    phone: normalize(firstNonEmpty(item.phone, item.mobile, item.tel, item.Phone)),
    email: normalize(firstNonEmpty(item.email, item.Email)),

    billingAddress: normalize(
      firstNonEmpty(item.billingAddress, item.billing_address, item.address, item['Billing Address'])
    ),

    shippingAddress: normalize(
      firstNonEmpty(
        item.shippingAddress,
        item.shipping_address,
        item.deliveryAddress,
        item.delivery_address,
        item['Shipping Address']
      )
    ),

    city: normalize(firstNonEmpty(item.city, item.City)),
    country: normalize(firstNonEmpty(item.country, item.Country)),

    taxNo: normalize(firstNonEmpty(item.taxNo, item.tax_no, item.trn, item.vatNo, item['Tax No'])),

    paymentTerms: normalize(
      firstNonEmpty(item.paymentTerms, item.payment_terms, item.terms, item['Payment Terms'])
    ),

    status: normalizeStatus(item.status),
    remarks: normalize(firstNonEmpty(item.remarks, item.notes)),

    createdAt: normalize(item.createdAt) || now,
    updatedAt: normalize(item.updatedAt) || now,
  };
}

function formatDateTime(value: string | undefined) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  const pad = (number: number) => String(number).padStart(2, '0');

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}`;
}

function statusColor(status: CustomerRecord['status']) {
  if (status === 'Active') return 'green';
  if (status === 'Inactive') return 'default';

  return 'red';
}

function customerGroupColor(group: CustomerGroup) {
  if (group === 'Member') return 'blue';

  return 'default';
}

function customerScoreColor(score: CustomerScore) {
  if (score === 'Silver') return 'default';
  if (score === 'Gold') return 'gold';
  if (score === 'Platinum') return 'cyan';

  return 'purple';
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;

    const parsed = JSON.parse(value);

    return (Array.isArray(parsed) ? parsed : fallback) as T;
  } catch {
    return fallback;
  }
}

function isValidCustomerGroup(value: string) {
  const normalized = normalizeCustomerGroup(value);
  const raw = normalize(value);

  return !raw || normalized === 'Member' || normalized === 'Non Member';
}

function isValidCustomerScore(value: string) {
  const raw = normalize(value).toLowerCase();

  return !raw || ['silver', 'gold', 'platinum', 'diamond'].includes(raw);
}

function isValidStatus(value: string) {
  const raw = normalize(value).toLowerCase();

  return !raw || ['active', 'inactive', 'blocked'].includes(raw);
}

function generateCopyCode(baseCode: string, customers: CustomerRecord[]) {
  const existingCodes = new Set(customers.map((item) => normalizeCode(item.customerCode)));

  let candidate = `${normalizeCode(baseCode)}-COPY`;
  let counter = 2;

  while (existingCodes.has(candidate)) {
    candidate = `${normalizeCode(baseCode)}-COPY-${counter}`;
    counter += 1;
  }

  return candidate;
}

export default function CustomerMasterPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<CustomerFormValues>();

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [storageLoaded, setStorageLoaded] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [cityFilter, setCityFilter] = useState<string>('All');
  const [customerGroupFilter, setCustomerGroupFilter] = useState<string>('All');
  const [customerScoreFilter, setCustomerScoreFilter] = useState<string>('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);

  const isViewMode = modalMode === 'view';

  useEffect(() => {
    try {
      const saved = safeJsonParse<any[]>(localStorage.getItem(STORAGE_KEY), []);

      const normalized = saved
        .map(normalizeLoadedCustomer)
        .filter((item) => item.customerCode && item.customerName);

      setCustomers(normalized);
    } catch (error) {
      console.error('Failed to load customers from localStorage:', error);
      setCustomers([]);
    } finally {
      setStorageLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!storageLoaded) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
    } catch (error) {
      console.error('Failed to save customers to localStorage:', error);
    }
  }, [customers, storageLoaded]);

  const cityOptions = useMemo(() => {
    return Array.from(new Set(customers.map((item) => item.city).filter(Boolean))).sort();
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return customers.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.customerCode,
          item.customerName,
          item.customerGroup,
          item.customerScore,
          item.contactPerson,
          item.phone,
          item.email,
          item.city,
          item.country,
          item.taxNo,
          item.paymentTerms,
          item.remarks,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);

      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      const matchesCity = cityFilter === 'All' || item.city === cityFilter;
      const matchesCustomerGroup =
        customerGroupFilter === 'All' || item.customerGroup === customerGroupFilter;
      const matchesCustomerScore =
        customerScoreFilter === 'All' || item.customerScore === customerScoreFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCity &&
        matchesCustomerGroup &&
        matchesCustomerScore
      );
    });
  }, [
    customers,
    searchText,
    statusFilter,
    cityFilter,
    customerGroupFilter,
    customerScoreFilter,
  ]);

  const summary = useMemo(() => {
    return {
      total: customers.length,
      active: customers.filter((item) => item.status === 'Active').length,
      inactive: customers.filter((item) => item.status === 'Inactive').length,
      blocked: customers.filter((item) => item.status === 'Blocked').length,
      members: customers.filter((item) => item.customerGroup === 'Member').length,
      nonMembers: customers.filter((item) => item.customerGroup === 'Non Member').length,
    };
  }, [customers]);

  const handleModalAfterOpenChange = (open: boolean) => {
    if (!open) return;

    form.resetFields();

    if (selectedCustomer && (modalMode === 'edit' || modalMode === 'view')) {
      form.setFieldsValue({
        customerCode: selectedCustomer.customerCode,
        customerName: selectedCustomer.customerName,
        customerGroup: selectedCustomer.customerGroup,
        customerScore: selectedCustomer.customerScore,
        contactPerson: selectedCustomer.contactPerson,
        phone: selectedCustomer.phone,
        email: selectedCustomer.email,
        billingAddress: selectedCustomer.billingAddress,
        shippingAddress: selectedCustomer.shippingAddress,
        city: selectedCustomer.city,
        country: selectedCustomer.country,
        taxNo: selectedCustomer.taxNo,
        paymentTerms: selectedCustomer.paymentTerms,
        status: selectedCustomer.status,
        remarks: selectedCustomer.remarks,
      });
    } else {
      form.setFieldsValue({
        status: 'Active',
        country: 'UAE',
        customerGroup: 'Non Member',
        customerScore: 'Silver',
      });
    }
  };

  const openCreateModal = () => {
    setSelectedCustomer(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const openEditModal = (record: CustomerRecord) => {
    setSelectedCustomer(record);
    setModalMode('edit');
    setModalOpen(true);
  };

  const openViewModal = (record: CustomerRecord) => {
    setSelectedCustomer(record);
    setModalMode('view');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedCustomer(null);
  };

  const createCompatibleCustomer = (
    values: CustomerFormValues,
    existing?: CustomerRecord
  ): CustomerRecord => {
    const now = new Date().toISOString();

    const customerCode = normalizeCode(values.customerCode);
    const customerName = normalize(values.customerName);
    const customerGroup = values.customerGroup || 'Non Member';

    return {
      id: existing?.id || generateId(),

      customerCode,
      customerId: customerCode,
      code: customerCode,

      customerName,
      name: customerName,

      type: customerGroup,
      customerType: customerGroup,
      customerGroup,

      customerScore: values.customerScore || 'Silver',

      contactPerson: normalize(values.contactPerson),
      phone: normalize(values.phone),
      email: normalize(values.email),

      billingAddress: normalize(values.billingAddress),
      shippingAddress: normalize(values.shippingAddress),
      city: normalize(values.city),
      country: normalize(values.country),

      taxNo: normalize(values.taxNo),
      paymentTerms: normalize(values.paymentTerms),

      status: values.status || 'Active',
      remarks: normalize(values.remarks),

      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const customerCode = normalizeCode(values.customerCode);

      const duplicate = customers.find(
        (item) =>
          normalizeCode(item.customerCode) === customerCode &&
          item.id !== selectedCustomer?.id
      );

      if (duplicate) {
        messageApi.error('Customer ID already exists.');
        return;
      }

      if (modalMode === 'create') {
        const newCustomer = createCompatibleCustomer(values);

        setCustomers((prev) => [newCustomer, ...prev]);
        messageApi.success('Customer created successfully.');
      }

      if (modalMode === 'edit' && selectedCustomer) {
        const updatedCustomer = createCompatibleCustomer(values, selectedCustomer);

        setCustomers((prev) =>
          prev.map((item) => (item.id === selectedCustomer.id ? updatedCustomer : item))
        );

        messageApi.success('Customer updated successfully.');
      }

      closeModal();
    } catch {
      messageApi.error('Please check required fields.');
    }
  };

  const handleDelete = (record: CustomerRecord) => {
    setCustomers((prev) => prev.filter((item) => item.id !== record.id));
    messageApi.success('Customer deleted.');
  };

  const handleDuplicate = (record: CustomerRecord) => {
    const now = new Date().toISOString();
    const copiedCode = generateCopyCode(record.customerCode, customers);

    const duplicate: CustomerRecord = {
      ...record,
      id: generateId(),

      customerCode: copiedCode,
      customerId: copiedCode,
      code: copiedCode,

      customerName: `${record.customerName} Copy`,
      name: `${record.customerName} Copy`,

      status: 'Active',
      createdAt: now,
      updatedAt: now,
    };

    setCustomers((prev) => [duplicate, ...prev]);
    messageApi.success('Customer duplicated.');
  };

  const handleClearFilters = () => {
    setSearchText('');
    setStatusFilter('All');
    setCityFilter('All');
    setCustomerGroupFilter('All');
    setCustomerScoreFilter('All');
  };

  const handleLoadDemo = () => {
    Modal.confirm({
      title: 'Load demo customers?',
      content: 'This will append demo customer records. Existing customer records will not be removed.',
      okText: 'Load Demo',
      onOk: () => {
        const existingCodes = new Set(customers.map((item) => normalizeCode(item.customerCode)));

        const now = new Date().toISOString();

        const newItems = DEMO_CUSTOMERS.filter(
          (item) => !existingCodes.has(normalizeCode(item.customerCode))
        ).map((item) => ({
          ...item,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        }));

        if (newItems.length === 0) {
          messageApi.info('Demo customers already exist.');
          return;
        }

        setCustomers((prev) => [...newItems, ...prev]);
        messageApi.success(`${newItems.length} demo customers loaded.`);
      },
    });
  };

  const handleClearAll = () => {
    Modal.confirm({
      title: 'Clear all customers?',
      content: 'This will delete all customer records from localStorage key wms_customers.',
      okText: 'Clear All',
      okButtonProps: {
        danger: true,
      },
      onOk: () => {
        setCustomers([]);
        messageApi.success('All customers cleared.');
      },
    });
  };

  const handleExportCsv = () => {
    if (filteredCustomers.length === 0) {
      messageApi.warning('No customers to export.');
      return;
    }

    const csv = buildCsv(filteredCustomers);

    downloadFile(`customer-master-${new Date().toISOString().slice(0, 10)}.csv`, csv);

    messageApi.success('Customer CSV exported.');
  };

  const handleDownloadTemplate = () => {
    const sampleRow = [
      'CUS-1004',
      'Sample Customer LLC',
      'Member',
      'Gold',
      'Ali Hassan',
      '+971500000000',
      'customer@example.com',
      'Billing address here',
      'Shipping address here',
      'Dubai',
      'UAE',
      'TRN000000000',
      'Net 30',
      'Active',
      'Sample customer import row',
    ];

    const csv = [CSV_HEADERS, sampleRow].map((row) => row.map(escapeCsv).join(',')).join('\n');

    downloadFile('customer-master-template.csv', csv);

    messageApi.success('Customer import template downloaded.');
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const rows = parseCsv(text);

      if (rows.length < 2) {
        messageApi.error('CSV file has no data rows.');
        return false;
      }

      const headers = rows[0];
      const headerMap = createHeaderMap(headers);
      const dataRows = rows.slice(1);

      const errors: string[] = [];
      const fileCodes = new Set<string>();

      const currentByCode = new Map<string, CustomerRecord>(
        customers.map((item) => [normalizeCode(item.customerCode), item])
      );

      const imported: CustomerRecord[] = [];

      dataRows.forEach((row, index) => {
        const rowNo = index + 2;

        const code = normalizeCode(
          getCsvValue(
            row,
            headerMap,
            ['Customer ID', 'Customer Code', 'CustomerCode', 'Code', 'customerCode'],
            0
          )
        );

        const name = normalize(
          getCsvValue(row, headerMap, ['Customer Name', 'CustomerName', 'Name', 'customerName'], 1)
        );

        const customerGroupRaw = normalize(
          getCsvValue(
            row,
            headerMap,
            ['Customer Group', 'CustomerGroup', 'Group', 'Type', 'Customer Type'],
            2
          )
        );

        const customerScoreRaw = normalize(
          getCsvValue(row, headerMap, ['Customer Score', 'CustomerScore'], 3)
        );

        const email = normalize(getCsvValue(row, headerMap, ['Email', 'E-mail'], 6));
        const status = normalize(getCsvValue(row, headerMap, ['Status'], 13));

        if (!code) {
          errors.push(`Row ${rowNo}: Customer ID is required.`);
          return;
        }

        if (!name) {
          errors.push(`Row ${rowNo}: Customer Name is required.`);
          return;
        }

        if (fileCodes.has(code)) {
          errors.push(`Row ${rowNo}: Duplicate Customer ID in file: ${code}.`);
          return;
        }

        if (!isValidCustomerGroup(customerGroupRaw)) {
          errors.push(`Row ${rowNo}: Customer Group must be Member or Non Member.`);
          return;
        }

        if (!isValidCustomerScore(customerScoreRaw)) {
          errors.push(`Row ${rowNo}: Customer Score must be Silver, Gold, Platinum, or Diamond.`);
          return;
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push(`Row ${rowNo}: Invalid email address.`);
          return;
        }

        if (!isValidStatus(status)) {
          errors.push(`Row ${rowNo}: Status must be Active, Inactive, or Blocked.`);
          return;
        }

        fileCodes.add(code);
        imported.push(mapCsvRowToCustomer(row, currentByCode.get(code), headerMap));
      });

      if (errors.length > 0) {
        Modal.error({
          title: 'CSV Import Validation Failed',
          width: 720,
          content: (
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              {errors.map((error) => (
                <Alert
                  key={error}
                  type="error"
                  showIcon
                  style={{ marginBottom: 8 }}
                  description={error}
                />
              ))}
            </div>
          ),
        });

        return false;
      }

      if (imported.length === 0) {
        messageApi.warning('No valid customer rows found.');
        return false;
      }

      setCustomers((prev) => {
        const nextByCode = new Map<string, CustomerRecord>(
          prev.map((item) => [normalizeCode(item.customerCode), item])
        );

        imported.forEach((item) => {
          nextByCode.set(normalizeCode(item.customerCode), item);
        });

        return Array.from(nextByCode.values()).sort((a, b) =>
          a.customerCode.localeCompare(b.customerCode)
        );
      });

      messageApi.success(`${imported.length} customers imported / updated.`);
    } catch (error) {
      console.error(error);
      messageApi.error('Failed to import CSV.');
    }

    return false;
  };

  const uploadProps: UploadProps = {
    accept: '.csv,text/csv',
    showUploadList: false,
    beforeUpload: async (file) => {
      await handleImportFile(file as File);
      return false;
    },
  };

  const columns: ColumnsType<CustomerRecord> = [
    {
      title: 'Customer ID',
      dataIndex: 'customerCode',
      key: 'customerCode',
      fixed: 'left',
      width: 150,
      sorter: (a, b) => a.customerCode.localeCompare(b.customerCode),
      render: (value) => <Text strong>{value}</Text>,
    },
    {
      title: 'Customer Name',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 220,
      sorter: (a, b) => a.customerName.localeCompare(b.customerName),
    },
    {
      title: 'Customer Group',
      dataIndex: 'customerGroup',
      key: 'customerGroup',
      width: 150,
      filters: [
        { text: 'Member', value: 'Member' },
        { text: 'Non Member', value: 'Non Member' },
      ],
      onFilter: (value, record) => record.customerGroup === String(value),
      render: (group: CustomerGroup) => <Tag color={customerGroupColor(group)}>{group}</Tag>,
    },
    {
      title: 'Customer Score',
      dataIndex: 'customerScore',
      key: 'customerScore',
      width: 150,
      filters: [
        { text: 'Silver', value: 'Silver' },
        { text: 'Gold', value: 'Gold' },
        { text: 'Platinum', value: 'Platinum' },
        { text: 'Diamond', value: 'Diamond' },
      ],
      onFilter: (value, record) => record.customerScore === String(value),
      render: (score: CustomerScore) => <Tag color={customerScoreColor(score)}>{score}</Tag>,
    },
    {
      title: 'Contact',
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      width: 170,
      render: (value) => value || '-',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
      render: (value) => value || '-',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 210,
      render: (value) => value || '-',
    },
    {
      title: 'City',
      dataIndex: 'city',
      key: 'city',
      width: 120,
      sorter: (a, b) => a.city.localeCompare(b.city),
      render: (value) => value || '-',
    },
    {
      title: 'Country',
      dataIndex: 'country',
      key: 'country',
      width: 120,
      render: (value) => value || '-',
    },
    {
      title: 'Payment Terms',
      dataIndex: 'paymentTerms',
      key: 'paymentTerms',
      width: 150,
      render: (value) => value || '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      filters: [
        { text: 'Active', value: 'Active' },
        { text: 'Inactive', value: 'Inactive' },
        { text: 'Blocked', value: 'Blocked' },
      ],
      onFilter: (value, record) => record.status === String(value),
      render: (status: CustomerRecord['status']) => <Tag color={statusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      render: (value) => formatDateTime(value),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 230,
      render: (_, record) => (
        <Space>
          <Tooltip title="View">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openViewModal(record)} />
          </Tooltip>

          <Tooltip title="Edit">
            <Button
              size="small"
              type="primary"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>

          <Tooltip title="Duplicate">
            <Button size="small" icon={<CopyOutlined />} onClick={() => handleDuplicate(record)} />
          </Tooltip>

          <Popconfirm
            title="Delete customer?"
            description={`Are you sure you want to delete ${record.customerCode}?`}
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record)}
          >
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}

      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            <UserOutlined /> Customer Master
          </Title>

          <Text type="secondary">
            Manage customer data for sales orders, outbound shipments, billing, delivery, and
            reporting.
          </Text>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Total Customers" value={summary.total} />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Active"
                value={summary.active}
                formatter={(value) => <span style={{ color: '#389e0d' }}>{value}</span>}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Inactive" value={summary.inactive} />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Blocked"
                value={summary.blocked}
                formatter={(value) => <span style={{ color: '#cf1322' }}>{value}</span>}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Card size="small">
              <Text type="secondary">Members: </Text>
              <Text strong style={{ color: '#1677ff' }}>
                {summary.members}
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12}>
            <Card size="small">
              <Text type="secondary">Non Members: </Text>
              <Text strong>{summary.nonMembers}</Text>
            </Card>
          </Col>
        </Row>

        <Card>
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} md={6}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Search customer ID, name, phone, email, city..."
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </Col>

            <Col xs={24} sm={12} md={3}>
              <Select style={{ width: '100%' }} value={statusFilter} onChange={setStatusFilter}>
                <Option value="All">All Status</Option>
                <Option value="Active">Active</Option>
                <Option value="Inactive">Inactive</Option>
                <Option value="Blocked">Blocked</Option>
              </Select>
            </Col>

            <Col xs={24} sm={12} md={3}>
              <Select style={{ width: '100%' }} value={cityFilter} onChange={setCityFilter}>
                <Option value="All">All Cities</Option>

                {cityOptions.map((city) => (
                  <Option key={city} value={city}>
                    {city}
                  </Option>
                ))}
              </Select>
            </Col>

            <Col xs={24} sm={12} md={3}>
              <Select
                style={{ width: '100%' }}
                value={customerGroupFilter}
                onChange={setCustomerGroupFilter}
              >
                <Option value="All">All Groups</Option>
                <Option value="Member">Member</Option>
                <Option value="Non Member">Non Member</Option>
              </Select>
            </Col>

            <Col xs={24} sm={12} md={3}>
              <Select
                style={{ width: '100%' }}
                value={customerScoreFilter}
                onChange={setCustomerScoreFilter}
              >
                <Option value="All">All Scores</Option>
                <Option value="Silver">Silver</Option>
                <Option value="Gold">Gold</Option>
                <Option value="Platinum">Platinum</Option>
                <Option value="Diamond">Diamond</Option>
              </Select>
            </Col>

            <Col xs={24} md={6}>
              <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button icon={<ClearOutlined />} onClick={handleClearFilters}>
                  Clear
                </Button>

                <Button icon={<ReloadOutlined />} onClick={handleLoadDemo}>
                  Load Demo
                </Button>

                <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                  Template
                </Button>

                <Upload {...uploadProps}>
                  <Button icon={<UploadOutlined />}>Import CSV</Button>
                </Upload>

                <Button icon={<FileExcelOutlined />} onClick={handleExportCsv}>
                  Export
                </Button>

                <Button danger icon={<DeleteOutlined />} onClick={handleClearAll}>
                  Clear All
                </Button>

                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                  New Customer
                </Button>
              </Space>
            </Col>
          </Row>

          <Divider />

          <Space style={{ marginBottom: 12 }}>
            <Text type="secondary">
              Showing {filteredCustomers.length.toLocaleString()} of{' '}
              {customers.length.toLocaleString()} customers
            </Text>
          </Space>

          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredCustomers}
            scroll={{ x: 1850 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `${total} customers`,
            }}
          />
        </Card>
      </Space>

      <Modal
        title={
          modalMode === 'create'
            ? 'Create Customer'
            : modalMode === 'edit'
              ? 'Edit Customer'
              : 'View Customer'
        }
        open={modalOpen}
        onCancel={closeModal}
        width={900}
        destroyOnHidden
        afterOpenChange={handleModalAfterOpenChange}
        footer={
          isViewMode ? (
            <Space>
              <Button onClick={closeModal}>Close</Button>

              {selectedCustomer && (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setModalMode('edit');
                  }}
                >
                  Edit
                </Button>
              )}
            </Space>
          ) : (
            <Space>
              <Button onClick={closeModal}>Cancel</Button>
              <Button type="primary" onClick={handleSave}>
                Save
              </Button>
            </Space>
          )
        }
      >
        <Form<CustomerFormValues>
          form={form}
          layout="vertical"
          disabled={isViewMode}
          initialValues={{
            status: 'Active',
            country: 'UAE',
            customerGroup: 'Non Member',
            customerScore: 'Silver',
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Customer ID"
                name="customerCode"
                rules={[
                  {
                    required: true,
                    message: 'Customer ID is required.',
                  },
                  {
                    max: 50,
                    message: 'Maximum 50 characters.',
                  },
                ]}
              >
                <Input placeholder="Example: CUS-1001" />
              </Form.Item>
            </Col>

            <Col xs={24} md={16}>
              <Form.Item
                label="Customer Name"
                name="customerName"
                rules={[
                  {
                    required: true,
                    message: 'Customer Name is required.',
                  },
                  {
                    max: 150,
                    message: 'Maximum 150 characters.',
                  },
                ]}
              >
                <Input placeholder="Customer company name" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Customer Group"
                name="customerGroup"
                rules={[
                  {
                    required: true,
                    message: 'Customer Group is required.',
                  },
                ]}
              >
                <Select placeholder="Select customer group">
                  <Option value="Member">Member</Option>
                  <Option value="Non Member">Non Member</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Customer Score"
                name="customerScore"
                rules={[
                  {
                    required: true,
                    message: 'Customer Score is required.',
                  },
                ]}
              >
                <Select placeholder="Select customer score">
                  <Option value="Silver">Silver</Option>
                  <Option value="Gold">Gold</Option>
                  <Option value="Platinum">Platinum</Option>
                  <Option value="Diamond">Diamond</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Contact Person" name="contactPerson">
                <Input placeholder="Contact person" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Phone" name="phone">
                <Input placeholder="+971..." />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  {
                    type: 'email',
                    message: 'Please enter a valid email address.',
                  },
                ]}
              >
                <Input placeholder="customer@example.com" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Status"
                name="status"
                rules={[
                  {
                    required: true,
                    message: 'Status is required.',
                  },
                ]}
              >
                <Select>
                  <Option value="Active">Active</Option>
                  <Option value="Inactive">Inactive</Option>
                  <Option value="Blocked">Blocked</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Billing Address" name="billingAddress">
                <TextArea rows={3} placeholder="Billing address" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Shipping Address" name="shippingAddress">
                <TextArea rows={3} placeholder="Default delivery address" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="City" name="city">
                <Input placeholder="Dubai" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Country" name="country">
                <Input placeholder="UAE" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Tax No / TRN" name="taxNo">
                <Input placeholder="Tax registration number" />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Payment Terms" name="paymentTerms">
                <Select placeholder="Select payment terms" allowClear>
                  <Option value="COD">COD</Option>
                  <Option value="Net 7">Net 7</Option>
                  <Option value="Net 15">Net 15</Option>
                  <Option value="Net 30">Net 30</Option>
                  <Option value="Net 45">Net 45</Option>
                  <Option value="Net 60">Net 60</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Remarks" name="remarks">
                <Input placeholder="Remarks / notes" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}