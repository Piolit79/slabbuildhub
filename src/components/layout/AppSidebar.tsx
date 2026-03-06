import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, CreditCard, Calculator, Users, Landmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import slabLogo from '@/assets/slab-builders-logo.svg';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/contracts', label: 'Contracts', icon: FileText },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/budget', label: 'Budget', icon: Calculator },
  { to: '/vendors', label: 'Vendors', icon: Users },
  { to: '/draws', label: 'Draws', icon: Landmark },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        'h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      <div className={cn("flex items-center border-b border-sidebar-border", collapsed ? "h-16 justify-center px-2" : "px-4 py-5")}>
        {collapsed ? (
          <span className="text-xs font-bold text-foreground">SB</span>
        ) : (
          <div className="flex flex-col items-start w-full">
            <a href="/"><img src={slabLogo} alt="SLAB Builders" className="w-full max-w-[200px]" /></a>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {!collapsed && (
          <span className="block text-base font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-2">
            Project Hub
          </span>
        )}
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                collapsed && 'justify-center px-0'
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-12 items-center justify-center border-t border-sidebar-border text-muted-foreground hover:text-sidebar-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
