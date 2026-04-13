import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

/**
 * InlineAutocomplete — Single-value typeahead that replaces raw text inputs.
 * Shows suggestions as user types. Selection fills the input value.
 * Allows custom entry if no match.
 */
const InlineAutocomplete = ({
  value = "",
  onChange,
  suggestions = [],
  placeholder = "",
  testId = "inline-autocomplete",
  className = "",
  showIcon = false,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);

  const filtered = value.length >= 1
    ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()).slice(0, 6)
    : [];

  useEffect(() => { setHighlightedIndex(-1); }, [value]);

  const selectItem = (item) => {
    onChange(item);
    setShowDropdown(false);
    inputRef.current?.blur();
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
        selectItem(filtered[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    } else if (e.key === "Tab" && filtered.length > 0 && highlightedIndex >= 0) {
      selectItem(filtered[highlightedIndex]);
    }
  };

  return (
    <div className="relative" data-testid={testId}>
      {showIcon && (
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
      )}
      <Input
        ref={inputRef}
        data-testid={`${testId}-input`}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => value.length >= 1 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={showIcon ? `pl-9 ${className}` : className}
        autoComplete="off"
      />
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map((item, i) => (
            <button
              key={item}
              type="button"
              className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                i === highlightedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted/50 text-foreground"
              }`}
              onMouseDown={(e) => { e.preventDefault(); selectItem(item); }}
              onMouseEnter={() => setHighlightedIndex(i)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default InlineAutocomplete;
