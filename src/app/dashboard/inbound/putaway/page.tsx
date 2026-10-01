'use client';

import { useState } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Button,
  Row,
  Col,
  Typography,
  message,
  Divider,
} from 'antd';
import { ScanOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import QrScannerModal from './QrScannerModal';

const { Title, Text } = Typography;

export default function PutAwayPage() {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleScanSuccess = (decodedText: string) => {
    try {
      const data = JSON.parse(decodedText);

      form.setFieldsValue({
        skuCode: data.skuCode ?? '',
        productName: data.productName ?? '',
        batchNumber: data.batchNumber ?? '',
        expiryDate: data.expiryDate ? dayjs(data.expiryDate) : undefined,
        quantity: data.quantity ?? undefined,
        plant: data.plant ?? '',
        fromLocation: data.fromLocation ?? '',
      });

      messageApi.success('✅ QR code scanned — form auto-filled!');
    } catch (err) {
      console.error('Invalid QR data:', err);
      messageApi.error('❌ Invalid QR code format. Expected JSON data.');
    }
  };

  const handleSave = (values: any) => {
    console.log('Put-away values:', values);
    messageApi.success('Put-away saved successfully!');
    form.resetFields();
  };

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}

      <Title level={3}>📥 Put-Away Scan</Title>
      <Text type="secondary">
        Scan a QR label to auto-fill the form below, then confirm the put-away location.
      </Text>

      <Divider />

      <Row gutter={24}>
        {/* LEFT: Scanner Button/Area */}
        <Col xs={24} md={8}>
          <Card title="📷 Scan QR Code">
            <Button
              type="primary"
              icon={<ScanOutlined />}
              size="large"
              block
              onClick={() => setScannerOpen(true)}
            >
              Open Scanner
            </Button>
            <div style={{ marginTop: 16, color: '#888', fontSize: 13 }}>
              Click above to activate your camera and scan a label.
            </div>
          </Card>
        </Col>

        {/* RIGHT: Auto-filled Form */}
        <Col xs={24} md={16}>
          <Card title="📝 Put-Away Details">
            <Form form={form} layout="vertical" onFinish={handleSave}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="SKU Code"
                    name="skuCode"
                    rules={[{ required: true, message: 'SKU is required' }]}
                  >
                    <Input placeholder="Will auto-fill from scan" readOnly />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Product Name"
                    name="productName"
                    rules={[{ required: true, message: 'Product name is required' }]}
                  >
                    <Input placeholder="Will auto-fill from scan" readOnly />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Batch Number"
                    name="batchNumber"
                    rules={[{ required: true, message: 'Batch number is required' }]}
                  >
                    <Input placeholder="e.g. BATCH-20250115" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Expiry Date"
                    name="expiryDate"
                    rules={[{ required: true, message: 'Expiry date is required' }]}
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Quantity"
                    name="quantity"
                    rules={[{ required: true, message: 'Quantity is required' }]}
                  >
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Plant / Warehouse"
                    name="plant"
                    rules={[{ required: true, message: 'Plant is required' }]}
                  >
                    <Input placeholder="e.g. Plant A" readOnly />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="From Location (Receiving)" name="fromLocation">
                    <Input placeholder="e.g. DOCK-01" readOnly />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="To Location (Put-Away)"
                    name="toLocation"
                    rules={[{ required: true, message: 'Destination bin is required' }]}
                  >
                    <Input placeholder="e.g. A1-R2-B3" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginTop: 16 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  size="large"
                  block
                >
                  Confirm Put-Away
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>

      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}