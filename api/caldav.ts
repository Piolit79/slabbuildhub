import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nlusfndskgdcottasfdy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sdXNmbmRza2dkY290dGFzZmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTY0NDYsImV4cCI6MjA4ODMzMjQ0Nn0.sGSdCsQl0wgAHk5L-xi6ZdrLkuAEaHcdhJ8uazjTjbA';
const CALDAV_BASE = 'https://caldav.icloud.com';

// ── Auth ──────────────────────────────────────────────────────────────────────

function basicAuth(email: string, password: string) {
  return 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
}

// ── Low-level CalDAV request ──────────────────────────────────────────────────

async function caldavReq(
  method: string,
  url: string,
  auth: string,
  extraHeaders: Record<string, string> = {},
  body?: string,
) {
  const headers: Record<string, string> = {
    Authorization: auth,
    'User-Agent': 'SLABHub/1.0',
    ...extraHeaders,
  };
  if (body) {
    headers['Content-Type'] = method === 'PUT'
      ? 'text/calendar; charset=utf-8'
      : 'application/xml; charset=utf-8';
  }
  const r = await fetch(url, { method, headers, body, redirect: 'follow' });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text };
}

// ── XML helpers ───────────────────────────────────────────────────────────────

function xmlFirst(xml: string, ...tags: string[]): string {
  for (const tag of tags) {
    const patterns = [
      new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i'),
      new RegExp(`<[A-Za-z]+:${tag}[^>]*>([^<]*)<\/[A-Za-z]+:${tag}>`, 'i'),
    ];
    for (const p of patterns) {
      const m = xml.match(p);
      if (m && m[1].trim()) return m[1].trim();
    }
  }
  return '';
}

function xmlBlocks(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<(?:[A-Za-z]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z]+:)?${tag}>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) results.push(m[1]);
  return results;
}

// ── iCal helpers ──────────────────────────────────────────────────────────────

function unfold(ics: string) {
  return ics.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function icsProp(block: string, prop: string): string {
  const m = block.match(new RegExp(`^${prop}(?:;[^:]*)?:(.+)$`, 'mi'));
  if (!m) return '';
  return m[1].replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').trim();
}

interface ParsedDate { iso: string; allDay: boolean }

function parseICSDate(raw: string): ParsedDate {
  const val = raw.includes(':') ? raw.split(':').pop()! : raw;
  const allDay = val.length === 8;
  if (allDay) {
    return { iso: `${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}`, allDay: true };
  }
  const y=val.slice(0,4), mo=val.slice(4,6), d=val.slice(6,8);
  const h=val.slice(9,11), mi=val.slice(11,13), s=val.slice(13,15)||'00';
  const z = val.endsWith('Z') ? 'Z' : '';
  return { iso: `${y}-${mo}-${d}T${h}:${mi}:${s}${z}`, allDay: false };
}

function toICSDate(iso: string, allDay: boolean): string {
  if (allDay) return iso.replace(/-/g, '').slice(0, 8);
  return iso.replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15) + 'Z';
}

function buildICS(uid: string, title: string, desc: string, start: string, end: string, allDay: boolean): string {
  const stamp = toICSDate(new Date().toISOString(), false);
  const dtstart = allDay
    ? `DTSTART;VALUE=DATE:${toICSDate(start, true)}`
    : `DTSTART:${toICSDate(start, false)}`;
  const dtend = allDay
    ? `DTEND;VALUE=DATE:${toICSDate(end, true)}`
    : `DTEND:${toICSDate(end, false)}`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SLAB Hub//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    dtstart,
    dtend,
    `SUMMARY:${title.replace(/,/g,'\\,').replace(/\n/g,'\\n')}`,
    desc ? `DESCRIPTION:${desc.replace(/,/g,'\\,').replace(/\n/g,'\\n')}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

interface CalEvent {
  uid: string; href: string; etag: string;
  title: string; description: string;
  start: string; end: string; allDay: boolean;
}

function parseEventsFromXML(xml: string): CalEvent[] {
  const events: CalEvent[] = [];
  // Split into <response> blocks
  const respRe = /<(?:[A-Za-z]+:)?response[^>]*>([\s\S]*?)<\/(?:[A-Za-z]+:)?response>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = respRe.exec(xml)) !== null) {
    const resp = rm[1];
    const hrefM = resp.match(/<(?:[A-Za-z]+:)?href[^>]*>([^<]+)<\/(?:[A-Za-z]+:)?href>/i);
    const etagM = resp.match(/<(?:[A-Za-z]+:)?getetag[^>]*>"?([^<"]+)"?<\/(?:[A-Za-z]+:)?getetag>/i);
    const dataM = resp.match(/<(?:[A-Za-z]+:)?calendar-data[^>]*>([\s\S]*?)<\/(?:[A-Za-z]+:)?calendar-data>/i);
    if (!hrefM || !dataM) continue;

    let icsRaw = dataM[1];
    // Unwrap CDATA if present
    const cdataM = icsRaw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
    if (cdataM) icsRaw = cdataM[1];
    // Decode common XML entities
    icsRaw = icsRaw.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');

    const ics = unfold(icsRaw);
    const veM = ics.match(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/);
    if (!veM) continue;

    const block = veM[1];
    const uid = icsProp(block, 'UID');
    const summary = icsProp(block, 'SUMMARY');
    const description = icsProp(block, 'DESCRIPTION');
    const dtstart = icsProp(block, 'DTSTART');
    const dtend = icsProp(block, 'DTEND');
    if (!uid || !dtstart) continue;

    const s = parseICSDate(dtstart);
    const e = dtend ? parseICSDate(dtend) : s;

    events.push({
      uid,
      href: hrefM[1].trim(),
      etag: etagM ? etagM[1].trim() : '',
      title: summary || '(No title)',
      description,
      start: s.iso,
      end: e.iso,
      allDay: s.allDay,
    });
  }
  return events;
}

// ── CalDAV discovery ──────────────────────────────────────────────────────────

async function discoverCalendars(appleId: string, appPassword: string) {
  const auth = basicAuth(appleId, appPassword);

  // 1. Discover principal
  const r1 = await caldavReq('PROPFIND',
    `${CALDAV_BASE}/.well-known/caldav`, auth, { Depth: '0' },
    `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop><D:current-user-principal/></D:prop>
</D:propfind>`);

  if (r1.status === 401) throw new Error('Invalid Apple ID or app-specific password.');
  if (!r1.ok && r1.status !== 207) throw new Error(`CalDAV error ${r1.status}`);

  const principalHref =
    xmlFirst(r1.text, 'current-user-principal href', 'href') ||
    (r1.text.match(/\/\d{6,}\/principal\//)?.[0]);
  if (!principalHref) throw new Error('Could not discover principal. Try again.');

  const principalUrl = principalHref.startsWith('http')
    ? principalHref
    : `${CALDAV_BASE}${principalHref.startsWith('/') ? '' : '/'}${principalHref}`;

  // 2. Get calendar home
  const r2 = await caldavReq('PROPFIND', principalUrl, auth, { Depth: '0' },
    `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><C:calendar-home-set/></D:prop>
</D:propfind>`);

  // Extract href inside calendar-home-set
  const homeBlocks = xmlBlocks(r2.text, 'calendar-home-set');
  const homeHref = homeBlocks.length > 0 ? xmlFirst(homeBlocks[0], 'href') : '';
  if (!homeHref) throw new Error('Could not find calendar home.');

  const homeUrl = homeHref.startsWith('http') ? homeHref : `${CALDAV_BASE}${homeHref}`;

  // 3. List calendars
  const r3 = await caldavReq('PROPFIND', homeUrl, auth, { Depth: '1' },
    `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:displayname/>
    <D:resourcetype/>
    <C:supported-calendar-component-set/>
  </D:prop>
</D:propfind>`);

  const calendars: { name: string; url: string }[] = [];
  const respRe = /<(?:[A-Za-z]+:)?response[^>]*>([\s\S]*?)<\/(?:[A-Za-z]+:)?response>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = respRe.exec(r3.text)) !== null) {
    const resp = rm[1];
    if (!resp.includes('calendar') || resp.includes('calendar-home-set') || resp.includes('principal')) continue;
    if (!resp.includes('VEVENT') && !resp.includes('vevent') && !resp.includes('comp name="VEVENT"')) continue;
    const hrefM = resp.match(/<(?:[A-Za-z]+:)?href[^>]*>([^<]+)<\/(?:[A-Za-z]+:)?href>/i);
    const nameM = resp.match(/<(?:[A-Za-z]+:)?displayname[^>]*>([^<]*)<\/(?:[A-Za-z]+:)?displayname>/i);
    if (!hrefM) continue;
    const href = hrefM[1].trim();
    const url = href.startsWith('http') ? href : `${CALDAV_BASE}${href}`;
    const name = nameM && nameM[1].trim() ? nameM[1].trim() : href.split('/').filter(Boolean).pop() || 'Calendar';
    calendars.push({ name, url });
  }

  return calendars;
}

// ── Fetch events for a date range ─────────────────────────────────────────────

async function fetchEvents(auth: string, calendarUrl: string, start: string, end: string): Promise<CalEvent[]> {
  const startStr = toICSDate(new Date(start).toISOString(), false);
  const endStr   = toICSDate(new Date(end).toISOString(), false);

  const r = await caldavReq('REPORT', calendarUrl, auth, { Depth: '1', Prefer: 'return=minimal' },
    `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${startStr}" end="${endStr}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`);

  if (!r.ok && r.status !== 207) throw new Error(`Failed to fetch events: ${r.status}`);
  return parseEventsFromXML(r.text);
}

// ── Supabase ──────────────────────────────────────────────────────────────────

function db() {
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function getSettings() {
  const { data } = await db().from('calendar_settings' as any).select('*').limit(1).maybeSingle();
  return data as any;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { action } = req.query;

    // GET settings (no password returned)
    if (req.method === 'GET' && action === 'settings') {
      const s = await getSettings();
      if (!s) return res.json({ connected: false });
      return res.json({ connected: true, calendarName: s.calendar_name, calendarUrl: s.calendar_url });
    }

    // POST connect — test creds + return calendar list
    if (req.method === 'POST' && action === 'connect') {
      const { appleId, appPassword } = req.body;
      if (!appleId || !appPassword) return res.status(400).json({ error: 'appleId and appPassword required' });
      const calendars = await discoverCalendars(appleId, appPassword);
      return res.json({ calendars });
    }

    // POST save — store credentials in Supabase
    if (req.method === 'POST' && action === 'save') {
      const { appleId, appPassword, calendarUrl, calendarName } = req.body;
      if (!appleId || !appPassword || !calendarUrl) return res.status(400).json({ error: 'Missing fields' });
      const existing = await getSettings();
      if (existing) {
        await db().from('calendar_settings' as any).update({ apple_id: appleId, app_password: appPassword, calendar_url: calendarUrl, calendar_name: calendarName }).eq('id', existing.id);
      } else {
        await db().from('calendar_settings' as any).insert({ apple_id: appleId, app_password: appPassword, calendar_url: calendarUrl, calendar_name: calendarName });
      }
      return res.json({ ok: true });
    }

    // GET events
    if (req.method === 'GET' && action === 'events') {
      const { start, end } = req.query as Record<string, string>;
      if (!start || !end) return res.status(400).json({ error: 'start and end required' });
      const s = await getSettings();
      if (!s) return res.status(400).json({ error: 'iCloud not connected' });
      const auth = basicAuth(s.apple_id, s.app_password);
      const events = await fetchEvents(auth, s.calendar_url, start, end);
      return res.json(events);
    }

    // POST event — create
    if (req.method === 'POST' && action === 'event') {
      const { title, description, start, end, allDay } = req.body;
      if (!title || !start) return res.status(400).json({ error: 'title and start required' });
      const s = await getSettings();
      if (!s) return res.status(400).json({ error: 'iCloud not connected' });
      const uid = `${crypto.randomUUID()}@slab-hub`;
      const ics = buildICS(uid, title, description || '', start, end || start, allDay || false);
      const auth = basicAuth(s.apple_id, s.app_password);
      const url = `${s.calendar_url}${uid}.ics`;
      const r = await caldavReq('PUT', url, auth, {}, ics);
      if (!r.ok && r.status !== 201 && r.status !== 204) throw new Error(`Create failed: ${r.status} ${r.text}`);
      return res.json({ ok: true, uid, href: url });
    }

    // DELETE event
    if (req.method === 'DELETE' && action === 'event') {
      const href = decodeURIComponent((req.query.href as string) || '');
      if (!href) return res.status(400).json({ error: 'href required' });
      const s = await getSettings();
      if (!s) return res.status(400).json({ error: 'iCloud not connected' });
      const auth = basicAuth(s.apple_id, s.app_password);
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
