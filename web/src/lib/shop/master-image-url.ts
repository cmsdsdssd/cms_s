const normalizeImagePath = (path: string, bucket: string) => {
  if (path.startsWith(`${bucket}/`)) return path.slice(bucket.length + 1);
  if (path.startsWith('storage/v1/object/public/')) {
    return path.replace('storage/v1/object/public/', '').split('/').slice(1).join('/');
  }
  return path;
};

export const buildMasterImageUrl = (supabase: { storage: { from: (bucket: string) => { getPublicUrl: (path: string) => { data?: { publicUrl?: string } } } } }, rawPath: string | null) => {
  if (!rawPath) return null;
  const path = String(rawPath).trim();
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const bucket = process.env.SUPABASE_BUCKET ?? 'master_images';
  if (!url) return null;
  const normalized = normalizeImagePath(path, bucket);
  const { data } = supabase.storage.from(bucket).getPublicUrl(normalized);
  return data?.publicUrl ?? `${url}/storage/v1/object/public/${bucket}/${normalized}`;
};
