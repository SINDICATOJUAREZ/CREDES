import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { isProduction } from '@/lib/supabase';
import { hasPermission } from '@/lib/auth-utils';
import { isSafePath, validateImageUpload } from '@/lib/security-utils';

export async function POST(req: NextRequest) {
  // Enforce access control
  if (!await hasPermission('canAccessSettings')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const data = await req.formData();
    const file = data.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate image format, mime type, and maximum size (10 MB)
    const validation = validateImageUpload(file.name, file.type, buffer.byteLength, 10 * 1024 * 1024);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const rawExt = path.extname(file.name).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(rawExt) ? rawExt : '.jpg';
    const fileName = `${crypto.randomUUID()}${safeExt}`;

    if (isProduction) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

      const res = await fetch(`${url}/storage/v1/object/photos/${encodeURIComponent(fileName)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'apikey': key || '',
          'Content-Type': file.type || 'image/jpeg',
          'x-upsert': 'true',
        },
        body: buffer,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase Storage background upload failed: ${errText}`);
      }

      const publicUrl = `${url}/storage/v1/object/public/photos/${encodeURIComponent(fileName)}`;
      return NextResponse.json({ url: publicUrl });
    }

    // Local upload fallback for development
    const uploadDir = path.resolve(process.cwd(), 'public', 'backgrounds');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    if (!isSafePath(uploadDir, fileName)) {
      return NextResponse.json({ error: 'Ruta de archivo no permitida' }, { status: 403 });
    }

    const filePath = path.resolve(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({ url: `/backgrounds/${fileName}` });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Error al subir la imagen de fondo' }, { status: 500 });
  }
}
