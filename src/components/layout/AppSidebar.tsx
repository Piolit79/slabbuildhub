import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, CreditCard, Calculator, Users, Landmark, ChevronLeft, ChevronRight, Menu, X, Settings, LogOut, Shield, FolderKanban, FolderClosed, FolderOpen, UserRound, MessageSquare, Store, ClipboardCheck, CalendarDays, Layers, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import slabLogo from '@/assets/slab-builders-logo.svg';

const companyNavItems = [
  { to: '/', label: 'Ledger', icon: LayoutDashboard },
  { to: '/budget', label: 'Budget', icon: Calculator },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/contracts', label: 'Contracts', icon: FileText },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/draws', label: 'Draws', icon: Landmark },
  { to: '/vendors', label: 'Vendors', icon: Users },
];

const clientNavItems = [
  { to: '/client/dashboard', label: 'Ledger', icon: LayoutDashboard },
  { to: '/client/budget', label: 'Budget', icon: Calculator },
  { to: '/client/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/client/draws', label: 'Draws', icon: Landmark },
  { to: '/client/coi', label: 'Cert. Of Insurance', icon: Shield },
  { to: '/client/sub-agreements', label: 'Sub. Agreements', icon: ClipboardCheck },
  { to: '/client/files', label: 'StudioLAB Docs', icon: FolderOpen },
];

const insuranceItems = [
  { to: '/insurance', label: 'COI Tracker', icon: Shield, exact: true },
  { to: '/insurance/projects', label: "Insert COI's", icon: FolderKanban, exact: false },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isMobile = useIsMobile();
  const { isClient, logout } = useAuth();

  const navItems = isClient ? clientNavItems : companyNavItems;

  const renderNavLink = (to: string, label: string, Icon: any, exact?: boolean) => {
    const isActive = exact !== undefined
      ? (exact ? location.pathname === to : location.pathname.startsWith(to))
      : (to === '/' || to === '/client/dashboard' ? location.pathname === to : location.pathname.startsWith(to));
    return (
      <NavLink
        key={to}
        to={to}
        onClick={() => isMobile && setMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
          collapsed && !isMobile && 'justify-center px-0'
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {(isMobile || !collapsed) && <span>{label}</span>}
      </NavLink>
    );
  };

  const navContent = (
    <>
      <div className={cn("flex items-center border-b border-sidebar-border", collapsed && !isMobile ? "h-16 justify-center px-2" : "px-4 py-5")}>
        {collapsed && !isMobile ? (
          <span className="text-xs font-bold text-foreground">SB</span>
        ) : (
          <div className="flex items-center justify-between w-full">
            <a href="/"><img src={slabLogo} alt="SLAB Builders" className="w-full max-w-[200px]" /></a>
            {isMobile && (
              <button onClick={() => setMobileOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {!(collapsed && !isMobile) && (
          <span className="block text-base font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-2">
            {isClient ? 'Project Hub' : 'Project Hub'}
          </span>
        )}
        {navItems.map(({ to, label, icon }) => renderNavLink(to, label, icon))}

        {/* Insurance Hub Section — company only */}
        {!isClient && (
          <>
            {!(collapsed && !isMobile) && (
              <span className="block text-base font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-2 pt-4">
                Insurance Hub
              </span>
            )}
            {collapsed && !isMobile && <div className="border-t border-sidebar-border my-2" />}
            {insuranceItems.map(({ to, label, icon, exact }) => renderNavLink(to, label, icon, exact))}
          </>
        )}

        {/* Vendor Hub Section — company only */}
        {!isClient && (
          <>
            {!(collapsed && !isMobile) && (
              <span className="block text-base font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-2 pt-4">
                Vendor Hub
              </span>
            )}
            {collapsed && !isMobile && <div className="border-t border-sidebar-border my-2" />}
            {renderNavLink('/vendor-hub', 'Vendor Directory', Store)}
          </>
        )}

        {/* Interiors Hub Section — company only */}
        {!isClient && (
          <>
            {!(collapsed && !isMobile) && (
              <span className="block text-base font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-2 pt-4">
                Interiors Hub
              </span>
            )}
            {collapsed && !isMobile && <div className="border-t border-sidebar-border my-2" />}
            {renderNavLink('/interiors', 'Ledger', LayoutDashboard, true)}
            {renderNavLink('/interiors/package-track', 'Package Track', Package, false)}
          </>
        )}

        {/* Client Hub Section — company only (admin view) */}
        {!isClient && (
          <>
            {!(collapsed && !isMobile) && (
              <span className="block text-base font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-2 pt-4">
                Client Hub
              </span>
            )}
            {collapsed && !isMobile && <div className="border-t border-sidebar-border my-2" />}
            {renderNavLink('/client', 'Client Users', UserRound)}
            {renderNavLink('/client/files', 'StudioLAB Docs', FolderClosed)}
          </>
        )}

        {/* Code Hub Section — company only */}
        {!isClient && (
          <>
            {!(collapsed && !isMobile) && (
              <span className="block text-base font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-2 pt-4">
                Code Hub
              </span>
            )}
            {collapsed && !isMobile && <div className="border-t border-sidebar-border my-2" />}
            {renderNavLink('/code', 'Code Questions', MessageSquare, true)}
          </>
        )}

      </nav>

      <div className="mt-auto border-t border-sidebar-border">
        <nav className="px-3 py-2 space-y-1">
          {!isClient && renderNavLink('/settings', 'Settings', Settings)}
          <button
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors w-full text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
              collapsed && !isMobile && 'justify-center px-0'
            )}
            onClick={() => logout()}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {(isMobile || !collapsed) && <span>Log Out</span>}
          </button>
        </nav>
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-12 items-center justify-center border-t border-sidebar-border text-muted-foreground hover:text-sidebar-foreground transition-colors w-full"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-border shadow-md text-foreground"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {mobileOpen && (
          <>
            <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setMobileOpen(false)} />
            <aside className="fixed inset-y-0 left-0 z-50 w-[260px] bg-sidebar border-r border-sidebar-border flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
              {navContent}
            </aside>
          </>
        )}
      </>
    );
  }

  return (
    <aside
      className={cn(
        'h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      {navContent}
    </aside>
  );
}
