import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  CreditCard, ArrowLeft, CheckCircle, Zap, Crown, Building, Shield,
  Briefcase, BarChart, Sparkles, Loader2, FileText, Clock, ArrowRight
} from "lucide-react";

const TIER_META = {
  free: { icon: Briefcase, color: "text-muted-foreground bg-muted", label: "Free" },
  growth: { icon: Zap, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30", label: "Growth" },
  pro: { icon: Crown, color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30", label: "Pro" },
  enterprise: { icon: Building, color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30", label: "Enterprise" },
};

const TIER_FEATURES = {
  free: ["Post jobs", "Limited candidate visibility"],
  growth: ["Unlimited job posts", "Full candidate access", "Basic filters", "Messaging"],
  pro: ["Verified candidate filtering", "Reference visibility", "Priority matching", "Autofill access"],
  enterprise: ["Full automation tools", "Compliance integrations", "Multi-location support", "API access"],
};

const BillingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [usage, setUsage] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);
  const [polling, setPolling] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [planRes, invRes, usageRes, priceRes] = await Promise.all([
        axios.get(`${API}/billing/my-plan`),
        axios.get(`${API}/billing/invoices`),
        axios.get(`${API}/billing/usage`),
        axios.get(`${API}/billing/pricing`),
      ]);
      setPlan(planRes.data);
      setInvoices(invRes.data);
      setUsage(usageRes.data);
      setPricing(priceRes.data);
    } catch {
      toast.error("Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Poll for checkout status on return from Stripe
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId || polling) return;
    setPolling(true);
    let attempts = 0;
    const poll = async () => {
      if (attempts >= 5) { setPolling(false); return; }
      attempts++;
      try {
        const res = await axios.get(`${API}/billing/checkout-status/${sessionId}`);
        if (res.data.payment_status === "paid") {
          toast.success("Payment successful!");
          setPolling(false);
          fetchData();
          navigate("/poster/billing", { replace: true });
          return;
        }
        if (res.data.status === "expired") {
          toast.error("Payment session expired");
          setPolling(false);
          return;
        }
      } catch { /* retry */ }
      setTimeout(poll, 2000);
    };
    poll();
  }, [searchParams, polling, fetchData, navigate]);

  const handleUpgrade = async (tier) => {
    setUpgrading(tier);
    try {
      const res = await axios.post(`${API}/billing/subscribe`, {
        tier,
        origin_url: window.location.origin,
      });
      window.location.href = res.data.checkout_url;
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start checkout");
      setUpgrading(null);
    }
  };

  const handlePayInvoice = async (invoiceId) => {
    try {
      const res = await axios.post(`${API}/billing/pay-invoice/${invoiceId}`);
      window.location.href = res.data.checkout_url;
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start payment");
    }
  };

  const handleBuyAddon = async (addonType) => {
    try {
      const res = await axios.post(`${API}/billing/addon`, {
        addon_type: addonType,
        origin_url: window.location.origin,
      });
      window.location.href = res.data.checkout_url;
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start purchase");
    }
  };

  const currentTier = plan?.subscription_tier || "free";

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div data-testid="billing-page" className="space-y-6 max-w-5xl">
        {polling && (
          <div className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center">
            <div className="text-center"><Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Processing payment...</p></div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/poster")} className="shrink-0 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Billing & Plans</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Manage your subscription, view invoices, and purchase add-ons</p>
          </div>
        </div>

        {/* Current Plan + Usage */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-3">
                {(() => { const TIcon = TIER_META[currentTier]?.icon || Briefcase; return <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${TIER_META[currentTier]?.color || "bg-muted"}`}><TIcon className="w-5 h-5" /></div>; })()}
                <div>
                  <p className="font-semibold text-foreground">{TIER_META[currentTier]?.label || "Free"} Plan</p>
                  <p className="text-xs text-muted-foreground">
                    {currentTier === "free" ? "No monthly charge" : `$${pricing?.tiers?.[currentTier]?.price || 0}/mo`}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                {TIER_FEATURES[currentTier]?.map((f, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3 text-green-600 shrink-0" /> {f}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <BarChart className="w-4 h-4 text-primary" /> Usage Summary
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Jobs Posted", value: usage?.jobs_posted || 0 },
                  { label: "Hires", value: usage?.hires || 0 },
                  { label: "Boosts Used", value: usage?.boosts_used || 0 },
                  { label: "Add-ons", value: usage?.addons_purchased || 0 },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plans */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">Plans</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(TIER_META).map(([tier, meta]) => {
              const price = pricing?.tiers?.[tier]?.price || 0;
              const isCurrent = tier === currentTier;
              const isUpgrade = ["free", "growth", "pro", "enterprise"].indexOf(tier) > ["free", "growth", "pro", "enterprise"].indexOf(currentTier);
              const TIcon = meta.icon;
              return (
                <Card key={tier} data-testid={`plan-card-${tier}`} className={`${isCurrent ? "ring-2 ring-primary" : ""}`}>
                  <CardContent className="p-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${meta.color}`}>
                      <TIcon className="w-4 h-4" />
                    </div>
                    <p className="font-semibold text-foreground text-sm">{meta.label}</p>
                    <p className="text-lg font-bold text-foreground">{price === 0 ? "Free" : `$${price}`}<span className="text-xs font-normal text-muted-foreground">{price > 0 ? "/mo" : ""}</span></p>
                    <div className="space-y-0.5 mt-2 mb-3">
                      {TIER_FEATURES[tier]?.map((f, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <CheckCircle className="w-2.5 h-2.5 text-green-600 shrink-0" /> {f}
                        </p>
                      ))}
                    </div>
                    {isCurrent ? (
                      <Badge className="w-full justify-center bg-primary/10 text-primary border-0">Current Plan</Badge>
                    ) : isUpgrade ? (
                      <Button size="sm" className="w-full text-xs" onClick={() => handleUpgrade(tier)} disabled={upgrading === tier} data-testid={`upgrade-${tier}`}>
                        {upgrading === tier ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ArrowRight className="w-3 h-3 mr-1" />}
                        Upgrade
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full text-xs" disabled>Included</Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Add-ons */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">Add-ons</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pricing?.addons && Object.entries(pricing.addons).map(([key, addon]) => (
              <Card key={key} data-testid={`addon-card-${key}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {key === "boosted_job" ? <Sparkles className="w-4 h-4 text-primary" /> : <Shield className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{addon.name}</p>
                    <p className="text-xs text-muted-foreground">{addon.description}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleBuyAddon(key)} data-testid={`buy-addon-${key}`}>
                    ${addon.price}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Invoices */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">Recent Transactions</h2>
          {invoices.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {invoices.slice(0, 10).map((txn) => (
                <Card key={txn.id} data-testid={`txn-${txn.id}`}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      txn.payment_status === "paid" ? "bg-green-100 text-green-600" :
                      txn.payment_status === "invoice_pending" ? "bg-amber-100 text-amber-600" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {txn.payment_status === "paid" ? <CheckCircle className="w-4 h-4" /> :
                       txn.payment_status === "invoice_pending" ? <Clock className="w-4 h-4" /> :
                       <CreditCard className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {txn.type === "subscription" ? `${txn.tier} Plan` :
                         txn.type === "hire_fee" ? `Hire Fee (${txn.role_type || "N/A"})` :
                         txn.type === "addon" ? `Add-on: ${txn.addon_type}` :
                         txn.type}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{txn.created_at?.slice(0, 10)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">${txn.amount?.toFixed(2)}</p>
                      <Badge variant="outline" className={`text-[8px] ${
                        txn.payment_status === "paid" ? "bg-green-100 text-green-700" :
                        txn.payment_status === "invoice_pending" ? "bg-amber-100 text-amber-700" :
                        "bg-muted text-muted-foreground"
                      }`}>{txn.payment_status}</Badge>
                    </div>
                    {txn.payment_status === "invoice_pending" && (
                      <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => handlePayInvoice(txn.id)} data-testid={`pay-invoice-${txn.id}`}>
                        Pay Now
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default BillingPage;
