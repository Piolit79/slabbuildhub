import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, ExternalLink, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

interface DropboxFolder {
  id: string;
  project_id: string;
  category: string;
  folder_name: string;
  dropbox_url: string;
  sort_order: number;
  category_sort_order: number;
}

const DEFAULT_TEMPLATE = [
  { category: 'Design & Presentations', folders: ['Schematic Design', 'Design Development'], catSort: 0 },
  { category: 'Drawings & Specs', folders: ['Construction Documents', 'Specifications', 'Scope of Work'], catSort: 1 },
  { category: 'Renderings', folders: ['Design', 'Final'], catSort: 2 },
  { category: 'Project Resources', folders: ['Master Ledger', 'Owner Purchased', 'Receipts', 'Agreements', 'Cert. of Insurance'], catSort: 3 },
  { category: 'DOB & Agency Approvals', folders: ['Exg. Docs', 'Final Approvals'], catSort: 4 },
  { category: 'Photos', folders: ['CA Photos'], catSort: 5 },
];

export default function ClientFiles() {
  const { selectedProject } = useProject();
  const { isClient } = useAuth();
  const [folders, setFolders] = useState<DropboxFolder[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addCatOpen, setAddCatOpen] = useState(false);

  useEffect(() => {
    loadFolders();
  }, [selectedProject.id]);

  const loadFolders = async () => {
    const { data } = await supabase
      .from('dropbox_folders')
      .select('*')
      .eq('project_id', selectedProject.id)
      .order('category_sort_order')
      .order('sort_order');
    setFolders((data || []) as DropboxFolder[]);
  };

  const initTemplate = async () => {
    const rows: any[] = [];
    DEFAULT_TEMPLATE.forEach(({ category, folders: names, catSort }) => {
      names.forEach((name, i) => {
        rows.push({
          project_id: selectedProject.id,
          category,
          folder_name: name,
          dropbox_url: '',
          sort_order: i,
          category_sort_order: catSort,
        });
      });
    });
    await supabase.from('dropbox_folders').insert(rows);
    loadFolders();
    toast.success('Template folders created');
  };

  const handleAddFolder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const category = fd.get('category') as string;
    const folderName = fd.get('folder_name') as string;
    const url = fd.get('dropbox_url') as string;
    const existingCat = folders.find(f => f.category === category);
    const catSort = existingCat?.category_sort_order ?? (categories.length);
    const sortOrder = folders.filter(f => f.category === category).length;

    await supabase.from('dropbox_folders').insert({
      project_id: selectedProject.id,
      category,
      folder_name: folderName,
      dropbox_url: url || '',
      sort_order: sortOrder,
      category_sort_order: catSort,
    });
    loadFolders();
    setAddOpen(false);
    toast.success('Folder added');
  };

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const category = fd.get('category') as string;
    const catSort = categories.length;

    await supabase.from('dropbox_folders').insert({
      project_id: selectedProject.id,
      category,
      folder_name: 'New Folder',
      dropbox_url: '',
      sort_order: 0,
      category_sort_order: catSort,
    });
    loadFolders();
    setAddCatOpen(false);
    toast.success('Category added');
  };

  const saveUrl = async (id: string) => {
    await supabase.from('dropbox_folders').update({ dropbox_url: editUrl }).eq('id', id);
    setFolders(prev => prev.map(f => f.id === id ? { ...f, dropbox_url: editUrl } : f));
    setEditingId(null);
    toast.success('Link saved');
  };

  const deleteFolder = async (id: string) => {
    await supabase.from('dropbox_folders').delete().eq('id', id);
    setFolders(prev => prev.filter(f => f.id !== id));
  };

  const deleteCategory = async (category: string) => {
    await supabase.from('dropbox_folders').delete()
      .eq('project_id', selectedProject.id)
      .eq('category', category);
    setFolders(prev => prev.filter(f => f.category !== category));
    toast.success('Category removed');
  };

  // Group folders by category
  const categories = [...new Set(folders.map(f => f.category))];
  const grouped = categories.map(cat => ({
    category: cat,
    items: folders.filter(f => f.category === cat).sort((a, b) => a.sort_order - b.sort_order),
  }));

  // Split into two columns
  const mid = Math.ceil(grouped.length / 2);
  const leftCol = grouped.slice(0, mid);
  const rightCol = grouped.slice(mid);

  if (folders.length === 0 && !isClient) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg md:text-xl font-bold" style={{ color: '#7b7c81' }}>Project Files</h1>
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">No file folders set up for this project yet.</p>
          <Button onClick={initTemplate} size="sm">Load Default Template</Button>
        </div>
      </div>
    );
  }

  const renderColumn = (groups: typeof grouped) => (
    <div className="space-y-6">
      {groups.map(({ category, items }) => (
        <div key={category}>
          <div className="flex items-center gap-2 border-b border-border pb-1 mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">{category}</h3>
            {!isClient && (
              <button onClick={() => deleteCategory(category)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="space-y-1">
            {items.map(folder => (
              <div key={folder.id} className="flex items-center gap-2 group">
                {editingId === folder.id ? (
                  <div className="flex-1 flex gap-1">
                    <Input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="Paste Dropbox URL"
                      className="h-7 text-xs flex-1"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') saveUrl(folder.id); if (e.key === 'Escape') setEditingId(null); }}
                    />
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => saveUrl(folder.id)}>Save</Button>
                  </div>
                ) : (
                  <>
                    {folder.dropbox_url ? (
                      <a
                        href={folder.dropbox_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1.5 flex-1"
                      >
                        {folder.folder_name}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground flex-1">{folder.folder_name}</span>
                    )}
                    {!isClient && (
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingId(folder.id); setEditUrl(folder.dropbox_url); }} className="text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => deleteFolder(folder.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-bold" style={{ color: '#7b7c81' }}>Project Files</h1>
        {!isClient && (
          <div className="flex gap-2">
            <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Plus size={14} /> Category</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
                <form onSubmit={handleAddCategory} className="space-y-3">
                  <div className="space-y-1"><Label className="text-xs">Category Name</Label><Input name="category" required className="h-8 text-xs" /></div>
                  <Button type="submit" size="sm" className="w-full">Add</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus size={14} /> Folder</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Folder</DialogTitle></DialogHeader>
                <form onSubmit={handleAddFolder} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Category</Label>
                    <select name="category" required className="w-full h-8 text-xs border rounded px-2 bg-background">
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Folder Name</Label><Input name="folder_name" required className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs">Dropbox URL (optional)</Label><Input name="dropbox_url" className="h-8 text-xs" placeholder="https://dropbox.com/..." /></div>
                  <Button type="submit" size="sm" className="w-full">Add</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="text-center mb-4">
        <h2 className="text-base font-semibold text-muted-foreground uppercase tracking-wide">{selectedProject.name}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {renderColumn(leftCol)}
        {renderColumn(rightCol)}
      </div>
    </div>
  );
}
