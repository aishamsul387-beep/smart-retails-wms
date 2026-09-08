'use client';

import React, { useState } from 'react';
import {
  Modal,
  Upload,
  Button,
  Table,
  Alert,
  Steps,
  Space,
  Tag,
  Typography,
  Divider,
  Result,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import {
  UploadOutlined,
  FileExcelOutlined,
  FileDoneOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const { Dragger } = Upload;
const { Text } = Typography;

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: Record<string, string>[]) => void;
  requiredHeaders: string[];
  templateHeaders?: string[];
  templateFilename: string;
  moduleName: string;
}

interface RowResult {
  row: number;
  status: 'success' | 'error';
  message: string;
  data: Record<string, string>;
}

function escapeCSV(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCSVTemplate(headers: string[], filename: string) {
  const csv = `${headers.map(escapeCSV).join(',')}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function downloadExcelTemplate(headers: string[], filename: string) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

  XLSX.writeFile(
    workbook,
    filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  );
}

function cleanHeader(header: string) {
  return String(header || '')
    .replace(/^\uFEFF/, '')
    .trim();
}

function normalizeRow(row: Record<string, unknown>) {
  const normalized: Record<string, string> = {};

  Object.keys(row || {}).forEach((key) => {
    const cleanKey = cleanHeader(key);

    if (!cleanKey) return;

    normalized[cleanKey] =
      row[key] === null || row[key] === undefined ? '' : String(row[key]).trim();
  });

  return normalized;
}

function isBlankRow(row: Record<string, string>) {
  return Object.values(row).every((value) => String(value || '').trim() === '');
}

function getFileExtension(filename: string) {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export default function ImportModal({
  open,
  onClose,
  onImport,
  requiredHeaders,
  templateHeaders,
  templateFilename,
  moduleName,
}: ImportModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [validationResults, setValidationResults] = useState<RowResult[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);

  const allTemplateHeaders =
    templateHeaders && templateHeaders.length > 0 ? templateHeaders : requiredHeaders;

  const resetAll = () => {
    setCurrentStep(0);
    setParsedData([]);
    setValidationResults([]);
    setFileName('');
    setImporting(false);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const processData = (rawData: Record<string, unknown>[]) => {
    const data = rawData.map(normalizeRow).filter((row) => !isBlankRow(row));

    /**
     * Important:
     * Header-only CSV / Excel should not show validation errors.
     * It should become 0 rows imported.
     */
    if (data.length === 0) {
      setParsedData([]);
      setValidationResults([]);
      setCurrentStep(1);
      return;
    }

    const results: RowResult[] = data.map((row, index) => {
      const missingFields = requiredHeaders.filter(
        (header) => !row[header] || row[header].trim() === ''
      );

      if (missingFields.length > 0) {
        return {
          row: index + 2,
          status: 'error',
          message: `Missing: ${missingFields.join(', ')}`,
          data: row,
        };
      }

      return {
        row: index + 2,
        status: 'success',
        message: 'Valid',
        data: row,
      };
    });

    setParsedData(data);
    setValidationResults(results);
    setCurrentStep(1);
  };

  const handleFile: UploadProps['beforeUpload'] = (file) => {
    setFileName(file.name);

    const ext = getFileExtension(file.name);

    if (ext === 'csv') {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          if (result.errors && result.errors.length > 0) {
            console.warn('CSV parse warnings:', result.errors);
          }

          processData(result.data || []);
        },
        error: (error) => {
          console.error('CSV read error:', error);
          message.error('Failed to read CSV file.');
        },
      });

      return false;
    }

    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const result = event.target?.result;

          if (!result) {
            message.error('Failed to read Excel file.');
            return;
          }

          const data = new Uint8Array(result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];

          if (!sheetName) {
            message.error('No worksheet found in this Excel file.');
            return;
          }

          const sheet = workbook.Sheets[sheetName];

          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: '',
          });

          processData(json);
        } catch (error) {
          console.error('Excel read error:', error);
          message.error('Failed to read Excel file.');
        }
      };

      reader.onerror = () => {
        message.error('Failed to read Excel file.');
      };

      reader.readAsArrayBuffer(file);

      return false;
    }

    message.error('Only CSV and Excel files are supported.');
    return false;
  };

  const handleConfirmImport = () => {
    const validRows = validationResults
      .filter((result) => result.status === 'success')
      .map((result) => result.data);

    if (validRows.length === 0) {
      message.warning('No valid rows to import.');
      return;
    }

    setImporting(true);

    setTimeout(() => {
      try {
        onImport(validRows);
        setCurrentStep(2);
      } catch (error) {
        console.error('Import error:', error);
        message.error('Failed to import data.');
      } finally {
        setImporting(false);
      }
    }, 400);
  };

  const successCount = validationResults.filter(
    (result) => result.status === 'success'
  ).length;

  const errorCount = validationResults.filter(
    (result) => result.status === 'error'
  ).length;

  const validationColumns: ColumnsType<RowResult> = [
    {
      title: 'Row #',
      dataIndex: 'row',
      key: 'row',
      width: 80,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: RowResult['status']) =>
        status === 'success' ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Valid
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            Error
          </Tag>
        ),
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      width: 220,
    },
    ...allTemplateHeaders.slice(0, 6).map((header) => ({
      title: header,
      key: header,
      render: (_: unknown, record: RowResult) => record.data[header] || '-',
    })),
  ];

  return (
    <Modal
      title={
        <Space>
          <FileExcelOutlined style={{ color: '#52c41a' }} />
          <span>Import {moduleName} Data</span>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={950}
      footer={null}
      destroyOnHidden
    >
      <Steps
        current={currentStep}
        style={{ marginBottom: 24 }}
        items={[
          { title: 'Upload File', icon: <UploadOutlined /> },
          { title: 'Validate', icon: <FileDoneOutlined /> },
          { title: 'Done', icon: <CheckCircleOutlined /> },
        ]}
      />

      {currentStep === 0 && (
        <div>
          <Alert
            message="Download the template first, fill in your data, then upload it."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            action={
              <Space wrap>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() =>
                    downloadCSVTemplate(allTemplateHeaders, templateFilename)
                  }
                >
                  CSV Template
                </Button>

                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() =>
                    downloadExcelTemplate(allTemplateHeaders, templateFilename)
                  }
                >
                  Excel Template
                </Button>
              </Space>
            }
          />

          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">Required fields:</Text>

            <div style={{ marginTop: 8, marginBottom: 16 }}>
              {requiredHeaders.map((header) => (
                <Tag key={header} color="blue" style={{ marginBottom: 6 }}>
                  {header}
                </Tag>
              ))}
            </div>

            <Dragger
              accept=".csv,.xlsx,.xls"
              beforeUpload={handleFile}
              showUploadList={false}
              style={{ padding: '20px 0' }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              </p>

              <p className="ant-upload-text">
                Click or drag file to this area to upload
              </p>

              <p className="ant-upload-hint">Supports CSV and Excel files only</p>
            </Dragger>
          </div>
        </div>
      )}

      {currentStep === 1 && (
        <div>
          <Space style={{ marginBottom: 16 }} wrap>
            <Text>
              📄 File: <strong>{fileName || '-'}</strong>
            </Text>

            <Text>
              📊 Total Rows: <strong>{parsedData.length}</strong>
            </Text>

            <Tag color="success">✅ Valid: {successCount}</Tag>
            <Tag color="error">❌ Errors: {errorCount}</Tag>
          </Space>

          {parsedData.length === 0 && (
            <Alert
              message="No data rows found."
              description="This file only contains headers or blank rows. Nothing will be imported."
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}

          {errorCount > 0 && (
            <Alert
              message={`${errorCount} row(s) have errors and will be skipped.`}
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}

          <Table
            dataSource={validationResults}
            columns={validationColumns}
            rowKey="row"
            size="small"
            scroll={{ x: 900, y: 280 }}
            pagination={false}
          />

          <Divider />

          <Space wrap>
            <Button onClick={() => setCurrentStep(0)}>← Back</Button>

            <Button
              type="primary"
              loading={importing}
              disabled={successCount === 0}
              onClick={handleConfirmImport}
              icon={<CheckCircleOutlined />}
            >
              Import {successCount} Valid Row(s)
            </Button>
          </Space>
        </div>
      )}

      {currentStep === 2 && (
        <Result
          status="success"
          title={`Successfully Imported ${successCount} Row(s)!`}
          subTitle={
            errorCount > 0
              ? `${errorCount} row(s) were skipped due to errors.`
              : 'All rows imported successfully.'
          }
          extra={[
            <Button type="primary" key="done" onClick={handleClose}>
              Done
            </Button>,
            <Button key="again" onClick={resetAll}>
              Import More
            </Button>,
          ]}
        />
      )}
    </Modal>
  );
}