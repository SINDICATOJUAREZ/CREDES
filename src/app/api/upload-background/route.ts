import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { isProduction } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = path.extname(file.name) || '.jpg';
    const fileName = `${crypto.randomUUID()}${ext}`;

    if (isProduction) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

      const res = await fetch(`${url}/storage/v1/object/photos/${encodeURIComponent(fileName)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'apikey': key || '',
          'Content-Type': file.type || 'image/jpeg',
          'x-upsert': 'true'
        },
        body: buffer
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase Storage background upload failed: ${errText}`);
      }

      const publicUrl = `${url}/storage/v1/object/public/photos/${encodeURIComponent(fileName)}`;
      return NextResponse.json({ url: publicUrl });
    }

    // Local upload fallback for development
    const uploadDir = path.join(process.cwd(), 'public', 'backgrounds');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({ url: `/backgrounds/${fileName}` });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
