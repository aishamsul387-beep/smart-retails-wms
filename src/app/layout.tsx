import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import 'antd/dist/reset.css';

import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: 'WMS Admin',
  description: 'Warehouse Management System Admin',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}