import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Plus, X, Loader2, ChevronRight, Kanban } from 'lucide-react';

interface TrelloBoard { id: string; name: string; url: string; }
interface TrelloList  { id: string; name: string; pos: number; }
interface TrelloCard  { id: string; name: string; desc: string; idList: string; pos: number; url: string; due: string | null; }

const SUPABASE_URL = 'https://nlusfndskgdcottasfdy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sdXNmbmRza2dkY290dGFzZmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTY0NDYsImV4cCI6MjA4ODMzMjQ0Nn0.sGSdCsQl0wgAHk5L-xi6ZdrLkuAEaHcdhJ8uazjTjbA';

async function trelloFetch(method: string, action: string, params: Record<string,string> = {}, body?: object) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const r = await fetch(`/api/trello?${qs}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `Trello error ${r.status}`);
  }
  return r.json();
}

export default function TrelloPage() {
  const { selectedProject } = useProject();
  const pid = selectedProject.id;

  const [linkedBoardId, setLinkedBoardId]   = useState<string | null>(null);
  const [linkedBoardUrl, setLinkedBoardUrl] = useState<string>('');
  const [boards, setBoards]   = useState<TrelloBoard[]>([]);
  const [lists, setLists]     = useState<TrelloList[]>([]);
  const [cards, setCards]     = useState<TrelloCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(false);

  // Link board dialog
  const [linkOpen, setLinkOpen]     = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [linking, setLinking]       = useState(false);

  // Add card
  const [addingToList, setAddingToList] = useState<string | null>(null);
  const [newCardName, setNewCardName]   = useState('');
  const [savingCard, setSavingCard]     = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Add list
  const [addingList, setAddingList]   = useState(false);
  const [newListName, setNewListName] = useState('');
  const [savingList, setSavingList]   = useState(false);

  // Move card
  const [movingCard, setMovingCard]   = useState<TrelloCard | null>(null);

  // Card detail
  const [detailCard, setDetailCard] = useState<TrelloCard | null>(null);
  const [editName, setEditName]     = useState('');
  const [editDesc, setEditDesc]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);

  // Load linked board for project
  useEffect(() => {
    setLoading(true);
    setLinkedBoardId(null);
    setLists([]);
    setCards([]);
    supabase
      .from('trello_board_links' as any)
      .select('board_id, board_url')
      .eq('project_id', pid)
      .maybeSingle()
      .then(({ data }) => {
        if (data && (data as any).board_id) {
          setLinkedBoardId((data as any).board_id);
          setLinkedBoardUrl((data as any).board_url || '');
        }
        setLoading(false);
      });
  }, [pid]);

  // Load board data when linked
  useEffect(() => {
    if (!linkedBoardId) return;
    setBoardLoading(true);
    trelloFetch('GET', 'board', { boardId: linkedBoardId })
      .then(({ lists: l, cards: c }) => {
        setLists(l.sort((a: TrelloList, b: TrelloList) => a.pos - b.pos));
        setCards(c.sort((a: TrelloCard, b: TrelloCard) => a.pos - b.pos));
      })
      .catch(console.error)
      .finally(() => setBoardLoading(false));
  }, [linkedBoardId]);

  // Focus add card input
  useEffect(() => {
    if (addingToList && addInputRef.current) addInputRef.current.focus();
  }, [addingToList]);

  async function openLinkDialog() {
    setLinkOpen(true);
    if (boards.length === 0) {
      const data = await trelloFetch('GET', 'boards').catch(() => []);
      setBoards(data);
    }
  }

  async function handleLink() {
    if (!selectedBoardId) return;
    setLinking(true);
    const board = boards.find(b => b.id === selectedBoardId);
    await supabase.from('trello_board_links' as any).upsert({
      project_id: pid,
      board_id: selectedBoardId,
      board_name: board?.name || '',
      board_url: board?.url || '',
    }, { onConflict: 'project_id' });
    setLinkedBoardId(selectedBoardId);
    setLinkedBoardUrl(board?.url || '');
    setLinkOpen(false);
    setLinking(false);
  }

  async function handleAddCard(listId: string) {
    const name = newCardName.trim();
    if (!name) { setAddingToList(null); return; }
    setSavingCard(true);
    try {
      const card = await trelloFetch('POST', 'card', {}, { name, idList: listId });
      setCards(prev => [...prev, card]);
    } catch (e) { console.error(e); }
    setNewCardName('');
    setAddingToList(null);
    setSavingCard(false);
  }

  async function handleAddList() {
    const name = newListName.trim();
    if (!name || !linkedBoardId) { setAddingList(false); return; }
    setSavingList(true);
    try {
      const list = await trelloFetch('POST', 'list', {}, { name, idBoard: linkedBoardId });
      setLists(prev => [...prev, list]);
    } catch (e) { console.error(e); }
    setNewListName('');
    setAddingList(false);
    setSavingList(false);
  }

  async function handleMoveCard(card: TrelloCard, toListId: string) {
    if (card.idList === toListId) { setMovingCard(null); return; }
    try {
      await trelloFetch('PUT', 'card', { cardId: card.id }, { idList: toListId });
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, idList: toListId } : c));
    } catch (e) { console.error(e); }
    setMovingCard(null);
  }

  function openDetail(card: TrelloCard) {
    setDetailCard(card);
    setEditName(card.name);
    setEditDesc(card.desc || '');
  }

  async function handleSaveDetail() {
    if (!detailCard) return;
    setSaving(true);
    try {
      const updated = await trelloFetch('PUT', 'card', { cardId: detailCard.id }, { name: editName, desc: editDesc });
      setCards(prev => prev.map(c => c.id === updated.id ? { ...c, name: updated.name, desc: updated.desc } : c));
      setDetailCard(null);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function handleDeleteCard() {
    if (!detailCard) return;
    setDeleting(true);
    try {
      await trelloFetch('DELETE', 'card', { cardId: detailCard.id });
      setCards(prev => prev.filter(c => c.id !== detailCard.id));
      setDetailCard(null);
    } catch (e) { console.error(e); }
    setDeleting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!linkedBoardId) {
    return (
      <div className="p-6 max-w-md mx-auto mt-20 text-center space-y-4">
        <Kanban className="h-12 w-12 mx-auto text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Trello board linked</h2>
        <p className="text-muted-foreground text-sm">Link a Trello board to <strong>{selectedProject.name}</strong> to manage tasks here.</p>
        <Button onClick={openLinkDialog}>Link a Trello Board</Button>

        <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Link Trello Board</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              {boards.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading your boards...
                </div>
              ) : (
                <Select value={selectedBoardId} onValueChange={setSelectedBoardId}>
                  <SelectTrigger><SelectValue placeholder="Select a board" /></SelectTrigger>
                  <SelectContent>
                    {boards.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={handleLink} disabled={!selectedBoardId || linking} className="w-full">
                {linking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Link Board
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold">{selectedProject.name} — Task Board</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openLinkDialog}>Change Board</Button>
          {linkedBoardUrl && (
            <a href={linkedBoardUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-1" /> Open in Trello
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Board */}
      {boardLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex gap-4 p-6 overflow-x-auto flex-1 items-start">
          {lists.map(list => {
            const listCards = cards.filter(c => c.idList === list.id);
            return (
              <div key={list.id} className="flex flex-col w-64 shrink-0 bg-muted/40 rounded-xl border border-border">
                {/* List header */}
                <div className="px-3 py-3 font-semibold text-sm text-foreground border-b border-border">
                  {list.name}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">({listCards.length})</span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 p-2 flex-1 min-h-[40px]">
                  {listCards.map(card => (
                    <div
                      key={card.id}
                      className="bg-background rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:border-primary/40 transition-colors group"
                      onClick={() => openDetail(card)}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="leading-snug">{card.name}</span>
                        <button
                          className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
                          onClick={e => { e.stopPropagation(); setMovingCard(card); }}
                          title="Move to list"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {card.desc && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.desc}</p>}
                      {card.due && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Due: {new Date(card.due).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}

                  {/* Add card inline */}
                  {addingToList === list.id ? (
                    <div className="space-y-1">
                      <Input
                        ref={addInputRef}
                        value={newCardName}
                        onChange={e => setNewCardName(e.target.value)}
                        placeholder="Card name..."
                        className="text-sm h-8"
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddCard(list.id);
                          if (e.key === 'Escape') { setAddingToList(null); setNewCardName(''); }
                        }}
                      />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-7 text-xs" onClick={() => handleAddCard(list.id)} disabled={savingCard}>
                          {savingCard ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingToList(null); setNewCardName(''); }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1 px-1 rounded transition-colors"
                      onClick={() => setAddingToList(list.id)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add card
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add list */}
          <div className="w-64 shrink-0">
            {addingList ? (
              <div className="bg-muted/40 rounded-xl border border-border p-3 space-y-2">
                <Input
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  placeholder="List name..."
                  className="text-sm h-8"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddList();
                    if (e.key === 'Escape') { setAddingList(false); setNewListName(''); }
                  }}
                />
                <div className="flex gap-1">
                  <Button size="sm" className="h-7 text-xs" onClick={handleAddList} disabled={savingList}>
                    {savingList ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add List'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingList(false); setNewListName(''); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground bg-muted/20 hover:bg-muted/40 rounded-xl border border-dashed border-border px-4 py-3 w-full transition-colors"
                onClick={() => setAddingList(true)}
              >
                <Plus className="h-4 w-4" /> Add list
              </button>
            )}
          </div>
        </div>
      )}

      {/* Move card dialog */}
      <Dialog open={!!movingCard} onOpenChange={open => { if (!open) setMovingCard(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Move to list</DialogTitle></DialogHeader>
          <div className="space-y-1 pt-1">
            {lists.map(l => (
              <button
                key={l.id}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  movingCard?.idList === l.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
                onClick={() => movingCard && handleMoveCard(movingCard, l.id)}
              >
                {l.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Card detail dialog */}
      <Dialog open={!!detailCard} onOpenChange={open => { if (!open) setDetailCard(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Card</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Add a description..."
              />
            </div>
            {detailCard?.url && (
              <a href={detailCard.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3.5 w-3.5" /> Open in Trello
              </a>
            )}
            <div className="flex items-center justify-between pt-1">
              <Button variant="destructive" size="sm" onClick={handleDeleteCard} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setDetailCard(null)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveDetail} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link board dialog (change board) */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link Trello Board</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {boards.length === 0 ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your boards...
              </div>
            ) : (
              <Select value={selectedBoardId} onValueChange={setSelectedBoardId}>
                <SelectTrigger><SelectValue placeholder="Select a board" /></SelectTrigger>
                <SelectContent>
                  {boards.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleLink} disabled={!selectedBoardId || linking} className="w-full">
              {linking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Link Board
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
