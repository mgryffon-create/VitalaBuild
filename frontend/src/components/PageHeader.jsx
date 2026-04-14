import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

/**
 * Consistent page header with back navigation.
 * @param {string} title - Page title
 * @param {string} [backTo] - Explicit fallback route (used when no history)
 * @param {React.ReactNode} [actions] - Optional right-side action buttons
 * @param {string} [subtitle] - Optional subtitle text
 */
export const PageHeader = ({ title, backTo, actions, subtitle }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else if (backTo) {
      navigate(backTo);
    }
  };

  return (
    <div className="flex items-center gap-2 mb-3" data-testid="page-header">
      {backTo && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleBack}
          data-testid="page-back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
};
