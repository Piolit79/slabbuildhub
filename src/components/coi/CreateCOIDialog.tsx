import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreateCOIDialogProps {
  projectId: string;
}

export function CreateCOIDialog({ projectId }: CreateCOIDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    subcontractor: '',
    company: '',
    gl_policy_number: '',
    gl_carrier: '',
    gl_effective_date: '',
    gl_expiration_date: '',
    gl_coverage_limit: '',
    labor_law_coverage: 'unknown',
    action_over: 'unknown',
    hammer_clause: 'unknown',
    wc_policy_number: '',
    wc_carrier: '',
    wc_effective_date: '',
    wc_expiration_date: '',
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const setSelect = (key: string) => (val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Save to database when Cloud tables are set up
    toast({ title: 'COI added', description: `${form.subcontractor} certificate saved (mock — database coming soon)` });
    setOpen(false);
    setForm({
      subcontractor: '', company: '',
      gl_policy_number: '', gl_carrier: '', gl_effective_date: '', gl_expiration_date: '', gl_coverage_limit: '',
      labor_law_coverage: 'unknown', action_over: 'unknown', hammer_clause: 'unknown',
      wc_policy_number: '', wc_carrier: '', wc_effective_date: '', wc_expiration_date: '',
    });
  };

  const provisionSelect = (label: string, key: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={(form as any)[key]} onValueChange={setSelect(key)}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="included">Included</SelectItem>
          <SelectItem value="excluded">Excluded</SelectItem>
          <SelectItem value="unknown">Unknown</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><Plus className="h-4 w-4" />Add COI</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Certificate of Insurance</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Subcontractor Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Insured Name</Label>
              <Input value={form.subcontractor} onChange={set('subcontractor')} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Company</Label>
              <Input value={form.company} onChange={set('company')} required />
            </div>
          </div>

          {/* GL Policy */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">GL Policy</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Policy Number</Label>
                <Input value={form.gl_policy_number} onChange={set('gl_policy_number')} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Carrier</Label>
                <Input value={form.gl_carrier} onChange={set('gl_carrier')} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Effective Date</Label>
                <Input type="date" value={form.gl_effective_date} onChange={set('gl_effective_date')} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expiration Date</Label>
                <Input type="date" value={form.gl_expiration_date} onChange={set('gl_expiration_date')} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Coverage Limit</Label>
                <Input value={form.gl_coverage_limit} onChange={set('gl_coverage_limit')} placeholder="e.g. $2,000,000" />
              </div>
            </div>
          </div>

          {/* Provisions */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Provisions</h4>
            <div className="grid grid-cols-3 gap-3">
              {provisionSelect('Labor Law', 'labor_law_coverage')}
              {provisionSelect('Action Over', 'action_over')}
              {provisionSelect('Hammer Clause', 'hammer_clause')}
            </div>
          </div>

          {/* WC Policy */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Workers' Comp</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Policy Number</Label>
                <Input value={form.wc_policy_number} onChange={set('wc_policy_number')} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Carrier</Label>
                <Input value={form.wc_carrier} onChange={set('wc_carrier')} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Effective Date</Label>
                <Input type="date" value={form.wc_effective_date} onChange={set('wc_effective_date')} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expiration Date</Label>
                <Input type="date" value={form.wc_expiration_date} onChange={set('wc_expiration_date')} />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full">
            Add COI
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
