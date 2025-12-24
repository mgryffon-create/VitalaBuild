import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/App";
import { 
  Home, 
  User, 
  FileText, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Briefcase,
  MessageCircle,
  Shield,
  CheckCircle,
  RotateCcw,
  HelpCircle,
  Rss,
  Calendar,
  Stethoscope,
  ClipboardList,
  Gift,
  ChevronDown,
  ChevronRight,
  UserCheck
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSeeker = user?.role === "seeker";

  const navigationItems = isSeeker
    ? [
        { label: "Dashboard", icon: Home, path: "/seeker" },
        { label: "Find Jobs", icon: Stethoscope, path: "/seeker/swipe" },
        { label: "My Profile", icon: User, path: "/seeker/profile" },
        { label: "Licenses", icon: Shield, path: "/seeker/licenses" },
        { label: "Documents", icon: FileText, path: "/seeker/documents" },
        { label: "My Offers", icon: Gift, path: "/seeker/offers" },
        { label: "Matches", icon: MessageCircle, path: "/matches" },
        { label: "Take Another Look", icon: RotateCcw, path: "/bins/passed" },
        { label: "Maybe", icon: HelpCircle, path: "/bins/maybe" },
        { label: "Interviews", icon: Calendar, path: "/interviews" },
        { label: "Feed", icon: Rss, path: "/feed" },
        { label: "References", icon: Users, path: "/references" },
        { label: "Settings", icon: Settings, path: "/settings" },
      ]
    : [
        { label: "Dashboard", icon: Home, path: "/poster" },
        { label: "Post Job", icon: Briefcase, path: "/poster/jobs/new" },
        { label: "Company Profile", icon: User, path: "/poster/profile" },
        { label: "Hiring Suite", icon: ClipboardList, path: "/poster/hiring" },
        { label: "Verify Licenses", icon: CheckCircle, path: "/poster/verifications" },
        { label: "Matches", icon: MessageCircle, path: "/matches" },
        { label: "Take Another Look", icon: RotateCcw, path: "/bins/passed" },
        { label: "Maybe", icon: HelpCircle, path: "/bins/maybe" },
        { label: "Interviews", icon: Calendar, path: "/interviews" },
        { label: "Feed", icon: Rss, path: "/feed" },
        { label: "References", icon: Users, path: "/references" },
        { label: "Settings", icon: Settings, path: "/settings" },
      ];

  const isActive = (path) => {
    if (path === "/seeker" || path === "/poster") {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const NavContent = ({ mobile = false }) => (
    <div className={`flex flex-col h-full ${mobile ? "" : ""}`}>
      {/* Logo */}
      <div className="p-4 border-b border-border bg-primary/5">
        <div 
          className="flex items-center justify-center cursor-pointer" 
          onClick={() => navigate("/")}
        >
          <img 
            src="/images/vitalamatch-logo.png" 
            alt="VitalaMatch" 
            className="h-12 w-auto"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => (
          <button
            key={item.path}
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => {
              navigate(item.path);
              if (mobile) setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
              isActive(item.path)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-semibold">
              {user?.full_name?.charAt(0) || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{user?.full_name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>
        <Button
          data-testid="logout-btn"
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col bg-card border-r border-border">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img 
              src="/images/vitalamatch-logo.png" 
              alt="VitalaMatch" 
              className="h-8 w-auto"
            />
          </div>
          
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="mobile-menu-btn">
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <NavContent mobile />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="pt-16 lg:pt-0 min-h-screen">
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
