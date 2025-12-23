import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { RotateCcw, HelpCircle, Heart, X, MapPin, Clock, DollarSign, Briefcase, User, Star, ChevronRight } from "lucide-react";

const SwipeBinsPage = () => {
  const { binType } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(binType || "passed");

  const isSeeker = user?.role === "seeker";

  useEffect(() => {
    fetchProfiles(activeTab);
  }, [activeTab]);

  const fetchProfiles = async (type) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/swipe/bins/${type}`);
      setProfiles(response.data);
    } catch (error) {
      toast.error("Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  const handleReconsider = async (swipeId, newAction) => {
    try {
      const response = await axios.put(`${API}/swipe/bins/${swipeId}/reconsider?new_action=${newAction}`);
      
      if (response.data.matched) {
        toast.success("It's a match!");
        navigate("/matches");
      } else {
        toast.success(newAction === "like" ? "Added to likes!" : newAction === "maybe" ? "Moved to Maybe" : "Passed");
        fetchProfiles(activeTab);
      }
    } catch (error) {
      toast.error("Failed to update");
    }
  };

  const ProfileCard = ({ profile }) => (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="h-32 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
        {isSeeker ? (
          profile.company_logo ? (
            <img src={profile.company_logo} alt="" className="w-full h-full object-cover" />
          ) : (
            <Briefcase className="w-12 h-12 text-primary/50" />
          )
        ) : (
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-primary">
              {profile.full_name?.charAt(0) || "?"}
            </span>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg text-foreground mb-1">
          {isSeeker ? profile.title : profile.full_name}
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          {isSeeker ? profile.company_name || "Healthcare Facility" : profile.specialty || "Medical Professional"}
        </p>
        
        <div className="flex flex-wrap gap-1 mb-4">
          {isSeeker ? (
            <>
              <Badge variant="secondary" className="text-xs">
                <MapPin className="w-3 h-3 mr-1" /> {profile.location}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <DollarSign className="w-3 h-3 mr-1" />
                ${profile.pay_range?.min?.toLocaleString()} - ${profile.pay_range?.max?.toLocaleString()}
              </Badge>
            </>
          ) : (
            <>
              <Badge variant="secondary" className="text-xs">
                <Star className="w-3 h-3 mr-1" /> {profile.years_experience || 0} years exp
              </Badge>
              {profile.specialty && (
                <Badge variant="outline" className="text-xs">
                  {profile.specialty}
                </Badge>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-white"
            onClick={() => handleReconsider(profile.swipe_id, "pass")}
            disabled={activeTab === "passed"}
          >
            <X className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-white"
            onClick={() => handleReconsider(profile.swipe_id, "maybe")}
            disabled={activeTab === "maybe"}
          >
            <HelpCircle className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-secondary hover:bg-secondary/90"
            onClick={() => handleReconsider(profile.swipe_id, "like")}
          >
            <Heart className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {activeTab === "passed" ? "Take Another Look" : "Maybe Later"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {activeTab === "passed" 
              ? "Review profiles you passed on - you might change your mind!" 
              : "Profiles you weren't sure about - make a decision when ready"}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="passed" className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> Take Another Look
            </TabsTrigger>
            <TabsTrigger value="maybe" className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4" /> Maybe
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              {activeTab === "passed" ? (
                <RotateCcw className="w-12 h-12 text-muted-foreground" />
              ) : (
                <HelpCircle className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No {activeTab === "passed" ? "passed" : "maybe"} profiles
            </h2>
            <p className="text-muted-foreground mb-6">
              {activeTab === "passed" 
                ? "You haven't passed on any profiles yet" 
                : "You haven't saved any profiles for later"}
            </p>
            <Button onClick={() => navigate(isSeeker ? "/seeker/swipe" : "/poster")} variant="outline">
              Start Swiping <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((profile) => (
              <ProfileCard key={profile.swipe_id} profile={profile} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SwipeBinsPage;
