import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { UserProfileDropdown } from '../components/common/UserProfileDropdown';
import { useUIStore } from '../store/uiStore';
import { ChangePasswordModal } from '../components/common/ChangePasswordModal';
import { useContextStore } from '../store/contextStore';
import { api } from '../services/api';
import {
  LayoutDashboard, BookOpen, Users, Award, FileSpreadsheet,
  CheckSquare, LogOut, Bell, Shield, Menu, X, BookMarked,
  BarChart3, Database, FileText, Layers, GraduationCap,
  ArrowRightLeft, Sparkles, Eye, Compass, User, Settings,
  ChevronRight, Search, CheckCircle2, AlertTriangle, Info
} from 'lucide-react';

interface SidebarItem {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  badge?: number | string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { user } = useAuthStore();
  const { changePasswordModalOpen } = useUIStore();
  const {
    programs, departments, regulations,
    selectedProgram, selectedDepartment, selectedRegulation,
    setPrograms, setDepartments, setRegulations,
    setSelectedProgram, setSelectedDepartment, setSelectedRegulation
  } = useContextStore();

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await api.notifications.list({ limit: 5 });
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const getRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };



  // Fetch academic context on mount
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const progRes = await api.programs.list();
        setPrograms(progRes.programs);
        if (progRes.programs.length > 0) setSelectedProgram(progRes.programs[0]);

        const deptRes = await api.programs.listDept();
        setDepartments(deptRes.departments);
        if (user?.department) {
          const userDept = deptRes.departments.find((d: any) => d._id === user.department?.id);
          setSelectedDepartment(userDept || deptRes.departments[0]);
        } else if (deptRes.departments.length > 0) {
          setSelectedDepartment(deptRes.departments[0]);
        }

        const regRes = await api.regulations.list();
        setRegulations(regRes.regulations);
        if (regRes.regulations.length > 0) {
          setSelectedRegulation(regRes.regulations[0]);
        }
      } catch (err) {
        console.error('[Layout] Failed to load academic context', err);
      }
    };
    if (user) fetchContext();
  }, [user]);



  // ── Sidebar navigation config per role ────────────────────────────────
  const getSidebarItems = (): SidebarItem[] => {
    if (!user) return [];
    switch (user.role) {
      case 'Admin':
        return [
          { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
          { id: 'programs', name: 'Programs', icon: Layers },
          { id: 'departments', name: 'Departments', icon: BookOpen },
          { id: 'regulations', name: 'Regulations', icon: Settings },
          { id: 'po-management', name: 'PO Management', icon: Award },
          { id: 'users', name: 'User Management', icon: Users },
          { id: 'hod-management', name: 'HOD Management', icon: Users },
          { id: 'curriculum', name: 'Curriculum Manager', icon: BookMarked },
          { id: 'approvals', name: 'Approvals', icon: CheckSquare },
          { id: 'profile', name: 'Profile', icon: User },
        ];
      case 'HOD':
        return [
          { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
          { id: 'local-outcomes', name: 'Local Outcomes', icon: Award },
          { id: 'course-categories', name: 'Course Types', icon: Layers },
          { id: 'courses', name: 'Course Repository', icon: Database },
          { id: 'curriculum', name: 'Curriculum Manager', icon: BookMarked },
          { id: 'faculty-management', name: 'Faculty Assignment', icon: Users },
          { id: 'approvals', name: 'Course Approvals', icon: CheckSquare },
          { id: 'minor-streams', name: 'Minor Streams', icon: Layers },
          { id: 'prerequisites', name: 'Prerequisites Links', icon: ArrowRightLeft },
          { id: 'profile', name: 'Profile', icon: User },
        ];
      case 'Coordinator':
        return [
          { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
          { id: 'my-courses', name: 'My Courses', icon: BookOpen },
          { id: 'course-details', name: 'Course Details', icon: Layers },
          { id: 'cos', name: 'COs Management', icon: Sparkles },
          { id: 'co-po', name: 'CO-PO Mapping', icon: FileSpreadsheet },
          { id: 'co-pso', name: 'CO-PSO Mapping', icon: FileSpreadsheet },
          { id: 'syllabus', name: 'Syllabus Management', icon: FileText },
          { id: 'reports', name: 'Reports', icon: FileText },
          { id: 'work-progress', name: 'Work Progress', icon: BarChart3 },
          { id: 'builder', name: 'Curriculum Book', icon: BookMarked },
          { id: 'profile', name: 'Profile', icon: User },
        ];
      case 'Faculty':
        return [
          { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
          { id: 'course-file', name: 'Course File Viewer', icon: BookOpen },
          { id: 'syllabus-view', name: 'Syllabus Viewer', icon: FileText },
          { id: 'builder', name: 'Curriculum Book', icon: BookMarked },
          { id: 'profile', name: 'Profile', icon: User },
        ];
      default:
        return [];
    }
  };

  const sidebarItems = getSidebarItems();

  // Derive user initials
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : '??';

  // Role color accent
  const roleAccent: Record<string, string> = {
    Admin: 'bg-violet-600',
    HOD: 'bg-teal-600',
    Coordinator: 'bg-blue-600',
    Faculty: 'bg-indigo-600',
  };
  const avatarColor = roleAccent[user?.role || ''] || 'bg-primary-600';

  const roleLabel: Record<string, string> = {
    Admin: 'System Administrator',
    HOD: 'Head of Department',
    Coordinator: 'Course Coordinator',
    Faculty: 'Faculty Member',
  };

  const currentPageName = sidebarItems.find(i => i.id === activeTab)?.name
    || activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace(/-/g, ' ');

  return (
    <div className="min-h-screen bg-surface-bg flex font-sans">

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-30 flex flex-col
          bg-white border-r border-border shadow-sidebar
          transition-all duration-300 ease-in-out no-print
          ${sidebarOpen ? 'w-[260px]' : 'w-0 overflow-hidden'}
        `}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[13px] font-bold text-text-primary leading-tight truncate">
              Aditya University
            </h2>
            <p className="text-[10px] text-text-subtle font-medium truncate">
              OBE Curriculum Portal
            </p>
          </div>
        </div>

        {/* Role Badge */}
        <div className="px-5 pt-4 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-active rounded-xl border border-primary-100">
            <div className={`w-6 h-6 rounded-lg ${avatarColor} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-primary-700 truncate leading-tight">{user?.name?.split(' ')[0]}</p>
              <p className="text-[9px] text-primary-500 font-medium truncate">{roleLabel[user?.role || ''] || user?.role}</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-0.5">
          <p className="text-[9px] font-bold text-text-subtle uppercase tracking-widest px-3 pb-2 pt-2">
            Navigation
          </p>
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium
                  transition-all duration-150 text-left group relative
                  ${isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text-secondary'
                  }
                `}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? 'text-white' : 'text-text-subtle group-hover:text-primary-500'}`} />
                <span className="flex-1 truncate">{item.name}</span>
                {item.badge && (
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${isActive ? 'bg-white/20 text-white' : 'bg-primary-50 text-primary-600'}`}>
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <ChevronRight className="w-3 h-3 text-white/70 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────────── */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? 'ml-[260px]' : 'ml-0'}`}
      >

        {/* ── TOP BAR ───────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 bg-white border-b border-border shadow-topbar h-14 flex items-center px-5 gap-4 no-print flex-shrink-0">

          {/* Left: hamburger + breadcrumb */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-secondary transition-colors"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs">
              <span className="text-text-subtle">OBE Portal</span>
              <ChevronRight className="w-3 h-3 text-text-subtle" />
              <span className="font-semibold text-text-secondary">{currentPageName}</span>
            </div>
          </div>

          {/* Spacer to push Right elements to the far right edge after removing the Center selectors */}
          <div className="flex-1" />

          {/* Right: Notifications + User */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Notifications bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2 rounded-xl text-text-muted hover:bg-surface-hover hover:text-text-secondary transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-danger-500 text-white rounded-full text-[9px] font-black h-4 w-4 flex items-center justify-center border border-white shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-card-lg border border-border z-50 overflow-hidden animate-fadeIn">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <h4 className="text-sm font-bold text-text-primary">Notifications</h4>
                    <button onClick={() => setNotifOpen(false)} className="text-text-subtle hover:text-text-muted">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((n) => {
                        const IconComponent = n.type === 'success' ? CheckCircle2 : n.type === 'warning' ? AlertTriangle : Info;
                        const iconColor = n.type === 'success' ? 'text-success-600 bg-success-50 border-success-100' :
                          n.type === 'warning' ? 'text-warning-600 bg-warning-50 border-warning-100' :
                            'text-primary-600 bg-primary-50 border-primary-100';
                        return (
                          <div
                            key={n._id}
                            onClick={async () => {
                              try {
                                if (!n.isRead) {
                                  await api.notifications.markRead(n._id);
                                  fetchNotifications();
                                }
                                setNotifOpen(false);
                                setActiveTab('notifications');
                              } catch (err) {
                                console.error('Error marking read', err);
                              }
                            }}
                            className={`flex items-start gap-3 p-2.5 rounded-xl hover:bg-surface-hover cursor-pointer transition-colors relative border border-transparent hover:border-border-light ${!n.isRead ? 'bg-primary-50/10' : ''}`}
                          >
                            {!n.isRead && (
                              <span className="absolute right-3 top-3.5 w-1.5 h-1.5 rounded-full bg-primary-650" />
                            )}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${iconColor}`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-text-primary truncate">{n.title}</p>
                              <p className="text-[10px] text-text-subtle mt-0.5 line-clamp-2 leading-relaxed font-medium">{n.description}</p>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="text-[9px] text-text-muted font-mono font-medium">{getRelativeTime(n.createdAt)}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 border border-slate-200`}>
                                  {n.category}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-text-subtle font-medium text-xs flex flex-col items-center justify-center gap-2">
                        <span className="text-2xl">🔔</span>
                        <span>You have no notifications.</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-border bg-slate-50/50">
                    <button
                      onClick={() => {
                        setNotifOpen(false);
                        setActiveTab('notifications');
                      }}
                      className="w-full text-xs text-primary-600 font-semibold text-center hover:underline bg-transparent border-0 cursor-pointer"
                    >
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-border" />

            {/* User Profile Dropdown */}
            <UserProfileDropdown setActiveTab={setActiveTab} />
          </div>
        </header>

        {/* ── PAGE CONTENT ──────────────────────────────────────────────── */}
        <main className="flex-1 p-6 overflow-y-auto bg-surface-bg">
          {children}
        </main>
      </div>



      {/* Backdrop overlay for notifications dropdown on mobile */}
      {notifOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
      )}

      {/* Global Change Password Modal */}
      <ChangePasswordModal />
    </div>
  );
};
