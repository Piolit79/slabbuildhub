import { useState, useCallback } from 'react';

const STORAGE_KEY = 'coi-email-reminders';

export interface EmailReminder {
  id: string;
  coiId: string;
  subcontractor: string;
  projectId: string;
  projectName: string;
  sentAt: string;
  emailTo: string;
  subject: string;
  policies: string[];
}

function load(): EmailReminder[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function save(data: EmailReminder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useEmailReminders() {
  const [reminders, setReminders] = useState<EmailReminder[]>(load);

  const addReminder = useCallback((reminder: Omit<EmailReminder, 'id' | 'sentAt'>) => {
    const entry: EmailReminder = {
      ...reminder,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sentAt: new Date().toISOString(),
    };
    setReminders(prev => {
      const next = [entry, ...prev];
      save(next);
      return next;
    });
    return entry;
  }, []);

  return { reminders, addReminder };
}
