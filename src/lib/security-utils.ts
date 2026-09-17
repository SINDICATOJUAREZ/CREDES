import path from 'path';

/**
 * Validates that a requested file path resolves strictly inside the allowed base directory.
 * Prevents Path Traversal (Directory Traversal / LFI) vulnerabilities.
 */
export function isSafePath(baseDir: string, userPath: string): boolean {
  if (!userPath || typeof userPath !== 'string') return false;
  
  // Normalize and resolve absolute paths
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(baseDir, userPath);

  // Target must strictly start with the base directory path + path separator
  return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase;
}

/**
 * Sanitizes a file name by removing any path traversal sequences, control characters,
 * and restricting it to safe alphanumeric characters and dots/hyphens/underscores.
 */
export function sanitizeFileName(rawFileName: string): string {
  if (!rawFileName || typeof rawFileName !== 'string') return '';

  // Extract only the base name (strips directories)
  const baseName = path.basename(rawFileName.trim());

  // Remove any remaining null bytes or control characters
  const cleanName = baseName.replace(/[\x00-\x1f\x80-\x9f]/g, '');

  // Strip path traversal attempts and special symbols, allow only safe characters
  const sanitized = cleanName.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Prevent hidden files (.env, .git, etc.)
  if (sanitized.startsWith('.')) {
    return `file_${sanitized}`;
  }

  return sanitized;
}

/**
 * Permitted image file extensions and MIME types
 */
export const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/gif'
]);

/**
 * Validates that an uploaded file is a safe image by extension, MIME type, and size.
 */
export function validateImageUpload(
  fileName: string,
  mimeType: string,
  byteLength: number,
  maxSizeBytes = 10 * 1024 * 1024 // 10 MB default
): { valid: boolean; error?: string } {
  if (byteLength > maxSizeBytes) {
    return { valid: false, error: `El archivo supera el tamaño máximo permitido (${Math.round(maxSizeBytes / (1024 * 1024))}MB)` };
  }

  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return { valid: false, error: 'Formato de archivo no permitido. Solo se aceptan imágenes (.jpg, .jpeg, .png, .webp)' };
  }

  if (mimeType && !ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) {
    return { valid: false, error: 'Tipo MIME inválido para la imagen proporcionada' };
  }

  return { valid: true };
}

/**
 * Sanitizes input strings for PostgREST query parameters to avoid filter injection.
 */
export function sanitizePostgrestParam(val: string): string {
  if (!val) return '';
  // Remove control characters and characters that have structural meaning in PostgREST operators
  return encodeURIComponent(val.trim());
}

/**
 * Validates employeeId / nómina format (strictly numeric or alphanumeric, between 1 and 20 chars)
 */
export function isValidEmployeeId(employeeId: string): boolean {
  if (!employeeId || typeof employeeId !== 'string') return false;
  return /^[a-zA-Z0-9_-]{1,20}$/.test(employeeId.trim());
}
