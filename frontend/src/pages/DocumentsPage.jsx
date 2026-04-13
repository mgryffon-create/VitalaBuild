import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  FileText, Upload, Trash2, AlertTriangle, CheckCircle, Clock, Eye, X, Calendar,
  Heart, Shield, CreditCard, ClipboardCheck, ArrowLeft, Search, Tag
} from "lucide-react";
import { DOCUMENT_CATEGORIES, getTypesForCategory, getGroupsForCategory } from "@/config/documentTypes";

const ICON_MAP = { Heart, Shield, CreditCard, FileText, ClipboardCheck };

const DocumentsPage = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Upload state
  const [uploadStep, setUploadStep] = useState("category"); // category | type | file
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]); // multi-tag
  const [typeSearch, setTypeSearch] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => { fetchDocuments(); }, []);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API}/documents`);
      setDocuments(response.data);
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const resetUpload = () => {
    setUploadStep("category");
    setSelectedCategory("");
    setSelectedTypes([]);
    setTypeSearch("");
    setExpirationDate("");
    setFileData(null);
    setFileName("");
  };

  const openUpload = () => { resetUpload(); setShowUploadDialog(true); };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF, JPG, and PNG files are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setFileData(reader.result); setFileName(file.name); };
    reader.readAsDataURL(file);
  };

  const toggleType = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleUpload = async () => {
    if (selectedTypes.length === 0 || !fileData) {
      toast.error("Select at least one document type and a file");
      return;
    }
    setUploading(true);
    try {
      const primaryType = selectedTypes[0];
      const additionalTags = selectedTypes.slice(1);
      await axios.post(`${API}/documents`, {
        document_type: primaryType,
        document_category: selectedCategory,
        document_tags: additionalTags.length > 0 ? additionalTags : null,
        expiration_date: expirationDate || null,
        file_data: fileData,
        file_name: fileName,
      });
      toast.success(`Document uploaded — ${selectedTypes.length} type${selectedTypes.length > 1 ? "s" : ""} tagged`);
      setShowUploadDialog(false);
      resetUpload();
      fetchDocuments();
    } catch {
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    try {
      await axios.delete(`${API}/documents/${docId}`);
      toast.success("Document deleted");
      setDocuments(documents.filter((d) => d.id !== docId));
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const viewDocument = async (doc) => {
    try {
      const response = await axios.get(`${API}/documents/${doc.id}`);
      setSelectedDoc(response.data);
      setShowViewDialog(true);
    } catch {
      toast.error("Failed to load document");
    }
  };

  const getExpirationStatus = (daysUntilExpiry) => {
    if (daysUntilExpiry === null || daysUntilExpiry === undefined) return "unknown";
    if (daysUntilExpiry <= 0) return "expired";
    if (daysUntilExpiry <= 30) return "expiring";
    if (daysUntilExpiry <= 60) return "warning";
    return "valid";
  };

  const getStatusBadge = (daysUntilExpiry) => {
    const status = getExpirationStatus(daysUntilExpiry);
    switch (status) {
      case "expired":
        return <Badge className="bg-destructive text-destructive-foreground text-[10px]">Expired</Badge>;
      case "expiring":
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px]">{daysUntilExpiry}d left</Badge>;
      case "warning":
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">{daysUntilExpiry}d left</Badge>;
      case "valid":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Valid</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">No expiration</Badge>;
    }
  };

  // Filter types by search within selected category
  const allTypes = getTypesForCategory(selectedCategory);
  const groups = getGroupsForCategory(selectedCategory);
  const searchLower = typeSearch.toLowerCase();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const expiringDocs = documents.filter((d) => d.days_until_expiry !== null && d.days_until_expiry <= 30 && d.days_until_expiry > 0);
  const expiredDocs = documents.filter((d) => d.days_until_expiry !== null && d.days_until_expiry <= 0);

  return (
    <DashboardLayout>
      <div data-testid="documents-page" className="space-y-5 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Documents</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Manage certifications, vaccinations, and compliance records
            </p>
          </div>
          <Button data-testid="upload-document-btn" onClick={openUpload} className="w-full sm:w-auto">
            <Upload className="w-4 h-4 mr-1.5" /> Upload Document
          </Button>
        </div>

        {/* Alerts */}
        {(expiringDocs.length > 0 || expiredDocs.length > 0) && (
          <div className="space-y-2">
            {expiredDocs.length > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-destructive/30 bg-destructive/5">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <div>
                  <p className="font-medium text-sm text-foreground">{expiredDocs.length} expired</p>
                  <p className="text-xs text-muted-foreground">Upload renewed documents</p>
                </div>
              </div>
            )}
            {expiringDocs.length > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/10">
                <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="font-medium text-sm text-foreground">{expiringDocs.length} expiring within 30 days</p>
                  <p className="text-xs text-muted-foreground">Plan to renew soon</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Documents Grid */}
        {documents.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="w-14 h-14 mx-auto mb-3 text-muted-foreground/40" />
              <h2 className="text-lg font-semibold text-foreground mb-1">No documents uploaded</h2>
              <p className="text-sm text-muted-foreground mb-4">Upload your certifications, vaccinations, and records</p>
              <Button data-testid="upload-first-doc-btn" onClick={openUpload}>Upload Your First Document</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {documents.map((doc) => {
              const status = getExpirationStatus(doc.days_until_expiry);
              return (
                <Card key={doc.id} data-testid={`doc-card-${doc.id}`} className={`transition-colors hover:border-primary/30 ${status === "expired" ? "border-destructive/30" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${status === "expired" ? "bg-destructive/10" : "bg-primary/10"}`}>
                        <FileText className={`w-5 h-5 ${status === "expired" ? "text-destructive" : "text-primary"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{doc.document_type}</p>
                        <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                        {doc.document_tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {doc.document_tags.map((tag) => (
                              <span key={tag} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                <Tag className="w-2 h-2" />{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {getStatusBadge(doc.days_until_expiry)}
                      <div className="flex gap-1">
                        <Button data-testid={`view-doc-${doc.id}`} variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => viewDocument(doc)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button data-testid={`delete-doc-${doc.id}`} variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(doc.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {doc.expiration_date && (
                      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        Expires: {new Date(doc.expiration_date).toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Upload Dialog ─────────────────────────────────── */}
        <Dialog open={showUploadDialog} onOpenChange={(open) => { if (!open) resetUpload(); setShowUploadDialog(open); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {uploadStep !== "category" && (
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 -ml-1 shrink-0"
                    data-testid="upload-back-btn"
                    onClick={() => {
                      if (uploadStep === "file") setUploadStep("type");
                      else if (uploadStep === "type") { setSelectedCategory(""); setSelectedTypes([]); setTypeSearch(""); setUploadStep("category"); }
                    }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                )}
                Upload Document
              </DialogTitle>
              <DialogDescription>
                {uploadStep === "category" && "Select a document category"}
                {uploadStep === "type" && `Select document type${selectedTypes.length > 0 ? ` (${selectedTypes.length} selected)` : ""}`}
                {uploadStep === "file" && "Attach your file"}
              </DialogDescription>
            </DialogHeader>

            {/* Step 1: Category Selection */}
            {uploadStep === "category" && (
              <div data-testid="upload-step-category" className="grid grid-cols-2 gap-2 py-2">
                {Object.entries(DOCUMENT_CATEGORIES).map(([key, cat]) => {
                  const Icon = ICON_MAP[cat.icon] || FileText;
                  return (
                    <button
                      key={key}
                      data-testid={`cat-${key}`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                      onClick={() => { setSelectedCategory(key); setUploadStep("type"); }}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cat.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-sm text-foreground">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 2: Type Selection (searchable + multi-tag) */}
            {uploadStep === "type" && (
              <div data-testid="upload-step-type" className="space-y-3 py-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="type-search-input"
                    placeholder="Search document types..."
                    value={typeSearch}
                    onChange={(e) => setTypeSearch(e.target.value)}
                    className="pl-9 h-9"
                    autoFocus
                  />
                </div>

                {/* Types list — grouped for medical, flat for others */}
                <div className="max-h-[280px] overflow-y-auto space-y-1 -mx-1 px-1">
                  {groups ? (
                    Object.entries(groups).map(([gKey, group]) => {
                      const filtered = group.types.filter((t) => t.toLowerCase().includes(searchLower));
                      if (filtered.length === 0) return null;
                      return (
                        <div key={gKey} className="mb-2">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">{group.label}</p>
                          {filtered.map((type) => (
                            <label
                              key={type}
                              data-testid={`type-option-${type.replace(/[^a-zA-Z0-9]/g, "-")}`}
                              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                                selectedTypes.includes(type) ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                              }`}
                            >
                              <Checkbox
                                checked={selectedTypes.includes(type)}
                                onCheckedChange={() => toggleType(type)}
                                className="shrink-0"
                              />
                              <span className="text-sm text-foreground">{type}</span>
                            </label>
                          ))}
                        </div>
                      );
                    })
                  ) : (
                    allTypes.filter((t) => t.toLowerCase().includes(searchLower)).map((type) => (
                      <label
                        key={type}
                        data-testid={`type-option-${type.replace(/[^a-zA-Z0-9]/g, "-")}`}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                          selectedTypes.includes(type) ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                        }`}
                      >
                        <Checkbox
                          checked={selectedTypes.includes(type)}
                          onCheckedChange={() => toggleType(type)}
                          className="shrink-0"
                        />
                        <span className="text-sm text-foreground">{type}</span>
                      </label>
                    ))
                  )}
                </div>

                {selectedTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                    {selectedTypes.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs gap-1 pr-1">
                        {t}
                        <button onClick={() => toggleType(t)} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  Select one or more types if this file contains multiple documents.
                </p>

                <Button
                  data-testid="type-next-btn"
                  className="w-full"
                  disabled={selectedTypes.length === 0}
                  onClick={() => setUploadStep("file")}
                >
                  Continue with {selectedTypes.length} type{selectedTypes.length !== 1 ? "s" : ""}
                </Button>
              </div>
            )}

            {/* Step 3: File + Expiration */}
            {uploadStep === "file" && (
              <div data-testid="upload-step-file" className="space-y-4 py-2">
                {/* Selected types summary */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedTypes.map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                </div>

                {/* File picker */}
                <div className="space-y-1.5">
                  <Label>File *</Label>
                  <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} className="hidden" />
                  {fileData ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                      <FileText className="w-5 h-5 text-primary shrink-0" />
                      <span className="text-sm truncate flex-1">{fileName}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => { setFileData(null); setFileName(""); }}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button data-testid="select-file-btn" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" /> Select File
                    </Button>
                  )}
                  <p className="text-[10px] text-muted-foreground">PDF, JPG, PNG — max 5MB</p>
                </div>

                {/* Expiration */}
                <div className="space-y-1.5">
                  <Label>Expiration Date (optional)</Label>
                  <Input data-testid="doc-expiration-input" type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">You'll receive a reminder 30 days before expiration</p>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
                  <Button
                    data-testid="confirm-upload-btn"
                    onClick={handleUpload}
                    disabled={uploading || selectedTypes.length === 0 || !fileData}
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* View Document Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedDoc?.document_type}</DialogTitle>
              <DialogDescription>{selectedDoc?.file_name}</DialogDescription>
            </DialogHeader>
            {selectedDoc?.file_data && (
              <div className="mt-2">
                {selectedDoc.file_data.startsWith("data:application/pdf") ? (
                  <iframe src={selectedDoc.file_data} className="w-full h-[500px] rounded-lg border border-border" title="Document Preview" />
                ) : (
                  <img src={selectedDoc.file_data} alt={selectedDoc.document_type} className="w-full max-h-[500px] object-contain rounded-lg" />
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default DocumentsPage;
