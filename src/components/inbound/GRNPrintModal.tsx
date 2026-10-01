'use client';

import React from 'react';
import { Modal, Button, Row, Col, Divider, Typography } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';

const { Title, Text } = Typography;

export interface GRNPrintItem {
  productCode: string;
  productName?: string;
  batchNo?: string;
  plant?: string;
  location?: string;
  expiryDate?: string;
  uom?: string;
  qty: number;
}

export interface GRNPrintData {
  receiptNo: string;
  supplierName?: string;
  poNo?: string;
  receiptDate?: string;
  status?: string;
  remarks?: string;
  items: GRNPrintItem[];
}

interface GRNPrintModalProps {
  open: boolean;
  onClose: () => void;
  receipt: GRNPrintData | null;
}

export default function GRNPrintModal({
  open,
  onClose,
  receipt,
}: GRNPrintModalProps) {
  if (!receipt) return null;

  const totalQty = receipt.items.reduce(
    (sum, item) => sum + Number(item.qty || 0),
    0,
  );

  // QR contains key GRN info — change this if you want a different format
  const qrValue = JSON.stringify({
    grn: receipt.receiptNo,
    po: receipt.poNo || '',
    supplier: receipt.supplierName || '',
    date: receipt.receiptDate || '',
    totalQty,
  });

  function handlePrint() {
    window.print();
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={800}
      title="🖨️ Print GRN"
      footer={[
        <Button key="close" className="no-print" onClick={onClose}>
          Close
        </Button>,
        <Button
          key="print"
          type="primary"
          className="no-print"
          icon={<PrinterOutlined />}
          onClick={handlePrint}
        >
          Print
        </Button>,
      ]}
    >
      {/* ===== PRINTABLE AREA START ===== */}
      <div className="grn-print-area" style={{ padding: 16 }}>
        <Row justify="space-between" align="top">
          <Col>
            <Title level={4} style={{ marginBottom: 0 }}>
              GOODS RECEIVED NOTE (GRN)
            </Title>
            <Text type="secondary">Warehouse Management System</Text>
          </Col>
          <Col>
            <QRCodeSVG value={qrValue} size={90} />
          </Col>
        </Row>

        <Divider style={{ margin: '12px 0' }} />

        <Row gutter={[8, 4]}>
          <Col span={12}>
            <Text strong>GRN No: </Text>
            <Text>{receipt.receiptNo}</Text>
          </Col>
          <Col span={12}>
            <Text strong>Status: </Text>
            <Text>{receipt.status || '-'}</Text>
          </Col>
          <Col span={12}>
            <Text strong>Supplier: </Text>
            <Text>{receipt.supplierName || '-'}</Text>
          </Col>
          <Col span={12}>
            <Text strong>PO No: </Text>
            <Text>{receipt.poNo || '-'}</Text>
          </Col>
          <Col span={12}>
            <Text strong>Receipt Date: </Text>
            <Text>{receipt.receiptDate || '-'}</Text>
          </Col>
          <Col span={12}>
            <Text strong>Total Qty: </Text>
            <Text>{totalQty.toLocaleString()}</Text>
          </Col>
        </Row>

        <Divider style={{ margin: '12px 0' }} />

        <table
          width="100%"
          cellPadding={6}
          style={{ borderCollapse: 'collapse', fontSize: 13 }}
          border={1}
        >
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th>#</th>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Batch No</th>
              <th>Plant</th>
              <th>Location</th>
              <th>Expiry</th>
              <th>UOM</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((item, index) => (
              <tr key={`${item.productCode}-${index}`}>
                <td>{index + 1}</td>
                <td>{item.productCode}</td>
                <td>{item.productName || '-'}</td>
                <td>{item.batchNo || '-'}</td>
                <td>{item.plant || '-'}</td>
                <td>{item.location || '-'}</td>
                <td>{item.expiryDate || '-'}</td>
                <td>{item.uom || '-'}</td>
                <td style={{ textAlign: 'right' }}>
                  {Number(item.qty || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {receipt.remarks && (
          <div style={{ marginTop: 12 }}>
            <Text strong>Remarks: </Text>
            <Text>{receipt.remarks}</Text>
          </div>
        )}

        <Row style={{ marginTop: 48 }} gutter={16}>
          <Col span={12}>
            <div style={{ borderTop: '1px solid #000', paddingTop: 4 }}>
              Received By / Signature
            </div>
          </Col>
          <Col span={12}>
            <div style={{ borderTop: '1px solid #000', paddingTop: 4 }}>
              Checked By / Signature
            </div>
          </Col>
        </Row>
      </div>
      {/* ===== PRINTABLE AREA END ===== */}
    </Modal>
  );
}