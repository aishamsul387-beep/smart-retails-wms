'use client';

import { useRef } from 'react';
import { Modal, Typography } from 'antd';
import { Html5Qrcode } from 'html5-qrcode';

const { Text } = Typography;

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

const QR_REGION_ID = 'qr-scanner-region';

export default function QrScannerModal({
  open,
  onClose,
  onScanSuccess,
}: QrScannerModalProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);

  const startScanner = async () => {
    try {
      const scanner = new Html5Qrcode(QR_REGION_ID);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          onScanSuccess(decodedText);
          stopScanner();
          onClose();
        },
        () => {
          // ignore per-frame "no QR found" errors — this fires constantly
        }
      );
      isRunningRef.current = true;
    } catch (err) {
      console.error('Failed to start scanner:', err);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isRunningRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      isRunningRef.current = false;
    }
  };

  const handleCancel = async () => {
    await stopScanner();
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      title="📷 Scan QR Code"
      destroyOnHidden
      afterOpenChange={(visible) => {
        if (visible) {
          startScanner();
        } else {
          stopScanner();
        }
      }}
    >
      <div id={QR_REGION_ID} style={{ width: '100%' }} />
      <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
        Point your camera at the QR label. Scanning happens automatically.
      </Text>
    </Modal>
  );
}