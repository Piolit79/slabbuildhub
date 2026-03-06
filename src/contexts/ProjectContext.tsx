import React, { createContext, useContext, useState } from 'react';
import { mockProjects } from '@/data/mock-data';
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
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [selectedProjectId, setSelectedProjectId] = useState(mockProjects[0].id);
  const activeProjects = projects.filter(p => p.status !== 'archived');
  const selectedProject = activeProjects.find(p => p.id === selectedProjectId) || activeProjects[0];

  const addProject = (name: string, address?: string) => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      address,
      status: 'active',
      created_at: new Date().toISOString().split('T')[0],
    };
    setProjects(prev => [...prev, newProject]);
    setSelectedProjectId(newProject.id);
  };

  const archiveProject = (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'archived' as const } : p));
    if (selectedProjectId === id) {
      const remaining = projects.filter(p => p.id !== id && p.status !== 'archived');
      if (remaining.length) setSelectedProjectId(remaining[0].id);
    }
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (selectedProjectId === id) {
      const remaining = projects.filter(p => p.id !== id && p.status !== 'archived');
      if (remaining.length) setSelectedProjectId(remaining[0].id);
    }
  };

  return (
    <ProjectContext.Provider value={{ projects, selectedProject, setSelectedProjectId, addProject, archiveProject, deleteProject }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
};
