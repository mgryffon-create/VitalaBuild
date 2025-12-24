import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import { Heart, Star, CheckCircle, Send, User, AlertCircle } from "lucide-react";

const ReferenceSubmitPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [requestInfo, setRequestInfo] = useState(null);
  const [form, setForm] = useState({
    token: token,
    rating: 0,
    strengths: [],
    areas_for_improvement: "",
    recommendation: "",
    comments: "",
    would_work_again: false
  });

  const [newStrength, setNewStrength] = useState("");

  const strengthOptions = [
    "Clinical Skills",
    "Communication",
    "Teamwork",
    "Leadership",
    "Problem Solving",
    "Time Management",
    "Patient Care",
    "Attention to Detail",
    "Adaptability",
    "Professionalism",
    "Technical Skills",
    "Critical Thinking"
  ];

  const recommendationOptions = [
    "Highly Recommend",
    "Recommend",
    "Recommend with Reservations",
    "Do Not Recommend"
  ];

  const fetchRequestInfo = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/references/submit/${token}`);
      setRequestInfo(response.data);
    } catch (error) {
      setError(error.response?.data?.detail || "Reference request not found or already completed");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRequestInfo();
  }, [fetchRequestInfo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (form.rating === 0) {
      toast.error("Please provide a rating");
      return;
    }
    if (!form.recommendation) {
      toast.error("Please select a recommendation");
      return;
    }
    if (!form.comments.trim()) {
      toast.error("Please provide comments");
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/references/submit/${token}`, form);
      setSubmitted(true);
      toast.success("Reference submitted successfully!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit reference");
    } finally {
      setSubmitting(false);
    }
  };

  const addStrength = (strength) => {
    if (!form.strengths.includes(strength)) {
      setForm(prev => ({ ...prev, strengths: [...prev.strengths, strength] }));
    }
  };

  const removeStrength = (strength) => {
    setForm(prev => ({ ...prev, strengths: prev.strengths.filter(s => s !== strength) }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">Request Not Found</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate("/")} variant="outline">
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-secondary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Thank You!</h1>
            <p className="text-muted-foreground mb-6">
              Your reference has been submitted successfully. {requestInfo?.requester_name} will appreciate your feedback.
            </p>
            <Button onClick={() => navigate("/")} className="bg-primary hover:bg-primary/90">
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground font-['Manrope']">VitalaMatch</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div data-testid="reference-submit-page" className="space-y-6">
          {/* Info Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reference request from</p>
                  <h2 className="text-xl font-bold text-foreground">{requestInfo?.requester_name}</h2>
                  <p className="text-muted-foreground mt-1">
                    {requestInfo?.referee_name}, you&apos;ve been asked to provide a{" "}
                    {requestInfo?.reference_type === "facility" ? "facility review" : "professional reference"}.
                  </p>
                  {requestInfo?.message && (
                    <p className="mt-3 p-3 bg-card rounded-lg text-sm italic text-muted-foreground">
                      &quot;{requestInfo.message}&quot;
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating */}
            <Card>
              <CardHeader>
                <CardTitle>Overall Rating</CardTitle>
                <CardDescription>
                  How would you rate {requestInfo?.requester_name} overall?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      data-testid={`rating-${rating}`}
                      onClick={() => setForm(prev => ({ ...prev, rating }))}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                        form.rating >= rating
                          ? "bg-secondary text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                      }`}
                    >
                      <Star className={`w-6 h-6 ${form.rating >= rating ? "fill-current" : ""}`} />
                    </button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {form.rating === 0 && "Select a rating"}
                  {form.rating === 1 && "Poor"}
                  {form.rating === 2 && "Below Average"}
                  {form.rating === 3 && "Average"}
                  {form.rating === 4 && "Good"}
                  {form.rating === 5 && "Excellent"}
                </p>
              </CardContent>
            </Card>

            {/* Strengths */}
            <Card>
              <CardHeader>
                <CardTitle>Key Strengths</CardTitle>
                <CardDescription>
                  Select or add strengths you observed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {strengthOptions.map((strength) => (
                    <button
                      key={strength}
                      type="button"
                      onClick={() => 
                        form.strengths.includes(strength) 
                          ? removeStrength(strength) 
                          : addStrength(strength)
                      }
                      className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                        form.strengths.includes(strength)
                          ? "bg-secondary text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                      }`}
                    >
                      {strength}
                    </button>
                  ))}
                </div>
                {form.strengths.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <span className="text-sm text-muted-foreground">Selected:</span>
                    {form.strengths.map((strength) => (
                      <Badge key={strength} variant="secondary">
                        {strength}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Areas for Improvement */}
            <Card>
              <CardHeader>
                <CardTitle>Areas for Improvement</CardTitle>
                <CardDescription>
                  Optional - Any constructive feedback
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  data-testid="improvement-input"
                  value={form.areas_for_improvement}
                  onChange={(e) => setForm(prev => ({ ...prev, areas_for_improvement: e.target.value }))}
                  placeholder="Any areas where they could improve..."
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* Recommendation */}
            <Card>
              <CardHeader>
                <CardTitle>Recommendation *</CardTitle>
                <CardDescription>
                  Would you recommend {requestInfo?.requester_name}?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={form.recommendation}
                  onValueChange={(value) => setForm(prev => ({ ...prev, recommendation: value }))}
                >
                  <SelectTrigger data-testid="recommendation-select">
                    <SelectValue placeholder="Select recommendation" />
                  </SelectTrigger>
                  <SelectContent>
                    {recommendationOptions.map((rec) => (
                      <SelectItem key={rec} value={rec}>{rec}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Comments */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Comments *</CardTitle>
                <CardDescription>
                  Please provide detailed feedback
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  data-testid="comments-input"
                  value={form.comments}
                  onChange={(e) => setForm(prev => ({ ...prev, comments: e.target.value }))}
                  placeholder="Share your experience working with this person..."
                  rows={5}
                  required
                />
              </CardContent>
            </Card>

            {/* Would Work Again */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="would_work_again"
                    data-testid="would-work-again-checkbox"
                    checked={form.would_work_again}
                    onCheckedChange={(checked) => 
                      setForm(prev => ({ ...prev, would_work_again: checked }))
                    }
                  />
                  <Label htmlFor="would_work_again" className="cursor-pointer">
                    I would work with {requestInfo?.requester_name} again
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end">
              <Button
                data-testid="submit-reference-btn"
                type="submit"
                disabled={submitting}
                className="bg-primary hover:bg-primary/90"
              >
                <Send className="w-4 h-4 mr-2" />
                {submitting ? "Submitting..." : "Submit Reference"}
              </Button>
            </div>
          </form>

          {/* Privacy Note */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Privacy Note:</strong> Your reference will remain confidential. 
                {requestInfo?.requester_name} will not see the content of your reference. 
                It will only be shared with potential employers after a job match is confirmed.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ReferenceSubmitPage;
