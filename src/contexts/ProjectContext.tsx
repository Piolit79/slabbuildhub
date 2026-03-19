import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Project } from '@/types';

interface ProjectContextType {
  projects: Project[];
  selectedProject: Project;
  setSelectedProjectId: (id: string) => void;
  addProject: (name: string, address?: string) => void;
  archiveProject: (id: string) => void;
  deleteProject: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isClient, profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('projects').select('*').order('created_at');
      if (data && data.length > 0) {
        setProjects(data as Project[]);
        // Client users: auto-select their assigned project
        if (isClient && profile?.project_id) {
          const assigned = data.find((p: any) => p.id === profile.project_id);
          if (assigned) {
            setSelectedProjectId(assigned.id);
          } else {
            setSelectedProjectId(data[0].id);
          }
        } else {
          const saved = localStorage.getItem('selectedProjectId');
          const valid = saved && data.find((p: any) => p.id === saved);
          setSelectedProjectId(valid ? saved : data[0].id);
        }
      }
      setLoaded(true);
    };
    load();
  }, [isClient, profile?.project_id]);

  const selectProject = (id: string) => {
    localStorage.setItem('selectedProjectId', id);
    setSelectedProjectId(id);
  };

  const activeProjects = projects.filter(p => p.status !== 'archived');
  const selectedProject = activeProjects.find(p => p.id === selectedProjectId) || activeProjects[0];

  const addProject = async (name: string, address?: string) => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      address,
      status: 'active',
      created_at: new Date().toISOString().split('T')[0],
    };
    await supabase.from('projects').insert(newProject);
    setProjects(prev => [...prev, newProject]);
    selectProject(newProject.id);
  };

  const archiveProject = async (id: string) => {
    await supabase.from('projects').update({ status: 'archived' }).eq('id', id);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'archived' as const } : p));
    if (selectedProjectId === id) {
      const remaining = projects.filter(p => p.id !== id && p.status !== 'archived');
      if (remaining.length) selectProject(remaining[0].id);
    }
  };

  const deleteProject = async (id: string) => {
    await supabase.from('projects').delete().eq('id', id);
    setProjects(prev => prev.filter(p => p.id !== id));
    if (selectedProjectId === id) {
      const remaining = projects.filter(p => p.id !== id && p.status !== 'archived');
      if (remaining.length) selectProject(remaining[0].id);
    }
  };

  if (!loaded || !selectedProject) return null;

  return (
    <ProjectContext.Provider value={{ projects, selectedProject, setSelectedProjectId: selectProject, addProject, archiveProject, deleteProject }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
};
