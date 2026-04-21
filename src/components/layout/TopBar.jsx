import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Bell, 
  Search, 
  User, 
  LogOut, 
  Sun, 
  Moon, 
  Library, 
  LayoutDashboard, 
  History, 
  ShieldCheck 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/utils/cn';

const TopBar = () => {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const studentLinks = [
    { name: 'Dashboard', icon: LayoutDashboard, path: `/student/${user?.roll}` },
    { name: 'History', icon: History, path: '/history' },
  ];

  const adminLinks = [
    { name: 'Live Monitor', icon: LayoutDashboard, path: '/admin' },
    { name: 'Reports', icon: ShieldCheck, path: '/admin/reports' },
  ];

  const links = isAdmin ? adminLinks : studentLinks;

  return (
    <header className="h-16 bg-card border-b border-border sticky top-0 z-40 transition-colors duration-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        
        {/* Left Side: Brand & Navigation */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2 text-primary">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
              <Library size={18} />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">NovaCard</span>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                className={({ isActive }) => cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-secondary text-primary" 
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <link.icon size={16} />
                <span>{link.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right Side: Utilities */}
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block mr-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={16} />
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-9 pr-4 py-1.5 bg-background border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-48 transition-all"
            />
          </div>

          <button onClick={toggleTheme} className="p-2 text-muted-foreground hover:bg-secondary rounded-full transition-colors">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <button className="relative p-2 text-muted-foreground hover:bg-secondary rounded-full transition-colors hidden sm:block">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full"></span>
          </button>

          <div className="h-6 w-px bg-border mx-1"></div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-muted-foreground border border-border">
              <User size={16} />
            </div>
            <div className="text-right hidden sm:block mr-2">
              <p className="text-sm font-semibold leading-none mb-1 text-foreground">{user?.name || 'Student'}</p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider leading-none">{user?.role || 'Guest'}</p>
            </div>
            <button 
              onClick={logout} 
              className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};

export default TopBar;
