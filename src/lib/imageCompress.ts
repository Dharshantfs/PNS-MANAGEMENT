// Shrinks a photo taken on a phone (often 3-8 MB) to a JPEG data URL small
// enough to send to the API and keep in one Firestore document - see
// api/_lib/app.ts POST /api/onboard/kyc-docs (limit ~330 KB per image).
// Steps down quality, then size, until it fits.
export async function compressImage(file: File, maxChars = 440_000): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo (JPG or PNG).');

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read that photo - try another one.'));
      el.src = url;
    });

    for (const maxSide of [1600, 1280, 1024, 800]) {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not process the photo on this device.');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.65, 0.5]) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length <= maxChars) return dataUrl;
      }
    }
    throw new Error('That photo is too large even after compressing - try a closer, clearer shot.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
