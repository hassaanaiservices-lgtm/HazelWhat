import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import Module from 'module';

// Intercept require calls to mock whatsapp-rust-bridge and avoid the Node.js ESM exports resolution error
const originalRequire = Module.prototype.require;
Module.prototype.require = function (this: any, id: string) {
  if (id === 'whatsapp-rust-bridge') {
    return {
      WhatsAppBridge: class MockBridge {
        init() {}
      },
      LTHashAntiTampering: class MockAntiTampering {}
    };
  }
  return originalRequire.apply(this, arguments as any);
};

// Mock minimal environment variables needed for import/run
process.env.SESSION_SECRET = "test-session-secret-for-build-verification-123456";

class MockRequest {
  url: string;
  nextUrl: URL;
  method: string;
  cookies: {
    get: (name: string) => any;
    getAll: () => any[];
  };
  headers: Headers;

  constructor(url: string, method: string = 'GET') {
    this.url = url;
    this.nextUrl = new URL(url);
    this.method = method;
    this.cookies = {
      get: () => undefined,
      getAll: () => []
    };
    this.headers = new Headers();
  }

  async json() {
    return {};
  }
}

// Map mock request to NextRequest type safely
function createMockRequest(url: string, method: string = 'GET'): NextRequest {
  return new MockRequest(url, method) as unknown as NextRequest;
}

// Function to find all route.ts files
function findRoutes(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findRoutes(filePath, fileList);
    } else if (file === 'route.ts' || file === 'route.js') {
      fileList.push(filePath);
    }
  }
  return fileList;
}

async function verifyProxyRedirection() {
  console.log("Checking proxy/middleware redirection rules...");
  
  // Dynamically import proxy
  const proxyModule = await import('../src/proxy');
  const proxyFn = proxyModule.proxy;

  if (typeof proxyFn !== 'function') {
    throw new Error("proxy.ts does not export a function named 'proxy'");
  }

  // Test admin redirection
  const reqAdmin = createMockRequest('https://hazelwhat.com/admin');
  const resAdmin = await proxyFn(reqAdmin);
  const locationAdmin = resAdmin?.headers?.get('location');

  if (!locationAdmin || !locationAdmin.includes('/login?portal=admin')) {
    throw new Error(`Proxy failed to redirect unauthenticated request to /admin. Received redirect: ${locationAdmin}`);
  }
  console.log("-> Proxy /admin redirect check passed.");

  // Test client redirection
  const reqClient = createMockRequest('https://hazelwhat.com/client');
  const resClient = await proxyFn(reqClient);
  const locationClient = resClient?.headers?.get('location');

  if (!locationClient || !locationClient.includes('/login?portal=client')) {
    throw new Error(`Proxy failed to redirect unauthenticated request to /client. Received redirect: ${locationClient}`);
  }
  console.log("-> Proxy /client redirect check passed.");
}

async function verifyApiRoute(routePath: string) {
  const relativePath = path.relative(path.join(__dirname, '..'), routePath).replace(/\\/g, '/');
  
  // Resolve import path
  const importPath = '../' + relativePath.replace(/\.ts$/, '');
  const module = await import(importPath);

  // Define HTTP methods to test
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  
  for (const method of methods) {
    const handler = module[method];
    if (!handler) continue;

    console.log(`Checking [${method}] on route: ${relativePath}`);

    // Mock NextRequest for the endpoint URL
    const url = `https://hazelwhat.com/${relativePath.replace('src/app/', '').replace('/route.ts', '')}`;
    const req = createMockRequest(url, method);

    try {
      const response = await handler(req, { params: {} });
      
      // We expect a 401, 403, or 307/302 Redirect
      const status = response?.status;
      
      if (status === 200 || status === 201) {
        throw new Error(`Security Bypass: Route returned status ${status} for unauthenticated request!`);
      }

      if (status !== 401 && status !== 403 && status !== 307 && status !== 302 && status !== 301) {
        throw new Error(`Unexpected Response Status: ${status}. Expected 401/403 or redirect.`);
      }

      console.log(`  -> Passed (Status: ${status})`);
    } catch (err: any) {
      // If it throws an error (e.g. database connection error), it means the handler didn't reject 
      // the request early at the auth layer and continued executing code that tried to touch the DB/API.
      throw new Error(`Security Bypass / Failure: Request hit execution code and threw error: ${err.message}`);
    }
  }
}

async function run() {
  console.log("=== STARTING AUTHENTICATION INTEGRITY BUILD VERIFICATION ===");
  let failed = false;

  try {
    // 1. Verify proxy redirects protect UI pages
    await verifyProxyRedirection();

    // 2. Find and verify all protected API routes
    const apiAdminDir = path.join(__dirname, '..', 'src', 'app', 'api', 'admin');
    const apiWhatsappDir = path.join(__dirname, '..', 'src', 'app', 'api', 'whatsapp');

    const protectedRoutes = [
      ...findRoutes(apiAdminDir),
      ...findRoutes(apiWhatsappDir)
    ];

    console.log(`Found ${protectedRoutes.length} API routes to verify.`);

    for (const route of protectedRoutes) {
      // Skip leads-revival if it is mock/disabled in standard cases, 
      // but wait, we want to verify it as well once we protect it.
      await verifyApiRoute(route);
    }

    console.log("\n=== ALL AUTHENTICATION INTEGRITY CHECKS PASSED SUCCESSFULLY ===");
    process.exit(0);
  } catch (error: any) {
    console.error("\n=== AUTHENTICATION INTEGRITY CHECK FAILED! ===");
    console.error(error.message || error);
    process.exit(1);
  }
}

run();
