import React, { createContext, useContext, useState } from 'react';
import { mockProjects } from '@/data/mock-data';
import { Project } from '@/types';

interface ProjectContextType {
  projects: Project[];
  selectedProject: Project;
  setSelectedProjectId: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedProjectId, setSelectedProjectId] = useState(mockProjects[0].id);
  const selectedProject = mockProjects.find(p => p.id === selectedProjectId) || mockProjects[0];

  return (
    <ProjectContext.Provider value={{ projects: mockProjects, selectedProject, setSelectedProjectId }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
};
