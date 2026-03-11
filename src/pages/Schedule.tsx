import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, ChevronLeft, ChevronRight, Check, X, Loader2, Undo2, Pencil, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
type Task = { id: string; project_id: string; name: string; color: string; sort_order: number };
type Bar  = { id: string; task_id: string; project_id: string; start_date: string; end_date: string; depends_on: string[] };

const COLORS = ['#7BAFD4','#D47878','#8BAFC4','#C47878','#A89BC4','#7ABFBF','#D4A07A','#9BB4D4'];
const ROW_H  = 48;
const LABEL_W = 220;
const CELL_W  = 80;

// ── Date helpers ──────────────────────────────────────────────────────────────
const startOfWeek = (d: Date) => { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0,0,0,0); return r; };
const addDays  = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const addWeeks = (d: Date, n: number) => addDays(d, n * 7);
const isoDate  = (d: Date) => d.toISOString().slice(0, 10);
const parseDate = (s: string) => new Date(s + 'T00:00:00');
const diffDays  = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Main component ────────────────────────────────────────────────────────────
export default function SchedulePage({ readOnly }: { readOnly?: boolean }) {
  const { selectedProject } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bars,  setBars]  = useState<Bar[]>([]);
  const barsRef = useRef<Bar[]>([]);
  useEffect(() => { barsRef.current = bars; }, [bars]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'week' | '2week' | 'month'>('week');
  const [originDate, setOriginDate] = useState<Date>(() => startOfWeek(new Date()));

  const colSpan = view === 'week' ? 7 : view === '2week' ? 14 : 30;
  const minCols = Math.ceil(diffDays(originDate, addDays(new Date(), 730)) / colSpan) + 4;
  const COLS = Math.max(view === 'week' ? 24 : view === '2week' ? 16 : 18, minCols);

  // ── Load ──────────────────────────────────────────────────────────────────────
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

  // ── Task CRUD ─────────────────────────────────────────────────────────────────
  const [addingTask,    setAddingTask]    = useState(false);
  const [newTaskName,   setNewTaskName]   = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskName,  setEditTaskName]  = useState('');
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ task: Task; bars: Bar[] } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addTask = async () => {
    if (!newTaskName.trim()) return;
    const { data, error } = await supabase.from('schedule_tasks').insert({
      project_id: selectedProject.id, name: newTaskName.trim(),
      color: COLORS[tasks.length % COLORS.length], sort_order: tasks.length,
    }).select().single();
    if (error) { alert(error.message); return; }
    if (data) setTasks(prev => [...prev, data as Task]);
    setNewTaskName(''); setAddingTask(false);
  };

  const saveTaskName = async (id: string) => {
    if (!editTaskName.trim()) return;
    const { error } = await supabase.from('schedule_tasks').update({ name: editTaskName.trim() }).eq('id', id);
    if (error) { alert(error.message); return; }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, name: editTaskName.trim() } : t));
    setEditingTaskId(null);
  };

  const confirmDeleteTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)!;
    const taskBars = bars.filter(b => b.task_id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    setBars(prev => prev.filter(b => b.task_id !== id));
    setConfirmDeleteTaskId(null);
    await supabase.from('schedule_bars').delete().eq('task_id', id);
    await supabase.from('schedule_tasks').delete().eq('id', id);
    setPendingDelete({ task, bars: taskBars });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setPendingDelete(null), 10000);
  };

  const handleUndoDelete = async () => {
    if (!pendingDelete) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    await supabase.from('schedule_tasks').insert(pendingDelete.task);
    if (pendingDelete.bars.length) await supabase.from('schedule_bars').insert(pendingDelete.bars);
    setTasks(prev => [...prev, pendingDelete.task].sort((a, b) => a.sort_order - b.sort_order));
    setBars(prev => [...prev, ...pendingDelete.bars]);
    setPendingDelete(null);
  };

  // ── Row drag-to-reorder ───────────────────────────────────────────────────────
  const [rowDraggingId, setRowDraggingId] = useState<string | null>(null);
  const [rowDragOverId, setRowDragOverId] = useState<string | null>(null);

  const handleRowDragStart = (e: React.DragEvent, id: string) => { setRowDraggingId(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleRowDragOver  = (e: React.DragEvent, id: string) => { e.preventDefault(); if (id !== rowDraggingId) setRowDragOverId(id); };
  const handleRowDragEnd   = () => { setRowDraggingId(null); setRowDragOverId(null); };
  const handleRowDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault(); setRowDragOverId(null);
    if (!rowDraggingId || rowDraggingId === targetId) { setRowDraggingId(null); return; }
    const from = tasks.findIndex(t => t.id === rowDraggingId);
    const to   = tasks.findIndex(t => t.id === targetId);
    const reordered = [...tasks];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const updated = reordered.map((t, i) => ({ ...t, sort_order: i }));
    setTasks(updated); setRowDraggingId(null);
    for (const t of updated) await supabase.from('schedule_tasks').update({ sort_order: t.sort_order }).eq('id', t.id);
  };

  // ── Bar creation (drag on empty cell) ────────────────────────────────────────
  const [cellDrag,    setCellDrag]    = useState<{ taskId: string; startCol: number } | null>(null);
  const [cellDragEnd, setCellDragEnd] = useState<number | null>(null);
  const colToDate = (col: number) => addDays(originDate, col * colSpan);

  const handleCellMouseDown = (taskId: string, col: number) => { if (readOnly) return; setCellDrag({ taskId, startCol: col }); setCellDragEnd(col); };
  const handleCellMouseEnter = (col: number) => { if (cellDrag) setCellDragEnd(col); };
  const handleCellMouseUp = async () => {
    if (!cellDrag || cellDragEnd === null) { setCellDrag(null); setCellDragEnd(null); return; }
    const s = Math.min(cellDrag.startCol, cellDragEnd);
    const e = Math.max(cellDrag.startCol, cellDragEnd);
    const start_date = isoDate(colToDate(s));
    const end_date   = isoDate(addDays(colToDate(e), colSpan - 1));
    const overlap = bars.some(b => b.task_id === cellDrag.taskId &&
      parseDate(b.start_date) <= parseDate(end_date) && parseDate(b.end_date) >= parseDate(start_date));
    if (!overlap) {
      const { data, error } = await supabase.from('schedule_bars').insert({
        task_id: cellDrag.taskId, project_id: selectedProject.id, start_date, end_date, depends_on: [],
      }).select().single();
      if (error) alert(error.message);
      else if (data) setBars(prev => [...prev, data as Bar]);
    }
    setCellDrag(null); setCellDragEnd(null);
  };

  // ── Bar resize ────────────────────────────────────────────────────────────────
  const resizeRef = useRef<{ barId: string; edge: 'start'|'end'; startX: number; origDate: string } | null>(null);

  const startResize = (e: React.MouseEvent, barId: string, edge: 'start'|'end') => {
    if (readOnly) return;
    e.stopPropagation(); e.preventDefault();
    const bar = barsRef.current.find(b => b.id === barId)!;
    resizeRef.current = { barId, edge, startX: e.clientX, origDate: edge === 'start' ? bar.start_date : bar.end_date };
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeUp);
  };
  const onResizeMove = (e: MouseEvent) => {
    if (!resizeRef.current) return;
    const { barId, edge, startX, origDate } = resizeRef.current;
    const newDate = isoDate(addDays(parseDate(origDate), Math.round((e.clientX - startX) / CELL_W * colSpan)));
    setBars(prev => prev.map(b => b.id !== barId ? b : edge === 'start' ? { ...b, start_date: newDate } : { ...b, end_date: newDate }));
  };
  const onResizeUp = async () => {
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeUp);
    if (!resizeRef.current) return;
    const { barId } = resizeRef.current;
    resizeRef.current = null;
    const bar = barsRef.current.find(b => b.id === barId);
    if (!bar) return;
    let finalBar = bar;
    if (parseDate(bar.start_date) > parseDate(bar.end_date)) {
      finalBar = { ...bar, start_date: bar.end_date, end_date: bar.start_date };
      setBars(prev => prev.map(b => b.id === barId ? finalBar : b));
    }
    await supabase.from('schedule_bars').update({ start_date: finalBar.start_date, end_date: finalBar.end_date }).eq('id', barId);
  };

  // ── Bar move (drag whole bar) ─────────────────────────────────────────────────
  const barMoveRef = useRef<{ barId: string; startX: number; origStart: string; origEnd: string; moved: boolean } | null>(null);

  const startBarMove = (e: React.MouseEvent, barId: string) => {
    if (readOnly) return;
    e.stopPropagation(); e.preventDefault();
    const bar = barsRef.current.find(b => b.id === barId)!;
    barMoveRef.current = { barId, startX: e.clientX, origStart: bar.start_date, origEnd: bar.end_date, moved: false };
    window.addEventListener('mousemove', onBarMoveMove);
    window.addEventListener('mouseup', onBarMoveUp);
  };
  const onBarMoveMove = (e: MouseEvent) => {
    if (!barMoveRef.current) return;
    const { barId, startX, origStart, origEnd } = barMoveRef.current;
    if (Math.abs(e.clientX - startX) > 4) barMoveRef.current.moved = true;
    const delta = Math.round((e.clientX - startX) / CELL_W * colSpan);
    if (delta === 0) return;
    setBars(prev => prev.map(b => b.id !== barId ? b : {
      ...b,
      start_date: isoDate(addDays(parseDate(origStart), delta)),
      end_date:   isoDate(addDays(parseDate(origEnd),   delta)),
    }));
  };
  const onBarMoveUp = async () => {
    window.removeEventListener('mousemove', onBarMoveMove);
    window.removeEventListener('mouseup', onBarMoveUp);
    if (!barMoveRef.current) return;
    const { barId, moved } = barMoveRef.current;
    barMoveRef.current = null;
    if (!moved) return;
    const bar = barsRef.current.find(b => b.id === barId);
    if (!bar) return;
    await supabase.from('schedule_bars').update({ start_date: bar.start_date, end_date: bar.end_date }).eq('id', barId);
  };

  // ── Bar date editor ───────────────────────────────────────────────────────────
  const [editingBarDates, setEditingBarDates] = useState<{ barId: string; start: string; end: string } | null>(null);
  const [editBarAnchor,   setEditBarAnchor]   = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const openDateEditor = (e: React.MouseEvent, bar: Bar) => {
    e.stopPropagation();
    setEditingBarDates({ barId: bar.id, start: bar.start_date, end: bar.end_date });
    // Position below the click, clamped to viewport
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY + 12, window.innerHeight - 160);
    setEditBarAnchor({ x, y });
  };
  const saveDateEdit = async () => {
    if (!editingBarDates) return;
    const { barId, start, end } = editingBarDates;
    if (!start || !end) return;
    const s = start <= end ? start : end;
    const en = start <= end ? end : start;
    await supabase.from('schedule_bars').update({ start_date: s, end_date: en }).eq('id', barId);
    setBars(prev => prev.map(b => b.id === barId ? { ...b, start_date: s, end_date: en } : b));
    setEditingBarDates(null);
  };

  // ── Bar delete (with confirm) ─────────────────────────────────────────────────
  const [confirmDeleteBarId, setConfirmDeleteBarId] = useState<string | null>(null);

  const deleteBar = async (barId: string) => {
    const updated = bars.filter(b => b.id !== barId).map(b => ({
      ...b, depends_on: b.depends_on.filter(d => d !== barId),
    }));
    await supabase.from('schedule_bars').delete().eq('id', barId);
    setBars(updated);
    setConfirmDeleteBarId(null);
  };

  // ── Geometry & navigation ─────────────────────────────────────────────────────
  const colHeaders = Array.from({ length: COLS }, (_, i) => colToDate(i));

  const barGeometry = (bar: Bar) => {
    const totalDays = COLS * colSpan;
    const startDay = diffDays(originDate, parseDate(bar.start_date));
    const endDay   = diffDays(originDate, parseDate(bar.end_date)) + 1;
    return { left: `${(startDay / totalDays) * 100}%`, width: `${((endDay - startDay) / totalDays) * 100}%` };
  };

  const navigate = (dir: number) => {
    if (view === 'week')      setOriginDate(p => addWeeks(p, dir * 4));
    else if (view === '2week') setOriginDate(p => addWeeks(p, dir * 8));
    else                       setOriginDate(p => addDays(p, dir * 120));
  };
  const goToday = () => setOriginDate(startOfWeek(new Date()));

  const colLabel = (d: Date) =>
    view === 'month'
      ? `${MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`
      : `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading schedule…
    </div>
  );

  return (
    <div className="flex flex-col h-full p-4 gap-3 select-none">

      {/* Undo delete-row banner */}
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
          {(['week', '2week', 'month'] as const).map(v => (
            <button key={v}
              className={cn('px-3 py-1.5 text-sm', view === v ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted')}
              onClick={() => setView(v)}
            >{v === '2week' ? '2 Week' : v.charAt(0).toUpperCase() + v.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <Card className="flex-1 overflow-auto">
        <div
          className="relative"
          style={{ minWidth: LABEL_W + COLS * CELL_W }}
          onMouseUp={handleCellMouseUp}
          onMouseLeave={handleCellMouseUp}
        >
          {/* Header */}
          <div className="flex sticky top-0 z-10 bg-card border-b border-border">
            <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="shrink-0 border-r border-border px-3 py-2 text-sm font-medium text-muted-foreground">Category</div>
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
              <div
                key={task.id}
                className={cn('flex border-b border-border group transition-colors', rowDragOverId === task.id && 'border-t-2 border-t-primary')}
                style={{ height: ROW_H, opacity: rowDraggingId === task.id ? 0.4 : 1 }}
                onDragOver={e => handleRowDragOver(e, task.id)}
                onDrop={e => handleRowDrop(e, task.id)}
                onDragEnd={handleRowDragEnd}
              >
                {/* Label cell */}
                <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="shrink-0 border-r border-border flex items-center gap-1 px-2">
                  {!readOnly && (
                    <div className="opacity-0 group-hover:opacity-40 hover:!opacity-100 cursor-grab active:cursor-grabbing shrink-0 transition-opacity"
                      draggable onDragStart={e => handleRowDragStart(e, task.id)}>
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: task.color }} />
                  {editingTaskId === task.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input className="h-6 text-xs px-1 flex-1" value={editTaskName}
                        onChange={e => setEditTaskName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveTaskName(task.id); if (e.key === 'Escape') setEditingTaskId(null); }}
                        autoFocus />
                      <button onClick={() => saveTaskName(task.id)}><Check className="h-3.5 w-3.5 text-green-500" /></button>
                      <button onClick={() => setEditingTaskId(null)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    </div>
                  ) : (
                    <span className="text-sm flex-1 truncate">{task.name}</span>
                  )}
                  {!readOnly && !editingTaskId && (
                    confirmDeleteTaskId === task.id ? (
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <span className="text-[10px] text-muted-foreground">Delete?</span>
                        <button onClick={() => confirmDeleteTask(task.id)} className="text-destructive hover:opacity-70"><Check className="h-3 w-3" /></button>
                        <button onClick={() => setConfirmDeleteTaskId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => { setEditingTaskId(task.id); setEditTaskName(task.name); }} className="text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => setConfirmDeleteTaskId(task.id)} className="text-muted-foreground/40 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  )}
                </div>

                {/* Gantt area */}
                <div className="relative flex-1 flex">
                  {/* Background cells */}
                  {Array.from({ length: COLS }, (_, i) => (
                    <div key={i} style={{ width: CELL_W, minWidth: CELL_W }}
                      className="shrink-0 border-r border-border h-full hover:bg-muted/30 cursor-crosshair"
                      onMouseDown={() => handleCellMouseDown(task.id, i)}
                      onMouseEnter={() => handleCellMouseEnter(i)} />
                  ))}

                  {/* Ghost bar while drawing */}
                  {cellDrag?.taskId === task.id && cellDragEnd !== null && (() => {
                    const s = Math.min(cellDrag.startCol, cellDragEnd);
                    const e = Math.max(cellDrag.startCol, cellDragEnd);
                    return (
                      <div className="absolute top-2 bottom-2 rounded opacity-40 pointer-events-none"
                        style={{ left: `${(s / COLS) * 100}%`, width: `${((e - s + 1) / COLS) * 100}%`, backgroundColor: task.color }} />
                    );
                  })()}

                  {/* Bars */}
                  {taskBars.map(bar => {
                    const geo = barGeometry(bar);
                    const isConfirmingDelete = confirmDeleteBarId === bar.id;
                    return (
                      <div key={bar.id}
                        className={cn(
                          'absolute top-2 bottom-2 rounded flex items-center overflow-hidden group/bar',
                          readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
                        )}
                        style={{ left: geo.left, width: geo.width, backgroundColor: task.color, minWidth: 8 }}
                        onMouseDown={e => startBarMove(e, bar.id)}
                        onContextMenu={e => { e.preventDefault(); setConfirmDeleteBarId(bar.id); }}
                      >
                        {/* Resize left */}
                        {!readOnly && <div className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize" onMouseDown={e => startResize(e, bar.id, 'start')} />}

                        {isConfirmingDelete ? (
                          /* Delete confirm overlay */
                          <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 rounded">
                            <span className="text-white text-[10px]">Delete?</span>
                            <button
                              className="text-white hover:text-green-300"
                              onClick={e => { e.stopPropagation(); deleteBar(bar.id); }}
                              onMouseDown={e => e.stopPropagation()}
                            ><Check className="h-3.5 w-3.5" /></button>
                            <button
                              className="text-white/70 hover:text-white"
                              onClick={e => { e.stopPropagation(); setConfirmDeleteBarId(null); }}
                              onMouseDown={e => e.stopPropagation()}
                            ><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : (
                          <>
                            {/* Date label — click to edit */}
                            <span
                              className="text-white/90 text-[10px] px-2 pointer-events-auto select-none whitespace-nowrap overflow-hidden shrink-0 cursor-pointer hover:text-white hover:underline"
                              onClick={e => openDateEditor(e, bar)}
                              onMouseDown={e => e.stopPropagation()}
                            >
                              {view === 'month'
                                ? `${diffDays(parseDate(bar.start_date), parseDate(bar.end_date)) + 1}d`
                                : `${MONTH_NAMES[parseDate(bar.start_date).getMonth()]} ${parseDate(bar.start_date).getDate()} – ${MONTH_NAMES[parseDate(bar.end_date).getMonth()]} ${parseDate(bar.end_date).getDate()}`
                              }
                            </span>
                            {/* Category name */}
                            <span className="text-white text-[11px] font-medium pr-6 ml-auto pointer-events-none select-none whitespace-nowrap overflow-hidden">
                              {task.name}
                            </span>
                            {/* Trash icon */}
                            {!readOnly && (
                              <button
                                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/bar:opacity-80 hover:!opacity-100 transition-opacity z-10"
                                onClick={e => { e.stopPropagation(); setConfirmDeleteBarId(bar.id); }}
                                onMouseDown={e => e.stopPropagation()}
                              >
                                <Trash2 className="h-3 w-3 text-white" />
                              </button>
                            )}
                          </>
                        )}

                        {/* Resize right */}
                        {!readOnly && <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize" onMouseDown={e => startResize(e, bar.id, 'end')} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Add category row */}
          {!readOnly && (
            <div className="flex border-b border-border" style={{ height: ROW_H }}>
              <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="shrink-0 border-r border-border flex items-center px-2">
                {addingTask ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input className="h-6 text-xs px-1 flex-1" placeholder="Category name…" value={newTaskName}
                      onChange={e => setNewTaskName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setAddingTask(false); }}
                      autoFocus />
                    <button onClick={addTask}><Check className="h-3.5 w-3.5 text-green-500" /></button>
                    <button onClick={() => setAddingTask(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>
                ) : (
                  <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => setAddingTask(true)}>
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
        Drag cells to create a bar · Drag bar to move · Drag edges to resize · Click date on bar to edit dates · Trash icon or right-click to delete bar
      </p>

      {/* Date editor popover (fixed, outside scroll container) */}
      {editingBarDates && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setEditingBarDates(null)} />
          <div
            className="fixed z-50 bg-card border border-border rounded-lg shadow-xl p-3 flex flex-col gap-2.5 min-w-[200px]"
            style={{ left: editBarAnchor.x, top: editBarAnchor.y }}
          >
            <p className="text-xs font-medium text-muted-foreground">Edit Dates</p>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Start</label>
              <input type="date" className="text-sm border border-border rounded px-2 py-1 bg-background text-foreground"
                value={editingBarDates.start}
                onChange={e => setEditingBarDates(p => p ? { ...p, start: e.target.value } : null)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">End</label>
              <input type="date" className="text-sm border border-border rounded px-2 py-1 bg-background text-foreground"
                value={editingBarDates.end}
                onChange={e => setEditingBarDates(p => p ? { ...p, end: e.target.value } : null)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={saveDateEdit}>Save</Button>
              <Button variant="outline" size="sm" onClick={() => setEditingBarDates(null)}>Cancel</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
