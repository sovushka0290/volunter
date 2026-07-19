import { put, list, head } from '@vercel/blob';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "vercel_blob_rw_MHIpFKiR19C2IXTg_dQfiKQMoZodAgeslAAv0lLz6Y4POp3";

export async function getJson(filename, defaultValue = []) {
  try {
    const { blobs } = await list({ prefix: filename, token: TOKEN });
    if (blobs.length === 0) return defaultValue;
    
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const blobUrl = blobs[0].url;
    
    // For private stores, we must pass the token in the request header
    const res = await fetch(blobUrl, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    if (!res.ok) {
      console.error('Blob fetch failed:', res.status, await res.text());
      return defaultValue;
    }
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
      addRandomSuffix: false,
      allowOverwrite: true
    });
  } catch (e) {
    console.error('Error saving blob:', e);
    throw new Error('Ошибка сохранения в базу данных (Blob)');
  }
}
