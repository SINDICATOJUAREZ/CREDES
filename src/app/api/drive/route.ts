import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { folderId } = await request.json();

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
      key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, thumbnailLink, webContentLink, mimeType)',
      pageSize: 1000,
    });

    return NextResponse.json({ files: response.data.files });
  } catch (error: any) {
    console.error('Drive API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
