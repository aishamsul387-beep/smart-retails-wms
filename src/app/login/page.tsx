'use client';

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Space,
  Spin,
  Typography,
} from 'antd';
import {
  LockOutlined,
  LoginOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const { Paragraph, Text, Title } = Typography;

interface LoginFormValues {
  userId: string;
  password: string;
  rememberMe?: boolean;
}

interface LoginResult {
  success?: boolean;
  message?: string;
  error?: string;
  requiresPasswordChange?: boolean;
}

interface LoginAuthContext {
  user?: unknown;
  currentUser?: unknown;
  loading?: boolean;
  isLoading?: boolean;
  initialized?: boolean;
  isAuthenticated?: boolean;
  login: (
    userId: string,
    password: string,
    rememberMe?: boolean,
  ) =>
    | boolean
    | LoginResult
    | void
    | Promise<boolean | LoginResult | void>;
}

/**
 * Only permits internal application return URLs.
 * This prevents external/open redirects after login.
 */
function getSafeReturnUrl(requestedReturnUrl: string | null): string {
  if (
    !requestedReturnUrl ||
    !requestedReturnUrl.startsWith('/') ||
    requestedReturnUrl.startsWith('//') ||
    requestedReturnUrl.startsWith('/login')
  ) {
    return '/dashboard';
  }
  return requestedReturnUrl;
}

/**
 * Normalizes the different possible results returned by AuthContext.login().
 */
function normalizeLoginResult(
  result: boolean | LoginResult | void,
): LoginResult {
  if (result === true) {
    return {
      success: true,
    };
  }
  if (result === false) {
    return {
      success: false,
      message: 'Invalid User ID or password.',
    };
  }
  if (result && typeof result === 'object') {
    return {
      ...result,
      success: result.success !== false,
    };
  }
  /*
   * Some AuthContext implementations return void after updating
   * the authenticated user state. If no exception was thrown,
   * consider the login operation successfully submitted.
   */
  return {
    success: true,
  };
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form] = Form.useForm<LoginFormValues>();

  /*
   * This compatibility interface allows the page to work with
   * AuthContext implementations using either:
   *
   * - user / loading
   * - currentUser / isLoading
   * - initialized / isAuthenticated
   */
  const auth = useAuth() as unknown as LoginAuthContext;
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [informationMessage, setInformationMessage] = useState('');

  const currentUser = auth.currentUser ?? auth.user ?? null;
  const authLoading =
    auth.loading ?? auth.isLoading ?? auth.initialized === false;
  const isAuthenticated = auth.isAuthenticated ?? Boolean(currentUser);

  const returnUrl = useMemo(
    () => getSafeReturnUrl(searchParams.get('returnUrl')),
    [searchParams],
  );

  /**
   * Redirect a user who already has an authenticated session.
   */
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(returnUrl);
    }
  }, [authLoading, isAuthenticated, returnUrl, router]);

  /**
   * Processes the Ant Design form values.
   */
  const handleLogin = async (values: LoginFormValues): Promise<void> => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    setInformationMessage('');

    try {
      if (typeof auth.login !== 'function') {
        throw new Error('Authentication service is not available.');
      }

      const userId = values.userId?.trim();
      const password = values.password ?? '';
      const rememberMe = Boolean(values.rememberMe);

      if (!userId || !password) {
        setErrorMessage('User ID and password are required.');
        return;
      }

      const rawResult = await auth.login(userId, password, rememberMe);
      const result = normalizeLoginResult(rawResult);

      if (!result.success) {
        setErrorMessage(
          result.message ||
            result.error ||
            'Unable to sign in. Check your credentials.',
        );
        return;
      }

      if (result.requiresPasswordChange) {
        setInformationMessage(
          'Login successful. You must change your password.',
        );
        router.replace(
          `/change-password?returnUrl=${encodeURIComponent(returnUrl)}`,
        );
        return;
      }

      router.replace(returnUrl);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'An unexpected login error occurred.';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Wait until authentication initialization has completed.
   * Also display this screen while an authenticated user is
   * being redirected away from the login page.
   */
  if (authLoading || isAuthenticated) {
    return (
      <main style={styles.loadingContainer}>
        <Spin
          size="large"
          tip={
            isAuthenticated
              ? 'Opening dashboard...'
              : 'Loading authentication...'
          }
        >
          <div style={styles.loadingContent} />
        </Spin>
      </main>
    );
  }

  return (
    <main style={styles.page} className="wms-login-page">
      <div style={styles.backgroundShapeOne} />
      <div style={styles.backgroundShapeTwo} />
      <section style={styles.container}>
        <Card
          variant="borderless"
          style={styles.card}
          styles={{
            body: {
              padding: 0,
            },
          }}
        >
          <div style={styles.grid} className="wms-login-grid">
            <aside style={styles.brandPanel} className="wms-brand-panel">
              <Space
                direction="vertical"
                size={20}
                style={{
                  width: '100%',
                }}
              >
                <div style={styles.logo}>
                  <SafetyCertificateOutlined />
                </div>
                <div>
                  <Title level={1} style={styles.brandTitle}>
                    WMS Portal
                  </Title>
                  <Paragraph style={styles.brandDescription}>
                    Secure warehouse management, inventory visibility,
                    transaction controls, and AI-assisted operational
                    review.
                  </Paragraph>
                </div>
                <div style={styles.securityBox}>
                  <SafetyCertificateOutlined />
                  <Text style={styles.securityText}>
                    Access is controlled by role, plant, location, and
                    assigned permissions.
                  </Text>
                </div>
              </Space>
            </aside>

            <section style={styles.formPanel} className="wms-form-panel">
              <div style={styles.formHeader}>
                <Title
                  level={2}
                  style={{
                    marginBottom: 8,
                  }}
                >
                  Sign in
                </Title>
                <Text type="secondary">
                  Enter your assigned User ID and password.
                </Text>
              </div>

              {errorMessage && (
                <Alert
                  showIcon
                  closable
                  type="error"
                  message="Login failed"
                  description={errorMessage}
                  style={styles.alert}
                  onClose={() => setErrorMessage('')}
                />
              )}

              {informationMessage && (
                <Alert
                  showIcon
                  type="info"
                  message="Authentication information"
                  description={informationMessage}
                  style={styles.alert}
                />
              )}

              <Form<LoginFormValues>
                form={form}
                layout="vertical"
                requiredMark={false}
                autoComplete="on"
                initialValues={{
                  rememberMe: true,
                }}
                onFinish={handleLogin}
              >
                <Form.Item
                  label="User ID"
                  name="userId"
                  normalize={(value: unknown) =>
                    typeof value === 'string' ? value.trimStart() : value
                  }
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: 'Enter your User ID.',
                    },
                    {
                      max: 100,
                      message: 'User ID cannot exceed 100 characters.',
                    },
                  ]}
                >
                  <Input
                    size="large"
                    prefix={<UserOutlined />}
                    placeholder="Enter User ID"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={submitting}
                  />
                </Form.Item>

                <Form.Item
                  label="Password"
                  name="password"
                  rules={[
                    {
                      required: true,
                      message: 'Enter your password.',
                    },
                  ]}
                >
                  <Input.Password
                    size="large"
                    prefix={<LockOutlined />}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    disabled={submitting}
                    onPressEnter={() => {
                      if (!submitting) {
                        form.submit();
                      }
                    }}
                  />
                </Form.Item>

                <Form.Item
                  name="rememberMe"
                  valuePropName="checked"
                  style={{
                    marginBottom: 20,
                  }}
                >
                  <Checkbox disabled={submitting}>
                    Keep me signed in on this device
                  </Checkbox>
                </Form.Item>

                <Button
                  block
                  size="large"
                  type="primary"
                  htmlType="submit"
                  icon={<LoginOutlined />}
                  loading={submitting}
                  disabled={submitting}
                >
                  Sign in
                </Button>
              </Form>

              <Alert
                showIcon
                type="warning"
                style={styles.demoAlert}
                message="Development account"
                description={
                  <Space direction="vertical" size={2}>
                    <Text>
                      User ID: <Text code>admin</Text>
                    </Text>
                    <Text>
                      Password: <Text code>Admin@123</Text>
                    </Text>
                    <Text type="secondary">
                      Replace this local authentication method before
                      production deployment.
                    </Text>
                  </Space>
                }
              />

              <Paragraph style={styles.footerText}>
                Login attempts and security activity are recorded in the
                WMS security audit log.
              </Paragraph>
            </section>
          </div>
        </Card>
      </section>

      <style jsx global>{`
        .wms-login-page {
          overflow-x: hidden;
          overflow-y: auto;
        }

        .wms-login-grid {
          display: grid;
          grid-template-columns: minmax(280px, 0.9fr) minmax(340px, 1.1fr);
          min-height: 600px;
        }

        @media (max-width: 768px) {
          .wms-login-grid {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
          }

          .wms-brand-panel {
            padding: 32px 24px !important;
          }

          .wms-form-panel {
            padding: 32px 24px !important;
          }
        }

        @media (max-width: 480px) {
          .wms-brand-panel {
            padding: 24px 20px !important;
          }

          .wms-form-panel {
            padding: 24px 20px !important;
          }
        }
      `}</style>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main style={styles.loadingContainer}>
          <Spin size="large" tip="Loading login page...">
            <div style={styles.loadingContent} />
          </Spin>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    alignItems: 'center',
    background:
      'linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 45%, #f6ffed 100%)',
    display: 'flex',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: 24,
    position: 'relative',
  },

  container: {
    maxWidth: 980,
    position: 'relative',
    width: '100%',
    zIndex: 2,
  },

  card: {
    borderRadius: 20,
    boxShadow: '0 24px 70px rgba(0, 21, 41, 0.16)',
    overflow: 'hidden',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(340px, 1.1fr)',
    minHeight: 600,
  },

  brandPanel: {
    background: 'linear-gradient(145deg, #001529 0%, #003a8c 100%)',
    color: '#ffffff',
    display: 'flex',
    padding: '64px 48px',
  },

  logo: {
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.14)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 18,
    display: 'flex',
    fontSize: 34,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },

  brandTitle: {
    color: '#ffffff',
    fontSize: 40,
    marginBottom: 12,
  },

  brandDescription: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 16,
    lineHeight: 1.75,
    marginBottom: 0,
  },

  securityBox: {
    alignItems: 'flex-start',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.16)',
    borderRadius: 12,
    display: 'flex',
    gap: 12,
    marginTop: 24,
    padding: 16,
  },

  securityText: {
    color: 'rgba(255, 255, 255, 0.82)',
    lineHeight: 1.6,
  },

  formPanel: {
    background: '#ffffff',
    padding: '56px 52px',
  },

  formHeader: {
    marginBottom: 28,
  },

  alert: {
    marginBottom: 20,
  },

  demoAlert: {
    marginTop: 24,
  },

  footerText: {
    color: '#8c8c8c',
    fontSize: 12,
    marginBottom: 0,
    marginTop: 20,
    textAlign: 'center',
  },

  loadingContainer: {
    alignItems: 'center',
    background: '#f5f5f5',
    display: 'flex',
    justifyContent: 'center',
    minHeight: '100vh',
  },

  loadingContent: {
    height: 100,
    width: 220,
  },

  backgroundShapeOne: {
    background: 'rgba(22, 119, 255, 0.12)',
    borderRadius: '50%',
    height: 420,
    left: -140,
    position: 'absolute',
    top: -140,
    width: 420,
  },

  backgroundShapeTwo: {
    background: 'rgba(82, 196, 26, 0.1)',
    borderRadius: '50%',
    bottom: -180,
    height: 480,
    position: 'absolute',
    right: -160,
    width: 480,
  },
};