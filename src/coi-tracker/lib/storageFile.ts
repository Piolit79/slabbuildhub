import { supabase } from '@/coi-tracker/integrations/supabase/client';

type SignedUrlResult = {
  url: string;
  resolvedPath: string;
};

type FileBlobResult = {
  blob: Blob;
  resolvedPath: string;
};

const STORAGE_PREFIX_REGEX = /^(uploads\/|agreements\/|policies\/)/i;

function toAbsoluteStorageUrl(signedUrl: string): string {
  if (signedUrl.startsWith('http')) return signedUrl;

  const baseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  if (signedUrl.startsWith('/storage/v1/')) return `${baseUrl}${signedUrl}`;
  if (signedUrl.startsWith('storage/v1/')) return `${baseUrl}/${signedUrl}`;

  return `${baseUrl}/storage/v1${signedUrl.startsWith('/') ? signedUrl : `/${signedUrl}`}`;
}

function getPathCandidates(filePath: string): string[] {
  const normalized = filePath.replace(/^\/+/, '');
  const candidates = [normalized];

  if (!STORAGE_PREFIX_REGEX.test(normalized)) {
    candidates.push(`uploads/coi/${normalized}`);
    candidates.push(`uploads/gl-policies/${normalized}`);
  }

  return [...new Set(candidates)];
}

export async function resolveStoragePath(filePath: string, bucket = 'certificates'): Promise<string> {
  const candidates = getPathCandidates(filePath);
  for (const candidate of candidates) {
    const { data, error } = await supabase.storage.from(bucket).download(candidate);
    if (!error && data) return candidate;
  }
  throw new Error(`Unable to resolve storage path for ${filePath}`);
}

export async function downloadStorageFileBlob(
  filePath: string,
  bucket = 'certificates'
): Promise<FileBlobResult> {
  const candidates = getPathCandidates(filePath);
  let lastError: unknown;

  for (const candidate of candidates) {
    const { data, error } = await supabase.storage.from(bucket).download(candidate);

    if (error || !data) {
      lastError = error;
      continue;
    }

    return { blob: data, resolvedPath: candidate };
  }

  throw new Error(
    `Unable to download file for ${filePath}${lastError ? `: ${(lastError as Error)?.message || 'unknown error'}` : ''}`
  );
}

export async function createSignedFileUrl(
  filePath: string,
  expiresInSeconds = 600,
  bucket = 'certificates'
): Promise<SignedUrlResult> {
  const candidates = getPathCandidates(filePath);

  for (const candidate of candidates) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(candidate, expiresInSeconds);

    const signed = (data as any)?.signedUrl || (data as any)?.signedURL;
    if (!error && signed) {
      return { url: toAbsoluteStorageUrl(signed), resolvedPath: candidate };
    }
  }

  throw new Error(`Unable to create signed URL for ${filePath}`);
}

