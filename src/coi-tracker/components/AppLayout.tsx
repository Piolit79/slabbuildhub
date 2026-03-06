import { ReactNode } from 'react';

// Passthrough — Hub's AppLayout provides the outer shell
export function AppLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
