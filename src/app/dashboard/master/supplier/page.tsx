"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
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
import type { UploadProps } from "antd";
import {
  CloudDownloadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { TextArea } = Input;

type SupplierStatus = "Active" | "Inactive" | "Blocked";
type SupplierType = "Local Supplier" | "Overseas Supplier";
type PaymentTerm =
  | "Cash"
  | "7 Days"
  | "14 Days"
  | "30 Days"
  | "45 Days"
  | "60 Days"
  | "90 Days";

interface SupplierRecord {
  id: string;
  supplierCode: string;
  supplierName: string;
  supplierType: SupplierType;
  status: SupplierStatus;

  registrationNo?: string;
  taxNo?: string;

  contactPerson?: string;
  phone?: string;
  email?: string;

  paymentTerm: PaymentTerm;
  creditLimit: number;

  bankName?: string;
  bankAccountNo?: string;

  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country: string;

  remarks?: string;

  createdAt: string;
  updatedAt: string;
}

interface SupplierFormValues {
  supplierCode: string;
  supplierName: string;
  supplierType: SupplierType;
  status: SupplierStatus;

  registrationNo?: string;
  taxNo?: string;

  contactPerson?: string;
  phone?: string;
  email?: string;

  paymentTerm: PaymentTerm;
  creditLimit?: number;

  bankName?: string;
  bankAccountNo?: string;

  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country: string;

  remarks?: string;
}

const STORAGE_KEY = "wms_suppliers";

const supplierTypeOptions: SupplierType[] = [
  "Local Supplier",
  "Overseas Supplier",
];

const supplierStatusOptions: SupplierStatus[] = ["Active", "Inactive", "Blocked"];

const paymentTermOptions: PaymentTerm[] = [
  "Cash",
  "7 Days",
  "14 Days",
  "30 Days",
  "45 Days",
  "60 Days",
  "90 Days",
];

const countryOptions = [
  "Malaysia",
  "Singapore",
  "Thailand",
  "Indonesia",
  "Vietnam",
  "China",
  "Japan",
  "South Korea",
  "India",
  "Australia",
  "United States",
  "United Kingdom",
  "Germany",
];

const demoSuppliers: SupplierRecord[] = [
  {
    id: "SUP-DEMO-001",
    supplierCode: "SUP-001",
    supplierName: "ABC Supplier Sdn Bhd",
    supplierType: "Local Supplier",
    status: "Active",
    registrationNo: "202001234567",
    taxNo: "SST-00112233",
    contactPerson: "Mr. Lim",
    phone: "+60 12-345 6789",
    email: "sales@abcsupplier.com",
    paymentTerm: "30 Days",
    creditLimit: 50000,
    bankName: "Maybank",
    bankAccountNo: "1234567890",
    address: "No. 12, Jalan Industri 1",
    city: "Shah Alam",
    state: "Selangor",
    postcode: "40150",
    country: "Malaysia",
    remarks: "Main local packaging supplier.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "SUP-DEMO-002",
    supplierCode: "SUP-002",
    supplierName: "Global Raw Materials Pte Ltd",
    supplierType: "Overseas Supplier",
    status: "Active",
    registrationNo: "SG-998877",
    taxNo: "GST-556677",
    contactPerson: "Ms. Tan",
    phone: "+65 6123 4567",
    email: "contact@globalraw.com",
    paymentTerm: "60 Days",
    creditLimit: 150000,
    bankName: "DBS Bank",
    bankAccountNo: "9876543210",
    address: "21 Tuas Avenue",
    city: "Singapore",
    state: "Singapore",
    postcode: "639123",
    country: "Singapore",
    remarks: "Overseas raw material supplier.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizeCode = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const formatCurrency = (value?: number) => {
  const numberValue = Number(value || 0);

  return numberValue.toLocaleString("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const generateId = () =>
  `SUP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const safeNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const escapeCSV = (value: unknown) => {
  const stringValue = String(value ?? "");
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const parseCSVLine = (line: string) => {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());

  return result;
};

const parseCSV = (text: string) => {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCSVLine(lines[0]).map((header) => normalizeText(header));

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
};

const downloadCSV = (filename: string, content: string) => {
  const blob = new Blob([content], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
};

export default function SupplierMasterPage() {
  const [messageApi, contextHolder] = message.useMessage();

  const [form] = Form.useForm<SupplierFormValues>();

  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  const [editingSupplier, setEditingSupplier] = useState<SupplierRecord | null>(
    null
  );
  const [viewingSupplier, setViewingSupplier] = useState<SupplierRecord | null>(
    null
  );

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | "All">(
    "All"
  );
  const [typeFilter, setTypeFilter] = useState<SupplierType | "All">("All");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as SupplierRecord[];

        if (Array.isArray(parsed)) {
          const cleaned = parsed.map((item) => ({
            ...item,
            creditLimit: safeNumber(item.creditLimit),
          }));

          setSuppliers(cleaned);
        }
      }
    } catch (error) {
      console.error("Failed to load suppliers:", error);
      messageApi.error("Failed to load supplier data from localStorage.");
    } finally {
      setHydrated(true);
    }
  }, [messageApi]);

  useEffect(() => {
    if (!hydrated) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(suppliers));
  }, [suppliers, hydrated]);

  const filteredSuppliers = useMemo(() => {
    const keyword = normalizeText(searchText);

    return suppliers.filter((supplier) => {
      const matchesSearch =
        !keyword ||
        normalizeText(supplier.supplierCode).includes(keyword) ||
        normalizeText(supplier.supplierName).includes(keyword) ||
        normalizeText(supplier.contactPerson).includes(keyword) ||
        normalizeText(supplier.phone).includes(keyword) ||
        normalizeText(supplier.email).includes(keyword) ||
        normalizeText(supplier.bankName).includes(keyword) ||
        normalizeText(supplier.country).includes(keyword);

      const matchesStatus =
        statusFilter === "All" || supplier.status === statusFilter;

      const matchesType =
        typeFilter === "All" || supplier.supplierType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [suppliers, searchText, statusFilter, typeFilter]);

  const totalCreditLimit = useMemo(() => {
    return suppliers.reduce(
      (sum, supplier) => sum + safeNumber(supplier.creditLimit),
      0
    );
  }, [suppliers]);

  const openAddModal = () => {
    setEditingSupplier(null);
    form.resetFields();

    form.setFieldsValue({
      supplierType: "Local Supplier",
      status: "Active",
      paymentTerm: "30 Days",
      country: "Malaysia",
      creditLimit: 0,
    });

    setModalOpen(true);
  };

  const openEditModal = (record: SupplierRecord) => {
    setEditingSupplier(record);
    form.resetFields();

    form.setFieldsValue({
      supplierCode: record.supplierCode,
      supplierName: record.supplierName,
      supplierType: record.supplierType,
      status: record.status,
      registrationNo: record.registrationNo,
      taxNo: record.taxNo,
      contactPerson: record.contactPerson,
      phone: record.phone,
      email: record.email,
      paymentTerm: record.paymentTerm,
      creditLimit: safeNumber(record.creditLimit),
      bankName: record.bankName,
      bankAccountNo: record.bankAccountNo,
      address: record.address,
      city: record.city,
      state: record.state,
      postcode: record.postcode,
      country: record.country,
      remarks: record.remarks,
    });

    setModalOpen(true);
  };

  const openViewModal = (record: SupplierRecord) => {
    setViewingSupplier(record);
    setViewModalOpen(true);
  };

  const handleSaveSupplier = async () => {
    try {
      const values = await form.validateFields();

      const supplierCode = normalizeCode(values.supplierCode);

      const duplicate = suppliers.some((supplier) => {
        if (editingSupplier && supplier.id === editingSupplier.id) {
          return false;
        }

        return normalizeCode(supplier.supplierCode) === supplierCode;
      });

      if (duplicate) {
        messageApi.error("Supplier Code already exists.");
        return;
      }

      const now = new Date().toISOString();

      if (editingSupplier) {
        setSuppliers((previous) =>
          previous.map((supplier) =>
            supplier.id === editingSupplier.id
              ? {
                  ...supplier,
                  supplierCode,
                  supplierName: values.supplierName.trim(),
                  supplierType: values.supplierType,
                  status: values.status,
                  registrationNo: values.registrationNo?.trim(),
                  taxNo: values.taxNo?.trim(),
                  contactPerson: values.contactPerson?.trim(),
                  phone: values.phone?.trim(),
                  email: values.email?.trim(),
                  paymentTerm: values.paymentTerm,
                  creditLimit: safeNumber(values.creditLimit),
                  bankName: values.bankName?.trim(),
                  bankAccountNo: values.bankAccountNo?.trim(),
                  address: values.address?.trim(),
                  city: values.city?.trim(),
                  state: values.state?.trim(),
                  postcode: values.postcode?.trim(),
                  country: values.country,
                  remarks: values.remarks?.trim(),
                  updatedAt: now,
                }
              : supplier
          )
        );

        messageApi.success("Supplier updated successfully.");
      } else {
        const newSupplier: SupplierRecord = {
          id: generateId(),
          supplierCode,
          supplierName: values.supplierName.trim(),
          supplierType: values.supplierType,
          status: values.status,
          registrationNo: values.registrationNo?.trim(),
          taxNo: values.taxNo?.trim(),
          contactPerson: values.contactPerson?.trim(),
          phone: values.phone?.trim(),
          email: values.email?.trim(),
          paymentTerm: values.paymentTerm,
          creditLimit: safeNumber(values.creditLimit),
          bankName: values.bankName?.trim(),
          bankAccountNo: values.bankAccountNo?.trim(),
          address: values.address?.trim(),
          city: values.city?.trim(),
          state: values.state?.trim(),
          postcode: values.postcode?.trim(),
          country: values.country,
          remarks: values.remarks?.trim(),
          createdAt: now,
          updatedAt: now,
        };

        setSuppliers((previous) => [newSupplier, ...previous]);

        messageApi.success("Supplier added successfully.");
      }

      setModalOpen(false);
      setEditingSupplier(null);
      form.resetFields();
    } catch {
      messageApi.warning("Please complete all required fields.");
    }
  };

  const handleDeleteSupplier = (record: SupplierRecord) => {
    setSuppliers((previous) =>
      previous.filter((supplier) => supplier.id !== record.id)
    );

    messageApi.success("Supplier deleted successfully.");
  };

  const handleLoadDemoData = () => {
    Modal.confirm({
      title: "Load demo suppliers?",
      content:
        "This will replace the current supplier list with demo supplier data.",
      okText: "Load Demo",
      cancelText: "Cancel",
      onOk: () => {
        setSuppliers(demoSuppliers);
        messageApi.success("Demo suppliers loaded.");
      },
    });
  };

  const handleClearAll = () => {
    Modal.confirm({
      title: "Clear all suppliers?",
      content:
        "This action will permanently remove all suppliers from localStorage.",
      okText: "Clear All",
      okButtonProps: {
        danger: true,
      },
      cancelText: "Cancel",
      onOk: () => {
        setSuppliers([]);
        messageApi.success("All suppliers cleared.");
      },
    });
  };

  const handleExportCSV = () => {
    const headers = [
      "Supplier Code",
      "Supplier Name",
      "Supplier Type",
      "Status",
      "Registration No.",
      "Tax No. / SST No.",
      "Contact Person",
      "Phone",
      "Email",
      "Payment Term",
      "Credit Limit",
      "Bank Name",
      "Bank Account No.",
      "Address",
      "City",
      "State",
      "Postcode",
      "Country",
      "Remarks",
      "Created At",
      "Updated At",
    ];

    const rows = filteredSuppliers.map((supplier) => [
      supplier.supplierCode,
      supplier.supplierName,
      supplier.supplierType,
      supplier.status,
      supplier.registrationNo,
      supplier.taxNo,
      supplier.contactPerson,
      supplier.phone,
      supplier.email,
      supplier.paymentTerm,
      supplier.creditLimit,
      supplier.bankName,
      supplier.bankAccountNo,
      supplier.address,
      supplier.city,
      supplier.state,
      supplier.postcode,
      supplier.country,
      supplier.remarks,
      supplier.createdAt,
      supplier.updatedAt,
    ]);

    const csv = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    downloadCSV(`supplier-master-${Date.now()}.csv`, csv);

    messageApi.success("Supplier CSV exported.");
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Supplier Code",
      "Supplier Name",
      "Supplier Type",
      "Status",
      "Registration No.",
      "Tax No. / SST No.",
      "Contact Person",
      "Phone",
      "Email",
      "Payment Term",
      "Credit Limit",
      "Bank Name",
      "Bank Account No.",
      "Address",
      "City",
      "State",
      "Postcode",
      "Country",
      "Remarks",
    ];

    const sampleRow = [
      "SUP-001",
      "ABC Supplier Sdn Bhd",
      "Local Supplier",
      "Active",
      "202001234567",
      "SST-00112233",
      "Mr. Lim",
      "+60 12-345 6789",
      "sales@example.com",
      "30 Days",
      "50000",
      "Maybank",
      "1234567890",
      "Supplier address",
      "Shah Alam",
      "Selangor",
      "40150",
      "Malaysia",
      "Optional remarks",
    ];

    const csv = [
      headers.map(escapeCSV).join(","),
      sampleRow.map(escapeCSV).join(","),
    ].join("\n");

    downloadCSV("supplier-master-template.csv", csv);

    messageApi.success("Supplier import template downloaded.");
  };

  const handleImportCSV: UploadProps["beforeUpload"] = (file) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || "");
        const rows = parseCSV(text);

        if (!rows.length) {
          messageApi.error("CSV file is empty or invalid.");
          return;
        }

        const existingCodes = new Set(
          suppliers.map((supplier) => normalizeCode(supplier.supplierCode))
        );

        const imported: SupplierRecord[] = [];
        const errors: string[] = [];

        rows.forEach((row, index) => {
          const lineNo = index + 2;

          const supplierCode = normalizeCode(
            row["supplier code"] || row["suppliercode"]
          );
          const supplierName = String(
            row["supplier name"] || row["suppliername"] || ""
          ).trim();
          const supplierType = String(
            row["supplier type"] || row["suppliertype"] || "Local Supplier"
          ).trim() as SupplierType;
          const status = String(row["status"] || "Active").trim() as SupplierStatus;
          const paymentTerm = String(
            row["payment term"] || row["paymentterm"] || "30 Days"
          ).trim() as PaymentTerm;
          const country = String(row["country"] || "Malaysia").trim();

          if (!supplierCode) {
            errors.push(`Line ${lineNo}: Supplier Code is required.`);
          }

          if (!supplierName) {
            errors.push(`Line ${lineNo}: Supplier Name is required.`);
          }

          if (!supplierTypeOptions.includes(supplierType)) {
            errors.push(`Line ${lineNo}: Invalid Supplier Type.`);
          }

          if (!supplierStatusOptions.includes(status)) {
            errors.push(`Line ${lineNo}: Invalid Status.`);
          }

          if (!paymentTermOptions.includes(paymentTerm)) {
            errors.push(`Line ${lineNo}: Invalid Payment Term.`);
          }

          if (!country) {
            errors.push(`Line ${lineNo}: Country is required.`);
          }

          if (existingCodes.has(supplierCode)) {
            errors.push(`Line ${lineNo}: Duplicate Supplier Code ${supplierCode}.`);
          }

          if (
            !supplierCode ||
            !supplierName ||
            !supplierTypeOptions.includes(supplierType) ||
            !supplierStatusOptions.includes(status) ||
            !paymentTermOptions.includes(paymentTerm) ||
            !country ||
            existingCodes.has(supplierCode)
          ) {
            return;
          }

          existingCodes.add(supplierCode);

          const now = new Date().toISOString();

          imported.push({
            id: generateId(),
            supplierCode,
            supplierName,
            supplierType,
            status,
            registrationNo:
              row["registration no."] ||
              row["registration no"] ||
              row["registrationno"] ||
              "",
            taxNo:
              row["tax no. / sst no."] ||
              row["tax no / sst no"] ||
              row["tax no."] ||
              row["tax no"] ||
              row["sst no"] ||
              "",
            contactPerson:
              row["contact person"] || row["contactperson"] || "",
            phone: row["phone"] || "",
            email: row["email"] || "",
            paymentTerm,
            creditLimit: safeNumber(
              row["credit limit"] || row["creditlimit"] || 0
            ),
            bankName: row["bank name"] || row["bankname"] || "",
            bankAccountNo:
              row["bank account no."] ||
              row["bank account no"] ||
              row["bankaccountno"] ||
              "",
            address: row["address"] || "",
            city: row["city"] || "",
            state: row["state"] || "",
            postcode: row["postcode"] || "",
            country,
            remarks: row["remarks"] || "",
            createdAt: now,
            updatedAt: now,
          });
        });

        if (errors.length) {
          Modal.error({
            title: "CSV Import Validation Failed",
            width: 700,
            content: (
              <div style={{ maxHeight: 320, overflow: "auto" }}>
                {errors.slice(0, 50).map((error) => (
                  <div key={error}>• {error}</div>
                ))}
                {errors.length > 50 && (
                  <Text type="secondary">
                    Showing first 50 errors only. Please fix the CSV and try
                    again.
                  </Text>
                )}
              </div>
            ),
          });

          return;
        }

        setSuppliers((previous) => [...imported, ...previous]);

        messageApi.success(`${imported.length} supplier(s) imported.`);
      } catch (error) {
        console.error("Supplier CSV import failed:", error);
        messageApi.error("Failed to import CSV file.");
      }
    };

    reader.readAsText(file);

    return Upload.LIST_IGNORE;
  };

  const columns: ColumnsType<SupplierRecord> = [
    {
      title: "Supplier Code",
      dataIndex: "supplierCode",
      key: "supplierCode",
      width: 150,
      sorter: (a, b) => a.supplierCode.localeCompare(b.supplierCode),
      fixed: "left",
    },
    {
      title: "Supplier Name",
      dataIndex: "supplierName",
      key: "supplierName",
      width: 240,
      sorter: (a, b) => a.supplierName.localeCompare(b.supplierName),
    },
    {
      title: "Type",
      dataIndex: "supplierType",
      key: "supplierType",
      width: 160,
      render: (value: SupplierType) => (
        <Tag color={value === "Local Supplier" ? "blue" : "purple"}>
          {value}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: SupplierStatus) => {
        const color =
          value === "Active" ? "green" : value === "Inactive" ? "default" : "red";

        return <Tag color={color}>{value}</Tag>;
      },
    },
    {
      title: "Contact Person",
      dataIndex: "contactPerson",
      key: "contactPerson",
      width: 180,
      render: (value) => value || "-",
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
      width: 160,
      render: (value) => value || "-",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      width: 220,
      render: (value) => value || "-",
    },
    {
      title: "Country",
      dataIndex: "country",
      key: "country",
      width: 140,
      render: (value) => value || "-",
    },
    {
      title: "Payment Term",
      dataIndex: "paymentTerm",
      key: "paymentTerm",
      width: 140,
    },
    {
      title: "Credit Limit",
      dataIndex: "creditLimit",
      key: "creditLimit",
      width: 160,
      align: "right",
      sorter: (a, b) => safeNumber(a.creditLimit) - safeNumber(b.creditLimit),
      render: (value) => formatCurrency(value),
    },
    {
      title: "Bank Name",
      dataIndex: "bankName",
      key: "bankName",
      width: 180,
      render: (value) => value || "-",
    },
    {
      title: "Updated At",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 190,
      render: (value) => formatDateTime(value),
    },
    {
      title: "Action",
      key: "action",
      width: 180,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openViewModal(record)}
            />
          </Tooltip>

          <Tooltip title="Edit">
            <Button
              size="small"
              type="primary"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>

          <Popconfirm
            title="Delete supplier?"
            description={`Delete ${record.supplierCode}?`}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{
              danger: true,
            }}
            onConfirm={() => handleDeleteSupplier(record)}
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
    <>
      {contextHolder}

      <div style={{ padding: 24 }}>
        <Space orientation="vertical" size={18} style={{ width: "100%" }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>
              Supplier Master
            </Title>
            <Text type="secondary">
              Standardized supplier data for purchasing, inbound GRN, CSV
              import, receiving traceability, and supplier validation.
            </Text>
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic title="Total Suppliers" value={suppliers.length} />
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Active Suppliers"
                  value={
                    suppliers.filter((supplier) => supplier.status === "Active")
                      .length
                  }
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Local Suppliers"
                  value={
                    suppliers.filter(
                      (supplier) => supplier.supplierType === "Local Supplier"
                    ).length
                  }
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Total Credit Limit"
                  value={totalCreditLimit}
                  precision={2}
                  prefix="RM"
                />
              </Card>
            </Col>
          </Row>

          <Card>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} md={8}>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="Search supplier code, name, bank, contact, phone, email..."
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </Col>

              <Col xs={24} md={4}>
                <Select
                  style={{ width: "100%" }}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { label: "All Status", value: "All" },
                    ...supplierStatusOptions.map((status) => ({
                      label: status,
                      value: status,
                    })),
                  ]}
                />
              </Col>

              <Col xs={24} md={5}>
                <Select
                  style={{ width: "100%" }}
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={[
                    { label: "All Types", value: "All" },
                    ...supplierTypeOptions.map((type) => ({
                      label: type,
                      value: type,
                    })),
                  ]}
                />
              </Col>

              <Col xs={24} md={7}>
                <Space wrap style={{ justifyContent: "flex-end", width: "100%" }}>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      setSearchText("");
                      setStatusFilter("All");
                      setTypeFilter("All");
                    }}
                  >
                    Reset
                  </Button>

                  <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
                    Add Supplier
                  </Button>
                </Space>
              </Col>
            </Row>

            <Divider />

            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExportCSV}
                  disabled={!filteredSuppliers.length}
                >
                  Export CSV
                </Button>
              </Col>

              <Col>
                <Upload
                  accept=".csv"
                  showUploadList={false}
                  beforeUpload={handleImportCSV}
                >
                  <Button icon={<UploadOutlined />}>Import CSV</Button>
                </Upload>
              </Col>

              <Col>
                <Button
                  icon={<CloudDownloadOutlined />}
                  onClick={handleDownloadTemplate}
                >
                  Template
                </Button>
              </Col>

              <Col>
                <Button icon={<FileTextOutlined />} onClick={handleLoadDemoData}>
                  Load Demo
                </Button>
              </Col>

              <Col>
                <Button danger icon={<DeleteOutlined />} onClick={handleClearAll}>
                  Clear All
                </Button>
              </Col>
            </Row>

            <Table
              rowKey="id"
              columns={columns}
              dataSource={filteredSuppliers}
              bordered
              size="middle"
              scroll={{ x: 1900 }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `${total} supplier(s)`,
              }}
            />
          </Card>
        </Space>
      </div>

      <Modal
        title={editingSupplier ? "Edit Supplier" : "Add Supplier"}
        open={modalOpen}
        width={980}
        onCancel={() => {
          setModalOpen(false);
          setEditingSupplier(null);
          form.resetFields();
        }}
        onOk={handleSaveSupplier}
        okText="Save"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{
            supplierType: "Local Supplier",
            status: "Active",
            paymentTerm: "30 Days",
            country: "Malaysia",
            creditLimit: 0,
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Supplier Code"
                name="supplierCode"
                rules={[
                  {
                    required: true,
                    message: "Supplier Code is required.",
                  },
                ]}
              >
                <Input placeholder="Example: SUP-001" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Supplier Name"
                name="supplierName"
                rules={[
                  {
                    required: true,
                    message: "Supplier Name is required.",
                  },
                ]}
              >
                <Input placeholder="Example: ABC Supplier Sdn Bhd" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Supplier Type"
                name="supplierType"
                rules={[
                  {
                    required: true,
                    message: "Supplier Type is required.",
                  },
                ]}
              >
                <Select
                  options={supplierTypeOptions.map((type) => ({
                    label: type,
                    value: type,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Status"
                name="status"
                rules={[
                  {
                    required: true,
                    message: "Status is required.",
                  },
                ]}
              >
                <Select
                  options={supplierStatusOptions.map((status) => ({
                    label: status,
                    value: status,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Registration No." name="registrationNo">
                <Input placeholder="Company registration number" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Tax No. / SST No." name="taxNo">
                <Input placeholder="Optional tax / SST number" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left">Contact Information</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Contact Person" name="contactPerson">
                <Input placeholder="Contact person name" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Phone" name="phone">
                <Input placeholder="Example: +60 12-345 6789" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  {
                    type: "email",
                    message: "Please enter a valid email address.",
                  },
                ]}
              >
                <Input placeholder="supplier@example.com" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Payment Term"
                name="paymentTerm"
                rules={[
                  {
                    required: true,
                    message: "Payment Term is required.",
                  },
                ]}
              >
                <Select
                  options={paymentTermOptions.map((term) => ({
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
                    required: true,
                    message: "Credit Limit is required.",
                  },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  precision={2}
                  addonBefore="RM"
                  placeholder="Example: 50000.00"
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left">Bank Information</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Bank Name" name="bankName">
                <Input placeholder="Example: Maybank / CIMB / Public Bank" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Bank Account No." name="bankAccountNo">
                <Input placeholder="Example: 1234567890" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left">Address</Divider>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="Address" name="address">
                <TextArea rows={2} placeholder="Supplier address" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="City" name="city">
                <Input placeholder="City" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="State" name="state">
                <Input placeholder="State" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Postcode" name="postcode">
                <Input placeholder="Postcode" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Country"
                name="country"
                rules={[
                  {
                    required: true,
                    message: "Country is required.",
                  },
                ]}
              >
                <Select
                  showSearch
                  options={countryOptions.map((country) => ({
                    label: country,
                    value: country,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label="Remarks" name="remarks">
                <TextArea rows={3} placeholder="Optional remarks" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Supplier Details"
        open={viewModalOpen}
        width={820}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setViewModalOpen(false);
              setViewingSupplier(null);
            }}
          >
            Close
          </Button>,
        ]}
        onCancel={() => {
          setViewModalOpen(false);
          setViewingSupplier(null);
        }}
        destroyOnHidden
      >
        {viewingSupplier && (
          <Space orientation="vertical" size={12} style={{ width: "100%" }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text type="secondary">Supplier Code</Text>
                <br />
                <Text strong>{viewingSupplier.supplierCode}</Text>
              </Col>

              <Col span={12}>
                <Text type="secondary">Supplier Name</Text>
                <br />
                <Text strong>{viewingSupplier.supplierName}</Text>
              </Col>

              <Col span={12}>
                <Text type="secondary">Supplier Type</Text>
                <br />
                <Tag
                  color={
                    viewingSupplier.supplierType === "Local Supplier"
                      ? "blue"
                      : "purple"
                  }
                >
                  {viewingSupplier.supplierType}
                </Tag>
              </Col>

              <Col span={12}>
                <Text type="secondary">Status</Text>
                <br />
                <Tag
                  color={
                    viewingSupplier.status === "Active"
                      ? "green"
                      : viewingSupplier.status === "Inactive"
                      ? "default"
                      : "red"
                  }
                >
                  {viewingSupplier.status}
                </Tag>
              </Col>

              <Col span={12}>
                <Text type="secondary">Registration No.</Text>
                <br />
                <Text>{viewingSupplier.registrationNo || "-"}</Text>
              </Col>

              <Col span={12}>
                <Text type="secondary">Tax No. / SST No.</Text>
                <br />
                <Text>{viewingSupplier.taxNo || "-"}</Text>
              </Col>

              <Col span={12}>
                <Text type="secondary">Contact Person</Text>
                <br />
                <Text>{viewingSupplier.contactPerson || "-"}</Text>
              </Col>

              <Col span={12}>
                <Text type="secondary">Phone</Text>
                <br />
                <Text>{viewingSupplier.phone || "-"}</Text>
              </Col>

              <Col span={12}>
                <Text type="secondary">Email</Text>
                <br />
                <Text>{viewingSupplier.email || "-"}</Text>
              </Col>

              <Col span={12}>
                <Text type="secondary">Payment Term</Text>
                <br />
                <Text>{viewingSupplier.paymentTerm}</Text>
              </Col>

              <Col span={12}>
                <Text type="secondary">Credit Limit</Text>
                <br />
                <Text strong>{formatCurrency(viewingSupplier.creditLimit)}</Text>
              </Col>

              <Col span={12}>
                <Text type="secondary">Bank Name</Text>
                <br />
                <Text>{viewingSupplier.bankName || "-"}</Text>
              </Col>

              <Col span={12}>
                <Text type="secondary">Bank Account No.</Text>
                <br />
                <Text>{viewingSupplier.bankAccountNo || "-"}</Text>
              </Col>

              <Col span={12}>
                <Text type="secondary">Country</Text>
                <br />
                <Text>{viewingSupplier.country || "-"}</Text>
              </Col>

              <Col span={24}>
                <Text type="secondary">Address</Text>
                <br />
                <Text>
                  {[
                    viewingSupplier.address,
                    viewingSupplier.city,
                    viewingSupplier.state,
                    viewingSupplier.postcode,
                    viewingSupplier.country,
                  ]
                    .filter(Boolean)
                    .join(", ") || "-"}
                </Text>
              </Col>

              <Col span={24}>
                <Text type="secondary">Remarks</Text>
                <br />
                <Text>{viewingSupplier.remarks || "-"}</Text>
              </Col>

              <Col span={12}>
                <Text type="secondary">Created At</Text>
                <br />
                <Text>{formatDateTime(viewingSupplier.createdAt)}</Text>
              </Col>

              <Col span={12}>
                <Text type="secondary">Updated At</Text>
                <br />
                <Text>{formatDateTime(viewingSupplier.updatedAt)}</Text>
              </Col>
            </Row>
          </Space>
        )}
      </Modal>
    </>
  );
}