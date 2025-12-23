import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MessageCircle, Send, User, Briefcase, MapPin, Clock, Star, FileText, Eye, ArrowLeft, Calendar, Video, AlertCircle, CheckCircle, Shield } from "lucide-react";

const MatchesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showReferencesDialog, setShowReferencesDialog] = useState(false);
  const [references, setReferences] = useState([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [replyProbability, setReplyProbability] = useState(null);
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [interviewData, setInterviewData] = useState({
    proposed_times: [""],
    duration_minutes: 60,
    meeting_type: "video",
    notes: "",
    calendly_link: "",
    zoom_link: ""
  });
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [verifyingLicense, setVerifyingLicense] = useState(false);
  const messagesEndRef = useRef(null);

  const isSeeker = user?.role === "seeker";

  useEffect(() => {
    fetchMatches();
  }, []);

  useEffect(() => {
    if (selectedMatch) {
      fetchMessages(selectedMatch.id);
      fetchReplyProbability(selectedMatch.id);
    }
  }, [selectedMatch]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMatches = async () => {
    try {
      const response = await axios.get(`${API}/matches`);
      setMatches(response.data);
      if (response.data.length > 0 && !selectedMatch) {
        setSelectedMatch(response.data[0]);
      }
    } catch (error) {
      toast.error("Failed to load matches");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (matchId) => {
    try {
      const response = await axios.get(`${API}/matches/${matchId}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error("Failed to load messages");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedMatch) return;

    setSendingMessage(true);
    try {
      await axios.post(`${API}/matches/${selectedMatch.id}/messages`, {
        content: newMessage.trim()
      });
      setNewMessage("");
      fetchMessages(selectedMatch.id);
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const viewReferences = async (userId) => {
    setLoadingRefs(true);
    setShowReferencesDialog(true);
    try {
      const response = await axios.get(`${API}/references/view/${userId}`);
      setReferences(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load references");
      setShowReferencesDialog(false);
    } finally {
      setLoadingRefs(false);
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

  return (
    <DashboardLayout>
      <div data-testid="matches-page" className="h-[calc(100vh-8rem)]">
        <h1 className="text-2xl font-bold text-foreground mb-6">Your Matches</h1>

        {matches.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-semibold text-foreground mb-2">No matches yet</h2>
              <p className="text-muted-foreground mb-6">
                Start swiping to find your perfect match
              </p>
              <Button
                data-testid="start-swiping-matches-btn"
                onClick={() => navigate(isSeeker ? "/seeker/swipe" : "/poster")}
                className="bg-primary hover:bg-primary/90"
              >
                {isSeeker ? "Find Jobs" : "View Candidates"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6 h-full">
            {/* Matches List */}
            <Card className="lg:col-span-1 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Conversations</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-16rem)]">
                  <div className="space-y-1 p-2">
                    {matches.map((match) => (
                      <button
                        key={match.id}
                        data-testid={`match-${match.id}`}
                        onClick={() => setSelectedMatch(match)}
                        className={`w-full p-3 rounded-xl text-left transition-all ${
                          selectedMatch?.id === match.id
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {isSeeker ? (
                              <Briefcase className="w-6 h-6 text-primary" />
                            ) : (
                              <span className="text-lg font-semibold text-primary">
                                {match.seeker?.full_name?.charAt(0) || "?"}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              {isSeeker ? match.job?.title : match.seeker?.full_name}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {isSeeker 
                                ? match.job?.company_name || "Healthcare Facility"
                                : match.seeker?.specialty || "Medical Professional"
                              }
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Chat Area */}
            <Card className="lg:col-span-2 h-full flex flex-col">
              {selectedMatch ? (
                <>
                  {/* Chat Header */}
                  <CardHeader className="border-b border-border pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          {isSeeker ? (
                            <Briefcase className="w-6 h-6 text-primary" />
                          ) : (
                            <span className="text-lg font-semibold text-primary">
                              {selectedMatch.seeker?.full_name?.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {isSeeker ? selectedMatch.job?.title : selectedMatch.seeker?.full_name}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            {isSeeker ? (
                              <>
                                <MapPin className="w-3 h-3" />
                                {selectedMatch.job?.location}
                              </>
                            ) : (
                              <>
                                <Star className="w-3 h-3" />
                                {selectedMatch.seeker?.specialty || "Medical Professional"}
                              </>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      
                      {/* View References Button */}
                      {(isSeeker ? selectedMatch.poster_references_available : selectedMatch.seeker_references_available) && (
                        <Button
                          data-testid="view-references-btn"
                          variant="outline"
                          size="sm"
                          onClick={() => viewReferences(isSeeker ? selectedMatch.poster_id : selectedMatch.seeker_id)}
                        >
                          <FileText className="w-4 h-4 mr-2" /> View References
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>No messages yet. Start the conversation!</p>
                        </div>
                      ) : (
                        messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.sender_id === user?.id ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[70%] p-3 rounded-2xl ${
                                message.sender_id === user?.id
                                  ? "bg-primary text-primary-foreground rounded-br-md"
                                  : "bg-muted text-foreground rounded-bl-md"
                              }`}
                            >
                              <p className="text-sm">{message.content}</p>
                              <p className={`text-xs mt-1 ${
                                message.sender_id === user?.id ? "text-primary-foreground/70" : "text-muted-foreground"
                              }`}>
                                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Message Input */}
                  <div className="p-4 border-t border-border">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <Input
                        data-testid="message-input"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        disabled={sendingMessage}
                        className="flex-1"
                      />
                      <Button
                        data-testid="send-message-btn"
                        type="submit"
                        disabled={sendingMessage || !newMessage.trim()}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <CardContent className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Select a match to start chatting</p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        )}

        {/* References Dialog */}
        <Dialog open={showReferencesDialog} onOpenChange={setShowReferencesDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>References</DialogTitle>
              <DialogDescription>
                Verified references from previous colleagues
              </DialogDescription>
            </DialogHeader>
            
            {loadingRefs ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : references.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No references available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {references.map((ref, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-foreground">{ref.referee_name}</p>
                          <p className="text-sm text-muted-foreground">{ref.relationship}</p>
                        </div>
                        <Badge variant="secondary">
                          Rating: {ref.submission?.rating}/5
                        </Badge>
                      </div>
                      
                      {ref.submission?.strengths?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-foreground mb-1">Strengths</p>
                          <div className="flex flex-wrap gap-1">
                            {ref.submission.strengths.map((strength, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{strength}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="mb-3">
                        <p className="text-sm font-medium text-foreground mb-1">Recommendation</p>
                        <p className="text-sm text-muted-foreground">{ref.submission?.recommendation}</p>
                      </div>
                      
                      {ref.submission?.comments && (
                        <div>
                          <p className="text-sm font-medium text-foreground mb-1">Additional Comments</p>
                          <p className="text-sm text-muted-foreground">{ref.submission.comments}</p>
                        </div>
                      )}
                      
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          Would work with again: {ref.submission?.would_work_again ? "Yes" : "No"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default MatchesPage;
