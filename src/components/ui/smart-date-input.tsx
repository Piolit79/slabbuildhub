import * as React from "react";
import { cn } from "@/lib/utils";

interface SmartDateInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (isoDate: string) => void;
  className?: string;
  autoFocus?: boolean;
  name?: string;
  required?: boolean;
  placeholder?: string;
}

function parseAndCorrect(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Try to split by / - or .
  const parts = trimmed.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let [m, d, y] = parts.map(p => p.trim());
    // Pad month
    if (m.length === 1) m = "0" + m;
    // Pad day
    if (d.length === 1) d = "0" + d;
    // Expand year
    if (y.length === 2) {
      const num = parseInt(y, 10);
      y = (num >= 0 && num <= 99) ? (num > 50 ? "19" + y : "20" + y) : y;
    }
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    const year = parseInt(y, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2099) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }

  // If already ISO format (YYYY-MM-DD), return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  return trimmed;
}

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[2]}/${match[3]}/${match[1].slice(2)}`;
  return iso;
}

const SmartDateInput = React.forwardRef<HTMLInputElement, SmartDateInputProps>(
  ({ value, defaultValue, onChange, className, autoFocus, name, required, placeholder = "MM/DD/YY" }, ref) => {
    const [internal, setInternal] = React.useState(defaultValue ? isoToDisplay(defaultValue) : "");
    const [isoValue, setIsoValue] = React.useState(defaultValue || "");
    const controlled = value !== undefined;

    const display = controlled ? isoToDisplay(value!) : internal;

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;
      if (controlled) {
        // In controlled mode, just pass through during typing
        setInternal(raw);
      } else {
        setInternal(raw);
      }
    }

    function handleBlur() {
      const raw = controlled ? internal || isoToDisplay(value!) : internal;
      const corrected = parseAndCorrect(raw);
      if (corrected && /^\d{4}-\d{2}-\d{2}$/.test(corrected)) {
        setIsoValue(corrected);
        setInternal(isoToDisplay(corrected));
        onChange?.(corrected);
      } else if (!raw.trim()) {
        setIsoValue("");
        setInternal("");
        onChange?.("");
      }
    }

    function handleFocus() {
      // On focus, show the display value for editing
      if (controlled) {
        setInternal(isoToDisplay(value!));
      }
    }

    // Sync internal when controlled value changes externally
    React.useEffect(() => {
      if (controlled) {
        setInternal(isoToDisplay(value!));
        setIsoValue(value!);
      }
    }, [value, controlled]);

    return (
      <>
        {name && <input type="hidden" name={name} value={isoValue} />}
        <input
          ref={ref}
          type="text"
          autoFocus={autoFocus}
          required={required}
          value={controlled ? internal : display}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className,
          )}
        />
      </>
    );
  },
);
SmartDateInput.displayName = "SmartDateInput";

export { SmartDateInput };
