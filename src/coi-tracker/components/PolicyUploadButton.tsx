import { useState, useCallback } from 'react';
import { Button } from '@/coi-tracker/components/ui/button';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/coi-tracker/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface PolicyUploadButtonProps {
  coiId: string;
  projectId: string;
  currentFilePath?: string | null;
}

export function PolicyUploadButton({ coiId, projectId, currentFilePath }: PolicyUploadButtonProps) {
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const handleUpload = useCallback(() => {
    if (uploading) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const filePath = `uploads/gl-policies/${projectId}/${coiId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('certificates')
          .upload(filePath, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from('subcontractor_cois')
          .update({ gl_policy_file_path: filePath })
          .eq('id', coiId);
        if (dbError) throw dbError;

        queryClient.invalidateQueries({ queryKey: ['cois', projectId] });
        queryClient.invalidateQueries({ queryKey: ['cois', 'all'] });
        toast.success('GL policy uploaded');
      } catch (err) {
        toast.error('Failed to upload policy');
        console.error(err);
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }, [coiId, projectId, uploading, queryClient]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={(e) => { e.stopPropagation(); handleUpload(); }}
      disabled={uploading}
      className="gap-1.5 text-xs"
    >
      {uploading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : currentFilePath ? (
        <FileText className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Upload className="h-3.5 w-3.5" />
      )}
      {currentFilePath ? 'Replace Policy' : 'Upload GL Policy'}
    </Button>
  );
}
