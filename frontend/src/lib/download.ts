export function downloadBlob(blob: Blob, filename: string): void {
  const fileURL = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = fileURL;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();

  URL.revokeObjectURL(fileURL);
  downloadLink.remove();
}

export function downloadTextFile(content: string, filename: string, mimeType = 'text/plain'): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}
