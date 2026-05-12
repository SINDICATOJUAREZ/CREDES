import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Resolve params.path (it's a Promise in newer Next.js)
    const resolvedParams = await params;
    const photoPath = resolvedParams.path.join('/');
    
    // Use absolute path for robustness
    const baseDir = 'I:/APLICACIONES/SINDICATO/CREDENCIALES/RECURSOS/FOTOS';
    const fullPath = path.join(baseDir, photoPath);

    console.log('Serving photo:', fullPath);

    if (!fs.existsSync(fullPath)) {
      console.error('Photo not found:', fullPath);
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
