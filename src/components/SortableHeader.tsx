import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  className?: string;
}

export function SortableHeader({ label, sortKey, currentSort, currentDir, onSort, className }: SortableHeaderProps) {
  const isActive = currentSort === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn('inline-flex items-center gap-1 hover:text-foreground transition-colors', className)}
    >
      <span>{label}</span>
      {isActive ? (
        currentDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
      ) : (
        <ChevronsUpDown size={12} className="opacity-30" />
      )}
    </button>
  );
}

export function useSortable<T>(data: T[], defaultKey: string, defaultDir: 'asc' | 'desc' = 'asc') {
  const [sortKey, setSortKey] = React.useState(defaultKey);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>(defaultDir);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = React.useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, handleSort };
}

import React from 'react';
