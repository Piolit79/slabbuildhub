import * as React from "react";
import { cn } from "@/lib/utils";

function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value.replace(/[^0-9.-]/g, "")) : value;
  if (isNaN(num) || num === 0) return "";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrency(formatted: string): number {
  return parseFloat(formatted.replace(/[^0-9.-]/g, "")) || 0;
}

interface CurrencyInputProps {
  value?: number | string;
  defaultValue?: number | string;
  onChange?: (value: number) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  name?: string;
  required?: boolean;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, defaultValue, onChange, className, placeholder = "0.00", autoFocus, name, required }, ref) => {
    const [numericValue, setNumericValue] = React.useState(() => {
      const v = value ?? defaultValue ?? 0;
      return typeof v === "string" ? parseFloat(v) || 0 : v;
    });
    const [display, setDisplay] = React.useState(() => {
      return numericValue ? formatCurrency(numericValue) : "";
    });
    const [focused, setFocused] = React.useState(false);

    React.useEffect(() => {
      if (!focused && value !== undefined) {
        const num = typeof value === "string" ? parseFloat(value) || 0 : value;
        setNumericValue(num);
        setDisplay(num ? formatCurrency(num) : "");
      }
    }, [value, focused]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value.replace(/[^0-9.,-]/g, "");
      setDisplay(raw);
      const num = parseCurrency(raw);
      setNumericValue(num);
      onChange?.(num);
    }

    function handleBlur() {
      setFocused(false);
      const num = parseCurrency(display);
      setNumericValue(num);
      setDisplay(num ? formatCurrency(num) : "");
      onChange?.(num);
    }

    function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
      setFocused(true);
      setDisplay(numericValue ? numericValue.toString() : "");
      setTimeout(() => e.target.select(), 0);
    }

    return (
      <div className="relative">
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">
          $
        </span>
        {name && <input type="hidden" name={name} value={numericValue} />}
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          required={required}
          autoFocus={autoFocus}
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background pl-5 pr-2 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm text-right",
            className,
          )}
        />
      </div>
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput, formatCurrency, parseCurrency };
