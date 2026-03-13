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
import { ChevronLeft, ChevronRight, Plus, Loader2, CalendarDays, Trash2, Settings2 } from 'lucide-react';

interface CalEvent {
  uid: string; href: string; etag: string; calendarId: string;
  title: string; description: string; start: string; end: string; allDay: boolean;
}
interface LinkedCal { id: string; calendar_name: string; color: string; active: boolean; }
interface ICloudCal  { name: string; url: string; }

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

// ── Add Calendar dialog ───────────────────────────────────────────────────────

function AddCalendarDialog({ open, onClose, onAdded }: {
  open: boolean; onClose: () => void; onAdded: (cal: LinkedCal) => void;
}) {
  const [step, setStep] = useState<'creds'|'pick'>('creds');
  const [appleId, setAppleId] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [available, setAvailable] = useState<ICloudCal[]>([]);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function reset() { setStep('creds'); setAppleId(''); setAppPassword(''); setAvailable([]); setSelectedUrl(''); setError(''); }

  async function handleConnect() {
    setError(''); setLoading(true);
    try {
      const { calendars } = await caldavFetch('POST', 'connect', {}, { appleId, appPassword });
      setAvailable(calendars);
      if (calendars.length) setSelectedUrl(calendars[0].url);
      setStep('pick');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function handleAdd() {
    const cal = available.find(c => c.url === selectedUrl);
    setLoading(true);
    try {
      const added = await caldavFetch('POST', 'add', {}, {
        appleId, appPassword, calendarUrl: selectedUrl, calendarName: cal?.name || 'Calendar',
      });
      onAdded(added);
      reset(); onClose();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add iCloud Calendar</DialogTitle></DialogHeader>
        {step === 'creds' ? (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Enter your Apple ID and an <strong>app-specific password</strong> from
              <strong> appleid.apple.com → Sign-In & Security → App-Specific Passwords</strong>.
            </p>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Apple ID</label>
              <Input className="mt-1" value={appleId} onChange={e => setAppleId(e.target.value)} placeholder="you@icloud.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">App-Specific Password</label>
              <Input className="mt-1" type="password" value={appPassword} onChange={e => setAppPassword(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleConnect} disabled={!appleId || !appPassword || loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Connect
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">Select a calendar to add:</p>
            {available.length === 0 ? <p className="text-sm text-muted-foreground">No calendars found.</p> : (
              <Select value={selectedUrl} onValueChange={setSelectedUrl}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {available.map(c => <SelectItem key={c.url} value={c.url}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('creds')}>Back</Button>
              <Button className="flex-1" onClick={handleAdd} disabled={!selectedUrl || loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Add
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Add Event dialog ──────────────────────────────────────────────────────────

function AddEventDialog({ open, defaultDate, calendars, onClose, onSaved }: {
  open: boolean; defaultDate: Date; calendars: LinkedCal[];
  onClose: () => void; onSaved: (e: CalEvent) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [date, setDate] = useState(format(defaultDate, 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [calendarId, setCalendarId] = useState(calendars[0]?.id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setDate(format(defaultDate, 'yyyy-MM-dd')); }, [defaultDate]);
  useEffect(() => { if (calendars.length && !calendarId) setCalendarId(calendars[0].id); }, [calendars]);

  async function handleSave() {
    if (!title.trim() || !calendarId) return;
    setError(''); setSaving(true);
    try {
      const start = allDay ? date : `${date}T${startTime}:00Z`;
      const end   = allDay ? format(addDays(parseISO(date), 1), 'yyyy-MM-dd') : `${date}T${endTime}:00Z`;
      const result = await caldavFetch('POST', 'event', {}, { title: title.trim(), description, start, end, allDay, calendarId });
      onSaved({ uid: result.uid, href: result.href, etag: '', calendarId, title: title.trim(), description, start, end, allDay });
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
          {calendars.length > 1 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Calendar</label>
              <Select value={calendarId} onValueChange={setCalendarId}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {calendars.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: c.color }} />
                        {c.calendar_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
            <textarea className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes..." />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!title.trim() || !calendarId || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Event detail dialog ───────────────────────────────────────────────────────

function EventDetailDialog({ event, calendars, onClose, onDeleted }: {
  event: CalEvent | null; calendars: LinkedCal[];
  onClose: () => void; onDeleted: (uid: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!event) return;
    setDeleting(true);
    try {
      await caldavFetch('DELETE', 'event', { href: encodeURIComponent(event.href), calendarId: event.calendarId });
      onDeleted(event.uid); onClose();
    } catch (e: any) { setError(e.message); }
    setDeleting(false);
  }

  if (!event) return null;
  const cal = calendars.find(c => c.id === event.calendarId);
  const startDate = event.allDay ? parseISO(event.start) : new Date(event.start);
  const endDate   = event.allDay ? parseISO(event.end)   : new Date(event.end);

  return (
    <Dialog open={!!event} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {cal && <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cal.color }} />}
            {event.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 pt-1 text-sm">
          {cal && <p className="text-xs text-muted-foreground">{cal.calendar_name}</p>}
          <p className="text-muted-foreground">
            {event.allDay
              ? format(startDate, 'MMMM d, yyyy')
              : `${format(startDate,'MMM d, yyyy h:mm a')} – ${format(endDate,'h:mm a')}`}
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

// ── Manage Calendars dialog ───────────────────────────────────────────────────

function ManageDialog({ open, calendars, onClose, onRemoved, onToggled }: {
  open: boolean; calendars: LinkedCal[]; onClose: () => void;
  onRemoved: (id: string) => void; onToggled: (id: string, active: boolean) => void;
}) {
  const [removing, setRemoving] = useState<string|null>(null);

  async function handleRemove(id: string) {
    setRemoving(id);
    try { await caldavFetch('DELETE', 'calendar', { id }); onRemoved(id); }
    catch (e) { console.error(e); }
    setRemoving(null);
  }

  async function handleToggle(id: string, active: boolean) {
    try { await caldavFetch('PATCH', 'calendar', { id }, { active }); onToggled(id, active); }
    catch (e) { console.error(e); }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Manage Calendars</DialogTitle></DialogHeader>
        <div className="space-y-2 pt-1">
          {calendars.length === 0 && <p className="text-sm text-muted-foreground">No calendars linked.</p>}
          {calendars.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-2 py-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="text-sm truncate">{c.calendar_name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input type="checkbox" checked={c.active} onChange={e => handleToggle(c.id, e.target.checked)} className="rounded" />
                <button onClick={() => handleRemove(c.id)} disabled={removing === c.id}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  {removing === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [calendars, setCalendars] = useState<LinkedCal[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [addCalOpen, setAddCalOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [addDate, setAddDate] = useState<Date|null>(null);
  const [detailEvent, setDetailEvent] = useState<CalEvent|null>(null);

  const activeCalendars = calendars.filter(c => c.active);
  const calMap = Object.fromEntries(calendars.map(c => [c.id, c]));

  useEffect(() => {
    caldavFetch('GET', 'settings')
      .then(s => setCalendars(s.calendars || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeCalendars.length === 0) { setEvents([]); return; }
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd'T'00:00:00'Z'");
    const end   = format(endOfMonth(currentMonth),   "yyyy-MM-dd'T'23:59:59'Z'");
    setEventsLoading(true);
    caldavFetch('GET', 'events', { start, end })
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setEventsLoading(false));
  }, [calendars, currentMonth]);

  const monthStart = startOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(endOfMonth(currentMonth)) });

  function eventsOnDay(day: Date) {
    return events.filter(e => {
      if (calMap[e.calendarId]?.active === false) return false;
      if (e.allDay) {
        const s = parseISO(e.start);
        const end = parseISO(e.end); // DTEND is exclusive for all-day
        return day >= s && day < end;
      }
      return isSameDay(new Date(e.start), day);
    });
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (calendars.length === 0) return (
    <div className="p-6 max-w-md mx-auto mt-20 text-center space-y-4">
      <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground" />
      <h2 className="text-xl font-semibold">Calendar</h2>
      <p className="text-muted-foreground text-sm">Connect your iCloud calendars to get started.</p>
      <Button onClick={() => setAddCalOpen(true)}>
        <Plus className="h-4 w-4 mr-2" /> Add iCloud Calendar
      </Button>
      <AddCalendarDialog open={addCalOpen} onClose={() => setAddCalOpen(false)}
        onAdded={cal => { setCalendars(prev => [...prev, cal]); setAddCalOpen(false); }} />
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold w-44 text-center">{format(currentMonth, 'MMMM yyyy')}</h1>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
          {eventsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {/* Calendar legend */}
        <div className="flex items-center gap-3 flex-wrap">
          {calendars.map(c => (
            <button key={c.id} onClick={() => caldavFetch('PATCH','calendar',{id:c.id},{active:!c.active}).then(()=>setCalendars(prev=>prev.map(p=>p.id===c.id?{...p,active:!p.active}:p)))}
              className={`flex items-center gap-1.5 text-xs transition-opacity ${c.active ? 'opacity-100' : 'opacity-40'}`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              {c.calendar_name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddCalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Calendar
          </Button>
          <Button size="sm" onClick={() => setAddDate(new Date())}>
            <Plus className="h-4 w-4 mr-1" /> Event
          </Button>
        </div>
      </div>

      {/* Day-of-week row */}
      <div className="grid grid-cols-7 border-b border-border">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto" style={{ gridAutoRows: 'minmax(100px, 1fr)' }}>
        {days.map(day => {
          const dayEvents = eventsOnDay(day);
          const inMonth = isSameMonth(day, currentMonth);
          return (
            <div key={day.toISOString()}
              className={`border-b border-r border-border p-1 flex flex-col cursor-pointer group transition-colors hover:bg-muted/30 ${inMonth ? 'bg-background' : 'bg-muted/20'}`}
              onClick={() => setAddDate(day)}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday(day) ? 'bg-primary text-primary-foreground' : inMonth ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {format(day, 'd')}
                </span>
                <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map(e => {
                  const cal = calMap[e.calendarId];
                  return (
                    <button key={e.uid}
                      className="text-left text-xs px-1.5 py-0.5 rounded truncate text-white font-medium"
                      style={{ backgroundColor: cal?.color || '#4f81bd' }}
                      onClick={ev => { ev.stopPropagation(); setDetailEvent(e); }}>
                      {!e.allDay && <span className="opacity-80">{format(new Date(e.start),'h:mma ')} </span>}
                      {e.title}
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className="text-xs text-muted-foreground px-1">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AddCalendarDialog open={addCalOpen} onClose={() => setAddCalOpen(false)}
        onAdded={cal => setCalendars(prev => [...prev, cal])} />

      <ManageDialog open={manageOpen} calendars={calendars} onClose={() => setManageOpen(false)}
        onRemoved={id => setCalendars(prev => prev.filter(c => c.id !== id))}
        onToggled={(id, active) => setCalendars(prev => prev.map(c => c.id === id ? { ...c, active } : c))} />

      <AddEventDialog open={!!addDate} defaultDate={addDate || new Date()}
        calendars={activeCalendars} onClose={() => setAddDate(null)}
        onSaved={e => { setEvents(prev => [...prev, e]); setAddDate(null); }} />

      <EventDetailDialog event={detailEvent} calendars={calendars}
        onClose={() => setDetailEvent(null)}
        onDeleted={uid => setEvents(prev => prev.filter(e => e.uid !== uid))} />
    </div>
  );
}
