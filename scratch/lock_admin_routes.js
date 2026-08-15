const fs = require('fs');
const path = require('path');

const adminRoutes = [
  'src/app/api/admin/debug-tenants/route.ts',
  'src/app/api/admin/init-db/route.ts',
  'src/app/api/admin/debug-tenant/route.ts',
  'src/app/api/admin/debug-customer/route.ts',
  'src/app/api/admin/debug-all-customers/route.ts',
  'src/app/api/admin/api-health/route.ts',
  'src/app/api/admin/debug-config/route.ts',
  'src/app/api/admin/debug-logs/route.ts',
  'src/app/api/admin/debug-llm/route.ts',
  'src/app/api/admin/tenants/route.ts',
  'src/app/api/admin/enable-ai/route.ts',
  'src/app/api/admin/seed-db/route.ts'
];

for (const route of adminRoutes) {
  const absolutePath = path.resolve(route);
  if (!fs.existsSync(absolutePath)) {
    continue;
  }

  let content = fs.readFileSync(absolutePath, 'utf8');

  // Fix imports from "next/server"
  content = content.replace(/import\s*\{\s*NextResponse\s*\}\s*from\s*["']next\/server["']/g, 'import { NextRequest, NextResponse } from "next/server"');
  content = content.replace(/import\s*\{\s*NextRequest\s*,\s*NextResponse\s*\}\s*from\s*["']next\/server["']/g, 'import { NextRequest, NextResponse } from "next/server"');
  content = content.replace(/import\s*\{\s*NextResponse\s*,\s*NextRequest\s*\}\s*from\s*["']next\/server["']/g, 'import { NextRequest, NextResponse } from "next/server"');

  fs.writeFileSync(absolutePath, content, 'utf8');
  console.log(`Ensured NextRequest import in: ${route}`);
}
