import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { FileText, Upload, Trash2, AlertTriangle, CheckCircle, Clock, Eye, X, Calendar } from "lucide-react";

const DocumentsPage = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    document_type: "",
    expiration_date: "",
    file: null,
    fileName: ""
  });
  const fileInputRef = useRef(null);

  const documentTypes = [
    "TB Test",
    "COVID-19 Vaccination",
    "MMR Vaccination",
    "MMR Titers",
    "Annual Physical",
    "BLS Certification",
    "ACLS Certification",
    "PALS Certification",
    "State License",
    "DEA License",
    "NPI Certificate",
    "Professional Liability Insurance",
    "Background Check",
    "Drug Screen",
    "Other"
  ];

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API}/documents`);
      setDocuments(response.data);
    } catch (error) {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF, JPG, and JPEG files are allowed");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadForm(prev => ({
        ...prev,
        file: reader.result,
        fileName: file.name
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!uploadForm.document_type || !uploadForm.file) {
      toast.error("Please select a document type and file");
      return;
    }

    setUploading(true);
    try {
      await axios.post(`${API}/documents`, {
        document_type: uploadForm.document_type,
        expiration_date: uploadForm.expiration_date || null,
        file_data: uploadForm.file,
        file_name: uploadForm.fileName
      });
      
      toast.success("Document uploaded successfully");
      setShowUploadDialog(false);
      setUploadForm({ document_type: "", expiration_date: "", file: null, fileName: "" });
      fetchDocuments();
    } catch (error) {
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    try {
      await axios.delete(`${API}/documents/${docId}`);
      toast.success("Document deleted");
      setDocuments(documents.filter(d => d.id !== docId));
    } catch (error) {
      toast.error("Failed to delete document");
    }
  };

  const viewDocument = async (doc) => {
    try {
      const response = await axios.get(`${API}/documents/${doc.id}`);
      setSelectedDoc(response.data);
      setShowViewDialog(true);
    } catch (error) {
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
        return <Badge className="bg-destructive text-destructive-foreground">Expired</Badge>;
      case "expiring":
        return <Badge className="badge-expiring">{daysUntilExpiry} days left</Badge>;
      case "warning":
        return <Badge className="badge-warning">{daysUntilExpiry} days left</Badge>;
      case "valid":
        return <Badge className="badge-valid">Valid</Badge>;
      default:
        return <Badge variant="outline">No expiration</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const expiringDocs = documents.filter(d => d.days_until_expiry !== null && d.days_until_expiry <= 30 && d.days_until_expiry > 0);
  const expiredDocs = documents.filter(d => d.days_until_expiry !== null && d.days_until_expiry <= 0);

  return (
    <DashboardLayout>
      <div data-testid="documents-page" className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Documents</h1>
            <p className="text-muted-foreground mt-1">
              Manage your certifications and medical records
            </p>
          </div>
          <Button
            data-testid="upload-document-btn"
            onClick={() => setShowUploadDialog(true)}
            className="bg-primary hover:bg-primary/90"
          >
            <Upload className="w-4 h-4 mr-2" /> Upload Document
          </Button>
        </div>

        {/* Alerts */}
        {(expiringDocs.length > 0 || expiredDocs.length > 0) && (
          <div className="space-y-3">
            {expiredDocs.length > 0 && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {expiredDocs.length} document{expiredDocs.length > 1 ? "s" : ""} expired
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Please upload renewed documents as soon as possible
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {expiringDocs.length > 0 && (
              <Card className="border-accent/50 bg-accent/5">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {expiringDocs.length} document{expiringDocs.length > 1 ? "s" : ""} expiring within 30 days
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Plan to renew these documents soon
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Documents Grid */}
        {documents.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-semibold text-foreground mb-2">No documents uploaded</h2>
              <p className="text-muted-foreground mb-6">
                Upload your certifications, licenses, and medical records
              </p>
              <Button
                data-testid="upload-first-doc-btn"
                onClick={() => setShowUploadDialog(true)}
                className="bg-primary hover:bg-primary/90"
              >
                Upload Your First Document
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <Card key={doc.id} className="hover-lift">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        getExpirationStatus(doc.days_until_expiry) === "expired"
                          ? "bg-destructive/10"
                          : getExpirationStatus(doc.days_until_expiry) === "expiring"
                          ? "bg-red-500/10"
                          : "bg-primary/10"
                      }`}>
                        <FileText className={`w-6 h-6 ${
                          getExpirationStatus(doc.days_until_expiry) === "expired"
                            ? "text-destructive"
                            : getExpirationStatus(doc.days_until_expiry) === "expiring"
                            ? "text-red-500"
                            : "text-primary"
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{doc.document_type}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {doc.file_name}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between">
                    {getStatusBadge(doc.days_until_expiry)}
                    <div className="flex gap-1">
                      <Button
                        data-testid={`view-doc-${doc.id}`}
                        variant="ghost"
                        size="sm"
                        onClick={() => viewDocument(doc)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        data-testid={`delete-doc-${doc.id}`}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {doc.expiration_date && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Expires: {new Date(doc.expiration_date).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload your certification, license, or medical record
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select
                  value={uploadForm.document_type}
                  onValueChange={(value) => setUploadForm(prev => ({ ...prev, document_type: value }))}
                >
                  <SelectTrigger data-testid="doc-type-select">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Expiration Date (Optional)</Label>
                <Input
                  data-testid="doc-expiration-input"
                  type="date"
                  value={uploadForm.expiration_date}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, expiration_date: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  You'll receive a reminder 30 days before expiration
                </p>
              </div>

              <div className="space-y-2">
                <Label>File</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {uploadForm.file ? (
                  <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="text-sm truncate max-w-[200px]">{uploadForm.fileName}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadForm(prev => ({ ...prev, file: null, fileName: "" }))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    data-testid="select-file-btn"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" /> Select File
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Accepted formats: PDF, JPG, JPEG (max 5MB)
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                Cancel
              </Button>
              <Button
                data-testid="confirm-upload-btn"
                onClick={handleUpload}
                disabled={uploading || !uploadForm.document_type || !uploadForm.file}
                className="bg-primary hover:bg-primary/90"
              >
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </DialogFooter>
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
              <div className="mt-4">
                {selectedDoc.file_data.startsWith("data:application/pdf") ? (
                  <iframe
                    src={selectedDoc.file_data}
                    className="w-full h-[500px] rounded-lg border border-border"
                    title="Document Preview"
                  />
                ) : (
                  <img
                    src={selectedDoc.file_data}
                    alt={selectedDoc.document_type}
                    className="w-full max-h-[500px] object-contain rounded-lg"
                  />
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
