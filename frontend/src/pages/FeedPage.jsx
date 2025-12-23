import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Heart, MessageCircle, Image, Send, Globe, Users, Lock, MoreHorizontal, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const FeedPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState("");
  const [postImage, setPostImage] = useState(null);
  const [postVisibility, setPostVisibility] = useState("everyone");
  const [commentPermission, setCommentPermission] = useState("everyone");
  const [isPosting, setIsPosting] = useState(false);
  const [showComments, setShowComments] = useState({});
  const [comments, setComments] = useState({});
  const [newComments, setNewComments] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    try {
      const response = await axios.get(`${API}/feed`);
      setPosts(response.data);
    } catch (error) {
      toast.error("Failed to load feed");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() || newPost.length > 140) return;
    
    setIsPosting(true);
    try {
      const postData = {
        content: newPost,
        visibility: postVisibility,
        comment_permission: commentPermission,
        image_data: postImage
      };
      
      const response = await axios.post(`${API}/feed`, postData);
      setPosts([response.data, ...posts]);
      setNewPost("");
      setPostImage(null);
      toast.success("Post created!");
    } catch (error) {
      toast.error("Failed to create post");
    } finally {
      setIsPosting(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPostImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await axios.post(`${API}/feed/${postId}/like`);
      setPosts(posts.map(p => 
        p.id === postId 
          ? { ...p, user_liked: response.data.liked, likes_count: response.data.likes_count }
          : p
      ));
    } catch (error) {
      toast.error("Failed to like post");
    }
  };

  const handleLoadComments = async (postId) => {
    if (!showComments[postId]) {
      try {
        const response = await axios.get(`${API}/feed/${postId}/comments`);
        setComments(prev => ({ ...prev, [postId]: response.data }));
      } catch (error) {
        toast.error("Failed to load comments");
      }
    }
    setShowComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleComment = async (postId) => {
    const content = newComments[postId];
    if (!content?.trim()) return;
    
    try {
      const response = await axios.post(`${API}/feed/${postId}/comment`, { content });
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), response.data]
      }));
      setPosts(posts.map(p => 
        p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p
      ));
      setNewComments(prev => ({ ...prev, [postId]: "" }));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to comment");
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await axios.delete(`${API}/feed/${postId}`);
      setPosts(posts.filter(p => p.id !== postId));
      toast.success("Post deleted");
    } catch (error) {
      toast.error("Failed to delete post");
    }
  };

  const getVisibilityIcon = (visibility) => {
    switch (visibility) {
      case "everyone": return <Globe className="w-3 h-3" />;
      case "matches_only": return <Users className="w-3 h-3" />;
      default: return <Lock className="w-3 h-3" />;
    }
  };

  const PostCard = ({ post }) => (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.user?.profile_image || post.user?.company_logo} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {post.user?.full_name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-foreground">
                {post.user?.full_name || post.user?.company_name}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                <span className="flex items-center gap-1">
                  {getVisibilityIcon(post.visibility)}
                  {post.visibility === "everyone" ? "Public" : "Matches"}
                </span>
              </div>
            </div>
          </div>
          {post.user_id === user?.id && (
            <Button variant="ghost" size="icon" onClick={() => handleDeletePost(post.id)}>
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-foreground mb-3 whitespace-pre-wrap">{post.content}</p>
        
        {post.image_url && (
          <div className="rounded-xl overflow-hidden mb-3">
            <img src={post.image_url} alt="" className="w-full max-h-96 object-cover" />
          </div>
        )}
        
        <div className="flex items-center gap-4 pt-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className={`flex items-center gap-2 ${post.user_liked ? "text-red-500" : "text-muted-foreground"}`}
            onClick={() => handleLike(post.id)}
          >
            <Heart className={`w-4 h-4 ${post.user_liked ? "fill-current" : ""}`} />
            {post.likes_count || 0}
          </Button>
          
          {post.can_comment && (
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 text-muted-foreground"
              onClick={() => handleLoadComments(post.id)}
            >
              <MessageCircle className="w-4 h-4" />
              {post.comments_count || 0}
            </Button>
          )}
        </div>
        
        {showComments[post.id] && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="space-y-3 mb-3">
              {comments[post.id]?.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-muted text-xs">
                      {comment.user?.full_name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 bg-muted rounded-lg p-2">
                    <p className="text-xs font-medium text-foreground">{comment.user?.full_name}</p>
                    <p className="text-sm text-foreground">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {post.can_comment && (
              <div className="flex gap-2">
                <Input
                  placeholder="Write a comment..."
                  value={newComments[post.id] || ""}
                  onChange={(e) => setNewComments(prev => ({ ...prev, [post.id]: e.target.value }))}
                  onKeyPress={(e) => e.key === "Enter" && handleComment(post.id)}
                  className="flex-1"
                />
                <Button size="icon" onClick={() => handleComment(post.id)}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">Feed</h1>
        
        {/* Create Post Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user?.full_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea
                  placeholder="What's on your mind? (140 characters max)"
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value.slice(0, 140))}
                  className="min-h-[80px] resize-none mb-2"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className={newPost.length > 130 ? "text-destructive" : ""}>
                    {newPost.length}/140
                  </span>
                </div>
                
                {postImage && (
                  <div className="relative mt-2 inline-block">
                    <img src={postImage} alt="" className="max-h-32 rounded-lg" />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 w-6 h-6"
                      onClick={() => setPostImage(null)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Image className="w-5 h-5 text-primary" />
                    </Button>
                    
                    <Select value={postVisibility} onValueChange={setPostVisibility}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="everyone"><Globe className="w-3 h-3 inline mr-1" /> Everyone</SelectItem>
                        <SelectItem value="matches_only"><Users className="w-3 h-3 inline mr-1" /> Matches Only</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={commentPermission} onValueChange={setCommentPermission}>
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="everyone">Comments: All</SelectItem>
                        <SelectItem value="matches_only">Comments: Matches</SelectItem>
                        <SelectItem value="none">Comments: Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button
                    onClick={handleCreatePost}
                    disabled={!newPost.trim() || isPosting}
                    size="sm"
                  >
                    {isPosting ? "Posting..." : "Post"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Feed Posts */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No posts yet. Be the first to share something!</p>
          </div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </DashboardLayout>
  );
};

export default FeedPage;
