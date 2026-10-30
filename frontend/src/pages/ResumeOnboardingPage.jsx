import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import {
  Upload, FileText, CheckCircle, AlertTriangle, Clock, Briefcase,
  MapPin, Award, Stethoscope, GraduationCap, Loader2, ArrowRight,
  ArrowLeft, Sparkles, ChevronDown, ChevronUp, Edit, Shield, Star
} from "lucide-react";

const CONFIDENCE_BADGE = {
  high: { label: "High", cls: "bg-green-100 text-green-700" },
  medium: { label: "Med", cls: "bg-amber-100 text-amber-700" },
  low: { label: "Low", cls: "bg-red-100 text-red-700" },
};

const ConfBadge = ({ confidence }) => {
  if (!confidence) return null;
  const c = CONFIDENCE_BADGE[confidence] || CONFIDENCE_BADGE.medium;
  return <Badge variant="outline" className={`text-[8px] px-1 py-0 ${c.cls}`}>{c.label}</Badge>;
};

const EmploymentGroupCard = ({ group, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isTravel = group.group_type === "travel_contract_group" || group.group_type === "staffing_agency_group";
  const count = group.source_assignments?.length || group.assignment_count_estimate || 0;
  return (
    <div className={`rounded-lg border p-3 ${isTravel ? "border-primary/20 bg-primary/5" : "border-border"}`}>
      <button className="w-full text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-medium text-sm text-foreground">{group.display_title || group.role_title || "Position"}</p>
              <ConfBadge confidence={group.confidence} />
              {isTravel && <Badge className="bg-primary/10 text-primary text-[9px] border-0">Travel</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{group.primary_employer}</p>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
              {group.start_date && <span>{group.start_date} — {group.currently_working ? "Present" : group.end_date || ""}</span>}
              {group.locations?.length > 0 && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{group.locations.slice(0, 3).join(", ")}</span>}
              {count > 0 && isTravel && <span>{count} assignment{count !== 1 ? "s" : ""}</span>}
            </div>
          </div>
          {count > 0 && (expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />)}
        </div>
      </button>
      {expanded && group.source_assignments?.length > 0 && (
        <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-primary/20">
          {group.source_assignments.map((a, i) => (
            <div key={i} className="text-xs">
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-foreground">{a.facility_name || a.role_title}</p>
                <ConfBadge confidence={a.confidence} />
              </div>
              <p className="text-muted-foreground">
                {a.location && `${a.location} — `}{a.start_date}{a.end_date ? ` to ${a.end_date}` : ""}{a.unit ? ` (${a.unit})` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
      {group.description_summary && !expanded && (
        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{group.description_summary}</p>
      )}
    </div>
  );
};

const STEPS = ["upload", "parsing", "review", "complete"];

const ResumeOnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState("upload");
  const [selectedFile, setSelectedFile] = useState(null);
  const [pastedText, setPastedText] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsedData, setParsedData] = useState(null);
  const [parseId, setParseId] = useState(null);
  const [applying, setApplying] = useState(false);

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.size > 10 * 1024 * 1024) { toast.error("File too large. Max 10 MB."); return; }
      setSelectedFile(f);
    }
  };

  const handleUploadAndParse = async () => {
    if (!selectedFile && !pastedText.trim()) { toast.error("Please select a file or paste your resume"); return; }
    setStep("parsing");
    try {
      let result;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const res = await axios.post(`${API}/resume/parse/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => { if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100)); },
        });
        result = res.data;
      } else {
        const res = await axios.post(`${API}/resume/parse/text`, { text: pastedText });
        result = res.data;
      }
      if (result.parsed_profile?.error) {
        toast.error(result.parsed_profile.error);
        setStep("upload");
        return;
      }
      setParsedData(result.parsed_profile);
      setParseId(result.parse_id);
      setStep("review");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to parse resume");
      setStep("upload");
    }
  };

  const handleApplyToProfile = async () => {
    if (!parseId) return;
    setApplying(true);
    try {
      await axios.post(`${API}/resume/apply-to-profile/${parseId}`);
      toast.success("Profile updated from resume!");
      setStep("complete");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  const stepIdx = STEPS.indexOf(step);
  const pct = ((stepIdx + 1) / STEPS.length) * 100;

  // Count filled fields for profile completeness
  const fieldCount = parsedData ? [
    parsedData.full_name, parsedData.email, parsedData.phone,
    parsedData.specialties?.length > 0, parsedData.licenses?.length > 0,
    parsedData.certifications?.length > 0, parsedData.education?.length > 0,
    parsedData.employment_groups?.length > 0, parsedData.skills?.length > 0,
  ].filter(Boolean).length : 0;
  const profilePct = parsedData ? Math.round((fieldCount / 9) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => step === "upload" ? navigate("/seeker") : setStep("upload")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> {step === "upload" ? "Dashboard" : "Back"}
          </Button>
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground">Step {stepIdx + 1} of {STEPS.length}</p>
          </div>
          <div className="w-20" />
        </div>
        <Progress value={pct} className="h-1" />
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        {/* ===== STEP 1: Upload ===== */}
        {step === "upload" && (
          <div data-testid="onboarding-upload-step" className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">One profile. Apply everywhere.</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-lg mx-auto">
                Upload your resume to autofill the details we can recognize. Review and edit the results before saving—no AI required.
              </p>
            </div>

            {/* File Upload */}
            <label
              data-testid="resume-file-dropzone"
              className="block cursor-pointer"
            >
              <Card className={`border-2 border-dashed transition-colors ${selectedFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                <CardContent className="py-10 text-center">
                  {selectedFile ? (
                    <>
                      <FileText className="w-12 h-12 mx-auto mb-3 text-primary" />
                      <p className="font-medium text-foreground">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                      <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={(e) => { e.preventDefault(); setSelectedFile(null); }}>
                        Choose different file
                      </Button>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="font-medium text-foreground">Upload your resume</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, or TXT — Max 10 MB</p>
                    </>
                  )}
                </CardContent>
              </Card>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt"
                onChange={handleFileSelect}
              />
            </label>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or paste your resume text</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Textarea
              data-testid="resume-paste-input"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste your resume text here..."
              rows={6}
              className="resize-none"
            />

            <Button
              data-testid="parse-resume-btn"
              size="lg"
              className="w-full"
              onClick={handleUploadAndParse}
              disabled={!selectedFile && !pastedText.trim()}
            >
              <Sparkles className="w-4 h-4 mr-2" /> Build My Profile
            </Button>
          </div>
        )}

        {/* ===== STEP 2: Parsing ===== */}
        {step === "parsing" && (
          <div data-testid="onboarding-parsing-step" className="text-center py-16">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
            <h2 className="text-xl font-bold text-foreground mb-2">Reading your resume...</h2>
            <p className="text-sm text-muted-foreground">Finding work history, certifications, and skills</p>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <Progress value={uploadProgress} className="h-1.5 max-w-xs mx-auto mt-4" />
            )}
          </div>
        )}

        {/* ===== STEP 3: Review ===== */}
        {step === "review" && parsedData && (
          <div data-testid="onboarding-review-step" className="space-y-5">
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Profile {profilePct}% complete</h2>
              <p className="text-sm text-muted-foreground mt-1">Review what we found. You can edit your profile later.</p>
              <Progress value={profilePct} className="h-2 max-w-xs mx-auto mt-3" />
            </div>

            {/* Identity */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-primary" /> Profile Summary
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{parsedData.full_name || "—"}</span></div>
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{parsedData.email || "—"}</span></div>
                  <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{parsedData.phone || "—"}</span></div>
                  <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{parsedData.address?.city ? `${parsedData.address.city}, ${parsedData.address.state}` : "—"}</span></div>
                </div>
                {parsedData.specialties?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {parsedData.specialties.map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                    ))}
                  </div>
                )}
                {parsedData.professional_summary && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{parsedData.professional_summary}</p>
                )}
              </CardContent>
            </Card>

            {/* Licenses & Certifications */}
            {(parsedData.licenses?.length > 0 || parsedData.certifications?.length > 0) && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-primary" /> Licenses & Certifications
                  </h3>
                  <div className="space-y-1.5">
                    {parsedData.licenses?.map((l, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Award className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="font-medium">{l.license_type}</span>
                        <span className="text-muted-foreground">— {l.state}</span>
                        {l.license_number && <span className="text-muted-foreground">#{l.license_number}</span>}
                        {l.compact && <Badge className="bg-blue-100 text-blue-700 text-[8px] border-0">Compact</Badge>}
                        <ConfBadge confidence={l.confidence} />
                      </div>
                    ))}
                    {parsedData.certifications?.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                        <span className="font-medium">{c.name}</span>
                        {c.issuer && <span className="text-muted-foreground">({c.issuer})</span>}
                        {c.expiration_date && <span className="text-muted-foreground">Exp: {c.expiration_date}</span>}
                        <ConfBadge confidence={c.confidence} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Work History */}
            {parsedData.employment_groups?.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-primary" /> Work History
                    <Badge variant="secondary" className="text-[9px] ml-1">{parsedData.work_history_mode || "condensed"}</Badge>
                  </h3>
                  <div className="space-y-2">
                    {parsedData.employment_groups.map((g, i) => (
                      <EmploymentGroupCard key={i} group={g} defaultExpanded={i === 0} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Education */}
            {parsedData.education?.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-primary" /> Education
                  </h3>
                  {parsedData.education.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{e.degree || e.field_of_study}</span>
                      <span className="text-muted-foreground">— {e.institution}</span>
                      {e.end_date && <span className="text-muted-foreground">({e.end_date})</span>}
                      <ConfBadge confidence={e.confidence} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Skills */}
            {parsedData.skills?.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-primary" /> Clinical Skills
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedData.skills.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2 pb-8">
              <Button variant="outline" className="flex-1" onClick={() => navigate("/seeker/profile")} data-testid="edit-profile-btn">
                <Edit className="w-4 h-4 mr-1.5" /> Edit First
              </Button>
              <Button className="flex-1" onClick={handleApplyToProfile} disabled={applying} data-testid="apply-profile-btn">
                {applying ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
                {applying ? "Saving..." : "Use This Profile"}
              </Button>
            </div>
          </div>
        )}

        {/* ===== STEP 4: Complete ===== */}
        {step === "complete" && (
          <div data-testid="onboarding-complete-step" className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Profile Ready!</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Your profile has been built from your resume. You can start finding jobs right away or fine-tune your profile.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
              <Button variant="outline" className="flex-1" onClick={() => navigate("/seeker/profile")} data-testid="go-profile-btn">
                View Profile
              </Button>
              <Button className="flex-1" onClick={() => navigate("/seeker/swipe")} data-testid="find-jobs-btn">
                Find Jobs <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { EmploymentGroupCard, ConfBadge };
export default ResumeOnboardingPage;
