// src/components/ui/UploadedFilePreview.jsx
import { FileText, Download, X, Film, Image as ImageIcon, File, Music, Archive } from "lucide-react";

const FORMAT_META = {
  // Images — safe to render as <img>
  jpg: { label: "JPG", color: "text-sky-500 bg-sky-500/10", isImage: true },
  jpeg: { label: "JPEG", color: "text-sky-500 bg-sky-500/10", isImage: true },
  png: { label: "PNG", color: "text-sky-500 bg-sky-500/10", isImage: true },
  gif: { label: "GIF", color: "text-sky-500 bg-sky-500/10", isImage: true },
  webp: { label: "WEBP", color: "text-sky-500 bg-sky-500/10", isImage: true },
  svg: { label: "SVG", color: "text-sky-500 bg-sky-500/10", isImage: true },
  // Docs
  pdf: { label: "PDF", color: "text-red-500 bg-red-500/10", icon: FileText },
  doc: { label: "DOC", color: "text-blue-500 bg-blue-500/10", icon: FileText },
  docx: { label: "DOCX", color: "text-blue-500 bg-blue-500/10", icon: FileText },
  txt: { label: "TXT", color: "text-gray-500 bg-gray-500/10", icon: FileText },
  // Video
  mp4: { label: "MP4", color: "text-purple-500 bg-purple-500/10", icon: Film },
  mov: { label: "MOV", color: "text-purple-500 bg-purple-500/10", icon: Film },
  avi: { label: "AVI", color: "text-purple-500 bg-purple-500/10", icon: Film },
  // Audio
  mp3: { label: "MP3", color: "text-green-500 bg-green-500/10", icon: Music },
  wav: { label: "WAV", color: "text-green-500 bg-green-500/10", icon: Music },
  // Archive
  zip: { label: "ZIP", color: "text-orange-500 bg-orange-500/10", icon: Archive },
  rar: { label: "RAR", color: "text-orange-500 bg-orange-500/10", icon: Archive },
};

function getFileMeta(file) {
  const ext = (file.format || file.originalFilename?.split(".").pop() || "").toLowerCase();
  return FORMAT_META[ext] || { label: ext?.toUpperCase() || "FILE", color: "text-muted-foreground bg-muted", icon: File };
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Compact version: used inside database table cells ───────
export function CompactFileChip({ file, onRemove }) {
  const meta = getFileMeta(file);
  const IconComp = meta.icon || ImageIcon;
  return (
    <span className="inline-flex items-center gap-1 bg-muted/60 border border-border/50 rounded-md px-1.5 py-0.5 text-[11px] max-w-[150px] group/chip">
      <IconComp className={`w-3 h-3 flex-shrink-0 ${meta.color.split(" ")[0]}`} />
      <span className="truncate text-foreground">{file.originalFilename || "file"}</span>
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="opacity-0 group-hover/chip:opacity-100 transition-opacity flex-shrink-0"
        title="Download"
        onClick={e => e.stopPropagation()}
      >
        <Download className="w-2.5 h-2.5 text-muted-foreground hover:text-foreground" />
      </a>
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(file); }}
          className="opacity-0 group-hover/chip:opacity-100 transition-opacity flex-shrink-0"
          title="Remove"
        >
          <X className="w-2.5 h-2.5 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </span>
  );
}

// ─── Full card version: used in PageEditor attachments panel ─
export default function UploadedFilePreview({ file, onRemove, compact = false }) {
  if (compact) return <CompactFileChip file={file} onRemove={onRemove} />;

  const meta = getFileMeta(file);
  const IconComp = meta.icon || File;
  const canShowThumbnail = meta.isImage && file.resourceType === "image";

  return (
    <div className="group relative flex flex-col w-[180px] border border-border rounded-xl overflow-hidden bg-card hover:shadow-md hover:border-primary/30 transition-all duration-200">
      {/* Thumbnail / icon area */}
      <div className="h-24 flex items-center justify-center bg-muted/40 overflow-hidden">
        {canShowThumbnail ? (
          <img
            src={file.url}
            alt={file.originalFilename}
            className="w-full h-full object-cover"
            onError={e => {
              // If image fails to load, replace with icon
              e.currentTarget.style.display = "none";
              e.currentTarget.nextSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        {/* Fallback icon — always rendered for non-images, hidden for images until error */}
        <div className={`flex flex-col items-center gap-1 ${canShowThumbnail ? "hidden" : ""}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${meta.color}`}>
            <IconComp className="w-6 h-6" />
          </div>
          <span className={`text-[10px] font-bold tracking-wider ${meta.color.split(" ")[0]}`}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Info footer */}
      <div className="px-2.5 py-2 flex flex-col gap-0.5">
        <p className="text-xs font-medium truncate leading-tight" title={file.originalFilename}>
          {file.originalFilename || "Untitled"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatBytes(file.bytes)}
        </p>
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
        >
          <Download className="w-3 h-3" />
          Download
        </a>
      </div>

      {/* Remove button */}
      {onRemove && (
        <button
          onClick={() => onRemove(file)}
          title="Remove attachment"
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive hover:border-destructive hover:text-destructive-foreground shadow-sm"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
