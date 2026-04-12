import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  BookOpen, Award, FileText, Clock, CheckCircle, AlertTriangle,
  ArrowLeft, ExternalLink, Play, GraduationCap, Calendar
} from "lucide-react";

const STATUS_META = {
  not_started: { label: "Not Started", cls: "bg-muted text-muted-foreground", icon: Clock },
  in_progress: { label: "In Progress", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Play },
  completed: { label: "Completed", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  expired: { label: "Expired", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertTriangle },
  waived: { label: "Waived", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: CheckCircle },
};

const TrainingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [transcript, setTranscript] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [aRes, tRes, cRes] = await Promise.all([
        axios.get(`${API}/training/assignments`),
        axios.get(`${API}/training/transcript`),
        axios.get(`${API}/training/certificates`),
      ]);
      setAssignments(aRes.data);
      setTranscript(tRes.data);
      setCertificates(cRes.data);
    } catch {
      toast.error("Failed to load training data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStartTraining = async (assignment) => {
    if (assignment.course?.launch_url) {
      window.open(assignment.course.launch_url, "_blank");
    }
    if (assignment.completion_status === "not_started") {
      try {
        await axios.put(`${API}/training/assignments/${assignment.id}`, { completion_status: "in_progress" });
        fetchData();
      } catch { /* ignore */ }
    }
  };

  const totalCredits = transcript.reduce((sum, a) => sum + (a.course?.credit_hours || 0), 0);
  const pending = assignments.filter((a) => a.completion_status !== "completed" && a.completion_status !== "waived");
  const overdue = pending.filter((a) => a.due_date && new Date(a.due_date) < new Date());

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div data-testid="training-page" className="space-y-5 max-w-5xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/seeker")} className="shrink-0 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Training & Compliance</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Your training assignments, transcripts, and certificates</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: "Assigned", value: assignments.length, icon: BookOpen, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600" },
            { label: "Completed", value: transcript.length, icon: CheckCircle, color: "bg-green-100 dark:bg-green-900/30 text-green-600" },
            { label: "Overdue", value: overdue.length, icon: AlertTriangle, color: overdue.length > 0 ? "bg-red-100 dark:bg-red-900/30 text-red-600" : "bg-muted text-muted-foreground" },
            { label: "CE Credits", value: totalCredits, icon: GraduationCap, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                  <s.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="assigned" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="assigned" data-testid="tab-assigned">Assigned ({assignments.length})</TabsTrigger>
            <TabsTrigger value="transcript" data-testid="tab-transcript">Transcript ({transcript.length})</TabsTrigger>
            <TabsTrigger value="certificates" data-testid="tab-certificates">Certificates ({certificates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="assigned">
            {assignments.length === 0 ? (
              <Card><CardContent className="py-10 text-center">
                <BookOpen className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No training assigned yet</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => {
                  const sm = STATUS_META[a.completion_status] || STATUS_META.not_started;
                  const Icon = sm.icon;
                  const isOverdue = a.due_date && new Date(a.due_date) < new Date() && a.completion_status !== "completed";
                  return (
                    <Card key={a.id} data-testid={`assignment-${a.id}`} className={isOverdue ? "border-red-300 dark:border-red-700" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${sm.cls}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground">{a.course?.title || "Training"}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                              {a.course?.credit_hours > 0 && <span>{a.course.credit_hours} {a.course.credit_type || "CEU"}</span>}
                              {a.course?.duration_minutes > 0 && <span>{a.course.duration_minutes} min</span>}
                              {a.due_date && (
                                <span className={`flex items-center gap-0.5 ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                                  <Calendar className="w-3 h-3" /> Due: {a.due_date.slice(0, 10)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className={`text-[9px] ${sm.cls}`}>{sm.label}</Badge>
                            {a.completion_status !== "completed" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleStartTraining(a)} data-testid={`start-${a.id}`}>
                                <ExternalLink className="w-3 h-3 mr-1" /> Start
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transcript">
            {transcript.length === 0 ? (
              <Card><CardContent className="py-10 text-center">
                <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No completed training yet</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {transcript.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground">{a.course?.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Completed: {a.completion_date?.slice(0, 10) || "N/A"}
                          {a.course?.credit_hours > 0 && ` — ${a.course.credit_hours} ${a.course.credit_type || "CEU"}`}
                          {a.score !== null && a.score !== undefined && ` — Score: ${a.score}%`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="certificates">
            {certificates.length === 0 ? (
              <Card><CardContent className="py-10 text-center">
                <Award className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No certificates earned yet</p>
              </CardContent></Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {certificates.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground">{a.course?.title}</p>
                        <p className="text-xs text-muted-foreground">{a.completion_date?.slice(0, 10)}</p>
                      </div>
                      {a.certificate_url && (
                        <a href={a.certificate_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="w-3.5 h-3.5" /></Button>
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default TrainingPage;
