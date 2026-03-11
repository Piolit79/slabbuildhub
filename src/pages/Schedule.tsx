import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, ChevronLeft, ChevronRight, Check, X, Link2, Loader2, Undo2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
type Task = { id: string; project_id: string; name: string; color: string; sort_order: number };
type Bar = { id: string; task_id: string; project_id: string; start_date: string; end_date: string; depends_on: string[] };

const COLORS = ['#7BAFD4','#D47878','#8BAFC4','#C47878','#A89BC4','#7ABFBF','#D4A07A','#9BB4D4'];
const ROW_H = 48;
const LABEL_W = 220;
const CELL_W = 80; // px per week in week view, per ~4 weeks in month view

// ── Date helpers ──────────────────────────────────────────────────────────────
const startOfWeek = (d: Date) => { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0,0,0,0); return r; };
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const addWeeks = (d: Date, n: number) => addDays(d, n * 7);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const parseDate = (s: string) => { const d = new Date(s + 'T00:00:00'); return d; };
const diffWeeks = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / (7 * 86400000));
const diffDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Main component ────────────────────────────────────────────────────────────
export default function SchedulePage({ readOnly }: { readOnly?: boolean }) {
  const { selectedProject } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bars, setBars] = useState<Bar[]>([]);
  const barsRef = useRef<Bar[]>([]);
  useEffect(() => { barsRef.current = bars; }, [bars]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'week' | '2week' | 'month'>('week');

  // Grid origin: leftmost column = this week's Sunday
  const [originDate, setOriginDate] = useState<Date>(() => startOfWeek(new Date()));

  // How many columns to show
  const COLS = view === 'week' ? 24 : view === '2week' ? 16 : 18;
  const colSpan = view === 'week' ? 7 : view === '2week' ? 14 : 30; // days per column

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async (pid: string) => {
    setLoading(true);
    const [{ data: t }, { data: b }] = await Promise.all([
      supabase.from('schedule_tasks').select('*').eq('project_id', pid).order('sort_order'),
      supabase.from('schedule_bars').select('*').eq('project_id', pid),
    ]);
    setTasks((t as Task[]) || []);
    setBars((b as Bar[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(selectedProject.id); }, [selectedProject.id, load]);

  // ── Task actions ────────────────────────────────────────────────────────────
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ task: Task; bars: Bar[] } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addTask = async () => {
    if (!newTaskName.trim()) return;
    const color = COLORS[tasks.length % COLORS.length];
    const sort_order = tasks.length;
    const { data, error } = await supabase.from('schedule_tasks').insert({
      project_id: selectedProject.id, name: newTaskName.trim(), color, sort_order,
    }).select().single();
    if (error) { console.error('addTask error:', error); alert(error.message); return; }
    if (data) setTasks(prev => [...prev, data as Task]);
    setNewTaskName(''); setAddingTask(false);
  };

  const saveTaskName = async (id: string) => {
    if (!editTaskName.trim()) return;
    const { error } = await supabase.from('schedule_tasks').update({ name: editTaskName.trim() }).eq('id', id);
    if (error) { console.error('saveTaskName error:', error); alert(error.message); return; }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, name: editTaskName.trim() } : t));
    setEditingTaskId(null);
  };

  const confirmDelete = async (id: string) => {
    const task = tasks.find(t => t.id === id)!;
    const taskBars = bars.filter(b => b.task_id === id);
    // Remove from UI and delete from DB immediately
    setTasks(prev => prev.filter(t => t.id !== id));
    setBars(prev => prev.filter(b => b.task_id !== id));
    setConfirmDeleteId(null);
    await supabase.from('schedule_bars').delete().eq('task_id', id);
    await supabase.from('schedule_tasks').delete().eq('id', id);
    // Store for undo (re-insert if undone)
    setPendingDelete({ task, bars: taskBars });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setPendingDelete(null), 10000);
  };

  const handleUndoDelete = async () => {
    if (!pendingDelete) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const { task, bars: taskBars } = pendingDelete;
    // Re-insert task and bars into DB
    await supabase.from('schedule_tasks').insert(task);
    if (taskBars.length) await supabase.from('schedule_bars').insert(taskBars);
    setTasks(prev => [...prev, task].sort((a, b) => a.sort_order - b.sort_order));
    setBars(prev => [...prev, ...taskBars]);
    setPendingDelete(null);
  };

  // ── Bar creation (click on empty cell) ────────────────────────────────────
  const [dragging, setDragging] = useState<{ taskId: string; startCol: number } | null>(null);
  const [dragEndCol, setDragEndCol] = useState<number | null>(null);

  const colToDate = (col: number) => addDays(originDate, col * colSpan);

  const handleCellMouseDown = (taskId: string, col: number) => {
    if (readOnly) return;
    setDragging({ taskId, startCol: col });
    setDragEndCol(col);
  };
  const handleCellMouseEnter = (col: number) => {
    if (dragging) setDragEndCol(col);
  };
  const handleMouseUp = async () => {
    if (!dragging || dragEndCol === null) { setDragging(null); setDragEndCol(null); return; }
    const s = Math.min(dragging.startCol, dragEndCol);
    const e = Math.max(dragging.startCol, dragEndCol);
    const start_date = isoDate(colToDate(s));
    const end_date = isoDate(addDays(colToDate(e), colSpan - 1));
    // check overlap on same task
    const overlap = bars.some(b => b.task_id === dragging.taskId &&
      parseDate(b.start_date) <= parseDate(end_date) &&
      parseDate(b.end_date) >= parseDate(start_date));
    if (!overlap) {
      const { data, error } = await supabase.from('schedule_bars').insert({
        task_id: dragging.taskId, project_id: selectedProject.id,
        start_date, end_date, depends_on: [],
      }).select().single();
      if (error) { console.error('addBar error:', error); alert(error.message); }
      else if (data) setBars(prev => [...prev, data as Bar]);
    }
    setDragging(null); setDragEndCol(null);
  };

  // ── Bar resize ─────────────────────────────────────────────────────────────
  const resizeRef = useRef<{ barId: string; edge: 'start' | 'end'; startX: number; origDate: string } | null>(null);

  const startResize = (e: React.MouseEvent, barId: string, edge: 'start' | 'end') => {
    if (readOnly) return;
    e.stopPropagation(); e.preventDefault();
    const bar = bars.find(b => b.id === barId)!;
    resizeRef.current = { barId, edge, startX: e.clientX, origDate: edge === 'start' ? bar.start_date : bar.end_date };
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeUp);
  };

  const onResizeMove = (e: MouseEvent) => {
    if (!resizeRef.current) return;
    const { barId, edge, startX, origDate } = resizeRef.current;
    const deltaX = e.clientX - startX;
    const deltaDays = Math.round(deltaX / CELL_W * colSpan);
    const newDate = isoDate(addDays(parseDate(origDate), deltaDays));
    setBars(prev => prev.map(b => {
      if (b.id !== barId) return b;
      if (edge === 'start') return { ...b, start_date: newDate };
      return { ...b, end_date: newDate };
    }));
  };

  const onResizeUp = async () => {
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeUp);
    if (!resizeRef.current) return;
    const { barId, edge } = resizeRef.current;
    resizeRef.current = null;
    // Use barsRef.current to get the latest state after drag
    const currentBars = barsRef.current;
    const bar = currentBars.find(b => b.id === barId);
    if (!bar) return;
    let finalBar = bar;
    // Ensure start <= end
    if (parseDate(bar.start_date) > parseDate(bar.end_date)) {
      const swapped = { ...bar, start_date: bar.end_date, end_date: bar.start_date };
      setBars(prev => prev.map(b => b.id === barId ? swapped : b));
      finalBar = swapped;
    }
    await supabase.from('schedule_bars').update({ start_date: finalBar.start_date, end_date: finalBar.end_date }).eq('id', barId);
    // Cascade dependents if end date changed
    if (edge === 'end') cascadeFrom(barId, finalBar.end_date, currentBars);
  };

  // ── Dependency cascade ─────────────────────────────────────────────────────
  // BFS: for every bar that depends on sourceId, shift it by the same delta days.
  // currentBars is passed explicitly to avoid stale closure reads.
  const cascadeFrom = async (sourceId: string, newEndDate: string, currentBars: Bar[]) => {
    const sourceBar = currentBars.find(b => b.id === sourceId);
    if (!sourceBar) return;
    const origEnd = sourceBar.end_date;
    const delta = diffDays(parseDate(origEnd), parseDate(newEndDate));
    if (delta === 0) return;

    const visited = new Set<string>();
    const queue = [sourceId];
    const updates: Bar[] = [];
    // Work on a mutable copy so cascaded bars also cascade their own dependents
    const workingBars = currentBars.map(b => ({ ...b }));

    while (queue.length) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const dependents = workingBars.filter(b => b.depends_on.includes(cur));
      for (const dep of dependents) {
        dep.start_date = isoDate(addDays(parseDate(dep.start_date), delta));
        dep.end_date = isoDate(addDays(parseDate(dep.end_date), delta));
        updates.push({ ...dep });
        queue.push(dep.id);
      }
    }

    if (!updates.length) return;
    setBars(prev => prev.map(b => updates.find(u => u.id === b.id) || b));
    for (const u of updates) {
      await supabase.from('schedule_bars').update({ start_date: u.start_date, end_date: u.end_date }).eq('id', u.id);
    }
  };

  // ── Dependency linking UI ──────────────────────────────────────────────────
  const [linkMode, setLinkMode] = useState(false);
  const [linkSource, setLinkSource] = useState<string | null>(null); // bar id

  const handleBarClick = async (barId: string) => {
    if (!linkMode) return;
    if (!linkSource) { setLinkSource(barId); return; }
    if (linkSource === barId) { setLinkSource(null); return; }
    // add dependency: barId depends on linkSource
    const bar = bars.find(b => b.id === barId)!;
    if (bar.depends_on.includes(linkSource)) { setLinkSource(null); return; }
    const newDeps = [...bar.depends_on, linkSource];
    await supabase.from('schedule_bars').update({ depends_on: newDeps }).eq('id', barId);
    setBars(prev => prev.map(b => b.id === barId ? { ...b, depends_on: newDeps } : b));
    // Stay in link mode so more links can be created; reset source for next pair
    setLinkSource(null);
  };

  const deleteBar = async (barId: string) => {
    if (readOnly) return;
    // remove from depends_on of others
    const updated = bars.filter(b => b.id !== barId).map(b => ({
      ...b, depends_on: b.depends_on.filter(d => d !== barId)
    }));
    await supabase.from('schedule_bars').delete().eq('id', barId);
    for (const b of updated.filter(b => b.depends_on !== bars.find(x => x.id === b.id)?.depends_on)) {
      await supabase.from('schedule_bars').update({ depends_on: b.depends_on }).eq('id', b.id);
    }
    setBars(updated);
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const colHeaders = Array.from({ length: COLS }, (_, i) => colToDate(i));

  // Bar pixel position within the grid
  const barGeometry = (bar: Bar) => {
    const gridStart = originDate;
    const barStart = parseDate(bar.start_date);
    const barEnd = parseDate(bar.end_date);
    const totalDays = COLS * colSpan;
    const startDay = diffDays(gridStart, barStart);
    const endDay = diffDays(gridStart, barEnd) + 1;
    const left = (startDay / totalDays) * 100;
    const width = ((endDay - startDay) / totalDays) * 100;
    return { left: `${left}%`, width: `${width}%` };
  };

  const navigate = (dir: number) => {
    if (view === 'week') setOriginDate(prev => addWeeks(prev, dir * 4));
    else if (view === '2week') setOriginDate(prev => addWeeks(prev, dir * 8));
    else setOriginDate(prev => addDays(prev, dir * 120));
  };

  const goToday = () => setOriginDate(startOfWeek(new Date()));

  // ── Column header label ────────────────────────────────────────────────────
  const colLabel = (d: Date) => {
    if (view === 'week') return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
    if (view === '2week') return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
    return `${MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
  };

  // ── Dependency lines (SVG overlay) ────────────────────────────────────────
  // We skip SVG arrows for now — a simple colored indicator on the bar is enough
  // and avoids complex coordinate math across rows.

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading schedule…
    </div>
  );

  return (
    <div className="flex flex-col h-full p-4 gap-3 select-none">
      {/* Undo banner */}
      {pendingDelete && (
        <div className="flex items-center gap-2 bg-muted/60 border border-border rounded px-3 py-1.5 text-sm">
          <span className="text-muted-foreground flex-1">"{pendingDelete.task.name}" deleted</span>
          <button onClick={handleUndoDelete} className="inline-flex items-center gap-1 text-primary font-medium hover:underline">
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-semibold flex-1">Construction Schedule</h1>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
        <Button variant="outline" size="sm" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
        <div className="flex rounded-md border border-border overflow-hidden">
          <button
            className={cn('px-3 py-1.5 text-sm', view === 'week' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted')}
            onClick={() => setView('week')}
          >Week</button>
          <button
            className={cn('px-3 py-1.5 text-sm', view === '2week' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted')}
            onClick={() => setView('2week')}
          >2 Week</button>
          <button
            className={cn('px-3 py-1.5 text-sm', view === 'month' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted')}
            onClick={() => setView('month')}
          >Month</button>
        </div>
        {!readOnly && (
          <Button
            variant={linkMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setLinkMode(l => !l); setLinkSource(null); }}
          >
            <Link2 className="h-4 w-4 mr-1" />
            {linkMode ? (linkSource ? 'Click target bar' : 'Click source bar') : 'Link Bars'}
          </Button>
        )}
      </div>

      {/* Grid */}
      <Card className="flex-1 overflow-auto">
        <div
          className="relative"
          style={{ minWidth: LABEL_W + COLS * CELL_W }}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Header row */}
          <div className="flex sticky top-0 z-10 bg-card border-b border-border">
            <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="shrink-0 border-r border-border px-3 py-2 text-sm font-medium text-muted-foreground">
              Category
            </div>
            {colHeaders.map((d, i) => (
              <div key={i} style={{ width: CELL_W, minWidth: CELL_W }} className="shrink-0 border-r border-border px-1 py-2 text-xs text-center text-muted-foreground">
                {colLabel(d)}
              </div>
            ))}
          </div>

          {/* Task rows */}
          {tasks.map(task => {
            const taskBars = bars.filter(b => b.task_id === task.id);
            return (
              <div key={task.id} className="flex border-b border-border group" style={{ height: ROW_H }}>
                {/* Label cell */}
                <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="shrink-0 border-r border-border flex items-center gap-1 px-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: task.color }} />
                  {editingTaskId === task.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        className="h-6 text-xs px-1 flex-1"
                        value={editTaskName}
                        onChange={e => setEditTaskName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveTaskName(task.id); if (e.key === 'Escape') setEditingTaskId(null); }}
                        autoFocus
                      />
                      <button onClick={() => saveTaskName(task.id)}><Check className="h-3.5 w-3.5 text-green-500" /></button>
                      <button onClick={() => setEditingTaskId(null)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    </div>
                  ) : (
                    <span
                      className="text-sm flex-1 truncate"
                    >{task.name}</span>
                  )}
                  {!readOnly && !editingTaskId && (
                    confirmDeleteId === task.id ? (
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <span className="text-[10px] text-muted-foreground">Delete?</span>
                        <button onClick={() => confirmDelete(task.id)} className="text-destructive hover:opacity-70"><Check className="h-3 w-3" /></button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => { setEditingTaskId(task.id); setEditTaskName(task.name); }} className="text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => setConfirmDeleteId(task.id)} className="text-muted-foreground/40 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  )}
                </div>

                {/* Gantt cells */}
                <div className="relative flex-1 flex">
                  {/* Background cells (click to start drawing) */}
                  {Array.from({ length: COLS }, (_, i) => (
                    <div
                      key={i}
                      style={{ width: CELL_W, minWidth: CELL_W }}
                      className="shrink-0 border-r border-border h-full hover:bg-muted/30 cursor-crosshair"
                      onMouseDown={() => handleCellMouseDown(task.id, i)}
                      onMouseEnter={() => handleCellMouseEnter(i)}
                    />
                  ))}

                  {/* Ghost bar while dragging */}
                  {dragging?.taskId === task.id && dragEndCol !== null && (() => {
                    const s = Math.min(dragging.startCol, dragEndCol);
                    const e = Math.max(dragging.startCol, dragEndCol);
                    const totalCols = COLS;
                    return (
                      <div
                        className="absolute top-2 bottom-2 rounded opacity-40 pointer-events-none"
                        style={{
                          left: `${(s / totalCols) * 100}%`,
                          width: `${((e - s + 1) / totalCols) * 100}%`,
                          backgroundColor: task.color,
                        }}
                      />
                    );
                  })()}

                  {/* Existing bars */}
                  {taskBars.map(bar => {
                    const geo = barGeometry(bar);
                    const isLinkSrc = linkSource === bar.id;
                    const hasDeps = bar.depends_on.length > 0;
                    return (
                      <div
                        key={bar.id}
                        className={cn(
                          'absolute top-2 bottom-2 rounded flex items-center cursor-pointer group/bar transition-opacity',
                          linkMode && 'ring-2 ring-offset-1',
                          isLinkSrc && 'ring-primary',
                        )}
                        style={{ left: geo.left, width: geo.width, backgroundColor: task.color, minWidth: 8 }}
                        onClick={() => handleBarClick(bar.id)}
                        onContextMenu={e => { e.preventDefault(); deleteBar(bar.id); }}
                      >
                        {/* Resize left */}
                        {!readOnly && (
                          <div
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize"
                            onMouseDown={e => startResize(e, bar.id, 'start')}
                          />
                        )}
                        {/* Dep indicator */}
                        {hasDeps && <div className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-white/70" />}
                        {/* Bar label */}
                        <span className="text-white text-xs px-2 truncate pointer-events-none select-none w-full">
                          {view === 'week'
                            ? `${MONTH_NAMES[parseDate(bar.start_date).getMonth()]} ${parseDate(bar.start_date).getDate()} – ${MONTH_NAMES[parseDate(bar.end_date).getMonth()]} ${parseDate(bar.end_date).getDate()}`
                            : `${diffDays(parseDate(bar.start_date), parseDate(bar.end_date)) + 1}d`
                          }
                        </span>
                        {/* Resize right */}
                        {!readOnly && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize"
                            onMouseDown={e => startResize(e, bar.id, 'end')}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Add task row */}
          {!readOnly && (
            <div className="flex border-b border-border" style={{ height: ROW_H }}>
              <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="shrink-0 border-r border-border flex items-center px-2">
                {addingTask ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      className="h-6 text-xs px-1 flex-1"
                      placeholder="Category name…"
                      value={newTaskName}
                      onChange={e => setNewTaskName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setAddingTask(false); }}
                      autoFocus
                    />
                    <button onClick={addTask}><Check className="h-3.5 w-3.5 text-green-500" /></button>
                    <button onClick={() => setAddingTask(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setAddingTask(true)}
                  >
                    <Plus className="h-4 w-4" /> Add category
                  </button>
                )}
              </div>
              <div className="flex-1" />
            </div>
          )}
        </div>
      </Card>

      {/* Legend */}
      <p className="text-xs text-muted-foreground">
        Drag across cells to create a bar · Drag bar edges to resize · Double-click category name to rename · Right-click bar to delete · Use "Link Bars" to chain bars — resizing a source bar shifts all linked bars
      </p>
    </div>
  );
}
