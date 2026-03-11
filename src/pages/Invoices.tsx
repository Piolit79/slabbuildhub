import React, { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { Plus, Printer, Trash2, Eye, Check, X } from 'lucide-react';
import { Contract, Vendor } from '@/types';
import { format } from 'date-fns';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

interface Invoice {
  id: string;
  project_id: string;
  invoice_number: string;
  date: string;
  status: 'draft' | 'sent' | 'paid';
  notes: string;
  created_at: string;
}

interface ClientProfile {
  full_name: string;
  email: string;
}

const statusColor = (s: string) => {
  if (s === 'paid') return '#5a9e6f';
  if (s === 'sent') return '#7b9ec3';
  return '#a89a7c';
};

export default function InvoicesPage() {
  const { selectedProject } = useProject();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newData, setNewData] = useState({ invoice_number: '', date: '', notes: '' });

  useEffect(() => {
    const pid = selectedProject.id;

    supabase.from('invoices' as any).select('*').eq('project_id', pid).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setInvoices(data as Invoice[]); });

    supabase.from('contracts').select('*').eq('project_id', pid)
      .then(({ data }) => { if (data) setContracts(data as Contract[]); });

    supabase.from('project_vendors' as any).select('vendor_id').eq('project_id', pid)
      .then(async ({ data: pvs }) => {
        if (pvs && (pvs as any[]).length) {
          const ids = (pvs as any[]).map(pv => pv.vendor_id);
          const { data: vs } = await supabase.from('vendors' as any).select('*').in('id', ids);
          if (vs) setVendors(vs as Vendor[]);
        }
      });

    supabase.from('profiles').select('full_name, email').eq('project_id', pid).eq('user_type', 'client')
      .then(({ data }) => {
        if (data && (data as any[]).length) setClientProfile((data as any[])[0] as ClientProfile);
        else setClientProfile(null);
      });
  }, [selectedProject.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const invoice: Invoice = {
      id: crypto.randomUUID(),
      project_id: selectedProject.id,
      invoice_number: newData.invoice_number,
      date: newData.date,
      status: 'draft',
      notes: newData.notes,
      created_at: new Date().toISOString(),
    };
    await supabase.from('invoices' as any).insert(invoice);
    setInvoices(prev => [invoice, ...prev]);
    setNewOpen(false);
    setNewData({ invoice_number: '', date: '', notes: '' });
    setViewInvoice(invoice);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('invoices' as any).delete().eq('id', id);
    setInvoices(prev => prev.filter(i => i.id !== id));
    setConfirmDeleteId(null);
    if (viewInvoice?.id === id) setViewInvoice(null);
  };

  const updateStatus = async (id: string, status: Invoice['status']) => {
    await supabase.from('invoices' as any).update({ status }).eq('id', id);
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    if (viewInvoice?.id === id) setViewInvoice(prev => prev ? { ...prev, status } : null);
  };

  const contractTotal = contracts.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: '#7b7c81' }}>Invoices</h1>
        <Button size="sm" onClick={() => setNewOpen(true)}><Plus size={14} className="mr-1" /> New Invoice</Button>
      </div>

      {/* Invoice List */}
      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No invoices yet. Click "New Invoice" to generate one.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <div className="text-sm font-medium">#{inv.invoice_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {inv.date ? format(new Date(inv.date), 'MM.dd.yyyy') : '—'}
                      </div>
                    </div>
                    <Badge className="text-[10px] px-1.5 py-0 text-white" style={{ backgroundColor: statusColor(inv.status) }}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {confirmDeleteId === inv.id ? (
                      <>
                        <span className="text-[10px] text-muted-foreground mr-1">Delete?</span>
                        <button onClick={() => handleDelete(inv.id)} className="text-destructive hover:opacity-70"><Check size={13} /></button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-muted-foreground hover:text-foreground ml-1"><X size={13} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setViewInvoice(inv)} className="text-muted-foreground hover:text-foreground p-1.5"><Eye size={14} /></button>
                        <button onClick={() => setConfirmDeleteId(inv.id)} className="text-muted-foreground/40 hover:text-destructive p-1.5"><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Invoice Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Invoice #</Label>
              <Input
                className="h-8 text-xs"
                value={newData.invoice_number}
                onChange={e => setNewData(d => ({ ...d, invoice_number: e.target.value }))}
                required
                placeholder="e.g. 2025-001"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <SmartDateInput
                className="h-8 text-xs"
                value={newData.date}
                onChange={v => setNewData(d => ({ ...d, date: v }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                className="text-xs min-h-[60px]"
                value={newData.notes}
                onChange={e => setNewData(d => ({ ...d, notes: e.target.value }))}
                placeholder="Optional notes for this invoice..."
              />
            </div>
            <Button type="submit" size="sm" className="w-full">Create &amp; Preview</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invoice Preview Dialog */}
      <Dialog open={!!viewInvoice} onOpenChange={() => setViewInvoice(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewInvoice && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-4">
                <Select value={viewInvoice.status} onValueChange={v => updateStatus(viewInvoice.id, v as Invoice['status'])}>
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => window.print()}>
                  <Printer size={14} className="mr-1" /> Print
                </Button>
              </div>

              {/* Printable Invoice Body */}
              <div className="bg-white text-gray-900 p-8 rounded border font-sans text-sm">
                {/* Header */}
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <div className="text-2xl font-bold tracking-tight text-gray-800">SLAB Builders</div>
                    <div className="text-xs text-gray-400 mt-0.5 tracking-wide">Design + Build</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-200 tracking-widest uppercase">Invoice</div>
                    <div className="text-base font-semibold text-gray-700 mt-1">#{viewInvoice.invoice_number}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {viewInvoice.date ? format(new Date(viewInvoice.date), 'MMMM d, yyyy') : ''}
                    </div>
                  </div>
                </div>

                {/* Bill To / Project */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Bill To</div>
                    {clientProfile ? (
                      <>
                        <div className="font-semibold text-gray-800">{clientProfile.full_name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{clientProfile.email}</div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-400 italic">No client linked to this project</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Project</div>
                    <div className="font-semibold text-gray-800">{selectedProject.name}</div>
                    {selectedProject.address && (
                      <div className="text-xs text-gray-500 mt-0.5">{selectedProject.address}</div>
                    )}
                  </div>
                </div>

                {/* Contract Line Items */}
                <div className="mb-6">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Contract Items</div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 text-[11px] font-semibold text-gray-400 w-20">Date</th>
                        <th className="text-left py-2 text-[11px] font-semibold text-gray-400">Description</th>
                        <th className="text-left py-2 text-[11px] font-semibold text-gray-400 w-24">Type</th>
                        <th className="text-right py-2 text-[11px] font-semibold text-gray-400 w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-xs text-gray-400 italic">No contracts on this project</td>
                        </tr>
                      )}
                      {contracts.map((c, idx) => (
                        <tr key={c.id} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                          <td className="py-1.5 text-xs text-gray-500 tabular-nums">
                            {c.date ? format(new Date(c.date), 'MM.dd.yy') : ''}
                          </td>
                          <td className="py-1.5 text-xs text-gray-800">{c.name}</td>
                          <td className="py-1.5 text-xs text-gray-500">{c.type}</td>
                          <td className={`py-1.5 text-xs text-right tabular-nums ${c.amount < 0 ? 'text-green-600' : 'text-gray-800'}`}>
                            {fmt(c.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Total */}
                <div className="flex justify-end mb-8">
                  <div className="w-52 border-t border-gray-200 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</span>
                      <span className="text-base font-bold text-gray-800">{fmt(contractTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Vendors */}
                {vendors.length > 0 && (
                  <div className="mb-6">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Vendors &amp; Subcontractors</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {vendors.map(v => (
                        <div key={v.id} className="text-xs text-gray-700">
                          <span className="font-medium">{v.name}</span>
                          {v.detail && <span className="text-gray-400"> — {v.detail}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {viewInvoice.notes && (
                  <div className="border-t border-gray-100 pt-4">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Notes</div>
                    <div className="text-xs text-gray-600 whitespace-pre-wrap">{viewInvoice.notes}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
