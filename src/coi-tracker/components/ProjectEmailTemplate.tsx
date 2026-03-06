import { useState } from 'react';
import { Card } from '@/coi-tracker/components/ui/card';
import { Input } from '@/coi-tracker/components/ui/input';
import { Label } from '@/coi-tracker/components/ui/label';
import { Button } from '@/coi-tracker/components/ui/button';
import { Textarea } from '@/coi-tracker/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateProject } from '@/coi-tracker/hooks/useProjects';
import { DEFAULT_REMINDER_SUBJECT, DEFAULT_REMINDER_BODY } from '@/coi-tracker/lib/reminderTemplate';

interface Props {
  projectId: string;
  subject: string | null;
  body: string | null;
}

const VARIABLES = ['{subcontractor}', '{project}', '{policies}'];

export function ProjectEmailTemplate({ projectId, subject, body }: Props) {
  const updateProject = useUpdateProject();
  const [draftSubject, setDraftSubject] = useState(subject ?? DEFAULT_REMINDER_SUBJECT);
  const [draftBody, setDraftBody] = useState(body ?? DEFAULT_REMINDER_BODY);

  const handleSave = async () => {
    try {
      await updateProject.mutateAsync({
        id: projectId,
        reminder_subject: draftSubject.trim() || null,
        reminder_body: draftBody.trim() || null,
      });
      toast.success('Email template saved');
    } catch {
      toast.error('Failed to save template');
    }
  };

  return (
    <Card className="border border-border p-6">
      <h2 className="text-sm font-semibold text-foreground mb-1">Reminder Email Template</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Customize the email that opens when you click "Send reminder email" on a COI.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <span className="text-[11px] text-muted-foreground self-center">Variables:</span>
        {VARIABLES.map(v => (
          <code key={v} className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">{v}</code>
        ))}
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reminder-subject" className="text-xs">Subject</Label>
          <Input
            id="reminder-subject"
            value={draftSubject}
            onChange={e => setDraftSubject(e.target.value)}
            className="text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reminder-body" className="text-xs">Body</Label>
          <Textarea
            id="reminder-body"
            value={draftBody}
            onChange={e => setDraftBody(e.target.value)}
            rows={8}
            className="text-sm font-mono resize-y"
          />
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateProject.isPending}
          className="gap-1.5"
        >
          {updateProject.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save Template
        </Button>
      </div>
    </Card>
  );
}
