const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
};

export function imageTypeFromUrl(src: string): string | null {
  const extension = src.split(/[?#]/)[0].split('.').pop()?.toLowerCase();

  return (extension && IMAGE_TYPES[extension]) || null;
}

export function detectImage(src: string): Promise<{ sizes: string; type: string | null } | null> {
  const type = imageTypeFromUrl(src);
  if (type === 'image/svg+xml') {
    return Promise.resolve({ sizes: 'any', type });
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ sizes: `${image.naturalWidth}x${image.naturalHeight}`, type });
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
