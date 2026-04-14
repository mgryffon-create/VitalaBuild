import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import DashboardLayout from "@/components/DashboardLayout";
import { Calendar, Video, Phone, MapPin, Clock, CheckCircle, XCircle, AlertCircle, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";

// Helper functions moved outside component
const getStatusBadge = (status) => {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="text-amber-500 border-amber-500"><AlertCircle className="w-3 h-3 mr-1" /> Pending</Badge>;
    case "accepted":
      return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Accepted</Badge>;
    case "declined":
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Declined</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getMeetingTypeIcon = (type) => {
  switch (type) {
    case "video": return <Video className="w-4 h-4" />;
    case "phone": return <Phone className="w-4 h-4" />;
    case "in_person": return <MapPin className="w-4 h-4" />;
    default: return <Calendar className="w-4 h-4" />;
  }
};

// InterviewCard moved outside InterviewsPage
const InterviewCard = ({ interview, isSeeker, onRespond }) => (
  <Card className="mb-4">
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between">
        <div>
          <CardTitle className="text-lg">
            {isSeeker ? interview.job?.title : interview.seeker?.full_name}
          </CardTitle>
          <CardDescription>
            {isSeeker ? interview.poster?.full_name : interview.job?.title}
          </CardDescription>
        </div>
        {getStatusBadge(interview.status)}
      </div>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {getMeetingTypeIcon(interview.meeting_type)}
          <span className="capitalize">{interview.meeting_type} Interview</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          {interview.duration_minutes} minutes
        </div>
      </div>
      
      {interview.proposed_times?.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground mb-2">Proposed Times:</p>
          <div className="flex flex-wrap gap-2">
            {interview.proposed_times.map((time, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {format(parseISO(time), "MMM d, yyyy 'at' h:mm a")}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {interview.selected_time && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Scheduled: {format(parseISO(interview.selected_time), "EEEE, MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
      )}
      
      {(interview.calendly_link || interview.zoom_link) && (
        <div className="flex gap-2 mb-4">
          {interview.calendly_link && (
            <Button variant="outline" size="sm" asChild>
              <a href={interview.calendly_link} target="_blank" rel="noopener noreferrer">
                <Calendar className="w-4 h-4 mr-1" /> Calendly
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </Button>
          )}
          {interview.zoom_link && (
            <Button variant="outline" size="sm" asChild>
              <a href={interview.zoom_link} target="_blank" rel="noopener noreferrer">
                <Video className="w-4 h-4 mr-1" /> Join Zoom
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </Button>
          )}
        </div>
      )}
      
      {interview.notes && (
        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-medium">Notes:</span> {interview.notes}
        </p>
      )}
      
      {isSeeker && interview.status === "pending" && (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => onRespond(interview)}>
            <CheckCircle className="w-4 h-4 mr-1" /> Respond
          </Button>
        </div>
      )}
    </CardContent>
  </Card>
);

const InterviewsPage = () => {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [responseDialog, setResponseDialog] = useState(false);
  const [responseData, setResponseData] = useState({ accepted: true, selected_time: "", notes: "" });
  const [integrationSettings, setIntegrationSettings] = useState({});

  const isSeeker = user?.role === "seeker";
  const isPoster = user?.role === "poster";

  const fetchInterviews = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/interview-requests`);
      setInterviews(response.data);
    } catch (error) {
      toast.error("Failed to load interviews");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIntegrationSettings = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/settings/integrations`);
      setIntegrationSettings(response.data);
    } catch (error) {
      console.error("Failed to load integration settings");
    }
  }, []);

  useEffect(() => {
    fetchInterviews();
    if (isPoster) {
      fetchIntegrationSettings();
    }
  }, [fetchInterviews, fetchIntegrationSettings, isPoster]);

  const handleRespond = async () => {
    if (!selectedInterview) return;
    
    try {
      await axios.put(`${API}/interview-requests/${selectedInterview.id}/respond`, responseData);
      toast.success(responseData.accepted ? "Interview accepted!" : "Interview declined");
      setResponseDialog(false);
      fetchInterviews();
    } catch (error) {
      toast.error("Failed to respond");
    }
  };

  const openResponseDialog = (interview) => {
    setSelectedInterview(interview);
    setResponseData({ accepted: true, selected_time: interview.proposed_times?.[0] || "", notes: "" });
    setResponseDialog(true);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <PageHeader title="Interviews" backTo={isSeeker ? "/seeker" : "/poster"} subtitle={isSeeker ? "Manage your interview invitations" : "Track interview requests"} />
        
        {isPoster && (
          <Card className="mb-6 bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <h3 className="font-medium text-foreground mb-2">Integration Settings</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connect your Calendly or Zoom to streamline interview scheduling.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={() => window.open("https://calendly.com", "_blank")}>
                  <Calendar className="w-4 h-4 mr-1" /> 
                  {integrationSettings.calendly_link ? "Connected" : "Connect Calendly"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open("https://zoom.us", "_blank")}>
                  <Video className="w-4 h-4 mr-1" /> 
                  {integrationSettings.zoom_link ? "Connected" : "Connect Zoom"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : interviews.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <Calendar className="w-12 h-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No interviews yet</h2>
            <p className="text-muted-foreground">
              {isSeeker 
                ? "When employers request interviews, they'll appear here" 
                : "Request interviews from your matches to get started"}
            </p>
          </div>
        ) : (
          <div>
            {interviews.map((interview) => (
              <InterviewCard 
                key={interview.id} 
                interview={interview} 
                isSeeker={isSeeker}
                onRespond={openResponseDialog}
              />
            ))}
          </div>
        )}
        
        {/* Response Dialog */}
        <Dialog open={responseDialog} onOpenChange={setResponseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Respond to Interview Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Your Response</Label>
                <RadioGroup
                  value={responseData.accepted ? "accept" : "decline"}
                  onValueChange={(v) => setResponseData(prev => ({ ...prev, accepted: v === "accept" }))}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="accept" id="accept" />
                    <Label htmlFor="accept">Accept</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="decline" id="decline" />
                    <Label htmlFor="decline">Decline</Label>
                  </div>
                </RadioGroup>
              </div>
              
              {responseData.accepted && selectedInterview?.proposed_times?.length > 0 && (
                <div>
                  <Label>Select Time</Label>
                  <Select
                    value={responseData.selected_time}
                    onValueChange={(v) => setResponseData(prev => ({ ...prev, selected_time: v }))}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose a time" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedInterview.proposed_times.map((time, i) => (
                        <SelectItem key={i} value={time}>
                          {format(parseISO(time), "MMM d, yyyy 'at' h:mm a")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={responseData.notes}
                  onChange={(e) => setResponseData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any notes for the employer..."
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResponseDialog(false)}>Cancel</Button>
              <Button onClick={handleRespond}>
                {responseData.accepted ? "Accept Interview" : "Decline"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default InterviewsPage;
