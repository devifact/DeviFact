import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const MAINTENANCE_PATH = '/maintenance';
// deno-lint-ignore no-process-global
const maintenanceEnabled = process.env.MAINTENANCE_MODE === 'true';
// deno-lint-ignore no-process-global
const maintenanceBypassToken = process.env.MAINTENANCE_BYPASS_TOKEN ?? '';

const bypassCookieName = 'maintenance_bypass';

const staticPaths = new Set([
  '/favicon.ico',
  '/favicon.svg',
  '/icon.svg',
  '/robots.txt',
  '/sitemap.xml',
]);

function isStaticAsset(pathname: string) {
  if (pathname.startsWith('/_next/')) {
    return true;
  }
  if (pathname.startsWith('/assets/')) {
    return true;
  }
  return staticPaths.has(pathname);
}

function hasMaintenanceBypass(request: NextRequest) {
  if (!maintenanceBypassToken) {
    return false;
  }
  const cookieValue = request.cookies.get(bypassCookieName)?.value;
  const headerValue = request.headers.get('x-maintenance-bypass');
  return cookieValue === maintenanceBypassToken || headerValue === maintenanceBypassToken;
}

export function middleware(request: NextRequest) {
  if (!maintenanceEnabled) {
    return NextResponse.next();
  }

  const { pathname, searchParams } = request.nextUrl;

  if (maintenanceBypassToken && searchParams.get('maintenance_token') === maintenanceBypassToken) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.searchParams.delete('maintenance_token');
    if (redirectUrl.pathname === MAINTENANCE_PATH) {
      redirectUrl.pathname = '/';
    }
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(bypassCookieName, maintenanceBypassToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return response;
  }

  if (hasMaintenanceBypass(request) || pathname === MAINTENANCE_PATH || isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new NextResponse('Site en maintenance', { status: 503 });
  }

  const url = request.nextUrl.clone();
  url.pathname = MAINTENANCE_PATH;
  return NextResponse.rewrite(url);
}
