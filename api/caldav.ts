import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nlusfndskgdcottasfdy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sdXNmbmRza2dkY290dGFzZmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTY0NDYsImV4cCI6MjA4ODMzMjQ0Nn0.sGSdCsQl0wgAHk5L-xi6ZdrLkuAEaHcdhJ8uazjTjbA';
const CALDAV_BASE = 'https://caldav.icloud.com';

const PALETTE = ['#4f81bd','#c37e87','#5a9e6f','#8b7cc8','#c9834e','#4a9b8e','#c46b9a','#8fa84a'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function basicAuth(email: string, password: string) {
  return 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
}

function db() { return createClient(SUPABASE_URL, SUPABASE_KEY); }

async function caldavReq(method: string, url: string, auth: string, extra: Record<string,string> = {}, body?: string) {
  const headers: Record<string,string> = { Authorization: auth, 'User-Agent': 'SLABHub/1.0', ...extra };
  if (body) headers['Content-Type'] = method === 'PUT' ? 'text/calendar; charset=utf-8' : 'application/xml; charset=utf-8';
  const r = await fetch(url, { method, headers, body, redirect: 'follow' });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

// ── iCal ──────────────────────────────────────────────────────────────────────

function unfold(s: string) { return s.replace(/\r\n[ \t]/g,'').replace(/\r\n/g,'\n').replace(/\n[ \t]/g,''); }

function icsProp(block: string, prop: string) {
  const m = block.match(new RegExp(`^${prop}(?:;[^:]*)?:(.+)$`, 'mi'));
  return m ? m[1].replace(/\\n/g,'\n').replace(/\\,/g,',').replace(/\\;/g,';').trim() : '';
}

function parseICSDate(raw: string): { iso: string; allDay: boolean } {
  const val = raw.includes(':') ? raw.split(':').pop()! : raw;
  const allDay = val.length === 8;
  if (allDay) return { iso: `${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}`, allDay: true };
  const [y,mo,d,h,mi,s] = [val.slice(0,4),val.slice(4,6),val.slice(6,8),val.slice(9,11),val.slice(11,13),val.slice(13,15)||'00'];
  return { iso: `${y}-${mo}-${d}T${h}:${mi}:${s}${val.endsWith('Z')?'Z':''}`, allDay: false };
}

function toICSDate(iso: string, allDay: boolean) {
  if (allDay) return iso.replace(/-/g,'').slice(0,8);
  return iso.replace(/[-:]/g,'').replace(/\.\d+/,'').slice(0,15) + 'Z';
}

function buildICS(uid: string, title: string, desc: string, start: string, end: string, allDay: boolean) {
  const stamp = toICSDate(new Date().toISOString(), false);
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SLAB Hub//EN','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',`UID:${uid}`,`DTSTAMP:${stamp}`,
    allDay ? `DTSTART;VALUE=DATE:${toICSDate(start,true)}` : `DTSTART:${toICSDate(start,false)}`,
    allDay ? `DTEND;VALUE=DATE:${toICSDate(end,true)}`   : `DTEND:${toICSDate(end,false)}`,
    `SUMMARY:${title.replace(/,/g,'\\,').replace(/\n/g,'\\n')}`,
    desc ? `DESCRIPTION:${desc.replace(/,/g,'\\,').replace(/\n/g,'\\n')}` : null,
    'END:VEVENT','END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

interface CalEvent {
  uid: string; href: string; etag: string; calendarId: string;
  title: string; description: string; start: string; end: string; allDay: boolean;
}

function parseEventsXML(xml: string, calendarId: string): CalEvent[] {
  const events: CalEvent[] = [];
  const re = /<(?:[A-Za-z]+:)?response[^>]*>([\s\S]*?)<\/(?:[A-Za-z]+:)?response>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const resp = m[1];
    const hrefM = resp.match(/<(?:[A-Za-z]+:)?href[^>]*>([^<]+)<\/(?:[A-Za-z]+:)?href>/i);
    const etagM = resp.match(/<(?:[A-Za-z]+:)?getetag[^>]*>"?([^<"]+)"?<\/(?:[A-Za-z]+:)?getetag>/i);
    const dataM = resp.match(/<(?:[A-Za-z]+:)?calendar-data[^>]*>([\s\S]*?)<\/(?:[A-Za-z]+:)?calendar-data>/i);
    if (!hrefM || !dataM) continue;
    let raw = dataM[1];
    const cdataM = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
    if (cdataM) raw = cdataM[1];
    raw = raw.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    const ics = unfold(raw);
    const veM = ics.match(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/);
    if (!veM) continue;
    const block = veM[1];
    const uid = icsProp(block,'UID'), dtstart = icsProp(block,'DTSTART');
    if (!uid || !dtstart) continue;
    const s = parseICSDate(dtstart), e = icsProp(block,'DTEND') ? parseICSDate(icsProp(block,'DTEND')) : s;
    events.push({
      uid, href: hrefM[1].trim(), etag: etagM?.[1]?.trim()||'', calendarId,
      title: icsProp(block,'SUMMARY')||'(No title)',
      description: icsProp(block,'DESCRIPTION'),
      start: s.iso, end: e.iso, allDay: s.allDay,
    });
  }
  return events;
}

// ── CalDAV discovery ──────────────────────────────────────────────────────────

async function discoverCalendars(appleId: string, appPassword: string) {
  const auth = basicAuth(appleId, appPassword);
  const r1 = await caldavReq('PROPFIND', `${CALDAV_BASE}/.well-known/caldav`, auth, { Depth: '0' },
    `<?xml version="1.0" encoding="UTF-8"?><D:propfind xmlns:D="DAV:"><D:prop><D:current-user-principal/></D:prop></D:propfind>`);
  if (r1.status === 401) throw new Error('Invalid Apple ID or app-specific password.');
  const principalM = r1.text.match(/\/\d{5,}\/principal\//);
  if (!principalM) throw new Error('Could not discover principal.');
  const principalUrl = `${CALDAV_BASE}${principalM[0]}`;

  const r2 = await caldavReq('PROPFIND', principalUrl, auth, { Depth: '0' },
    `<?xml version="1.0" encoding="UTF-8"?><D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><C:calendar-home-set/></D:prop></D:propfind>`);
  const homeM = r2.text.match(/https?:\/\/[^<"]+\/\d{5,}\/calendars\//);
  if (!homeM) throw new Error('Could not find calendar home.');
  const homeUrl = homeM[0];

  const r3 = await caldavReq('PROPFIND', homeUrl, auth, { Depth: '1' },
    `<?xml version="1.0" encoding="UTF-8"?><D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><D:displayname/><D:resourcetype/><C:supported-calendar-component-set/></D:prop></D:propfind>`);

  const calendars: { name: string; url: string }[] = [];
  const re = /<(?:[A-Za-z]+:)?response[^>]*>([\s\S]*?)<\/(?:[A-Za-z]+:)?response>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = re.exec(r3.text)) !== null) {
    const resp = rm[1];
    if (!resp.includes('VEVENT') && !resp.match(/comp name=['"]VEVENT['"]/i)) continue;
    if (resp.includes('principal') || resp.includes('inbox') || resp.includes('outbox') || resp.includes('notification')) continue;
    const hM = resp.match(/<(?:[A-Za-z]+:)?href[^>]*>([^<]+)<\/(?:[A-Za-z]+:)?href>/i);
    const nM = resp.match(/<(?:[A-Za-z]+:)?displayname[^>]*>([^<]*)<\/(?:[A-Za-z]+:)?displayname>/i);
    if (!hM) continue;
    const href = hM[1].trim();
    const url = href.startsWith('http') ? href : `${CALDAV_BASE}${href}`;
    const name = nM && nM[1].trim() ? nM[1].trim() : 'Calendar';
    calendars.push({ name, url });
  }
  return calendars;
}

async function fetchEventsForCalendar(cal: any, start: string, end: string): Promise<CalEvent[]> {
  const auth = basicAuth(cal.apple_id, cal.app_password);
  const startStr = toICSDate(new Date(start).toISOString(), false);
  const endStr   = toICSDate(new Date(end).toISOString(), false);
  const r = await caldavReq('REPORT', cal.calendar_url, auth, { Depth: '1', Prefer: 'return=minimal' },
    `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${startStr}" end="${endStr}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`);
  if (!r.ok && r.status !== 207) return [];
  return parseEventsXML(r.text, cal.id);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { action } = req.query;

    // GET calendars list (no passwords returned)
    if (req.method === 'GET' && action === 'settings') {
      const { data } = await db().from('linked_calendars' as any).select('id,calendar_name,color,active').order('created_at');
      return res.json({ connected: !!(data && (data as any[]).length), calendars: data || [] });
    }

    // POST connect — test creds, return available calendars
    if (req.method === 'POST' && action === 'connect') {
      const { appleId, appPassword } = req.body;
      if (!appleId || !appPassword) return res.status(400).json({ error: 'appleId and appPassword required' });
      const calendars = await discoverCalendars(appleId, appPassword);
      return res.json({ calendars });
    }

    // POST add — link a new calendar
    if (req.method === 'POST' && action === 'add') {
      const { appleId, appPassword, calendarUrl, calendarName } = req.body;
      if (!appleId || !appPassword || !calendarUrl) return res.status(400).json({ error: 'Missing fields' });
      // Pick next color
      const { data: existing } = await db().from('linked_calendars' as any).select('id').order('created_at');
      const color = PALETTE[((existing as any[])?.length || 0) % PALETTE.length];
      const { data, error } = await db().from('linked_calendars' as any).insert({
        apple_id: appleId, app_password: appPassword,
        calendar_url: calendarUrl, calendar_name: calendarName, color, active: true,
      }).select('id,calendar_name,color,active').single();
      if (error) throw new Error(error.message);
      return res.json(data);
    }

    // DELETE calendar
    if (req.method === 'DELETE' && action === 'calendar') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id required' });
      await db().from('linked_calendars' as any).delete().eq('id', id);
      return res.json({ ok: true });
    }

    // PATCH calendar (toggle active)
    if (req.method === 'PATCH' && action === 'calendar') {
      const { id } = req.query;
      const { active } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      await db().from('linked_calendars' as any).update({ active }).eq('id', id);
      return res.json({ ok: true });
    }

    // GET events — fetch from all active calendars in parallel
    if (req.method === 'GET' && action === 'events') {
      const { start, end } = req.query as Record<string,string>;
      if (!start || !end) return res.status(400).json({ error: 'start and end required' });
      const { data: cals } = await db().from('linked_calendars' as any).select('*').eq('active', true);
      if (!cals || !(cals as any[]).length) return res.json([]);
      const results = await Promise.allSettled((cals as any[]).map(c => fetchEventsForCalendar(c, start, end)));
      const events = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      return res.json(events);
    }

    // POST event — create in a specific calendar
    if (req.method === 'POST' && action === 'event') {
      const { title, description, start, end, allDay, calendarId } = req.body;
      if (!title || !start || !calendarId) return res.status(400).json({ error: 'title, start, calendarId required' });
      const { data: cal } = await db().from('linked_calendars' as any).select('*').eq('id', calendarId).single();
      if (!cal) return res.status(400).json({ error: 'Calendar not found' });
      const uid = `${crypto.randomUUID()}@slab-hub`;
      const ics = buildICS(uid, title, description || '', start, end || start, allDay || false);
      const auth = basicAuth((cal as any).apple_id, (cal as any).app_password);
      const url = `${(cal as any).calendar_url}${uid}.ics`;
      const r = await caldavReq('PUT', url, auth, {}, ics);
      if (!r.ok && r.status !== 201 && r.status !== 204) throw new Error(`Create failed: ${r.status}`);
      return res.json({ ok: true, uid, href: url, calendarId });
    }

    // DELETE event
    if (req.method === 'DELETE' && action === 'event') {
      const href = decodeURIComponent((req.query.href as string) || '');
      const calendarId = req.query.calendarId as string;
      if (!href || !calendarId) return res.status(400).json({ error: 'href and calendarId required' });
      const { data: cal } = await db().from('linked_calendars' as any).select('*').eq('id', calendarId).single();
      if (!cal) return res.status(400).json({ error: 'Calendar not found' });
      const auth = basicAuth((cal as any).apple_id, (cal as any).app_password);
      const url = href.startsWith('http') ? href : `${CALDAV_BASE}${href}`;
      const r = await caldavReq('DELETE', url, auth);
      if (!r.ok && r.status !== 204) throw new Error(`Delete failed: ${r.status}`);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e: any) {
    console.error('caldav error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
