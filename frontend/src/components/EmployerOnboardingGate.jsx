import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";

const EmployerOnboardingGate = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [pass, setPass] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "poster") {
      setPass(true);
      setChecked(true);
      return;
    }
    let cancelled = false;
    axios.get(`${API}/profile/completion`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        if (data.complete) {
          setPass(true);
        } else {
          navigate("/poster/onboarding", { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) setPass(true);
      })
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, [user, navigate]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return pass ? children : null;
};

export default EmployerOnboardingGate;
