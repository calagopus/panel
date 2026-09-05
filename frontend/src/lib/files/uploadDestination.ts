import { UploadDestination } from '@/stores/uploads.ts';

export function uploadDestinationPath(destination: UploadDestination): string {
  return destination.type === 'server'
    ? `/server/${destination.routeId}/files?directory=${encodeURIComponent(destination.directory)}`
    : `/admin/assets${destination.directory ? `?directory=${encodeURIComponent(destination.directory)}` : ''}`;
}
