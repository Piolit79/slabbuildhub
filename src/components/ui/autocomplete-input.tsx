import * as React from "react";
import { createPortal } from "react-dom";
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
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});

    const filtered = React.useMemo(() => {
      if (!display) return suggestions.slice(0, 8);
      const lower = display.toLowerCase();
      return suggestions
        .filter(s => s.toLowerCase().includes(lower) && s.toLowerCase() !== lower)
        .slice(0, 8);
    }, [display, suggestions]);

    function updatePosition() {
      const el = inputRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const v = e.target.value;
      if (value === undefined) setInternal(v);
      onChange?.(v);
      setOpen(true);
      setSelectedIdx(-1);
      updatePosition();
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
      } else if (e.key === "Tab") {
        setOpen(false);
      }
    }

    function handleFocus() {
      updatePosition();
      setOpen(true);
    }

    function handleBlur() {
      // Small delay to allow click on dropdown items
      setTimeout(() => setOpen(false), 150);
    }

    function setRefs(el: HTMLInputElement | null) {
      inputRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
    }

    return (
      <>
        {name && <input type="hidden" name={name} value={display} />}
        <input
          ref={setRefs}
          type="text"
          autoFocus={autoFocus}
          required={required}
          value={display}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className,
          )}
        />
        {open && filtered.length > 0 && createPortal(
          <div
            style={dropdownStyle}
            className="rounded-md border border-input bg-background shadow-lg max-h-40 overflow-y-auto"
          >
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
          </div>,
          document.body
        )}
      </>
    );
  },
);
AutocompleteInput.displayName = "AutocompleteInput";

export { AutocompleteInput };
