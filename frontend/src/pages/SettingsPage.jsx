import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import DashboardLayout from "@/components/DashboardLayout";
import { Bell, Mail, Phone, Save, Settings as SettingsIcon, Smartphone, Download, CheckCircle, XCircle } from "lucide-react";
import { 
  isPushNotificationSupported, 
  getNotificationPermission, 
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications
} from "@/utils/pushNotifications";

const SettingsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [preferences, setPreferences] = useState({
    email_enabled: true,
    sms_enabled: false,
    phone_number: "",
    frequency: "immediate",
    match_notifications: true,
    message_notifications: true,
    document_reminders: true,
    push_enabled: false
  });

  useEffect(() => {
    fetchPreferences();
    checkPushStatus();
    checkInstallStatus();
    
    // Listen for install prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => setIsInstalled(true));
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const checkPushStatus = async () => {
    const supported = isPushNotificationSupported();
    setPushSupported(supported);
    
    if (supported) {
      setPushPermission(getNotificationPermission());
      
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setPushSubscribed(!!subscription);
      }
    }
  };

  const checkInstallStatus = () => {
    // Check if running as installed PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    setIsInstalled(isStandalone);
  };

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      toast.info("App is already installed or installation not available");
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast.success("VitalaMatch installed successfully!");
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleEnablePush = async () => {
    const granted = await requestNotificationPermission();
    
    if (granted) {
      setPushPermission('granted');
      
      const registration = await navigator.serviceWorker.ready;
      const subscription = await subscribeToPushNotifications(registration);
      
      if (subscription) {
        setPushSubscribed(true);
        setPreferences(prev => ({ ...prev, push_enabled: true }));
        toast.success("Push notifications enabled!");
        
        // Send subscription to server
        try {
          await axios.post(`${API}/notifications/push-subscription`, {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
              auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))
            }
          });
        } catch (error) {
          console.error("Failed to save push subscription to server");
        }
      }
    } else {
      setPushPermission('denied');
      toast.error("Notification permission denied");
    }
  };

  const handleDisablePush = async () => {
    const unsubscribed = await unsubscribeFromPushNotifications();
    if (unsubscribed) {
      setPushSubscribed(false);
      setPreferences(prev => ({ ...prev, push_enabled: false }));
      toast.success("Push notifications disabled");
    }
  };

  const fetchPreferences = async () => {
    try {
      const response = await axios.get(`${API}/notifications/preferences`);
      if (response.data) {
        setPreferences(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.error("Failed to load preferences");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/notifications/preferences`, preferences);
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
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
      <div data-testid="settings-page" className="max-w-2xl mx-auto space-y-6">
        <PageHeader title="Settings" backTo="/seeker" subtitle="Manage your notification preferences" actions={
          <Button data-testid="save-settings-btn" onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
            <Save className="w-4 h-4 mr-2" />{saving ? "Saving..." : "Save Changes"}
          </Button>
        } />

        {/* Install App Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Install VitalaMatch App
            </CardTitle>
            <CardDescription>
              Install VitalaMatch on your device for the best experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isInstalled ? (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  VitalaMatch is installed on your device!
                </AlertDescription>
              </Alert>
            ) : deferredPrompt ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Add VitalaMatch to your home screen for quick access and offline support.
                </p>
                <Button onClick={handleInstallApp} className="bg-primary hover:bg-primary/90">
                  <Download className="w-4 h-4 mr-2" /> Install App
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  To install VitalaMatch, open this site in Chrome, Safari, or Edge and look for the &quot;Add to Home Screen&quot; or &quot;Install&quot; option in your browser menu.
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="px-2 py-1 bg-muted rounded">Chrome: Menu → Install app</span>
                  <span className="px-2 py-1 bg-muted rounded">Safari: Share → Add to Home Screen</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Push Notifications Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Push Notifications
            </CardTitle>
            <CardDescription>
              Receive instant notifications on your device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!pushSupported ? (
              <Alert>
                <XCircle className="w-4 h-4" />
                <AlertDescription>
                  Push notifications are not supported in your browser. Try using Chrome, Firefox, or Edge.
                </AlertDescription>
              </Alert>
            ) : pushPermission === 'denied' ? (
              <Alert className="border-destructive">
                <XCircle className="w-4 h-4 text-destructive" />
                <AlertDescription>
                  Notification permission was denied. Please enable notifications in your browser settings to receive alerts.
                </AlertDescription>
              </Alert>
            ) : pushSubscribed ? (
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">Push notifications enabled</p>
                    <p className="text-sm text-green-600 dark:text-green-500">You&apos;ll receive instant alerts for matches, messages, and offers.</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDisablePush}>
                  Disable
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Enable push notifications</p>
                  <p className="text-sm text-muted-foreground">Get instant alerts for new matches, messages, and offers.</p>
                </div>
                <Button onClick={handleEnablePush} className="bg-primary hover:bg-primary/90">
                  Enable
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notification Channels */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Email & SMS Notifications
            </CardTitle>
            <CardDescription>
              Choose how you want to receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
              </div>
              <Switch
                data-testid="email-toggle"
                checked={preferences.email_enabled}
                onCheckedChange={(checked) => 
                  setPreferences(prev => ({ ...prev, email_enabled: checked }))
                }
              />
            </div>

            {/* SMS Notifications */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">SMS Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive text message notifications
                    </p>
                  </div>
                </div>
                <Switch
                  data-testid="sms-toggle"
                  checked={preferences.sms_enabled}
                  onCheckedChange={(checked) => 
                    setPreferences(prev => ({ ...prev, sms_enabled: checked }))
                  }
                />
              </div>
              
              {preferences.sms_enabled && (
                <div className="ml-13 pl-13">
                  <Label htmlFor="phone_number" className="text-sm">Phone Number</Label>
                  <Input
                    data-testid="phone-number-input"
                    id="phone_number"
                    value={preferences.phone_number || ""}
                    onChange={(e) => 
                      setPreferences(prev => ({ ...prev, phone_number: e.target.value }))
                    }
                    placeholder="+1 (555) 123-4567"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Include country code (e.g., +1 for US)
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notification Frequency */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-primary" />
              Notification Frequency
            </CardTitle>
            <CardDescription>
              Control how often you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={preferences.frequency}
                onValueChange={(value) => 
                  setPreferences(prev => ({ ...prev, frequency: value }))
                }
              >
                <SelectTrigger data-testid="frequency-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="daily">Daily Digest</SelectItem>
                  <SelectItem value="weekly">Weekly Summary</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {preferences.frequency === "immediate" && "Get notified as soon as something happens"}
                {preferences.frequency === "daily" && "Receive a daily summary of all notifications"}
                {preferences.frequency === "weekly" && "Get a weekly recap of activity"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notification Types */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Types</CardTitle>
            <CardDescription>
              Choose which types of notifications you want to receive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">Match Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Get notified when you match with a {user?.role === "seeker" ? "job" : "candidate"}
                </p>
              </div>
              <Switch
                data-testid="match-notifications-toggle"
                checked={preferences.match_notifications}
                onCheckedChange={(checked) => 
                  setPreferences(prev => ({ ...prev, match_notifications: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between py-2 border-t border-border">
              <div>
                <p className="font-medium text-foreground">Message Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Get notified when you receive a new message
                </p>
              </div>
              <Switch
                data-testid="message-notifications-toggle"
                checked={preferences.message_notifications}
                onCheckedChange={(checked) => 
                  setPreferences(prev => ({ ...prev, message_notifications: checked }))
                }
              />
            </div>

            {user?.role === "seeker" && (
              <div className="flex items-center justify-between py-2 border-t border-border">
                <div>
                  <p className="font-medium text-foreground">Document Reminders</p>
                  <p className="text-sm text-muted-foreground">
                    Get reminded 30 days before documents expire
                  </p>
                </div>
                <Switch
                  data-testid="document-reminders-toggle"
                  checked={preferences.document_reminders}
                  onCheckedChange={(checked) => 
                    setPreferences(prev => ({ ...prev, document_reminders: checked }))
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium text-foreground">{user?.email}</span>
            </div>
            <div className="flex justify-between py-2 border-t border-border">
              <span className="text-muted-foreground">Account Type</span>
              <span className="font-medium text-foreground capitalize">{user?.role}</span>
            </div>
            <div className="flex justify-between py-2 border-t border-border">
              <span className="text-muted-foreground">Member Since</span>
              <span className="font-medium text-foreground">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
