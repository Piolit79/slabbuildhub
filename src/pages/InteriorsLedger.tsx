import React, { useState, useEffect, useCallback, useRef, Component } from 'react';

// ─── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: string | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 border border-red-200 rounded-lg bg-red-50 text-red-800">
          <p className="font-semibold mb-1">Something went wrong rendering this page.</p>
          <p className="text-xs font-mono">{this.state.error}</p>
          <button className="mt-3 text-xs underline" onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus, Pencil, Check, X, ChevronUp, ChevronDown, Trash2,
  Upload, Loader2, Link2, Package, ImageIcon, Scan, RefreshCw
} from 'lucide-react';
import JSZip from 'jszip';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Room {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
}

interface FurnitureItem {
  id: string;
  project_id: string;
  room_id: string;
  key: string;
  item: string;
  vendor: string;
  finish_color: string;
  description: string;
  qty: number;
  image_url: string;
  product_link: string;
  tracking_number: string;
  carrier: string;
  delivery_status: string;
  eta: string | null;
  sort_order: number;
}

interface ScannedItem {
  vendor: string;
  item: string;
  description: string;
  finish_color: string;
  image_hint: string;
  image_filename?: string; // exact filename from IDML scan
  image_url?: string;
  assigned_image?: string; // filename from zip
}

interface ScannedRoom {
  name: string;
  items: ScannedItem[];
}

interface ZipImage {
  name: string;
  dataUrl: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'not_ordered', label: 'Not Ordered', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'ordered', label: 'Ordered', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'in_production', label: 'In Production', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'shipped', label: 'Shipped', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'in_transit', label: 'In Transit', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { value: 'delayed', label: 'Delayed', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-700 border-green-200' },
];

function getStatusStyle(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status)?.color || STATUS_OPTIONS[0].color;
}

function getStatusLabel(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status)?.label || 'Not Ordered';
}

function detectCarrier(tn: string): string {
  if (!tn) return '';
  const t = tn.replace(/\s/g, '').toUpperCase();
  if (/^1Z[A-Z0-9]{16}$/.test(t)) return 'UPS';
  if (/^(96\d{18}|\d{12}|\d{15}|\d{20}|\d{22})$/.test(t)) return 'FedEx';
  if (/^(94|93|92|91|82|71)\d{18,20}$/.test(t)) return 'USPS';
  if (/^\d{10}$/.test(t)) return 'DHL';
  return '';
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

function autoKey(item: string, existing: string[]): string {
  const lightWords = ['lamp', 'light', 'pendant', 'sconce', 'chandelier', 'ceiling', 'fixture', 'lantern'];
  const isLight = lightWords.some(w => item.toLowerCase().includes(w));
  const prefix = isLight ? 'L' : 'F';
  const nums = existing
    .filter(k => k.startsWith(prefix + '-'))
    .map(k => parseInt(k.split('-')[1] || '0', 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${String(next).padStart(2, '0')}`;
}

function fuzzyScore(filename: string, hint: string, vendor: string, item: string): number {
  const haystack = filename.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const words = [hint, vendor, item].join(' ').toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  let score = 0;
  for (const w of words) {
    if (w.length > 2 && haystack.includes(w)) score++;
  }
  return score;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InteriorsLedger() {
  const { selectedProject } = useProject();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [items, setItems] = useState<FurnitureItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Row edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<FurnitureItem>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Room rename state
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Upload/scan state
  const [idmlFile, setIdmlFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scannedRooms, setScannedRooms] = useState<ScannedRoom[]>([]);
  const [zipImages, setZipImages] = useState<ZipImage[]>([]);
  const [importingItems, setImportingItems] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState<{ itemId: string } | null>(null);
  const [showZipPicker, setShowZipPicker] = useState<{ roomIdx: number; itemIdx: number } | null>(null);

  const idmlInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUploadItemId, setImageUploadItemId] = useState<string | null>(null);

  // ── Load data ────────────────────────────────────────────────────────────────

  const load = useCallback(async (projectId: string) => {
    setLoading(true);
    const [{ data: roomsData }, { data: itemsData }] = await Promise.all([
      supabase.from('interiors_rooms').select('*').eq('project_id', projectId).order('sort_order'),
      supabase.from('interiors_items').select('*').eq('project_id', projectId).order('sort_order'),
    ]);
    setRooms((roomsData as Room[]) || []);
    setItems((itemsData as FurnitureItem[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedProject?.id) load(selectedProject.id);
    else { setRooms([]); setItems([]); }
  }, [selectedProject?.id, load]);

  // ── Room CRUD ─────────────────────────────────────────────────────────────────

  const addRoom = async () => {
    if (!selectedProject?.id) return;
    const maxOrder = rooms.length > 0 ? Math.max(...rooms.map(r => r.sort_order)) + 1 : 0;
    const { data, error } = await supabase
      .from('interiors_rooms')
      .insert({ project_id: selectedProject.id, name: 'New Room', sort_order: maxOrder })
      .select().single();
    if (error) { toast.error('Failed to add room'); return; }
    setRooms(prev => [...prev, data as Room]);
    setEditingRoomId(data.id);
    setEditValue('New Room');
  };

  const saveRoomName = async (roomId: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) { setEditingRoomId(null); return; }
    const { error } = await supabase.from('interiors_rooms').update({ name: trimmed }).eq('id', roomId);
    if (error) { toast.error('Failed to rename room'); return; }
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, name: trimmed } : r));
    setEditingRoomId(null);
  };

  const deleteRoom = async (roomId: string) => {
    const { error } = await supabase.from('interiors_rooms').delete().eq('id', roomId);
    if (error) { toast.error('Failed to delete room'); return; }
    setRooms(prev => prev.filter(r => r.id !== roomId));
    setItems(prev => prev.filter(i => i.room_id !== roomId));
  };

  const moveRoom = async (roomId: string, direction: 'up' | 'down') => {
    const sorted = [...rooms].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(r => r.id === roomId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx], b = sorted[swapIdx];
    await Promise.all([
      supabase.from('interiors_rooms').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('interiors_rooms').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    setRooms(prev => prev.map(r => {
      if (r.id === a.id) return { ...r, sort_order: b.sort_order };
      if (r.id === b.id) return { ...r, sort_order: a.sort_order };
      return r;
    }));
  };

  // ── Item CRUD ─────────────────────────────────────────────────────────────────

  const addItem = async (roomId: string) => {
    if (!selectedProject?.id) return;
    const roomItems = items.filter(i => i.room_id === roomId);
    const maxOrder = roomItems.length > 0 ? Math.max(...roomItems.map(i => i.sort_order)) + 1 : 0;
    const existingKeys = items.map(i => i.key);
    const newKey = autoKey('', existingKeys);
    const { data, error } = await supabase
      .from('interiors_items')
      .insert({
        project_id: selectedProject.id,
        room_id: roomId,
        key: newKey,
        item: '',
        vendor: '',
        finish_color: '',
        description: '',
        qty: 1,
        image_url: '',
        product_link: '',
        tracking_number: '',
        carrier: '',
        delivery_status: 'not_ordered',
        eta: null,
        sort_order: maxOrder,
      })
      .select().single();
    if (error) { toast.error('Failed to add item'); return; }
    setItems(prev => [...prev, data as FurnitureItem]);
  };

  const updateItemField = async (itemId: string, field: string, value: unknown) => {
    const updates: Record<string, unknown> = { [field]: value };
    // Auto-detect carrier when tracking number changes
    if (field === 'tracking_number') {
      updates.carrier = detectCarrier(value as string);
      if (updates.carrier && (value as string)) {
        updates.delivery_status = 'shipped';
      }
    }
    const { error } = await supabase.from('interiors_items').update(updates).eq('id', itemId);
    if (error) { toast.error('Failed to update'); return; }
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i));
  };

  const deleteItem = async (itemId: string) => {
    const { error } = await supabase.from('interiors_items').delete().eq('id', itemId);
    if (error) { toast.error('Failed to delete item'); return; }
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const moveItem = async (itemId: string, roomId: string, direction: 'up' | 'down') => {
    const roomItems = [...items.filter(i => i.room_id === roomId)].sort((a, b) => a.sort_order - b.sort_order);
    const idx = roomItems.findIndex(i => i.id === itemId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= roomItems.length) return;
    const a = roomItems[idx], b = roomItems[swapIdx];
    await Promise.all([
      supabase.from('interiors_items').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('interiors_items').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    setItems(prev => prev.map(i => {
      if (i.id === a.id) return { ...i, sort_order: b.sort_order };
      if (i.id === b.id) return { ...i, sort_order: a.sort_order };
      return i;
    }));
  };

  // ── Row edit helpers ──────────────────────────────────────────────────────────

  const startEditRow = (item: FurnitureItem) => {
    setConfirmDeleteId(null);
    setEditId(item.id);
    setEditDraft({ ...item });
  };

  const saveEditRow = async () => {
    if (!editId || !editDraft) return;
    const updates: Record<string, unknown> = { ...editDraft };
    // Auto-detect carrier when tracking number changes
    if (editDraft.tracking_number !== undefined) {
      updates.carrier = detectCarrier(editDraft.tracking_number as string);
      if (updates.carrier && editDraft.tracking_number) updates.delivery_status = 'shipped';
    }
    const { error } = await supabase.from('interiors_items').update(updates).eq('id', editId);
    if (error) { toast.error('Failed to save'); return; }
    setItems(prev => prev.map(i => i.id === editId ? { ...i, ...updates } as FurnitureItem : i));
    setEditId(null);
    setEditDraft({});
  };

  const cancelEditRow = () => { setEditId(null); setEditDraft({}); };

  // ── Image upload ──────────────────────────────────────────────────────────────

  const handleImageUpload = async (file: File, itemId: string) => {
    const ext = file.name.split('.').pop();
    const path = `${selectedProject?.id}/${itemId}.${ext}`;
    const { error: upErr } = await supabase.storage.from('interiors-images').upload(path, file, { upsert: true });
    if (upErr) { toast.error('Image upload failed'); return; }
    const { data: urlData } = supabase.storage.from('interiors-images').getPublicUrl(path);
    await updateItemField(itemId, 'image_url', urlData.publicUrl);
    toast.success('Image updated');
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !imageUploadItemId) return;
    await handleImageUpload(file, imageUploadItemId);
    setImageUploadItemId(null);
    e.target.value = '';
  };

  // ── IDML client-side parser ───────────────────────────────────────────────────
  // IDML is a ZIP of XML files. Parse it in the browser — no upload needed.
  // Stories/*.xml  → clean UTF-8 text (exactly what was typed in InDesign)
  // Spreads/*.xml  → image filenames from LinkResourceURI attributes

  const parseIdmlClient = async (file: File): Promise<{ text: string; imageFilenames: string[] }> => {
    const jszip = new JSZip();
    const zip = await jszip.loadAsync(file);
    const storyTexts: string[] = [];
    const imageFilenames: string[] = [];

    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      if (path.startsWith('Stories/') && path.endsWith('.xml')) {
        const xml = await entry.async('string');
        const re = /<Content>([^<]*)<\/Content>/g;
        let m;
        while ((m = re.exec(xml)) !== null) {
          const t = m[1]
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&apos;/g, "'").replace(/&quot;/g, '"').trim();
          if (t.length > 1) storyTexts.push(t);
        }
      }
      if ((path.startsWith('Spreads/') && path.endsWith('.xml')) || path === 'BackingStory.xml') {
        const xml = await entry.async('string');
        const re = /LinkResourceURI="([^"]+)"/g;
        let m;
        while ((m = re.exec(xml)) !== null) {
          const uri = m[1].replace(/\\/g, '/');
          const fname = decodeURIComponent(uri.split('/').pop() || '');
          if (fname && /\.(jpe?g|png|gif|webp|tiff?|psd|eps|ai|svg)$/i.test(fname)) {
            imageFilenames.push(fname);
          }
        }
      }
    }

    return { text: storyTexts.join('\n'), imageFilenames: [...new Set(imageFilenames)] };
  };

  // ── PDF Scan ──────────────────────────────────────────────────────────────────

  const extractZipImages = async (zip: File): Promise<ZipImage[]> => {
    const jszip = new JSZip();
    const content = await jszip.loadAsync(zip);
    const images: ZipImage[] = [];
    const imageFiles = Object.entries(content.files).filter(([name]) =>
      /\.(jpg|jpeg|png|gif|webp)$/i.test(name) && !name.startsWith('__MACOSX')
    );
    for (const [name, file] of imageFiles) {
      const blob = await file.async('blob');
      const dataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      images.push({ name: name.split('/').pop() || name, dataUrl });
    }
    return images;
  };


  const handleScan = async () => {
    const sourceFile = idmlFile || pdfFile;
    if (!sourceFile) { toast.error('Please select an IDML or PDF file'); return; }
    const isIdml = !!idmlFile;
    setScanning(true);
    try {
      // Extract ZIP images if provided
      let extracted: ZipImage[] = [];
      if (zipFile) {
        extracted = await extractZipImages(zipFile);
        setZipImages(extracted);
      }

      // ── Call the appropriate API ───────────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let apiData: any = {};
      let docImageFilenames: string[] = [];

      if (isIdml) {
        const { text, imageFilenames } = await parseIdmlClient(idmlFile!);
        if (!text || text.trim().length < 10) throw new Error('Could not extract text from this IDML file. Make sure it was exported from InDesign as .idml');
        docImageFilenames = imageFilenames;
        const resp = await fetch('/api/interiors-scan-idml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, imageFilenames }),
        });
        if (!resp.ok) throw new Error(await resp.text());
        apiData = await resp.json();
      } else {
        const tempPath = `temp/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
        const { error: upErr } = await supabase.storage
          .from('interiors-images')
          .upload(tempPath, pdfFile!, { contentType: 'application/pdf', upsert: true });
        if (upErr) throw new Error(`PDF upload failed: ${upErr.message}`);
        const { data: urlData } = supabase.storage.from('interiors-images').getPublicUrl(tempPath);
        const resp = await fetch('/api/interiors-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfUrl: urlData.publicUrl }),
        });
        supabase.storage.from('interiors-images').remove([tempPath]).catch(() => {});
        if (!resp.ok) throw new Error(await resp.text());
        apiData = await resp.json();
        const pdfImages: ZipImage[] = (apiData.pdfImages || []).map((dataUrl: string, i: number) => ({
          name: `image-${i + 1}.jpg`,
          dataUrl,
        }));
        if (pdfImages.length > 0) {
          const merged = [...extracted, ...pdfImages];
          setZipImages(merged);
          extracted = merged;
        }
      }

      // ── Image matching helper ──────────────────────────────────────────────
      const zipByName = new Map<string, ZipImage>(extracted.map(img => [img.name.toLowerCase(), img]));

      const matchItem = (ai: ScannedItem): ScannedItem => {
        if (ai.image_filename) {
          const exact = zipByName.get(ai.image_filename.toLowerCase());
          if (exact) return { ...ai, assigned_image: exact.name, image_url: exact.dataUrl };
        }
        let best: ZipImage | null = null;
        let bestScore = 0;
        for (const img of extracted) {
          const score = fuzzyScore(img.name, ai.image_hint ?? ai.image_filename ?? '', ai.vendor ?? '', ai.item ?? '');
          if (score > bestScore) { bestScore = score; best = img; }
        }
        return { ...ai, assigned_image: best ? best.name : undefined, image_url: best ? best.dataUrl : undefined };
      };

      // ── Build scanned rooms ────────────────────────────────────────────────
      let finalRooms: ScannedRoom[];

      if (isIdml) {
        const rawRooms: Array<{ name: string; items: ScannedItem[] }> = apiData.rooms || [];
        finalRooms = rawRooms.map(r => ({ name: r.name, items: r.items.map(matchItem) }));
        if (finalRooms.length === 0) finalRooms = [{ name: 'General', items: [] }];
      } else {
        const aiItems: ScannedItem[] = apiData.items || [];
        finalRooms = [{ name: apiData.room || 'General', items: aiItems.map(matchItem) }];
      }

      if (isIdml && docImageFilenames.length > 0 && extracted.length === 0) {
        toast.info(`Found ${docImageFilenames.length} image file(s) in the IDML. Upload the InDesign Links ZIP to auto-attach photos.`);
      }

      setScannedRooms(finalRooms);
      setShowScanModal(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Scan failed: ${message}`);
    } finally {
      setScanning(false);
    }
  };

  // ── Import scanned items ──────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!selectedProject?.id) return;
    setImportingItems(true);
    try {
      const existingKeys = [...items.map(i => i.key)];
      const allNewRooms: Room[] = [];
      const allNewItems: FurnitureItem[] = [];
      let sortBase = rooms.length > 0 ? Math.max(...rooms.map(r => r.sort_order)) + 1 : 0;

      for (const sr of scannedRooms) {
        // Create a new room for each scanned room group
        const { data: newRoom, error: roomErr } = await supabase
          .from('interiors_rooms')
          .insert({ project_id: selectedProject.id, name: sr.name.trim() || 'New Room', sort_order: sortBase++ })
          .select().single();
        if (roomErr) throw roomErr;
        allNewRooms.push(newRoom as Room);

        for (let idx = 0; idx < sr.items.length; idx++) {
          const si = sr.items[idx];
          const key = autoKey(si.item, [...existingKeys, ...allNewItems.map(i => i.key)]);

          let imageUrl = '';
          if (si.image_url && si.image_url.startsWith('data:')) {
            const resp = await fetch(si.image_url);
            const blob = await resp.blob();
            const ext = blob.type.split('/')[1] || 'jpg';
            const path = `${selectedProject.id}/${Date.now()}-${idx}.${ext}`;
            const { error: upErr } = await supabase.storage.from('interiors-images').upload(path, blob, { upsert: true });
            if (!upErr) {
              const { data: urlData } = supabase.storage.from('interiors-images').getPublicUrl(path);
              imageUrl = urlData.publicUrl;
            }
          }

          const { data: newItem, error } = await supabase
            .from('interiors_items')
            .insert({
              project_id: selectedProject.id,
              room_id: newRoom.id,
              key,
              item: si.item,
              vendor: si.vendor,
              finish_color: si.finish_color,
              description: si.description,
              qty: 1,
              image_url: imageUrl,
              product_link: '',
              tracking_number: '',
              carrier: '',
              delivery_status: 'not_ordered',
              eta: null,
              sort_order: idx,
            })
            .select().single();
          if (error) throw error;
          existingKeys.push(key);
          allNewItems.push(newItem as FurnitureItem);
        }
      }

      setRooms(prev => [...prev, ...allNewRooms]);
      setItems(prev => [...prev, ...allNewItems]);
      setShowScanModal(false);
      setIdmlFile(null);
      setPdfFile(null);
      setZipFile(null);
      setZipImages([]);
      toast.success(`Imported ${allNewItems.length} items across ${allNewRooms.length} room${allNewRooms.length !== 1 ? 's' : ''}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Import failed: ${message}`);
    } finally {
      setImportingItems(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const isEditing = (itemId: string) => editId === itemId;

  const df = (field: keyof FurnitureItem) =>
    editDraft[field] !== undefined ? String(editDraft[field]) : '';

  const setDf = (field: keyof FurnitureItem, value: string | number | null) =>
    setEditDraft(d => ({ ...d, [field]: value }));

  // ─────────────────────────────────────────────────────────────────────────────

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
        <Package className="h-8 w-8 opacity-40" />
        <span className="text-sm">Select a project to view the furniture list</span>
      </div>
    );
  }

  const sortedRooms = [...rooms].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <ErrorBoundary>
    <div className="p-4 md:p-6 space-y-6 max-w-full">
      {/* Hidden inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Interiors Hub</h1>
          <p className="text-sm text-muted-foreground">{selectedProject.name}</p>
        </div>
        <Button size="sm" onClick={addRoom} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Room
        </Button>
      </div>

      {/* Upload / Scan Panel */}
      <div className="border rounded-lg p-4 bg-card space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          <Scan className="h-4 w-4" /> Import from Design Board
        </div>
        <div className="flex flex-wrap gap-3 items-end">

          {/* IDML — primary (recommended) */}
          <div className="space-y-1">
            <p className="text-xs font-medium">Design Board <span className="text-primary">.idml</span> <span className="text-muted-foreground font-normal">(recommended)</span></p>
            <div className="flex gap-2 items-center">
              <Button variant="outline" size="sm" onClick={() => idmlInputRef.current?.click()} className={`gap-1.5 text-xs ${idmlFile ? 'border-primary text-primary' : ''}`}>
                <Upload className="h-3.5 w-3.5" />
                {idmlFile ? idmlFile.name.slice(0, 26) + (idmlFile.name.length > 26 ? '…' : '') : 'Choose IDML'}
              </Button>
              {idmlFile && <button onClick={() => setIdmlFile(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <input ref={idmlInputRef} type="file" accept=".idml" className="hidden" onChange={e => { setIdmlFile(e.target.files?.[0] || null); setPdfFile(null); }} />
          </div>

          {/* Links ZIP */}
          <div className="space-y-1">
            <p className="text-xs font-medium">InDesign Links Folder <span className="text-muted-foreground font-normal">(.zip)</span></p>
            <div className="flex gap-2 items-center">
              <Button variant="outline" size="sm" onClick={() => zipInputRef.current?.click()} className="gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" />
                {zipFile ? zipFile.name.slice(0, 26) + (zipFile.name.length > 26 ? '…' : '') : 'Choose ZIP'}
              </Button>
              {zipFile && <button onClick={() => setZipFile(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={e => setZipFile(e.target.files?.[0] || null)} />
          </div>

          {/* Scan button */}
          <Button size="sm" onClick={handleScan} disabled={(!idmlFile && !pdfFile) || scanning} className="gap-1.5">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
            {scanning ? 'Scanning…' : 'Scan with AI'}
          </Button>
        </div>

        {/* PDF fallback */}
        <div className="flex flex-wrap gap-3 items-center pt-1 border-t border-dashed">
          <p className="text-xs text-muted-foreground">Or use PDF (less accurate):</p>
          <div className="flex gap-2 items-center">
            <Button variant="ghost" size="sm" onClick={() => pdfInputRef.current?.click()} className="gap-1.5 text-xs h-7">
              <Upload className="h-3 w-3" />
              {pdfFile ? pdfFile.name.slice(0, 24) + (pdfFile.name.length > 24 ? '…' : '') : 'Choose PDF'}
            </Button>
            {pdfFile && <button onClick={() => setPdfFile(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>}
          </div>
          <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={e => { setPdfFile(e.target.files?.[0] || null); setIdmlFile(null); }} />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {/* Rooms + Items */}
      {sortedRooms.map((room, roomIdx) => {
        const roomItems = [...items.filter(i => i.room_id === room.id)].sort((a, b) => a.sort_order - b.sort_order);
        return (
          <div key={room.id} className="border rounded-lg overflow-hidden">
            {/* Room Header — matches app accent style */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary/50 text-secondary-foreground">
              {editingRoomId === room.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => saveRoomName(room.id)}
                    onKeyDown={e => { if (e.key === 'Enter') saveRoomName(room.id); if (e.key === 'Escape') setEditingRoomId(null); }}
                    className="h-7 text-sm font-semibold bg-background/20 border-white/20 max-w-[200px]"
                  />
                  <button onClick={() => saveRoomName(room.id)}><Check className="h-4 w-4" /></button>
                  <button onClick={() => setEditingRoomId(null)}><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <span className="font-semibold text-sm flex-1 uppercase tracking-wide">{room.name}</span>
              )}
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditingRoomId(room.id); setEditValue(room.name); }} title="Rename" className="opacity-70 hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => moveRoom(room.id, 'up')} disabled={roomIdx === 0} className="disabled:opacity-20 opacity-70 hover:opacity-100"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => moveRoom(room.id, 'down')} disabled={roomIdx === sortedRooms.length - 1} className="disabled:opacity-20 opacity-70 hover:opacity-100"><ChevronDown className="h-4 w-4" /></button>
                <button onClick={() => deleteRoom(room.id)} className="opacity-70 hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground" style={{ backgroundColor: 'rgba(195, 126, 135, 0.10)' }}>
                    <th className="w-[52px] px-2 py-2 text-left">Sort</th>
                    <th className="w-[68px] px-2 py-2 text-left">Image</th>
                    <th className="w-[64px] px-2 py-2 text-left">Key</th>
                    <th className="w-[110px] px-2 py-2 text-left">Item</th>
                    <th className="w-[120px] px-2 py-2 text-left">Vendor</th>
                    <th className="w-[110px] px-2 py-2 text-left">Finish / Color</th>
                    <th className="w-[180px] px-2 py-2 text-left">Description</th>
                    <th className="w-[42px] px-2 py-2 text-left">Qty</th>
                    <th className="w-[80px] px-2 py-2 text-left">Link</th>
                    <th className="w-[120px] px-2 py-2 text-left">Tracking #</th>
                    <th className="w-[64px] px-2 py-2 text-left">Carrier</th>
                    <th className="w-[120px] px-2 py-2 text-left">Status</th>
                    <th className="w-[100px] px-2 py-2 text-left">ETA</th>
                    <th className="w-[72px] px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {roomItems.map((item, itemIdx) => {
                    const editing = isEditing(item.id);
                    const confirming = confirmDeleteId === item.id;
                    return (
                    <tr
                      key={item.id}
                      className="group border-b transition-colors"
                      style={itemIdx % 2 === 0 ? { backgroundColor: 'rgba(195, 126, 135, 0.07)' } : undefined}
                    >
                      {/* Sort */}
                      <td className="px-2 py-1.5">
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => moveItem(item.id, room.id, 'up')} disabled={itemIdx === 0} className="disabled:opacity-20 text-muted-foreground hover:text-foreground"><ChevronUp className="h-3.5 w-3.5" /></button>
                          <button onClick={() => moveItem(item.id, room.id, 'down')} disabled={itemIdx === roomItems.length - 1} className="disabled:opacity-20 text-muted-foreground hover:text-foreground"><ChevronDown className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>

                      {/* Image */}
                      <td className="px-2 py-1.5">
                        <div className="relative group w-12 h-12">
                          {item.image_url ? (
                            <img src={item.image_url} alt="" className="w-12 h-12 object-contain rounded border bg-white" />
                          ) : (
                            <div className="w-12 h-12 rounded border bg-muted/20 flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-1">
                            <button onClick={() => { setImageUploadItemId(item.id); imageInputRef.current?.click(); }} className="text-white p-0.5" title="Upload photo"><Upload className="h-3.5 w-3.5" /></button>
                            {zipImages.length > 0 && <button onClick={() => setShowImagePicker({ itemId: item.id })} className="text-white p-0.5" title="Pick from board"><RefreshCw className="h-3 w-3" /></button>}
                          </div>
                        </div>
                      </td>

                      {/* Key */}
                      <td className="px-2 py-1.5">
                        {editing ? <Input value={df('key')} onChange={e => setDf('key', e.target.value)} className="h-7 text-xs px-1 w-14" /> : <span className="text-xs font-mono text-muted-foreground">{item.key}</span>}
                      </td>

                      {/* Item */}
                      <td className="px-2 py-1.5">
                        {editing ? <Input value={df('item')} onChange={e => setDf('item', e.target.value)} className="h-7 text-xs px-1 w-24" /> : <span className="text-xs">{item.item || <span className="text-muted-foreground/40">—</span>}</span>}
                      </td>

                      {/* Vendor */}
                      <td className="px-2 py-1.5">
                        {editing ? <Input value={df('vendor')} onChange={e => setDf('vendor', e.target.value)} className="h-7 text-xs px-1 w-24" /> : <span className="text-xs text-muted-foreground">{item.vendor || '—'}</span>}
                      </td>

                      {/* Finish/Color */}
                      <td className="px-2 py-1.5">
                        {editing ? <Input value={df('finish_color')} onChange={e => setDf('finish_color', e.target.value)} className="h-7 text-xs px-1 w-24" /> : <span className="text-xs text-muted-foreground">{item.finish_color || '—'}</span>}
                      </td>

                      {/* Description */}
                      <td className="px-2 py-1.5">
                        {editing ? <Input value={df('description')} onChange={e => setDf('description', e.target.value)} className="h-7 text-xs px-1 w-40" /> : <span className="text-xs text-muted-foreground truncate max-w-[170px] block">{item.description || '—'}</span>}
                      </td>

                      {/* Qty */}
                      <td className="px-2 py-1.5">
                        {editing ? <Input type="number" value={df('qty')} onChange={e => setDf('qty', parseInt(e.target.value) || 1)} className="h-7 text-xs px-1 w-12" /> : <span className="text-xs">{item.qty}</span>}
                      </td>

                      {/* Product Link */}
                      <td className="px-2 py-1.5">
                        {editing ? (
                          <Input value={df('product_link')} onChange={e => setDf('product_link', e.target.value)} className="h-7 text-xs px-1 w-20" placeholder="https://…" />
                        ) : item.product_link ? (
                          <a href={item.product_link} target="_blank" rel="noopener noreferrer" style={{ color: '#7b9ec3' }} className="hover:underline"><Link2 className="h-3.5 w-3.5" /></a>
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                      </td>

                      {/* Tracking # */}
                      <td className="px-2 py-1.5">
                        {editing ? (
                          <Input value={df('tracking_number')} onChange={e => setDf('tracking_number', e.target.value)} className="h-7 text-xs px-1 w-28" placeholder="Tracking #" />
                        ) : item.tracking_number ? (
                          getTrackingUrl(item.carrier, item.tracking_number) ? (
                            <a href={getTrackingUrl(item.carrier, item.tracking_number)} target="_blank" rel="noopener noreferrer" style={{ color: '#7b9ec3' }} className="text-xs font-mono hover:underline truncate max-w-[90px] block">{item.tracking_number}</a>
                          ) : (
                            <span className="text-xs font-mono truncate max-w-[90px] block">{item.tracking_number}</span>
                          )
                        ) : <span className="text-muted-foreground/30 text-xs">—</span>}
                      </td>

                      {/* Carrier */}
                      <td className="px-2 py-1.5">
                        <span className="text-xs text-muted-foreground">{item.carrier || '—'}</span>
                      </td>

                      {/* Status */}
                      <td className="px-2 py-1.5">
                        <Select
                          value={editing ? (df('delivery_status') || 'not_ordered') : (item.delivery_status || 'not_ordered')}
                          onValueChange={val => editing ? setDf('delivery_status', val) : updateItemField(item.id, 'delivery_status', val)}
                        >
                          <SelectTrigger className={`h-6 text-xs border px-2 py-0 rounded-full w-auto min-w-[95px] ${getStatusStyle(editing ? df('delivery_status') : item.delivery_status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(s => (
                              <SelectItem key={s.value} value={s.value}>
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* ETA */}
                      <td className="px-2 py-1.5">
                        {editing ? (
                          <Input type="date" value={df('eta')} onChange={e => setDf('eta', e.target.value || null)} className="h-7 text-xs px-1 w-28" />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {item.eta ? new Date(item.eta + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </span>
                        )}
                      </td>

                      {/* Actions: edit / delete */}
                      <td className="px-2 py-1.5">
                        {editing ? (
                          <div className="flex items-center gap-1">
                            <button onClick={saveEditRow} className="text-green-600 hover:opacity-70" title="Save"><Check className="h-3.5 w-3.5" /></button>
                            <button onClick={cancelEditRow} className="text-muted-foreground hover:text-foreground" title="Undo"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : confirming ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">Delete?</span>
                            <button onClick={() => { deleteItem(item.id); setConfirmDeleteId(null); }} className="text-destructive hover:opacity-70"><Check className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditRow(item)} className="text-muted-foreground/60 hover:text-foreground" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => { setEditId(null); setConfirmDeleteId(item.id); }} className="text-muted-foreground/40 hover:text-destructive" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>

              {roomItems.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground">No items yet</div>
              )}

              <div className="p-2 border-t">
                <Button variant="ghost" size="sm" onClick={() => addItem(room.id)} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {sortedRooms.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No rooms yet. Add a room or import a design board.</p>
        </div>
      )}

      {/* Bottom Add Room */}
      {sortedRooms.length > 0 && (
        <Button variant="outline" size="sm" onClick={addRoom} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Room
        </Button>
      )}

      {/* Image Picker Modal (from ZIP) */}
      {showImagePicker && (
        <Dialog open onOpenChange={() => setShowImagePicker(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Choose Image from Board</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-4 gap-3 max-h-96 overflow-y-auto p-1">
              {zipImages.map(img => (
                <button
                  key={img.name}
                  className="border rounded p-1 hover:border-primary transition-colors text-left"
                  onClick={async () => {
                    const itemId = showImagePicker.itemId;
                    // Upload to Supabase Storage
                    const resp = await fetch(img.dataUrl);
                    const blob = await resp.blob();
                    const ext = img.name.split('.').pop() || 'jpg';
                    const path = `${selectedProject.id}/${itemId}.${ext}`;
                    const { error } = await supabase.storage.from('interiors-images').upload(path, blob, { upsert: true });
                    if (!error) {
                      const { data: urlData } = supabase.storage.from('interiors-images').getPublicUrl(path);
                      await updateItemField(itemId, 'image_url', urlData.publicUrl);
                      toast.success('Image updated');
                    }
                    setShowImagePicker(null);
                  }}
                >
                  <img src={img.dataUrl} alt={img.name} className="w-full h-20 object-contain rounded bg-white" />
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{img.name}</p>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Scan Preview Modal */}
      {showScanModal && (
        <Dialog open onOpenChange={v => { if (!v && !importingItems) setShowScanModal(false); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Review Scanned Items — {scannedRooms.length} room{scannedRooms.length !== 1 ? 's' : ''},{' '}
                {scannedRooms.reduce((n, r) => n + r.items.length, 0)} items
              </DialogTitle>
            </DialogHeader>

            <p className="text-xs text-muted-foreground -mt-1">Each room will be created as a new section. Edit names and items before importing.</p>

            <div className="space-y-4">
              {scannedRooms.map((sr, roomIdx) => (
                <div key={roomIdx} className="border rounded-lg overflow-hidden">
                  {/* Room name header — editable */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 text-secondary-foreground border-b">
                    <span className="text-xs font-semibold uppercase tracking-wide opacity-70 w-20">Room</span>
                    <Input
                      value={sr.name}
                      onChange={e => setScannedRooms(prev => prev.map((r, i) => i === roomIdx ? { ...r, name: e.target.value } : r))}
                      className="h-7 text-sm font-semibold max-w-xs border-0 bg-white/20 focus-visible:ring-1 px-2"
                    />
                    <span className="text-xs opacity-60 ml-auto">{sr.items.length} item{sr.items.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Items table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground bg-muted/10">
                          <th className="px-2 py-1.5 text-left w-14">Image</th>
                          <th className="px-2 py-1.5 text-left">Item</th>
                          <th className="px-2 py-1.5 text-left">Vendor</th>
                          <th className="px-2 py-1.5 text-left">Finish/Color</th>
                          <th className="px-2 py-1.5 text-left">Description</th>
                          {zipImages.length > 0 && <th className="px-2 py-1.5 text-left w-20">Photo</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sr.items.map((si, itemIdx) => (
                          <tr key={itemIdx} className="border-b hover:bg-muted/10">
                            <td className="px-2 py-1.5">
                              {si.image_url ? (
                                <img src={si.image_url} alt="" className="w-12 h-12 object-contain rounded border bg-white" />
                              ) : (
                                <div className="w-12 h-12 rounded border bg-muted/20 flex items-center justify-center">
                                  <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              <Input value={si.item ?? ''} onChange={e => setScannedRooms(prev => prev.map((r, ri) => ri !== roomIdx ? r : { ...r, items: r.items.map((s, ii) => ii === itemIdx ? { ...s, item: e.target.value } : s) }))} className="h-7 text-xs px-1" />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input value={si.vendor ?? ''} onChange={e => setScannedRooms(prev => prev.map((r, ri) => ri !== roomIdx ? r : { ...r, items: r.items.map((s, ii) => ii === itemIdx ? { ...s, vendor: e.target.value } : s) }))} className="h-7 text-xs px-1" />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input value={si.finish_color ?? ''} onChange={e => setScannedRooms(prev => prev.map((r, ri) => ri !== roomIdx ? r : { ...r, items: r.items.map((s, ii) => ii === itemIdx ? { ...s, finish_color: e.target.value } : s) }))} className="h-7 text-xs px-1" />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input value={si.description ?? ''} onChange={e => setScannedRooms(prev => prev.map((r, ri) => ri !== roomIdx ? r : { ...r, items: r.items.map((s, ii) => ii === itemIdx ? { ...s, description: e.target.value } : s) }))} className="h-7 text-xs px-1" />
                            </td>
                            {zipImages.length > 0 && (
                              <td className="px-2 py-1.5">
                                <button
                                  onClick={() => setShowZipPicker({ roomIdx, itemIdx })}
                                  className="border rounded px-2 py-1 text-xs hover:bg-accent"
                                >
                                  {si.assigned_image ? si.assigned_image.slice(0, 14) + '…' : 'Pick photo'}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowScanModal(false)} disabled={importingItems}>Cancel</Button>
              <Button size="sm" onClick={handleImport} disabled={importingItems} className="gap-1.5">
                {importingItems ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Import {scannedRooms.reduce((n, r) => n + r.items.length, 0)} Items into {scannedRooms.length} Room{scannedRooms.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ZIP Image picker for scan modal */}
      {showZipPicker !== null && (
        <Dialog open onOpenChange={() => setShowZipPicker(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Choose Photo</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-4 gap-3 max-h-96 overflow-y-auto p-1">
              {zipImages.map(img => (
                <button
                  key={img.name}
                  className="border rounded p-1 hover:border-primary transition-colors text-left"
                  onClick={() => {
                    const { roomIdx, itemIdx } = showZipPicker!;
                    setScannedRooms(prev => prev.map((r, ri) => ri !== roomIdx ? r : {
                      ...r,
                      items: r.items.map((s, ii) => ii === itemIdx ? { ...s, assigned_image: img.name, image_url: img.dataUrl } : s)
                    }));
                    setShowZipPicker(null);
                  }}
                >
                  <img src={img.dataUrl} alt={img.name} className="w-full h-20 object-contain rounded bg-white" />
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{img.name}</p>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
    </ErrorBoundary>
  );
}
