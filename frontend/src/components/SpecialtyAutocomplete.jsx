import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, X, Search } from "lucide-react";

/**
 * Format specialty for display:
 * "Registered Nurse (RN) - ICU/Critical Care" → "ICU / Critical Care (RN)"
 * "Licensed Practical Nurse (LPN)" → "LPN"
 * "Physical Therapist (PT)" → "Physical Therapist (PT)"
 */
function formatSpecialty(raw) {
  // Pattern: "Role (ABBR) - Specialty"
  const match = raw.match(/^(.+?)\s*\(([^)]+)\)\s*-\s*(.+)$/);
  if (match) {
    const abbr = match[2].trim();
    const spec = match[3].trim();
    return `${spec} (${abbr})`;
  }
  // Pattern: "Role (ABBR)" with no subspecialty
  const simpleMatch = raw.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (simpleMatch) {
    const role = simpleMatch[1].trim();
    const abbr = simpleMatch[2].trim();
    // Short abbreviations: just show "CNA", "LPN" etc
    if (abbr.length <= 4 && role.split(" ").length > 2) return abbr;
    return `${role} (${abbr})`;
  }
  return raw;
}

const SpecialtyAutocomplete = ({
  value = "",
  allSpecialties = [],
  onChange,
  testId = "specialty-autocomplete",
}) => {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);

  const suggestions = query.length >= 1
    ? allSpecialties.filter((s) =>
        s.toLowerCase().includes(query.toLowerCase()) ||
        formatSpecialty(s).toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  useEffect(() => { setHighlightedIndex(-1); }, [query]);

  const selectSpecialty = (spec) => {
    onChange(spec);
    setQuery("");
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        selectSpecialty(suggestions[highlightedIndex]);
      } else if (suggestions.length > 0) {
        selectSpecialty(suggestions[0]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div data-testid={testId}>
      {/* Selected value as chip */}
      {value && (
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary" className="flex items-center gap-1.5 py-1 px-2.5 text-sm">
            <Stethoscope className="w-3.5 h-3.5" />
            {formatSpecialty(value)}
            <button
              type="button"
              data-testid={`${testId}-clear`}
              onClick={() => onChange("")}
              className="ml-1 hover:text-destructive"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </Badge>
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          data-testid={`${testId}-input`}
          placeholder={value ? "Change specialty..." : "Search specialty (e.g., ICU, Med-Surg, CNA)..."}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => query.length >= 1 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
          className="pl-9"
          autoComplete="off"
        />

        {showSuggestions && suggestions.length > 0 && (
          <div
            data-testid={`${testId}-suggestions`}
            className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto"
          >
            {suggestions.map((spec, i) => (
              <button
                key={spec}
                type="button"
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                  i === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50 text-foreground"
                }`}
                onMouseDown={(e) => { e.preventDefault(); selectSpecialty(spec); }}
                onMouseEnter={() => setHighlightedIndex(i)}
              >
                <Stethoscope className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium">{formatSpecialty(spec)}</span>
                {formatSpecialty(spec) !== spec && (
                  <span className="text-[10px] text-muted-foreground ml-auto truncate max-w-[120px]">{spec.split(" - ")[0]?.split("(")[0]?.trim()}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpecialtyAutocomplete;
export { formatSpecialty };
