import { useState, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { mockCOIs } from '@/data/mock-coi-data';
import { mockVendors } from '@/data/mock-data';
import { COI } from '@/types';
import { COICard } from '@/components/coi/COICard';
import { COIStatusBadge } from '@/components/coi/COIStatusBadge';
import { COIDetailDialog } from '@/components/coi/COIDetailDialog';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Shield, AlertTriangle, XCircle, CheckCircle2, Search, Bell, CalendarDays, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function InsurancePage() {
  const { selectedProject } = useProject();
  const [selectedCOI, setSelectedCOI] = useState<COI | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const cois = useMemo(() =>
    mockCOIs.filter(c => c.project_id === selectedProject.id),
    [selectedProject.id]
  );

  const filteredCois = useMemo(() => {
    if (!searchQuery) return cois;
    const q = searchQuery.toLowerCase();
    return cois.filter(c =>
      c.insured_name.toLowerCase().includes(q) ||
      c.carrier.toLowerCase().includes(q) ||
      c.policyNumber.toLowerCase().includes(q)
    );
  }, [cois, searchQuery]);

  const activeCois = filteredCois.filter(c => c.is_active !== false);
  const validCount = activeCois.filter(c => c.status === 'valid').length;
  const expiringCount = activeCois.filter(c => c.status === 'expiring').length;
  const expiredCount = activeCois.filter(c => c.status === 'expired').length;

  const alerts = activeCois
    .filter(c => c.status === 'expiring' || c.status === 'expired')
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  // Find linked vendor info
  const getVendorInfo = (coi: COI) => {
    if (!coi.vendor_id) return null;
    return mockVendors.find(v => v.id === coi.vendor_id);
  };

  const stats = [
    { label: 'Total COIs', value: activeCois.length, icon: Shield, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Current', value: validCount, icon: CheckCircle2, color: 'text-status-valid', bg: 'bg-status-valid-bg' },
    { label: 'Expiring Soon', value: expiringCount, icon: AlertTriangle, color: 'text-status-warning', bg: 'bg-status-warning-bg' },
    { label: 'Expired', value: expiredCount, icon: XCircle, color: 'text-status-expired', bg: 'bg-status-expired-bg' },
  ];

  return (
    <div className="max-w-7xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Insurance Tracker</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track certificates of insurance for {selectedProject.name}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="flex items-center gap-4 border border-border p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-status-warning" />
            <h2 className="text-sm font-semibold text-foreground">Expiration Alerts</h2>
            <span className="rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-semibold text-status-warning">{alerts.length}</span>
          </div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
            {alerts.map((coi) => {
              const vendor = getVendorInfo(coi);
              return (
                <Card
                  key={coi.id}
                  className="flex items-center gap-2 border border-border px-3 py-2 cursor-pointer hover:shadow-sm transition-shadow"
                  onClick={() => setSelectedCOI(coi)}
                >
                  <Bell className="h-3 w-3 text-status-warning shrink-0" />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground truncate">{coi.insured_name}</p>
                    {vendor && (
                      <span className="text-[10px] text-primary truncate">— {vendor.detail}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{coi.expirationDate}</span>
                    <COIStatusBadge status={coi.status} daysUntilExpiry={coi.daysUntilExpiry} />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & COI Grid */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, carrier, or policy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <span className="text-xs text-muted-foreground">{filteredCois.length} certificate{filteredCois.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {filteredCois.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredCois.map((coi) => (
            <COICard key={coi.id} coi={coi} onClick={setSelectedCOI} />
          ))}
        </div>
      ) : (
        <Card className="border border-dashed border-border p-8 text-center">
          <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {searchQuery ? 'No certificates match your search.' : 'No certificates of insurance yet for this project.'}
          </p>
        </Card>
      )}

      <COIDetailDialog coi={selectedCOI} onClose={() => setSelectedCOI(null)} />
    </div>
  );
}
