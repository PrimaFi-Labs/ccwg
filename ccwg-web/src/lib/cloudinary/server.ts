// ccwg/ccwg-web/src/lib/cloudinary/server.ts

import 'server-only';
import { cloudinary, CLOUDINARY_FOLDERS } from './config';

// Upload image to Cloudinary (SERVER ONLY)
export const uploadToCloudinary = async (
  file: Buffer | string,
  folder: keyof typeof CLOUDINARY_FOLDERS,
  publicId?: string
): Promise<{ url: string; publicId: string }> => {
  // If Buffer, convert to data URI to be safe
  const data =
    typeof file === 'string'
      ? file
      : `data:application/octet-stream;base64,${file.toString('base64')}`;

  const result = await cloudinary.uploader.upload(data, {
    folder: CLOUDINARY_FOLDERS[folder],
    public_id: publicId,
    resource_type: 'auto',
    quality: 'auto:good',
    fetch_format: 'auto',
  });

  return { url: result.secure_url, publicId: result.public_id };
};

// Delete from Cloudinary (SERVER ONLY)
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  await cloudinary.uploader.destroy(publicId);
};
