import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ExternalLink, FileText, Image, X } from "lucide-react";

const EXT_IMAGE = [".jpg", ".jpeg", ".png", ".webp", ".heic"];
const EXT_PDF = [".pdf"];

function getExtension(url) {
  if (!url) return "";
  const clean = url.split("?")[0];
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot).toLowerCase() : "";
}

const DocumentPreview = ({ doc, open, onClose }) => {
  if (!doc) return null;
  const ext = getExtension(doc.file_url || doc.file_name || "");
  const isImage = EXT_IMAGE.includes(ext);
  const isPdf = EXT_PDF.includes(ext);
  const fileUrl = doc.file_url || "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground truncate">{doc.file_name || doc.subtype || doc.category}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {doc.category && <span>{doc.category.replace(/_/g, " ")}</span>}
                {doc.subtype && <span>— {doc.subtype.replace(/_/g, " ")}</span>}
                {doc.file_size && <span>— {(doc.file_size / 1024).toFixed(0)} KB</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {fileUrl && (
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="preview-open-external">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            )}
            {fileUrl && (
              <a href={fileUrl} download>
                <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="preview-download">
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Metadata strip */}
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 text-xs text-muted-foreground flex-wrap border-b">
          {doc.verification_status && (
            <Badge variant="outline" className="text-[9px]">{doc.verification_status}</Badge>
          )}
          {doc.issuing_authority && <span>Issued by: {doc.issuing_authority}</span>}
          {doc.document_number && <span>#{doc.document_number}</span>}
          {doc.expiration_date && <span>Expires: {doc.expiration_date.slice(0, 10)}</span>}
          {doc.state && <span>State: {doc.state}</span>}
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-auto min-h-[300px] bg-muted/20">
          {isImage && fileUrl ? (
            <div className="flex items-center justify-center p-4 h-full">
              <img
                src={fileUrl}
                alt={doc.file_name || "Document preview"}
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
                data-testid="preview-image"
              />
            </div>
          ) : isPdf && fileUrl ? (
            <iframe
              src={fileUrl}
              title="Document preview"
              className="w-full h-[60vh] border-0"
              data-testid="preview-pdf"
            />
          ) : fileUrl ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground mb-1">Preview not available for this file type</p>
              <p className="text-xs text-muted-foreground mb-4">{ext || "Unknown type"}</p>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open File
                </Button>
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">No file attached</p>
              <p className="text-xs text-muted-foreground mt-1">This document has metadata only</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreview;
