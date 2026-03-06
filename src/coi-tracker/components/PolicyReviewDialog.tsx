import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Search, Loader2, AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PolicyReviewDialogProps {
  coiId: string;
  filePath: string;
  subcontractorName: string;
}

interface Finding {
  category: string;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  recommendation?: string;
}

interface ReviewResult {
  overall_rating: string;
  summary: string;
  findings: Finding[];
  additional_insured_status: string;
  subrogation_waiver: string;
}

const ratingStyles: Record<string, { bg: string; text: string; label: string }> = {
  FAVORABLE: { bg: 'bg-status-valid-bg', text: 'text-status-valid', label: 'Favorable' },
  ACCEPTABLE: { bg: 'bg-primary/10', text: 'text-primary', label: 'Acceptable' },
  NEEDS_REVIEW: { bg: 'bg-status-warning-bg', text: 'text-status-warning', label: 'Needs Review' },
  UNFAVORABLE: { bg: 'bg-status-expired-bg', text: 'text-status-expired', label: 'Unfavorable' },
};

const riskIcons = {
  HIGH: AlertTriangle,
  MEDIUM: Info,
  LOW: CheckCircle2,
};

const riskColors = {
  HIGH: 'text-status-expired',
  MEDIUM: 'text-status-warning',
  LOW: 'text-status-valid',
};

export function PolicyReviewDialog({ coiId, filePath, subcontractorName }: PolicyReviewDialogProps) {
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const runReview = async () => {
    setLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review-policy`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ coi_id: coiId, file_path: filePath }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Review failed' }));
        throw new Error(err.error || 'Review failed');
      }
      const data = await resp.json();
      setReview(data.review);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Review failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <Search className="h-3.5 w-3.5" />
          Review Policy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            GL Policy Review — {subcontractorName}
          </DialogTitle>
        </DialogHeader>

        {!review && !loading && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              AI will analyze the GL policy for labor law exclusions, hammer clauses, action over exclusions, and other provisions that could transfer liability to you as the GC.
            </p>
            <Button onClick={runReview} className="gap-2">
              <Search className="h-4 w-4" />
              Start Deep Review
            </Button>
          </div>
        )}

        {loading && (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Analyzing policy document...</p>
            <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
          </div>
        )}

        {review && (
          <div className="space-y-5 mt-2">
            {/* Overall Rating */}
            <div className={cn(
              "rounded-lg p-4 flex items-center gap-3",
              ratingStyles[review.overall_rating]?.bg || 'bg-muted'
            )}>
              <ShieldAlert className={cn("h-6 w-6", ratingStyles[review.overall_rating]?.text || 'text-foreground')} />
              <div>
                <p className={cn("text-sm font-semibold", ratingStyles[review.overall_rating]?.text || 'text-foreground')}>
                  {ratingStyles[review.overall_rating]?.label || review.overall_rating}
                </p>
                <p className="text-xs text-foreground/80 mt-0.5">{review.summary}</p>
              </div>
            </div>

            {/* Quick Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Additional Insured</p>
                <p className={cn("text-xs font-semibold", review.additional_insured_status === 'confirmed' ? 'text-status-valid' : review.additional_insured_status === 'not_found' ? 'text-status-expired' : 'text-status-warning')}>
                  {review.additional_insured_status === 'confirmed' ? '✓ Confirmed' : review.additional_insured_status === 'not_found' ? '✗ Not Found' : '? Unclear'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Subrogation Waiver</p>
                <p className={cn("text-xs font-semibold", review.subrogation_waiver === 'confirmed' ? 'text-status-valid' : review.subrogation_waiver === 'not_found' ? 'text-status-expired' : 'text-status-warning')}>
                  {review.subrogation_waiver === 'confirmed' ? '✓ Confirmed' : review.subrogation_waiver === 'not_found' ? '✗ Not Found' : '? Unclear'}
                </p>
              </div>
            </div>

            {/* Findings */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Findings ({review.findings.length})
              </h3>
              <div className="space-y-2">
                {review.findings
                  .sort((a, b) => {
                    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                    return order[a.risk_level] - order[b.risk_level];
                  })
                  .map((finding, i) => {
                    const Icon = riskIcons[finding.risk_level];
                    return (
                      <div key={i} className="rounded-lg border border-border p-3">
                        <div className="flex items-start gap-2">
                          <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", riskColors[finding.risk_level])} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-foreground">{finding.title}</span>
                              <span className={cn(
                                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                                finding.risk_level === 'HIGH' ? 'bg-status-expired-bg text-status-expired' :
                                finding.risk_level === 'MEDIUM' ? 'bg-status-warning-bg text-status-warning' :
                                'bg-status-valid-bg text-status-valid'
                              )}>
                                {finding.risk_level}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">{finding.description}</p>
                            {finding.recommendation && (
                              <p className="text-[11px] text-primary mt-1">💡 {finding.recommendation}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={runReview} className="gap-1.5 text-xs">
              <Search className="h-3.5 w-3.5" />
              Re-run Review
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
