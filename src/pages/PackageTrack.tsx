import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package, ExternalLink, Search } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrackingRow {
  id: string;
  project_id: string;
  project_name: string;
  room_name: string;
  key: string;
  item: string;
  vendor: string;
  description: string;
  image_url: string;
  tracking_number: string;
  carrier: string;
  delivery_status: string;
  eta: string | null;
  qty: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'not_ordered', label: 'Not Ordered', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'ordered', label: 'Ordered', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'in_production', label: 'In Production', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'shipped', label: 'Shipped', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'in_transit', label: 'In Transit', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { value: 'delayed', label: 'Delayed', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-700 border-green-200' },
];

function getStatusStyle(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-600 border-gray-200';
}

function getStatusLabel(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
}

function getTrackingUrl(carrier: string, tn: string): string {
  const t = tn.replace(/\s/g, '');
  switch (carrier) {
    case 'UPS': return `https://www.ups.com/track?tracknum=${t}`;
    case 'FedEx': return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
    case 'USPS': return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    case 'DHL': return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${t}`;
    default: return '';
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PackageTrack() {
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    // Join items → rooms → projects
    const { data: items, error: itemsErr } = await supabase
      .from('interiors_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (itemsErr || !items) { setLoading(false); return; }

    // Get all rooms and projects
    const roomIds = [...new Set(items.map((i: { room_id: string }) => i.room_id))];
    const projectIds = [...new Set(items.map((i: { project_id: string }) => i.project_id))];

    const [{ data: roomsData }, { data: projectsData }] = await Promise.all([
      roomIds.length > 0 ? supabase.from('interiors_rooms').select('id,name').in('id', roomIds) : Promise.resolve({ data: [] }),
      projectIds.length > 0 ? supabase.from('projects').select('id,name').in('id', projectIds) : Promise.resolve({ data: [] }),
    ]);

    const roomMap = Object.fromEntries((roomsData || []).map((r: { id: string; name: string }) => [r.id, r.name]));
    const projectMap = Object.fromEntries((projectsData || []).map((p: { id: string; name: string }) => [p.id, p.name]));

    const mapped: TrackingRow[] = items.map((i: {
      id: string; project_id: string; room_id: string; key: string; item: string;
      vendor: string; description: string; image_url: string; tracking_number: string;
      carrier: string; delivery_status: string; eta: string | null; qty: number;
    }) => ({
      id: i.id,
      project_id: i.project_id,
      project_name: projectMap[i.project_id] || 'Unknown Project',
      room_name: roomMap[i.room_id] || 'Unknown Room',
      key: i.key,
      item: i.item,
      vendor: i.vendor,
      description: i.description,
      image_url: i.image_url,
      tracking_number: i.tracking_number,
      carrier: i.carrier,
      delivery_status: i.delivery_status,
      eta: i.eta,
      qty: i.qty,
    }));

    setRows(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtering ─────────────────────────────────────────────────────────────────

  const filtered = rows.filter(r => {
    const matchStatus = statusFilter === 'all' || r.delivery_status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || [r.item, r.vendor, r.description, r.tracking_number, r.project_name, r.room_name, r.key]
      .some(v => v?.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  // Group by project
  const grouped = filtered.reduce<Record<string, TrackingRow[]>>((acc, row) => {
    (acc[row.project_name] = acc[row.project_name] || []).push(row);
    return acc;
  }, {});

  // ── Status counts ─────────────────────────────────────────────────────────────
  const counts = STATUS_OPTIONS.slice(1).map(s => ({
    ...s,
    count: rows.filter(r => r.delivery_status === s.value).length,
  })).filter(s => s.count > 0);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Package Track</h1>
        <p className="text-sm text-muted-foreground">Shipping status across all projects</p>
      </div>

      {/* Status summary pills */}
      {counts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {counts.map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(statusFilter === s.value ? 'all' : s.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${s.color} ${statusFilter === s.value ? 'ring-2 ring-offset-1 ring-current' : 'opacity-80 hover:opacity-100'}`}
            >
              {s.label} · {s.count}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search items, vendors, tracking…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm w-64"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-sm w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {/* No results */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
          <Package className="h-8 w-8 opacity-30" />
          <p className="text-sm">No items found</p>
        </div>
      )}

      {/* Grouped tables */}
      {Object.entries(grouped).map(([projectName, projectRows]) => (
        <div key={projectName} className="border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/40 border-b">
            <span className="font-semibold text-sm">{projectName}</span>
            <span className="text-xs text-muted-foreground ml-2">{projectRows.length} item{projectRows.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground bg-muted/10">
                  <th className="px-3 py-2 text-left w-14">Image</th>
                  <th className="px-3 py-2 text-left w-16">Key</th>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Room</th>
                  <th className="px-3 py-2 text-left w-8">Qty</th>
                  <th className="px-3 py-2 text-left">Tracking #</th>
                  <th className="px-3 py-2 text-left w-16">Carrier</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">ETA</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map(row => (
                  <tr key={row.id} className="border-b hover:bg-muted/10 transition-colors">
                    {/* Image */}
                    <td className="px-3 py-2">
                      {row.image_url ? (
                        <img src={row.image_url} alt="" className="w-10 h-10 object-contain rounded border bg-white" />
                      ) : (
                        <div className="w-10 h-10 rounded border bg-muted/20 flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground/20" />
                        </div>
                      )}
                    </td>

                    {/* Key */}
                    <td className="px-3 py-2">
                      <span className="text-xs font-mono text-muted-foreground">{row.key}</span>
                    </td>

                    {/* Item */}
                    <td className="px-3 py-2">
                      <div>
                        <span className="font-medium text-sm">{row.item || '—'}</span>
                        {row.description && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{row.description}</p>}
                      </div>
                    </td>

                    {/* Vendor */}
                    <td className="px-3 py-2 text-xs text-muted-foreground">{row.vendor || '—'}</td>

                    {/* Room */}
                    <td className="px-3 py-2 text-xs text-muted-foreground">{row.room_name}</td>

                    {/* Qty */}
                    <td className="px-3 py-2 text-xs text-center">{row.qty}</td>

                    {/* Tracking */}
                    <td className="px-3 py-2">
                      {row.tracking_number ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono">{row.tracking_number}</span>
                          {getTrackingUrl(row.carrier, row.tracking_number) && (
                            <a
                              href={getTrackingUrl(row.carrier, row.tracking_number)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>

                    {/* Carrier */}
                    <td className="px-3 py-2">
                      <span className="text-xs text-muted-foreground">{row.carrier || '—'}</span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusStyle(row.delivery_status)}`}>
                        {getStatusLabel(row.delivery_status)}
                      </span>
                    </td>

                    {/* ETA */}
                    <td className="px-3 py-2">
                      {row.eta ? (
                        <span className="text-xs">
                          {new Date(row.eta + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
