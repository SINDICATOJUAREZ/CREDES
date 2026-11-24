import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isProduction, sSelectOne, sUpdate } from '@/lib/supabase';
import { hasPermission } from '@/lib/auth-utils';
import { isSafePath, sanitizeFileName, validateImageUpload, isValidEmployeeId, ALLOWED_IMAGE_EXTENSIONS } from '@/lib/security-utils';

const BASE_DIR = 'I:/APLICACIONES/SINDICATO/RECURSOS/FOTOS';

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
  if (!await hasPermission('canCreateMember') && !await hasPermission('canAccessSettings')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
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
            sortBy: { column: 'name', order: 'asc' },
          }),
        });

        if (res.ok) {
          const items = await res.json();
          const photos = items.map((item: any) => ({
            name: item.name,
            url: `/api/photos/${encodeURIComponent(item.name)}`,
            size: item.metadata?.size || 0,
            updatedAt: item.updated_at || new Date().toISOString(),
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
    if (!fs.existsSync(BASE_DIR)) {
      return NextResponse.json([]);
    }

    const files = fs.readdirSync(BASE_DIR);
    const photos = files
      .filter((file) => /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(file))
      .map((file) => {
        const filePath = path.join(BASE_DIR, file);
        const stat = fs.statSync(filePath);
        return {
          name: file,
          url: `/api/photos/${encodeURIComponent(file)}`,
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
        };
      });

    return NextResponse.json(photos);
  } catch (error: any) {
    console.error('GET Photos API Error:', error);
    return NextResponse.json({ error: 'Error al consultar fotografías' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!await hasPermission('canCreateMember')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rawEmployeeId = formData.get('employeeId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Archivo no proporcionado.' }, { status: 400 });
    }

    // Validate employee ID if provided
    let cleanEmployeeId = '';
    if (rawEmployeeId) {
      if (!isValidEmployeeId(rawEmployeeId)) {
        return NextResponse.json({ error: 'Número de nómina inválido.' }, { status: 400 });
      }
      cleanEmployeeId = rawEmployeeId.trim();
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate image format, mime type and maximum size (10 MB)
    const validation = validateImageUpload(file.name, file.type, buffer.byteLength, 10 * 1024 * 1024);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Determine target safe filename
    let fileName = sanitizeFileName(file.name);
    if (cleanEmployeeId) {
      const ext = path.extname(fileName).toLowerCase() || '.jpg';
      fileName = `${cleanEmployeeId}${ext}`;
    }

    // Validate path safety
    if (!isSafePath(BASE_DIR, fileName)) {
      return NextResponse.json({ error: 'Nombre de archivo inválido.' }, { status: 400 });
    }

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
          'x-upsert': 'true',
        },
        body: buffer,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase Storage upload failed: ${errText}`);
      }

      publicUrl = `/api/photos/${encodeURIComponent(fileName)}`;
    } else {
      // Save locally only for local development
      ensureLocalDir();
      const localPath = path.resolve(BASE_DIR, fileName);
      if (!isSafePath(BASE_DIR, fileName)) {
        return NextResponse.json({ error: 'Ruta no permitida' }, { status: 403 });
      }
      fs.writeFileSync(localPath, buffer);
    }

    // Synchronize photo URL with Database for the corresponding member
    const memberIdMatch = fileName.match(/^([a-zA-Z0-9_-]+)\./);
    if (memberIdMatch) {
      const empId = memberIdMatch[1];
      if (isProduction) {
        await sUpdate('members', `employee_id=eq.${encodeURIComponent(empId)}`, { photo_url: publicUrl });
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
    return NextResponse.json({ error: 'Error al subir la fotografía' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!await hasPermission('canCreateMember')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const rawName = searchParams.get('name');

    if (!rawName) {
      return NextResponse.json({ error: 'Nombre de fotografía requerido.' }, { status: 400 });
    }

    // Preserve valid spaces in legacy filenames while strictly blocking traversal/control chars
    const trimmedName = rawName.trim();
    const baseName = path.basename(trimmedName);
    if (
      !baseName ||
      baseName !== trimmedName ||
      baseName.startsWith('.') ||
      /[\x00-\x1f\x80-\x9f/\\]/.test(baseName) ||
      !ALLOWED_IMAGE_EXTENSIONS.has(path.extname(baseName).toLowerCase()) ||
      !isSafePath(BASE_DIR, baseName)
    ) {
      return NextResponse.json({ error: 'Nombre de archivo inválido.' }, { status: 400 });
    }

    // Delete local file safely
    if (!isProduction) {
      const localPath = path.resolve(BASE_DIR, baseName);
      if (isSafePath(BASE_DIR, baseName) && fs.existsSync(localPath)) {
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
        body: JSON.stringify({ prefixes: [baseName] }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase Storage deletion failed: ${errText}`);
      }
    }

    // Only clear photo_url in database if the member's current photo_url actually references the deleted file
    const memberIdMatch = baseName.match(/^([a-zA-Z0-9_-]+)(?:\.| )/);
    if (memberIdMatch) {
      const empId = memberIdMatch[1];
      const matchesDeletedFile = (currentUrl: string | null | undefined): boolean => {
        if (!currentUrl) return false;
        const cleanUrl = currentUrl.split('?')[0];
        let referencedFile = '';
        if (cleanUrl.startsWith('/api/photos/')) {
          referencedFile = decodeURIComponent(cleanUrl.slice('/api/photos/'.length));
        } else if (cleanUrl.includes('/storage/v1/object/public/photos/')) {
          referencedFile = decodeURIComponent(cleanUrl.split('/storage/v1/object/public/photos/')[1]);
        }
        return referencedFile.toLowerCase() === baseName.toLowerCase();
      };

      if (isProduction) {
        const member = await sSelectOne('members', `employee_id=eq.${encodeURIComponent(empId)}&select=id,photo_url`);
        if (member && matchesDeletedFile(member.photo_url)) {
          await sUpdate('members', `id=eq.${encodeURIComponent(member.id)}`, { photo_url: null });
        }
      } else {
        const Database = (await import('better-sqlite3')).default;
        const db = new Database(path.join(process.cwd(), 'database.sqlite'));
        const member = db.prepare('SELECT id, photo_url FROM members WHERE employee_id = ?').get(empId) as { id: string; photo_url: string | null } | undefined;
        if (member && matchesDeletedFile(member.photo_url)) {
          db.prepare('UPDATE members SET photo_url = NULL WHERE id = ?').run(member.id);
        }
        db.close();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE Photos API Error:', error);
    return NextResponse.json({ error: 'Error al eliminar la fotografía' }, { status: 500 });
  }
}
