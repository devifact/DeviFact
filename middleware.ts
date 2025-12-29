import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const MAINTENANCE_PATH = '/maintenance';
// deno-lint-ignore no-process-global
const maintenanceEnabled = process.env.MAINTENANCE_MODE === 'true';

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

export function middleware(request: NextRequest) {
  if (!maintenanceEnabled) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (pathname === MAINTENANCE_PATH || isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new NextResponse('Site en maintenance', { status: 503 });
  }

  const url = request.nextUrl.clone();
  url.pathname = MAINTENANCE_PATH;
  return NextResponse.rewrite(url);
}
