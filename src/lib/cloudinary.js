export const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
export const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export async function uploadToCloudinary(file, folder = "xponet") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Upload failed");
  }

  const data = await res.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    resourceType: data.resource_type,
    format: data.format,
    bytes: data.bytes,
    originalFilename: data.original_filename,
  };
}

export function getCloudinaryUrl(publicId, { width, height, crop = "fill" } = {}) {
  let t = "";
  if (width || height) {
    t = `c_${crop},${width ? `w_${width},` : ""}${height ? `h_${height}` : ""}/`;
  }
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${t}${publicId}`;
}
