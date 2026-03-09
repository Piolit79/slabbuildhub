import * as React from "react";
import { cn } from "@/lib/utils";

interface AutocompleteInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  suggestions: string[];
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  name?: string;
  required?: boolean;
}

const AutocompleteInput = React.forwardRef<HTMLInputElement, AutocompleteInputProps>(
  ({ value, defaultValue, onChange, suggestions, className, placeholder, autoFocus, name, required }, ref) => {
    const [internal, setInternal] = React.useState(defaultValue || "");
    const display = value !== undefined ? value : internal;
    const [open, setOpen] = React.useState(false);
    const [selectedIdx, setSelectedIdx] = React.useState(-1);
    const wrapperRef = React.useRef<HTMLDivElement>(null);

    const filtered = React.useMemo(() => {
      if (!display) return suggestions.slice(0, 8);
      const lower = display.toLowerCase();
      return suggestions
        .filter(s => s.toLowerCase().includes(lower) && s.toLowerCase() !== lower)
        .slice(0, 8);
    }, [display, suggestions]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const v = e.target.value;
      if (value === undefined) setInternal(v);
      onChange?.(v);
      setOpen(true);
      setSelectedIdx(-1);
    }

    function select(s: string) {
      if (value === undefined) setInternal(s);
      onChange?.(s);
      setOpen(false);
      setSelectedIdx(-1);
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if (!open || filtered.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && selectedIdx >= 0) {
        e.preventDefault();
        select(filtered[selectedIdx]);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }

    React.useEffect(() => {
      function handleClick(e: MouseEvent) {
        if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    return (
      <div ref={wrapperRef} className="relative">
        {name && <input type="hidden" name={name} value={display} />}
        <input
          ref={ref}
          type="text"
          autoFocus={autoFocus}
          required={required}
          value={display}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className,
          )}
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 mt-0.5 w-full rounded-md border border-input bg-background shadow-md max-h-40 overflow-y-auto">
            {filtered.map((s, i) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(s); }}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-xs truncate hover:bg-accent hover:text-accent-foreground",
                  i === selectedIdx && "bg-accent text-accent-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);
AutocompleteInput.displayName = "AutocompleteInput";

export { AutocompleteInput };
