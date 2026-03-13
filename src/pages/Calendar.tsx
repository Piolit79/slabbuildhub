import React, { useState, useEffect } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, parseISO, addDays,
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Plus, Loader2, CalendarDays, X, Trash2 } from 'lucide-react';

interface CalEvent {
  uid: string; href: string; etag: string;
  title: string; description: string;
  start: string; end: string; allDay: boolean;
}

interface Settings { connected: boolean; calendarName?: string; calendarUrl?: string; }
interface ICloudCalendar { name: string; url: string; }

const EVENT_COLORS = [
  '#4f81bd','#c37e87','#3d6594','#a6636b','#6a8fbf','#b87e8a',
];

async function caldavFetch(method: string, action: string, params: Record<string,string> = {}, body?: object) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const r = await fetch(`/api/caldav?${qs}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error || `Error ${r.status}`);
  return json;
}

function colorForEvent(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
}

// ── Connect iCloud dialog ─────────────────────────────────────────────────────

function ConnectDialog({
  open, onClose, onConnected,
}: { open: boolean; onClose: () => void; onConnected: () => void }) {
  const [step, setStep] = useState<'creds' | 'pick'>('creds');
  const [appleId, setAppleId] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [calendars, setCalendars] = useState<ICloudCalendar[]>([]);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConnect() {
    setError(''); setLoading(true);
    try {
      const { calendars: cals } = await caldavFetch('POST', 'connect', {}, { appleId, appPassword });
      setCalendars(cals);
      if (cals.length > 0) setSelectedUrl(cals[0].url);
      setStep('pick');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function handleSave() {
    const cal = calendars.find(c => c.url === selectedUrl);
    setLoading(true);
    try {
      await caldavFetch('POST', 'save', {}, {
        appleId, appPassword, calendarUrl: selectedUrl, calendarName: cal?.name || 'Calendar',
      });
      onConnected();
      onClose();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Connect iCloud Calendar</DialogTitle></DialogHeader>
        {step === 'creds' ? (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Use an <strong>app-specific password</strong> — not your Apple ID password.
              Generate one at <strong>appleid.apple.com → Sign-In & Security → App-Specific Passwords</strong>.
            </p>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Apple ID (email)</label>
              <Input className="mt-1" value={appleId} onChange={e => setAppleId(e.target.value)} placeholder="you@icloud.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">App-Specific Password</label>
              <Input className="mt-1" type="password" value={appPassword} onChange={e => setAppPassword(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleConnect} disabled={!appleId || !appPassword || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Connect
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">Select which calendar to sync:</p>
            {calendars.length === 0 ? (
              <p className="text-sm text-muted-foreground">No calendars found.</p>
            ) : (
              <Select value={selectedUrl} onValueChange={setSelectedUrl}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {calendars.map(c => <SelectItem key={c.url} value={c.url}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleSave} disabled={!selectedUrl || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Use This Calendar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Add event dialog ──────────────────────────────────────────────────────────

function AddEventDialog({
  open, defaultDate, onClose, onSaved,
}: { open: boolean; defaultDate: Date; onClose: () => void; onSaved: (e: CalEvent) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [date, setDate] = useState(format(defaultDate, 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setDate(format(defaultDate, 'yyyy-MM-dd')); }, [defaultDate]);

  async function handleSave() {
    if (!title.trim()) return;
    setError(''); setSaving(true);
    try {
      const start = allDay ? date : `${date}T${startTime}:00Z`;
      const end   = allDay ? format(addDays(parseISO(date), 1), 'yyyy-MM-dd') : `${date}T${endTime}:00Z`;
      const result = await caldavFetch('POST', 'event', {}, { title: title.trim(), description, start, end, allDay });
      onSaved({
        uid: result.uid, href: result.href, etag: '',
        title: title.trim(), description, start, end, allDay,
      });
      setTitle(''); setDescription('');
      onClose();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Event — {format(defaultDate, 'MMMM d, yyyy')}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title</label>
            <Input className="mt-1" value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title" autoFocus />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="allday" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="rounded" />
            <label htmlFor="allday" className="text-sm">All day</label>
          </div>

          {!allDay && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start</label>
                <Input type="time" className="mt-1" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">End</label>
                <Input type="time" className="mt-1" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes..."
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!title.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Event detail dialog ───────────────────────────────────────────────────────

function EventDetailDialog({
  event, onClose, onDeleted,
}: { event: CalEvent | null; onClose: () => void; onDeleted: (uid: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!event) return;
    setDeleting(true);
    try {
      await caldavFetch('DELETE', 'event', { href: encodeURIComponent(event.href) });
      onDeleted(event.uid);
      onClose();
    } catch (e: any) { setError(e.message); }
    setDeleting(false);
  }

  if (!event) return null;

  const startDate = event.allDay ? parseISO(event.start) : new Date(event.start);
  const endDate   = event.allDay ? parseISO(event.end) : new Date(event.end);

  return (
    <Dialog open={!!event} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{event.title}</DialogTitle></DialogHeader>
        <div className="space-y-2 pt-1 text-sm">
          <p className="text-muted-foreground">
            {event.allDay
              ? format(startDate, 'MMMM d, yyyy')
              : `${format(startDate, 'MMM d, yyyy h:mm a')} – ${format(endDate, 'h:mm a')}`}
          </p>
          {event.description && <p className="whitespace-pre-wrap">{event.description}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-between pt-2">
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-1" />Delete</>}
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Calendar page ────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [addDate, setAddDate] = useState<Date | null>(null);
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null);

  // Load settings on mount
  useEffect(() => {
    caldavFetch('GET', 'settings')
      .then(s => setSettings(s))
      .catch(() => setSettings({ connected: false }))
      .finally(() => setLoading(false));
  }, []);

  // Load events when month or connection changes
  useEffect(() => {
    if (!settings?.connected) return;
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd'T'00:00:00'Z'");
    const end   = format(endOfMonth(currentMonth),   "yyyy-MM-dd'T'23:59:59'Z'");
    setEventsLoading(true);
    caldavFetch('GET', 'events', { start, end })
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setEventsLoading(false));
  }, [settings, currentMonth]);

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const gridStart  = startOfWeek(monthStart);
  const gridEnd    = endOfWeek(monthEnd);
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function eventsOnDay(day: Date) {
    return events.filter(e => {
      const s = e.allDay ? parseISO(e.start) : new Date(e.start);
      return isSameDay(s, day);
    });
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!settings?.connected) return (
    <div className="p-6 max-w-md mx-auto mt-20 text-center space-y-4">
      <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground" />
      <h2 className="text-xl font-semibold">Calendar</h2>
      <p className="text-muted-foreground text-sm">Connect your iCloud calendar to view and add events.</p>
      <Button onClick={() => setConnectOpen(true)}>Connect iCloud Calendar</Button>
      <ConnectDialog
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnected={() => {
          caldavFetch('GET', 'settings').then(s => setSettings(s));
        }}
      />
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold w-44 text-center">{format(currentMonth, 'MMMM yyyy')}</h1>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
          {eventsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
          <Button size="sm" onClick={() => setAddDate(new Date())}>
            <Plus className="h-4 w-4 mr-1" /> Add Event
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConnectOpen(true)} className="text-xs text-muted-foreground">
            {settings.calendarName || 'iCloud'}
          </Button>
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-border">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto" style={{ gridAutoRows: 'minmax(100px, 1fr)' }}>
        {days.map(day => {
          const dayEvents = eventsOnDay(day);
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`border-b border-r border-border p-1 flex flex-col cursor-pointer group transition-colors ${
                inMonth ? 'bg-background' : 'bg-muted/20'
              } hover:bg-muted/30`}
              onClick={() => setAddDate(day)}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                  today
                    ? 'bg-primary text-primary-foreground'
                    : inMonth ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {format(day, 'd')}
                </span>
                <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Events */}
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map(e => (
                  <button
                    key={e.uid}
                    className="text-left text-xs px-1.5 py-0.5 rounded truncate text-white font-medium"
                    style={{ backgroundColor: colorForEvent(e.uid) }}
                    onClick={ev => { ev.stopPropagation(); setDetailEvent(e); }}
                  >
                    {e.allDay ? '' : format(new Date(e.start), 'h:mma ').toLowerCase()}
                    {e.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-xs text-muted-foreground px-1">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialogs */}
      <ConnectDialog
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnected={() => caldavFetch('GET', 'settings').then(s => setSettings(s))}
      />

      <AddEventDialog
        open={!!addDate}
        defaultDate={addDate || new Date()}
        onClose={() => setAddDate(null)}
        onSaved={e => { setEvents(prev => [...prev, e]); setAddDate(null); }}
      />

      <EventDetailDialog
        event={detailEvent}
        onClose={() => setDetailEvent(null)}
        onDeleted={uid => setEvents(prev => prev.filter(e => e.uid !== uid))}
      />
    </div>
  );
}
