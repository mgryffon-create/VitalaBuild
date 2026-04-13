import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API } from "@/App";
import axios from "axios";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";

const EXT_IMAGE = [".jpg", ".jpeg", ".png", ".webp", ".heic"];
const EXT_PDF = [".pdf"];

function getExtension(name) {
  if (!name) return "";
  const clean = name.split("?")[0];
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot).toLowerCase() : "";
}

const DocumentPreview = ({ doc, open, onClose }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const ext = getExtension(doc?.file_url || doc?.file_name || "");
  const isImage = EXT_IMAGE.includes(ext);
  const isPdf = EXT_PDF.includes(ext);
  const canPreview = isImage || isPdf;

  // Fetch file via authenticated axios → blob URL
  useEffect(() => {
    if (!open || !doc?.file_url) {
      setBlobUrl(null);
      setError(false);
      return;
    }

    let objectUrl = null;
    setLoading(true);
    setError(false);

    const fullUrl = doc.file_url.startsWith("http") ? doc.file_url : `${API}${doc.file_url.replace(/^\/api/, "")}`;

    axios.get(fullUrl, { responseType: "blob" })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, doc?.file_url]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = doc?.file_name || "document";
    a.click();
  };

  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogDescription className="sr-only">Document preview</DialogDescription>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground truncate">{doc.subtype || doc.file_name || doc.category || "Document"}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {doc.category && <span>{doc.category.replace(/_/g, " ")}</span>}
                {doc.file_size > 0 && <span>· {(doc.file_size / 1024).toFixed(0)} KB</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {blobUrl && (
              <>
                <a href={blobUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="preview-open-external">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
                <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="preview-download" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Metadata */}
        {(doc.issuing_authority || doc.document_number || doc.expiration_date || doc.state) && (
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 text-xs text-muted-foreground flex-wrap border-b">
            {doc.issuing_authority && <span>Issued by: {doc.issuing_authority}</span>}
            {doc.document_number && <span>#{doc.document_number}</span>}
            {doc.expiration_date && <span>Expires: {doc.expiration_date.slice(0, 10)}</span>}
            {doc.state && <span>State: {doc.state}</span>}
          </div>
        )}

        {/* Preview area */}
        <div className="flex-1 overflow-auto min-h-[300px] bg-muted/20">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Loading document...</p>
            </div>
          ) : error || !doc.file_url ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">{doc.file_url ? "Could not load this file" : "No file attached"}</p>
              <p className="text-xs text-muted-foreground mt-1">This document has metadata only</p>
            </div>
          ) : isImage && blobUrl ? (
            <div className="flex items-center justify-center p-4 h-full">
              <img
                src={blobUrl}
                alt={doc.file_name || "Document preview"}
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
                data-testid="preview-image"
              />
            </div>
          ) : isPdf && blobUrl ? (
            <iframe
              src={blobUrl}
              title="Document preview"
              className="w-full h-[60vh] border-0"
              data-testid="preview-pdf"
            />
          ) : blobUrl ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground mb-1">Preview not available for this file type</p>
              <p className="text-xs text-muted-foreground mb-4">{ext || "Unknown type"}</p>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Download File
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreview;
