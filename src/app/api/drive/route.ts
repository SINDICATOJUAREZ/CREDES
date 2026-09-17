import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/auth-utils';

export async function POST(request: Request) {
  // Enforce access control
  if (!await hasPermission('canCreateMember') && !await hasPermission('canAccessSettings')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const { folderId } = await request.json();

    // Prevent Google Drive query injection
    if (!folderId || typeof folderId !== 'string' || !/^[a-zA-Z0-9_-]{10,100}$/.test(folderId.trim())) {
      return NextResponse.json({ error: 'Identificador de carpeta de Google Drive inválido' }, { status: 400 });
    }

    const cleanFolderId = folderId.trim();

    const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
      return NextResponse.json({ error: 'Servicio de Google Drive no configurado' }, { status: 503 });
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.list({
      q: `'${cleanFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, thumbnailLink, webContentLink, mimeType)',
      pageSize: 1000,
    });

    return NextResponse.json({ files: response.data.files || [] });
  } catch (error: any) {
    console.error('Drive API Error:', error);
    return NextResponse.json({ error: 'Error al consultar Google Drive' }, { status: 500 });
  }
}
