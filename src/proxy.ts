import { NextRequest, NextResponse } from 'next/server';

/**
 * Current authentication is stored in localStorage.
 *
 * Next.js middleware runs on the server/Edge runtime and cannot read
 * localStorage. Authentication protection is therefore handled by:
 *
 * - src/contexts/AuthContext.tsx
 * - src/app/dashboard/layout.tsx
 * - PermissionGuard components
 *
 * Do not import src/lib/auth.ts into this file while auth remains
 * localStorage-based.
 */
export function proxy(request: NextRequest) {
  return NextResponse.next();
}

/**
 * Run middleware only for application pages.
 *
 * Next.js internal assets, API routes and public files are excluded.
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};