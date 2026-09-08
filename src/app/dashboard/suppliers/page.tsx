"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
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
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ClearOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UploadOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { TextArea } = Input;

type SupplierStatus = "Active" | "Inactive" | "Blocked";
type ModalMode = "create" | "edit" | "view";

interface SupplierRecord {
  id: string;
  supplierCode: string;
  supplierName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  paymentTerms?: string;
  creditLimit?: number;
  status: SupplierStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "wms_suppliers";
const PURCHASE_ORDER_KEY = "wms_purchase_orders";

const STATUS_OPTIONS: SupplierStatus[] = ["Active", "Inactive", "Blocked"];

const PAYMENT_TERM_OPTIONS = [
  "COD",
  "Net 7",
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60",
  "Advance Payment",
  "Milestone Payment",
];

const CSV_HEADERS = [
  "Supplier Code",
  "Supplier Name",
  "Contact Person",
  "Email",
  "Phone",
  "Address",
  "Country",
  "Payment Terms",
  "Credit Limit",
  "Status",
  "Remarks",
];

const DEMO_SUPPLIERS: SupplierRecord[] = [
  {
    id: "SUP-DEMO-001",
    supplierCode: "SUP-RAW-001",
    supplierName: "Global Raw Materials Ltd",
    contactPerson: "Michael Tan",
    email: "michael.tan@globalraw.example",
    phone: "+60 12-345 1001",
    address: "Lot 12, Industrial Park, Shah Alam",
    country: "Malaysia",
    paymentTerms: "Net 30",
    creditLimit: 50000,
    status: "Active",
    remarks: "Primary supplier for raw materials.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "SUP-DEMO-002",
    supplierCode: "SUP-PKG-002",
    supplierName: "Premium Packaging Supply",
    contactPerson: "Sarah Lim",
    email: "sarah.lim@premium-pack.example",
    phone: "+60 12-345 1002",
    address: "Packaging Hub, Klang",
    country: "Malaysia",
    paymentTerms: "Net 45",
    creditLimit: 35000,
    status: "Active",
    remarks: "Cartons, labels, and packaging consumables.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "SUP-DEMO-003",
    supplierCode: "SUP-CHEM-003",
    supplierName: "Asia Chemical Traders",
    contactPerson: "Daniel Wong",
    email: "daniel.wong@asiachem.example",
    phone: "+60 12-345 1003",
    address: "Chemical Trade Centre, Penang",
    country: "Malaysia",
    paymentTerms: "Net 30",
    creditLimit: 15000,
    status: "Inactive",
    remarks: "Inactive due to pricing review.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "SUP-DEMO-004",
    supplierCode: "SUP-INTL-004",
    supplierName: "Nippon Industrial Export",
    contactPerson: "Hiroshi Sato",
    email: "hiroshi.sato@nipponexport.example",
    phone: "+81 90-1234-5678",
    address: "Osaka Industrial Zone",
    country: "Japan",
    paymentTerms: "Advance Payment",
    creditLimit: 80000,
    status: "Active",
    remarks: "International supplier.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function normalizeCode(value?: string) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function cleanText(value?: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value?: unknown, fallback = 0) {
  const cleaned = String(value ?? "")
    .replace(/,/g, "")
    .trim();

  if (!cleaned) return fallback;

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

function formatMoney(value?: number) {
  const amount = Number(value || 0);

  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function generateId(prefix = "SUP") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function formatDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString();
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;

    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function readLocalArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];

  const parsed = safeJsonParse<T[]>(window.localStorage.getItem(key), []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeLocalArray<T>(key: string, records: T[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(key, JSON.stringify(records));
}

function statusColor(status: SupplierStatus) {
  if (status === "Active") return "green";
  if (status === "Inactive") return "default";
  if (status === "Blocked") return "red";

  return "blue";
}

function csvEscape(value?: unknown) {
  const raw = String(value ?? "");

  if (raw.includes(",") || raw.includes("\n") || raw.includes('"')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }

  return raw;
}

function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/csv;charset=utf-8;"
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];

  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;

      row.push(current);
      rows.push(row);

      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  rows.push(row);

  return rows.filter((r) => r.some((cell) => cleanText(cell)));
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "")
    .replace(/-/g, "");
}

function getCsvCell(headers: string[], row: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);

  for (let i = 0; i < headers.length; i += 1) {
    if (normalizedAliases.includes(normalizeHeader(headers[i]))) {
      return cleanText(row[i]);
    }
  }

  return "";
}

function isValidEmail(value?: string) {
  if (!value) return true;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function SupplierMasterPage() {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [form] = Form.useForm<SupplierRecord>();

  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | "All">("All");
  const [countryFilter, setCountryFilter] = useState<string>("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRecord | null>(null);

  useEffect(() => {
    const records = readLocalArray<SupplierRecord>(STORAGE_KEY).map((item) => ({
      ...item,
      creditLimit: toNumber(item.creditLimit, 0),
    }));

    setSuppliers(records);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    if (modalMode === "create") {
      form.setFieldsValue({
        status: "Active",
        paymentTerms: "Net 30",
        creditLimit: 0,
      } as SupplierRecord);
      return;
    }

    if (selectedSupplier) {
      form.setFieldsValue({
        ...selectedSupplier,
        creditLimit: toNumber(selectedSupplier.creditLimit, 0),
      });
    }
  }, [modalOpen, modalMode, selectedSupplier, form]);

  const persistSuppliers = (nextRecords: SupplierRecord[]) => {
    const normalizedRecords = nextRecords.map((item) => ({
      ...item,
      creditLimit: toNumber(item.creditLimit, 0),
    }));

    setSuppliers(normalizedRecords);
    writeLocalArray(STORAGE_KEY, normalizedRecords);
  };

  const supplierCodeSet = useMemo(() => {
    return new Set(suppliers.map((item) => normalizeCode(item.supplierCode)));
  }, [suppliers]);

  const countryOptions = useMemo(() => {
    const countries = Array.from(
      new Set(suppliers.map((item) => cleanText(item.country)).filter(Boolean))
    ).sort();

    return countries;
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return suppliers.filter((item) => {
      const matchesKeyword =
        !keyword ||
        [
          item.supplierCode,
          item.supplierName,
          item.contactPerson,
          item.email,
          item.phone,
          item.country,
          item.paymentTerms,
          item.creditLimit,
          item.remarks,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const matchesCountry = countryFilter === "All" || item.country === countryFilter;

      return matchesKeyword && matchesStatus && matchesCountry;
    });
  }, [suppliers, searchText, statusFilter, countryFilter]);

  const summary = useMemo(() => {
    return {
      total: suppliers.length,
      active: suppliers.filter((item) => item.status === "Active").length,
      inactive: suppliers.filter((item) => item.status === "Inactive").length,
      blocked: suppliers.filter((item) => item.status === "Blocked").length,
    };
  }, [suppliers]);

  const openCreateModal = () => {
    setSelectedSupplier(null);
    setModalMode("create");
    form.resetFields();
    setModalOpen(true);
  };

  const openViewModal = (record: SupplierRecord) => {
    setSelectedSupplier(record);
    setModalMode("view");
    setModalOpen(true);
  };

  const openEditModal = (record: SupplierRecord) => {
    setSelectedSupplier(record);
    setModalMode("edit");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedSupplier(null);
    form.resetFields();
  };

  const handleSaveSupplier = async () => {
    try {
      const values = await form.validateFields();

      const supplierCode = normalizeCode(values.supplierCode);
      const supplierName = cleanText(values.supplierName);

      const duplicate = suppliers.find((item) => {
        const sameCode = normalizeCode(item.supplierCode) === supplierCode;
        const differentRecord =
          modalMode === "create" || item.id !== selectedSupplier?.id;

        return sameCode && differentRecord;
      });

      if (duplicate) {
        messageApi.error(`Supplier Code "${supplierCode}" already exists.`);
        return;
      }

      const now = new Date().toISOString();

      if (modalMode === "create") {
        const newRecord: SupplierRecord = {
          id: generateId(),
          supplierCode,
          supplierName,
          contactPerson: cleanText(values.contactPerson),
          email: cleanText(values.email),
          phone: cleanText(values.phone),
          address: cleanText(values.address),
          country: cleanText(values.country),
          paymentTerms: cleanText(values.paymentTerms),
          creditLimit: toNumber(values.creditLimit, 0),
          status: values.status || "Active",
          remarks: cleanText(values.remarks),
          createdAt: now,
          updatedAt: now,
        };

        persistSuppliers([newRecord, ...suppliers]);
        messageApi.success("Supplier created successfully.");
      }

      if (modalMode === "edit" && selectedSupplier) {
        const updatedRecords = suppliers.map((item) => {
          if (item.id !== selectedSupplier.id) return item;

          return {
            ...item,
            supplierCode,
            supplierName,
            contactPerson: cleanText(values.contactPerson),
            email: cleanText(values.email),
            phone: cleanText(values.phone),
            address: cleanText(values.address),
            country: cleanText(values.country),
            paymentTerms: cleanText(values.paymentTerms),
            creditLimit: toNumber(values.creditLimit, 0),
            status: values.status || "Active",
            remarks: cleanText(values.remarks),
            updatedAt: now,
          };
        });

        persistSuppliers(updatedRecords);
        messageApi.success("Supplier updated successfully.");
      }

      closeModal();
    } catch {
      messageApi.warning("Please check the required fields.");
    }
  };

  const isSupplierUsedInPurchaseOrders = (supplierCode: string) => {
    const purchaseOrders = readLocalArray<any>(PURCHASE_ORDER_KEY);
    const normalized = normalizeCode(supplierCode);

    return purchaseOrders.some((po) => {
      return normalizeCode(po?.supplierCode) === normalized;
    });
  };

  const handleDeleteSupplier = (record: SupplierRecord) => {
    if (isSupplierUsedInPurchaseOrders(record.supplierCode)) {
      messageApi.error(
        `Supplier "${record.supplierCode}" is used in Purchase Orders and cannot be deleted.`
      );
      return;
    }

    const nextRecords = suppliers.filter((item) => item.id !== record.id);

    persistSuppliers(nextRecords);
    messageApi.success("Supplier deleted successfully.");
  };

  const handleDuplicateSupplier = (record: SupplierRecord) => {
    let copyCode = `${normalizeCode(record.supplierCode)}-COPY`;
    let counter = 2;

    while (supplierCodeSet.has(copyCode)) {
      copyCode = `${normalizeCode(record.supplierCode)}-COPY-${counter}`;
      counter += 1;
    }

    const now = new Date().toISOString();

    const copy: SupplierRecord = {
      ...record,
      id: generateId(),
      supplierCode: copyCode,
      supplierName: `${record.supplierName} Copy`,
      creditLimit: toNumber(record.creditLimit, 0),
      status: "Inactive",
      createdAt: now,
      updatedAt: now,
    };

    persistSuppliers([copy, ...suppliers]);
    messageApi.success(`Supplier duplicated as "${copyCode}".`);
  };

  const handleLoadDemoData = () => {
    const existingCodes = new Set(
      suppliers.map((item) => normalizeCode(item.supplierCode))
    );

    const demoToAdd = DEMO_SUPPLIERS.filter(
      (item) => !existingCodes.has(normalizeCode(item.supplierCode))
    );

    if (demoToAdd.length === 0) {
      messageApi.info("Demo suppliers are already loaded.");
      return;
    }

    persistSuppliers([...demoToAdd, ...suppliers]);
    messageApi.success(`${demoToAdd.length} demo supplier(s) loaded.`);
  };

  const handleExportCsv = () => {
    const rows = filteredSuppliers.map((item) =>
      [
        item.supplierCode,
        item.supplierName,
        item.contactPerson,
        item.email,
        item.phone,
        item.address,
        item.country,
        item.paymentTerms,
        toNumber(item.creditLimit, 0),
        item.status,
        item.remarks,
      ]
        .map(csvEscape)
        .join(",")
    );

    const csv = [CSV_HEADERS.join(","), ...rows].join("\n");

    downloadTextFile(
      `supplier-master-${new Date().toISOString().slice(0, 10)}.csv`,
      csv
    );

    messageApi.success("Supplier CSV exported.");
  };

  const handleDownloadTemplate = () => {
    const exampleRow = [
      "SUP-001",
      "Example Supplier Sdn Bhd",
      "John Tan",
      "john@example.com",
      "+60 12-345 6789",
      "Example Address",
      "Malaysia",
      "Net 30",
      "50000",
      "Active",
      "Optional remarks",
    ];

    const csv = [CSV_HEADERS.join(","), exampleRow.map(csvEscape).join(",")].join(
      "\n"
    );

    downloadTextFile("supplier-master-template.csv", csv);
    messageApi.success("Supplier import template downloaded.");
  };

  const importSupplierCsv = (text: string) => {
    const rows = parseCsv(text);

    if (rows.length < 2) {
      messageApi.error("CSV file has no data rows.");
      return;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const existingCodes = new Set(
      suppliers.map((item) => normalizeCode(item.supplierCode))
    );

    const fileCodes = new Set<string>();
    const errors: string[] = [];
    const imported: SupplierRecord[] = [];

    dataRows.forEach((row, index) => {
      const lineNo = index + 2;

      const supplierCode = normalizeCode(
        getCsvCell(headers, row, ["Supplier Code", "supplierCode", "Code"])
      );

      const supplierName = cleanText(
        getCsvCell(headers, row, ["Supplier Name", "supplierName", "Name"])
      );

      const contactPerson = cleanText(
        getCsvCell(headers, row, ["Contact Person", "contactPerson", "Contact"])
      );

      const email = cleanText(getCsvCell(headers, row, ["Email", "Email Address"]));

      const phone = cleanText(
        getCsvCell(headers, row, ["Phone", "Phone No", "Telephone"])
      );

      const address = cleanText(getCsvCell(headers, row, ["Address"]));
      const country = cleanText(getCsvCell(headers, row, ["Country"]));

      const paymentTerms = cleanText(
        getCsvCell(headers, row, ["Payment Terms", "paymentTerms"])
      );

      const rawCreditLimit = cleanText(
        getCsvCell(headers, row, [
          "Credit Limit",
          "creditLimit",
          "CreditLimit",
          "Limit",
        ])
      );

      const creditLimit = toNumber(rawCreditLimit, 0);

      const rawStatus = cleanText(getCsvCell(headers, row, ["Status"])) || "Active";

      const remarks = cleanText(
        getCsvCell(headers, row, ["Remarks", "Remark", "Notes"])
      );

      if (!supplierCode) {
        errors.push(`Line ${lineNo}: Supplier Code is required.`);
      }

      if (!supplierName) {
        errors.push(`Line ${lineNo}: Supplier Name is required.`);
      }

      if (supplierCode && existingCodes.has(supplierCode)) {
        errors.push(`Line ${lineNo}: Supplier Code "${supplierCode}" already exists.`);
      }

      if (supplierCode && fileCodes.has(supplierCode)) {
        errors.push(`Line ${lineNo}: Duplicate Supplier Code "${supplierCode}" in CSV.`);
      }

      if (email && !isValidEmail(email)) {
        errors.push(`Line ${lineNo}: Invalid email "${email}".`);
      }

      if (rawCreditLimit && creditLimit < 0) {
        errors.push(`Line ${lineNo}: Credit Limit cannot be negative.`);
      }

      if (!STATUS_OPTIONS.includes(rawStatus as SupplierStatus)) {
        errors.push(
          `Line ${lineNo}: Status must be one of ${STATUS_OPTIONS.join(", ")}.`
        );
      }

      if (supplierCode) {
        fileCodes.add(supplierCode);
      }

      const now = new Date().toISOString();

      imported.push({
        id: generateId(),
        supplierCode,
        supplierName,
        contactPerson,
        email,
        phone,
        address,
        country,
        paymentTerms,
        creditLimit,
        status: (rawStatus as SupplierStatus) || "Active",
        remarks,
        createdAt: now,
        updatedAt: now,
      });
    });

    if (errors.length > 0) {
      modalApi.error({
        title: "Supplier CSV Import Failed",
        content: (
          <div>
            <Text>Please fix the following issue(s) and import again:</Text>
            <ul style={{ marginTop: 12, paddingLeft: 20 }}>
              {errors.slice(0, 12).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
            {errors.length > 12 && (
              <Text type="secondary">
                And {errors.length - 12} more error(s).
              </Text>
            )}
          </div>
        ),
      });

      return;
    }

    persistSuppliers([...imported, ...suppliers]);
    messageApi.success(`${imported.length} supplier(s) imported successfully.`);
  };

  const handleUploadCsv = (file: File) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = String(event.target?.result || "");
      importSupplierCsv(text);
    };

    reader.readAsText(file);

    return false;
  };

  const handleClearFilters = () => {
    setSearchText("");
    setStatusFilter("All");
    setCountryFilter("All");
  };

  const columns: ColumnsType<SupplierRecord> = [
    {
      title: "Supplier Code",
      dataIndex: "supplierCode",
      key: "supplierCode",
      width: 160,
      fixed: "left",
      sorter: (a, b) => a.supplierCode.localeCompare(b.supplierCode),
      render: (value: string, record) => (
        <Button
          type="link"
          onClick={() => openViewModal(record)}
          style={{ padding: 0 }}
        >
          {value}
        </Button>
      ),
    },
    {
      title: "Supplier Name",
      dataIndex: "supplierName",
      key: "supplierName",
      width: 240,
      sorter: (a, b) => a.supplierName.localeCompare(b.supplierName),
    },
    {
      title: "Contact",
      dataIndex: "contactPerson",
      key: "contactPerson",
      width: 160,
      render: (value?: string) => value || "-",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      width: 220,
      render: (value?: string) => value || "-",
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
      width: 150,
      render: (value?: string) => value || "-",
    },
    {
      title: "Country",
      dataIndex: "country",
      key: "country",
      width: 130,
      render: (value?: string) => value || "-",
    },
    {
      title: "Payment Terms",
      dataIndex: "paymentTerms",
      key: "paymentTerms",
      width: 150,
      render: (value?: string) => value || "-",
    },
    {
      title: "Credit Limit",
      dataIndex: "creditLimit",
      key: "creditLimit",
      width: 150,
      align: "right",
      render: (value?: number) => formatMoney(value),
      sorter: (a, b) => toNumber(a.creditLimit, 0) - toNumber(b.creditLimit, 0),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: SupplierStatus) => (
        <Tag color={statusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: "Updated At",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 190,
      render: (value?: string) => formatDate(value),
      sorter: (a, b) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    },
    {
      title: "Actions",
      key: "actions",
      width: 210,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Tooltip title="View">
            <Button icon={<EyeOutlined />} onClick={() => openViewModal(record)} />
          </Tooltip>

          <Tooltip title="Edit">
            <Button icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          </Tooltip>

          <Tooltip title="Duplicate">
            <Button
              icon={<CopyOutlined />}
              onClick={() => handleDuplicateSupplier(record)}
            />
          </Tooltip>

          <Tooltip title="Delete">
            <Popconfirm
              title="Delete supplier?"
              description="This action cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDeleteSupplier(record)}
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      {messageContextHolder}
      {modalContextHolder}

      <div style={{ padding: 24 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Space orientation="vertical" size={0}>
              <Title level={3} style={{ margin: 0 }}>
                <TeamOutlined /> Supplier Master
              </Title>
              <Text type="secondary">
                Manage suppliers for Purchase Orders and inbound procurement flow.
              </Text>
            </Space>
          </Col>

          <Col>
            <Space wrap>
              <Button icon={<FileTextOutlined />} onClick={handleDownloadTemplate}>
                Template
              </Button>

              <Upload
                accept=".csv"
                beforeUpload={handleUploadCsv}
                showUploadList={false}
                maxCount={1}
              >
                <Button icon={<UploadOutlined />}>Import CSV</Button>
              </Upload>

              <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>
                Export CSV
              </Button>

              <Button icon={<ReloadOutlined />} onClick={handleLoadDemoData}>
                Load Demo
              </Button>

              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                New Supplier
              </Button>
            </Space>
          </Col>
        </Row>

        <Divider />

        <Alert
          type="info"
          showIcon
          title="Supplier Master is ready for Purchase Order integration."
          description="Supplier Code is unique and can be used as a searchable dropdown in the Purchase Order module. Deletion is blocked when the supplier is already referenced by Purchase Orders."
          style={{ marginBottom: 16 }}
        />

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Total Suppliers" value={summary.total} />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Active"
                value={summary.active}
                valueStyle={{ color: "#389e0d" }}
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
                valueStyle={{ color: "#cf1322" }}
              />
            </Card>
          </Col>
        </Row>

        <Card style={{ marginBottom: 16 }}>
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} md={10}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Search supplier code, name, contact, email, phone, credit limit..."
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </Col>

            <Col xs={24} md={5}>
              <Select
                style={{ width: "100%" }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { label: "All Status", value: "All" },
                  ...STATUS_OPTIONS.map((status) => ({
                    label: status,
                    value: status,
                  })),
                ]}
              />
            </Col>

            <Col xs={24} md={5}>
              <Select
                style={{ width: "100%" }}
                value={countryFilter}
                onChange={setCountryFilter}
                options={[
                  { label: "All Countries", value: "All" },
                  ...countryOptions.map((country) => ({
                    label: country,
                    value: country,
                  })),
                ]}
              />
            </Col>

            <Col xs={24} md={4}>
              <Button block icon={<ClearOutlined />} onClick={handleClearFilters}>
                Clear
              </Button>
            </Col>
          </Row>
        </Card>

        <Card>
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={filteredSuppliers}
            scroll={{ x: 1850 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} suppliers`,
            }}
          />
        </Card>

        <Modal
          title={
            modalMode === "create"
              ? "Create Supplier"
              : modalMode === "edit"
              ? "Edit Supplier"
              : "View Supplier"
          }
          open={modalOpen}
          onCancel={closeModal}
          width={900}
          destroyOnHidden
          footer={
            modalMode === "view"
              ? [
                  <Button key="close" onClick={closeModal}>
                    Close
                  </Button>,
                  <Button
                    key="edit"
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => setModalMode("edit")}
                  >
                    Edit
                  </Button>,
                ]
              : [
                  <Button key="cancel" onClick={closeModal}>
                    Cancel
                  </Button>,
                  <Button key="save" type="primary" onClick={handleSaveSupplier}>
                    Save
                  </Button>,
                ]
          }
        >
          <Form form={form} layout="vertical" disabled={modalMode === "view"}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Supplier Code"
                  name="supplierCode"
                  rules={[
                    { required: true, message: "Supplier Code is required." },
                    {
                      pattern: /^[A-Za-z0-9._-]+$/,
                      message: "Use letters, numbers, dot, dash or underscore only.",
                    },
                  ]}
                >
                  <Input placeholder="e.g. SUP-001" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label="Supplier Name"
                  name="supplierName"
                  rules={[
                    { required: true, message: "Supplier Name is required." },
                  ]}
                >
                  <Input placeholder="e.g. Example Supplier Sdn Bhd" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item label="Contact Person" name="contactPerson">
                  <Input placeholder="Contact person" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[{ type: "email", message: "Please enter a valid email." }]}
                >
                  <Input placeholder="email@example.com" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item label="Phone" name="phone">
                  <Input placeholder="+60 ..." />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item label="Country" name="country">
                  <Input placeholder="Country" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item label="Payment Terms" name="paymentTerms">
                  <Select
                    showSearch
                    allowClear
                    placeholder="Select payment terms"
                    options={PAYMENT_TERM_OPTIONS.map((term) => ({
                      label: term,
                      value: term,
                    }))}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label="Credit Limit"
                  name="creditLimit"
                  rules={[
                    {
                      type: "number",
                      min: 0,
                      message: "Credit Limit cannot be negative.",
                    },
                  ]}
                >
                  <InputNumber<number>
                    style={{ width: "100%" }}
                    min={0}
                    precision={2}
                    placeholder="e.g. 50000"
                    formatter={(value) =>
                      `${value ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                    }
                    parser={(value) =>
                      Number(String(value ?? "").replace(/,/g, ""))
                    }
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label="Status"
                  name="status"
                  rules={[{ required: true, message: "Status is required." }]}
                >
                  <Select
                    options={STATUS_OPTIONS.map((status) => ({
                      label: status,
                      value: status,
                    }))}
                  />
                </Form.Item>
              </Col>

              <Col xs={24}>
                <Form.Item label="Address" name="address">
                  <TextArea rows={2} placeholder="Supplier address" />
                </Form.Item>
              </Col>

              <Col xs={24}>
                <Form.Item label="Remarks" name="remarks">
                  <TextArea rows={3} placeholder="Optional remarks" />
                </Form.Item>
              </Col>
            </Row>

            {modalMode !== "create" && selectedSupplier && (
              <>
                <Divider />

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Text type="secondary">Created At</Text>
                    <br />
                    <Text>{formatDate(selectedSupplier.createdAt)}</Text>
                  </Col>

                  <Col xs={24} md={12}>
                    <Text type="secondary">Updated At</Text>
                    <br />
                    <Text>{formatDate(selectedSupplier.updatedAt)}</Text>
                  </Col>
                </Row>
              </>
            )}
          </Form>
        </Modal>
      </div>
    </>
  );
}