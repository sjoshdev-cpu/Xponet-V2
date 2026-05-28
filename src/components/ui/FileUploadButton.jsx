import { useState, useRef } from "react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { Paperclip, Loader2, Image, FileText } from "lucide-react";
import { toast } from "sonner";

export default function FileUploadButton({
  onUpload,
  folder = "xponet",
  accept = "image/*,application/pdf,.doc,.docx,.txt",
  label = "Attach File",
  variant = "outline",
  size = "sm",
  className = "",
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 10MB.");
      return;
    }

    setUploading(true);
    try {
      const result = await uploadToCloudinary(file, folder);
      toast.success(`"${result.originalFilename}" uploaded!`);
      onUpload?.(result);
    } catch (err) {
      toast.error("Upload failed: " + err.message);
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        variant={variant}
        size={size}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={className}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Paperclip className="w-4 h-4 mr-2" />
        )}
        {uploading ? "Uploading..." : label}
      </Button>
    </>
  );
}
