import { faFile } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ItemPreviewRow } from '@/elements/data-display/ItemPreviewList.tsx';
import { bytesToString } from '@/lib/format/size.ts';
import { relativeName } from '@/lib/path.ts';
import { StorageAsset } from '@/lib/schemas/admin/assets.ts';

export default function AssetListItem({ asset, currentDirectory }: { asset: StorageAsset; currentDirectory: string }) {
  return (
    <ItemPreviewRow
      icon={<FontAwesomeIcon icon={faFile} />}
      name={relativeName(asset.name, currentDirectory)}
      meta={bytesToString(asset.size)}
    />
  );
}
