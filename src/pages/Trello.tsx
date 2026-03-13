import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Plus, X, Loader2, Kanban } from 'lucide-react';

interface TrelloBoard  { id: string; name: string; url: string; }
interface TrelloList   { id: string; name: string; pos: number; }
interface TrelloMember { id: string; fullName: string; username: string; avatarHash: string | null; }
interface TrelloLabel  { id: string; name: string; color: string; }
interface TrelloCard   {
  id: string; name: string; desc: string; idList: string; pos: number;
  url: string; due: string | null; idMembers: string[]; idLabels: string[];
}

const LABEL_COLORS: Record<string, string> = {
  red: '#eb5a46', orange: '#ff9f1a', yellow: '#f2d600', green: '#61bd4f',
  blue: '#0079bf', purple: '#c377e0', pink: '#ff78cb', sky: '#00c2e0',
  lime: '#51e898', black: '#344563',
};

const LIST_PALETTE = [
  { bg: '#4f81bd', light: 'rgba(79,129,189,0.10)',  border: 'rgba(79,129,189,0.25)' },
  { bg: '#c37e87', light: 'rgba(195,126,135,0.10)', border: 'rgba(195,126,135,0.25)' },
  { bg: '#5a9e6f', light: 'rgba(90,158,111,0.10)',  border: 'rgba(90,158,111,0.25)' },
  { bg: '#8b7cc8', light: 'rgba(139,124,200,0.10)', border: 'rgba(139,124,200,0.25)' },
  { bg: '#c9834e', light: 'rgba(201,131,78,0.10)',  border: 'rgba(201,131,78,0.25)' },
  { bg: '#4a9b8e', light: 'rgba(74,155,142,0.10)',  border: 'rgba(74,155,142,0.25)' },
];

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

function memberInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function MemberAvatar({ member }: { member: TrelloMember }) {
  if (member.avatarHash) {
    return (
      <img
        src={`https://trello-members.s3.amazonaws.com/${member.avatarHash}/50.png`}
        className="w-6 h-6 rounded-full object-cover border border-white"
        title={member.fullName}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold border border-white" title={member.fullName}>
      {memberInitials(member.fullName)}
    </div>
  );
}

// ── Board selector ────────────────────────────────────────────────────────────

function BoardSelector({ boards, loading, error, selectedBoardId, onSelect, onLink, linking }: {
  boards: TrelloBoard[]; loading: boolean; error: string;
  selectedBoardId: string; onSelect: (id: string) => void; onLink: () => void; linking: boolean;
}) {
  if (loading) return <div className="flex items-center gap-2 text-muted-foreground text-sm pt-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading boards...</div>;
  if (error) return <div className="pt-2 space-y-1"><p className="text-sm text-destructive">{error}</p><p className="text-xs text-muted-foreground">Check your Trello API key and token in Vercel.</p></div>;
  if (boards.length === 0) return (
    <div className="pt-2 space-y-3">
      <p className="text-sm text-muted-foreground">No boards found. Create one in Trello first.</p>
      <a href="https://trello.com/b/create" target="_blank" rel="noopener noreferrer">
        <Button variant="outline" className="w-full"><ExternalLink className="h-4 w-4 mr-2" /> Create board in Trello</Button>
      </a>
    </div>
  );
  return (
    <div className="space-y-4 pt-2">
      <Select value={selectedBoardId} onValueChange={onSelect}>
        <SelectTrigger><SelectValue placeholder="Select a board" /></SelectTrigger>
        <SelectContent>{boards.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
      </Select>
      <Button onClick={onLink} disabled={!selectedBoardId || linking} className="w-full">
        {linking && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Link Board
      </Button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TrelloPage() {
  const { selectedProject } = useProject();
  const pid = selectedProject.id;

  const [linkedBoardId, setLinkedBoardId]   = useState<string | null>(null);
  const [boardName, setBoardName]           = useState('');
  const [linkedBoardUrl, setLinkedBoardUrl] = useState('');
  const [boards, setBoards]     = useState<TrelloBoard[]>([]);
  const [lists, setLists]       = useState<TrelloList[]>([]);
  const [cards, setCards]       = useState<TrelloCard[]>([]);
  const [members, setMembers]   = useState<TrelloMember[]>([]);
  const [labels, setLabels]     = useState<TrelloLabel[]>([]);
  const [loading, setLoading]   = useState(true);
  const [boardLoading, setBoardLoading] = useState(false);

  // Link dialog
  const [linkOpen, setLinkOpen]               = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [linking, setLinking]                 = useState(false);
  const [boardsLoading, setBoardsLoading]     = useState(false);
  const [boardsError, setBoardsError]         = useState('');

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
  const [movingCard, setMovingCard] = useState<TrelloCard | null>(null);

  // Card detail
  const [detailCard, setDetailCard] = useState<TrelloCard | null>(null);
  const [editName, setEditName]     = useState('');
  const [editDesc, setEditDesc]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [togglingMember, setTogglingMember] = useState('');
  const [togglingLabel, setTogglingLabel]   = useState('');

  // Load linked board
  useEffect(() => {
    setLoading(true);
    setLinkedBoardId(null); setLists([]); setCards([]); setMembers([]); setLabels([]);
    supabase.from('trello_board_links' as any).select('board_id,board_url,board_name')
      .eq('project_id', pid).maybeSingle()
      .then(({ data }) => {
        if (data && (data as any).board_id) {
          setLinkedBoardId((data as any).board_id);
          setLinkedBoardUrl((data as any).board_url || '');
          setBoardName((data as any).board_name || '');
        }
        setLoading(false);
      });
  }, [pid]);

  // Load board data
  useEffect(() => {
    if (!linkedBoardId) return;
    setBoardLoading(true);
    trelloFetch('GET', 'board', { boardId: linkedBoardId })
      .then(({ board, lists: l, cards: c, members: m, labels: lb }) => {
        if (board?.name) { setBoardName(board.name); setLinkedBoardUrl(board.url || linkedBoardUrl); }
        setLists(l.sort((a: TrelloList, b: TrelloList) => a.pos - b.pos));
        setCards(c.sort((a: TrelloCard, b: TrelloCard) => a.pos - b.pos));
        setMembers(m || []);
        setLabels((lb || []).filter((lb: TrelloLabel) => lb.color));
      })
      .catch(console.error)
      .finally(() => setBoardLoading(false));
  }, [linkedBoardId]);

  useEffect(() => {
    if (addingToList && addInputRef.current) addInputRef.current.focus();
  }, [addingToList]);

  async function openLinkDialog() {
    setLinkOpen(true); setBoardsError(''); setBoardsLoading(true);
    try {
      const data = await trelloFetch('GET', 'boards');
      setBoards(Array.isArray(data) ? data : []);
    } catch (e: any) { setBoardsError(e.message || 'Failed to load boards'); }
    setBoardsLoading(false);
  }

  async function handleLink() {
    if (!selectedBoardId) return;
    setLinking(true);
    const board = boards.find(b => b.id === selectedBoardId);
    await supabase.from('trello_board_links' as any).upsert({
      project_id: pid, board_id: selectedBoardId,
      board_name: board?.name || '', board_url: board?.url || '',
    }, { onConflict: 'project_id' });
    setLinkedBoardId(selectedBoardId);
    setBoardName(board?.name || '');
    setLinkedBoardUrl(board?.url || '');
    setLinkOpen(false); setLinking(false);
  }

  async function handleAddCard(listId: string) {
    const name = newCardName.trim();
    if (!name) { setAddingToList(null); return; }
    setSavingCard(true);
    try {
      const card = await trelloFetch('POST', 'card', {}, { name, idList: listId });
      setCards(prev => [...prev, { ...card, idMembers: card.idMembers || [], idLabels: card.idLabels || [] }]);
    } catch (e) { console.error(e); }
    setNewCardName(''); setAddingToList(null); setSavingCard(false);
  }

  async function handleAddList() {
    const name = newListName.trim();
    if (!name || !linkedBoardId) { setAddingList(false); return; }
    setSavingList(true);
    try {
      const list = await trelloFetch('POST', 'list', {}, { name, idBoard: linkedBoardId });
      setLists(prev => [...prev, list]);
    } catch (e) { console.error(e); }
    setNewListName(''); setAddingList(false); setSavingList(false);
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
    setDetailCard(card); setEditName(card.name); setEditDesc(card.desc || '');
  }

  async function handleSaveDetail() {
    if (!detailCard) return;
    setSaving(true);
    try {
      const updated = await trelloFetch('PUT', 'card', { cardId: detailCard.id }, { name: editName, desc: editDesc });
      setCards(prev => prev.map(c => c.id === updated.id ? { ...c, name: updated.name, desc: updated.desc } : c));
      setDetailCard(prev => prev ? { ...prev, name: updated.name, desc: updated.desc } : null);
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

  async function handleToggleMember(memberId: string) {
    if (!detailCard) return;
    setTogglingMember(memberId);
    const has = detailCard.idMembers.includes(memberId);
    try {
      if (has) {
        await trelloFetch('DELETE', 'card/member', { cardId: detailCard.id, memberId });
        const updated = { ...detailCard, idMembers: detailCard.idMembers.filter(m => m !== memberId) };
        setDetailCard(updated);
        setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
      } else {
        await trelloFetch('POST', 'card/member', { cardId: detailCard.id }, { memberId });
        const updated = { ...detailCard, idMembers: [...detailCard.idMembers, memberId] };
        setDetailCard(updated);
        setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
      }
    } catch (e) { console.error(e); }
    setTogglingMember('');
  }

  async function handleToggleLabel(labelId: string) {
    if (!detailCard) return;
    setTogglingLabel(labelId);
    const has = detailCard.idLabels.includes(labelId);
    try {
      if (has) {
        await trelloFetch('DELETE', 'card/label', { cardId: detailCard.id, labelId });
        const updated = { ...detailCard, idLabels: detailCard.idLabels.filter(l => l !== labelId) };
        setDetailCard(updated);
        setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
      } else {
        await trelloFetch('POST', 'card/label', { cardId: detailCard.id }, { labelId });
        const updated = { ...detailCard, idLabels: [...detailCard.idLabels, labelId] };
        setDetailCard(updated);
        setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
      }
    } catch (e) { console.error(e); }
    setTogglingLabel('');
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!linkedBoardId) return (
    <div className="p-6 max-w-md mx-auto mt-20 text-center space-y-4">
      <Kanban className="h-12 w-12 mx-auto text-muted-foreground" />
      <h2 className="text-xl font-semibold">No Trello board linked</h2>
      <p className="text-muted-foreground text-sm">Link a board to <strong>{selectedProject.name}</strong>.</p>
      <Button onClick={openLinkDialog}>Link a Trello Board</Button>
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link Trello Board</DialogTitle></DialogHeader>
          <BoardSelector boards={boards} loading={boardsLoading} error={boardsError}
            selectedBoardId={selectedBoardId} onSelect={setSelectedBoardId} onLink={handleLink} linking={linking} />
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold">{boardName || selectedProject.name}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openLinkDialog}>Change Board</Button>
          {linkedBoardUrl && (
            <a href={linkedBoardUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1" /> Open in Trello</Button>
            </a>
          )}
        </div>
      </div>

      {boardLoading ? (
        <div className="flex items-center justify-center flex-1"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        // ── Wrapping grid — lists flow to next row instead of scrolling right ──
        <div className="flex flex-wrap gap-4 p-6 overflow-y-auto items-start content-start">
          {lists.map((list, idx) => {
            const listCards = cards.filter(c => c.idList === list.id);
            const color = LIST_PALETTE[idx % LIST_PALETTE.length];
            return (
              <div key={list.id} className="flex flex-col w-64 shrink-0 rounded-xl overflow-hidden"
                style={{ border: `1px solid ${color.border}`, background: color.light }}>
                {/* List header */}
                <div className="px-3 py-3 font-semibold text-sm text-white" style={{ backgroundColor: color.bg }}>
                  {list.name}
                  <span className="ml-2 text-xs font-normal opacity-75">({listCards.length})</span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 p-2 min-h-[40px]">
                  {listCards.map(card => {
                    const cardMembers = members.filter(m => card.idMembers?.includes(m.id));
                    const cardLabels  = labels.filter(l => card.idLabels?.includes(l.id));
                    return (
                      <div key={card.id}
                        className="bg-background rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:border-primary/40 transition-colors"
                        onClick={() => openDetail(card)}>
                        {/* Labels */}
                        {cardLabels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {cardLabels.map(lbl => (
                              <span key={lbl.id} className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                                style={{ backgroundColor: LABEL_COLORS[lbl.color] || '#888' }}>
                                {lbl.name || lbl.color}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="leading-snug">{card.name}</span>
                        {card.desc && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.desc}</p>}
                        {card.due && <p className="text-xs text-muted-foreground mt-1">Due: {new Date(card.due).toLocaleDateString()}</p>}
                        {/* Members */}
                        {cardMembers.length > 0 && (
                          <div className="flex mt-2 -space-x-1">
                            {cardMembers.map(m => <MemberAvatar key={m.id} member={m} />)}
                          </div>
                        )}
                        {/* Move button */}
                        <button className="text-xs text-muted-foreground hover:text-foreground mt-1.5 block"
                          onClick={e => { e.stopPropagation(); setMovingCard(card); }}>
                          Move →
                        </button>
                      </div>
                    );
                  })}

                  {/* Add card */}
                  {addingToList === list.id ? (
                    <div className="space-y-1">
                      <Input ref={addInputRef} value={newCardName} onChange={e => setNewCardName(e.target.value)}
                        placeholder="Card name..." className="text-sm h-8"
                        onKeyDown={e => { if (e.key === 'Enter') handleAddCard(list.id); if (e.key === 'Escape') { setAddingToList(null); setNewCardName(''); } }} />
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
                    <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1 px-1 rounded transition-colors"
                      onClick={() => setAddingToList(list.id)}>
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
                <Input value={newListName} onChange={e => setNewListName(e.target.value)}
                  placeholder="List name..." className="text-sm h-8" autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleAddList(); if (e.key === 'Escape') { setAddingList(false); setNewListName(''); } }} />
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
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground bg-muted/20 hover:bg-muted/40 rounded-xl border border-dashed border-border px-4 py-3 w-full transition-colors"
                onClick={() => setAddingList(true)}>
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
              <button key={l.id}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${movingCard?.idList === l.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => movingCard && handleMoveCard(movingCard, l.id)}>
                {l.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Card detail dialog */}
      <Dialog open={!!detailCard} onOpenChange={open => { if (!open) setDetailCard(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Card</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Title */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1" />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Add a description..." />
            </div>

            {/* Labels */}
            {labels.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Labels</label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {labels.map(lbl => {
                    const active = detailCard?.idLabels.includes(lbl.id);
                    return (
                      <button key={lbl.id}
                        onClick={() => handleToggleLabel(lbl.id)}
                        disabled={togglingLabel === lbl.id}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-opacity ${active ? 'opacity-100' : 'opacity-35'}`}
                        style={{ backgroundColor: LABEL_COLORS[lbl.color] || '#888', color: '#fff' }}>
                        {togglingLabel === lbl.id ? '...' : (lbl.name || lbl.color)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Members */}
            {members.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Members</label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {members.map(m => {
                    const active = detailCard?.idMembers.includes(m.id);
                    return (
                      <button key={m.id} onClick={() => handleToggleMember(m.id)} disabled={togglingMember === m.id}
                        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-colors ${active ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                        <MemberAvatar member={m} />
                        {m.fullName}
                        {togglingMember === m.id && <Loader2 className="h-3 w-3 animate-spin" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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

      {/* Link board dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link Trello Board</DialogTitle></DialogHeader>
          <BoardSelector boards={boards} loading={boardsLoading} error={boardsError}
            selectedBoardId={selectedBoardId} onSelect={setSelectedBoardId} onLink={handleLink} linking={linking} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
