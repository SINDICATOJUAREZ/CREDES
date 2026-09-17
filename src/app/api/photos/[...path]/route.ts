import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isProduction } from '@/lib/supabase';
import { isSafePath, ALLOWED_IMAGE_EXTENSIONS } from '@/lib/security-utils';
import { getSessionUser } from '@/lib/auth-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Require authenticated session to view personal ID photos
    const user = await getSessionUser();
    if (!user) {
      return new NextResponse('No autorizado', { status: 401 });
    }

    const resolvedParams = await params;
    if (!resolvedParams?.path || !Array.isArray(resolvedParams.path) || resolvedParams.path.length === 0) {
      return new NextResponse('Bad Request', { status: 400 });
    }

    const photoPath = resolvedParams.path.join('/');
    const baseDir = 'I:/APLICACIONES/SINDICATO/RECURSOS/FOTOS';

    // Verify path safety (anti-path traversal / LFI)
    if (!isSafePath(baseDir, photoPath)) {
      return new NextResponse('Forbidden: Invalid Path', { status: 403 });
    }

    // Verify extension is strictly an image format
    const extension = path.extname(photoPath).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
      return new NextResponse('Forbidden: Invalid file type', { status: 403 });
    }

    const fullPath = path.resolve(baseDir, photoPath);

    // If in production or the local file does not exist, fetch from Supabase
    if (isProduction || !fs.existsSync(fullPath)) {
      const supabaseUrl = process.env.SUPABASE_URL;
      if (supabaseUrl) {
        // Sanitize path parameter when proxying to Supabase
        const safeEncodedPath = resolvedParams.path.map(encodeURIComponent).join('/');
        const targetUrl = `${supabaseUrl}/storage/v1/object/public/photos/${safeEncodedPath}`;
        const res = await fetch(targetUrl);
        if (res.ok) {
          const contentType = res.headers.get('content-type') || 'image/jpeg';
          const fileBuffer = await res.arrayBuffer();
          return new Response(fileBuffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'private, max-age=3600',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        }
      }
    }

    if (!fs.existsSync(fullPath)) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(fullPath);

    let contentType = 'image/jpeg';
    if (extension === '.png') contentType = 'image/png';
    if (extension === '.bmp') contentType = 'image/bmp';
    if (extension === '.gif') contentType = 'image/gif';
    if (extension === '.webp') contentType = 'image/webp';

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('Photo API Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
