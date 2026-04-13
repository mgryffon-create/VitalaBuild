import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Search, Plus, Sparkles } from "lucide-react";

/**
 * SuggestionInput — Searchable typeahead for adding items from a suggestion list.
 * Supports: search filtering, one-tap suggested chips, custom entry fallback, duplicate prevention.
 */
const SuggestionInput = ({
  items = [],
  suggestions = [],
  onAdd,
  onRemove,
  placeholder = "Search or type to add...",
  maxItems = 10,
  testId = "suggestion-input",
  chipVariant = "outline",
}) => {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);

  const normalizedItems = items.map((i) => (typeof i === "string" ? i : i?.name || "").toLowerCase());

  // Filter suggestions by query and exclude already-added items
  const filtered = query.length >= 1
    ? suggestions.filter(
        (s) => s.toLowerCase().includes(query.toLowerCase()) && !normalizedItems.includes(s.toLowerCase())
      ).slice(0, 6)
    : [];

  // Unselected suggestions for the quick-tap chips (not yet added, no query needed)
  const quickSuggestions = suggestions.filter(
    (s) => !normalizedItems.includes(s.toLowerCase())
  ).slice(0, 6);

  useEffect(() => { setHighlightedIndex(-1); }, [query]);

  const addItem = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (normalizedItems.includes(trimmed.toLowerCase())) return; // prevent duplicates
    if (items.length >= maxItems) return;
    onAdd(trimmed);
    setQuery("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
        addItem(filtered[highlightedIndex]);
      } else if (query.trim()) {
        // Custom entry — allow if no suggestion matched
        addItem(query.trim());
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const atMax = items.length >= maxItems;

  return (
    <div data-testid={testId} className="space-y-3">
      {/* Quick-tap suggestion chips (when input is empty and not at max) */}
      {!atMax && quickSuggestions.length > 0 && !query && (
        <div data-testid={`${testId}-quick-suggestions`}>
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Suggested for your specialty
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quickSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                data-testid={`${testId}-quick-${s.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 30)}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 transition-colors"
                onClick={() => addItem(s)}
              >
                <Plus className="w-3 h-3" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search input */}
      {!atMax && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            data-testid={`${testId}-input`}
            placeholder={placeholder}
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

          {/* Suggestion dropdown */}
          {showSuggestions && filtered.length > 0 && (
            <div
              data-testid={`${testId}-dropdown`}
              className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
            >
              {filtered.map((item, i) => (
                <button
                  key={item}
                  type="button"
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    i === highlightedIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/50 text-foreground"
                  }`}
                  onMouseDown={(e) => { e.preventDefault(); addItem(item); }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          {/* Show "add custom" hint when typing something not in suggestions */}
          {showSuggestions && query.trim() && filtered.length === 0 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 text-foreground"
                onMouseDown={(e) => { e.preventDefault(); addItem(query.trim()); }}
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                Add &ldquo;{query.trim()}&rdquo;
              </button>
            </div>
          )}
        </div>
      )}

      {/* Selected items as chips/tags */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, index) => {
            const label = typeof item === "string" ? item : item?.name || "";
            return (
              <Badge
                key={`${label}-${index}`}
                variant={chipVariant}
                className="flex items-center gap-1 pr-1"
              >
                {label}
                <button
                  type="button"
                  data-testid={`${testId}-remove-${index}`}
                  onClick={() => onRemove(index)}
                  className="ml-0.5 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SuggestionInput;
