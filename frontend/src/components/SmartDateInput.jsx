import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";

/**
 * Date input that supports both typing (MM/DD/YYYY, M/D/YY) and native calendar picker.
 * Auto-formats to YYYY-MM-DD for form value, displays as user-friendly format.
 */
export const SmartDateInput = ({ value, onChange, min, max, error, className, ...props }) => {
  const [displayValue, setDisplayValue] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  // When focused, show the text input for fast typing
  // When blurred, show native date input for calendar access
  const handleTextChange = (e) => {
    let raw = e.target.value;
    setDisplayValue(raw);

    // Auto-format: try to parse MM/DD/YYYY or M/D/YY
    const cleaned = raw.replace(/[^0-9/\-]/g, "");
    let match = cleaned.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
    if (match) {
      let [, mm, dd, yyyy] = match;
      if (yyyy.length === 2) yyyy = `20${yyyy}`;
      mm = mm.padStart(2, "0");
      dd = dd.padStart(2, "0");
      const isoDate = `${yyyy}-${mm}-${dd}`;
      // Validate
      const d = new Date(isoDate + "T00:00:00");
      if (!isNaN(d.getTime()) && d.getMonth() + 1 === parseInt(mm)) {
        onChange(isoDate);
      }
    }
  };

  const handleNativeChange = (e) => {
    const val = e.target.value;
    onChange(val);
    setDisplayValue("");
  };

  const formatDisplay = (iso) => {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    return iso;
  };

  if (focused) {
    return (
      <Input
        ref={inputRef}
        type="text"
        value={displayValue || formatDisplay(value)}
        onChange={handleTextChange}
        onBlur={() => { setFocused(false); setDisplayValue(""); }}
        placeholder="MM/DD/YYYY"
        className={`${className || ""} ${error ? "border-red-500" : ""}`}
        autoFocus
        {...props}
        data-testid={props["data-testid"]}
      />
    );
  }

  return (
    <Input
      type="date"
      value={value || ""}
      onChange={handleNativeChange}
      onFocus={() => setFocused(true)}
      min={min}
      max={max}
      className={`${className || ""} ${error ? "border-red-500" : ""}`}
      {...props}
      data-testid={props["data-testid"]}
    />
  );
};
