import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isProduction } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Resolve params.path (it's a Promise in newer Next.js)
    const resolvedParams = await params;
    const photoPath = resolvedParams.path.join('/');
    
    // Use absolute path for local development
    const baseDir = 'I:/APLICACIONES/SINDICATO/CREDENCIALES/RECURSOS/FOTOS';
    const fullPath = path.join(baseDir, photoPath);

    console.log('Serving photo:', photoPath);

    // If in production or the local file does not exist, fetch from Supabase
    if (isProduction || !fs.existsSync(fullPath)) {
      const supabaseUrl = process.env.SUPABASE_URL;
      if (supabaseUrl) {
        const targetUrl = `${supabaseUrl}/storage/v1/object/public/photos/${encodeURIComponent(photoPath)}`;
        console.log('Fetching photo from Supabase proxy:', targetUrl);
        const res = await fetch(targetUrl);
        if (res.ok) {
          const contentType = res.headers.get('content-type') || 'image/jpeg';
          const fileBuffer = await res.arrayBuffer();
          return new Response(fileBuffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
      }
    }

    if (!fs.existsSync(fullPath)) {
      console.error('Photo not found locally:', fullPath);
      return new NextResponse('Not Found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(fullPath);
    const extension = path.extname(fullPath).toLowerCase();
    
    let contentType = 'image/jpeg';
    if (extension === '.png') contentType = 'image/png';
    if (extension === '.bmp') contentType = 'image/bmp';
    if (extension === '.gif') contentType = 'image/gif';
    if (extension === '.webp') contentType = 'image/webp';

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    console.error('Photo API Error:', error);
    return new Response('Internal Server Error: ' + error.message, { status: 500 });
  }
}
