import { put, list } from '@vercel/blob';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "vercel_blob_rw_MHIpFKiR19C2IXTg_dQfiKQMoZodAgeslAAv0lLz6Y4POp3";

export async function getJson(filename, defaultValue = []) {
  try {
    const { blobs } = await list({ prefix: filename, token: TOKEN });
    if (blobs.length === 0) return defaultValue;
    
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    
    // For private stores, downloadUrl contains the short-lived access token
    const res = await fetch(blobs[0].downloadUrl || blobs[0].url);
    if (!res.ok) return defaultValue;
    return await res.json();
  } catch (e) {
    console.error('Error reading blob:', e);
    return defaultValue;
  }
}

export async function saveJson(filename, data) {
  try {
    await put(filename, JSON.stringify(data), { 
      access: 'private', 
      token: TOKEN, 
      addRandomSuffix: false 
    });
  } catch (e) {
    console.error('Error saving blob:', e);
    throw new Error('Ошибка сохранения в базу данных (Blob)');
  }
}
