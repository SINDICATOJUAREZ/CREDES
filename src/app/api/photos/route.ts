import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isProduction, sUpdate } from '@/lib/supabase';

const BASE_DIR = 'I:/APLICACIONES/SINDICATO/CREDENCIALES/RECURSOS/FOTOS';

function ensureLocalDir() {
  if (isProduction) return;
  try {
    if (!fs.existsSync(BASE_DIR)) {
      fs.mkdirSync(BASE_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to create local photos directory:', err);
  }
}

export async function GET() {
  try {
    if (isProduction) {
      try {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
        
        const res = await fetch(`${url}/storage/v1/object/list/photos`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'apikey': key || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prefix: '',
            limit: 1000,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' }
          })
        });

        if (res.ok) {
          const items = await res.json();
          const photos = items.map((item: any) => ({
            name: item.name,
            url: `${url}/storage/v1/object/public/photos/${encodeURIComponent(item.name)}`,
            size: item.metadata?.size || 0,
            updatedAt: item.updated_at || new Date().toISOString()
          }));

          return NextResponse.json(photos);
        }
        console.warn(`Supabase Storage list failed (status ${res.status}), falling back to local files.`);
      } catch (supabaseError) {
        console.error('Supabase Storage list error, falling back to local:', supabaseError);
      }
    }

    // Local listing fallback
    ensureLocalDir();
    const files = fs.readdirSync(BASE_DIR);
    const photos = files
      .filter(file => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file))
      .map(file => {
        const filePath = path.join(BASE_DIR, file);
        const stat = fs.statSync(filePath);
        return {
          name: file,
          url: `/api/photos/${encodeURIComponent(file)}`,
          size: stat.size,
          updatedAt: stat.mtime.toISOString()
        };
      });

    return NextResponse.json(photos);
  } catch (error: any) {
    console.error('GET Photos API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const employeeId = formData.get('employeeId') as string;

    if (!file) {
      return NextResponse.json({ error: 'Archivo no proporcionado.' }, { status: 400 });
    }

    // Determine target filename
    let fileName = file.name;
    if (employeeId) {
      const ext = path.extname(file.name) || '.jpg';
      fileName = `${employeeId}${ext}`;
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let publicUrl = `/api/photos/${encodeURIComponent(fileName)}`;

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
        throw new Error(`Supabase Storage upload failed: ${errText}`);
      }

      publicUrl = `${url}/storage/v1/object/public/photos/${encodeURIComponent(fileName)}`;
    } else {
      // Save locally only for local development
      ensureLocalDir();
      const localPath = path.join(BASE_DIR, fileName);
      fs.writeFileSync(localPath, buffer);
    }

    // Synchronize photo URL with Database for the corresponding member
    const memberIdMatch = fileName.match(/^(\d+)/);
    if (memberIdMatch) {
      const empId = memberIdMatch[1];
      if (isProduction) {
        await sUpdate('members', `employee_id=eq.${empId}`, { photo_url: publicUrl });
      } else {
        const Database = (await import('better-sqlite3')).default;
        const db = new Database(path.join(process.cwd(), 'database.sqlite'));
        db.prepare('UPDATE members SET photo_url = ? WHERE employee_id = ?').run(publicUrl, empId);
        db.close();
      }
    }

    return NextResponse.json({ success: true, name: fileName, url: publicUrl });
  } catch (error: any) {
    console.error('POST Photos API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json({ error: 'Nombre de fotografía requerido.' }, { status: 400 });
    }

    // Delete local file
    if (!isProduction) {
      const localPath = path.join(BASE_DIR, name);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    }

    if (isProduction) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

      const res = await fetch(`${url}/storage/v1/object/photos`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${key}`,
          'apikey': key || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefixes: [name] })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase Storage deletion failed: ${errText}`);
      }
    }

    // Remove photo reference in database
    const memberIdMatch = name.match(/^(\d+)/);
    if (memberIdMatch) {
      const empId = memberIdMatch[1];
      if (isProduction) {
        await sUpdate('members', `employee_id=eq.${empId}`, { photo_url: null });
      } else {
        const Database = (await import('better-sqlite3')).default;
        const db = new Database(path.join(process.cwd(), 'database.sqlite'));
        db.prepare('UPDATE members SET photo_url = NULL WHERE employee_id = ?').run(empId);
        db.close();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE Photos API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
