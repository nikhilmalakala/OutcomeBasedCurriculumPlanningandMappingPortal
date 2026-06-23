import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useContextStore } from '../../store/contextStore';
import { api } from '../../services/api';
import { 
  LayoutDashboard, BookOpen, FileText, Bell, Settings, 
  Search, ShieldAlert, Award, ArrowRight, ArrowLeft, CheckCircle2, ChevronRight,
  Info, ExternalLink, Calendar, User, Briefcase, Mail, Cpu, Building2, Phone, AlertCircle, X,
  Filter, Eye
} from 'lucide-react';
import { CurriculumBookGenerator } from '../../components/common/CurriculumBookGenerator';

interface FacultyDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ activeTab, setActiveTab }) => {
  const { user } = useAuthStore();

  const getInitials = () => {
    if (!user?.name) return 'FA';
    return user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getDepartmentName = () => {
    return user?.department?.name || 'Computer Science and Engineering';
  };

  const getDepartmentCode = () => {
    return user?.department?.code || 'CSE';
  };

  const getRoleLabel = () => {
    if (user?.role === 'Faculty') return 'Faculty Member';
    return user?.role || 'Faculty';
  };

  // State for approved courses
  const [approvedCourses, setApprovedCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedCourseCode, setSelectedCourseCode] = useState('');
  const [showAllCourses, setShowAllCourses] = useState(false);

  // Profile update success state
  const [showProfileSuccess, setShowProfileSuccess] = useState(false);
  const { profileSuccess, setChangePasswordModalOpen } = useUIStore();

  // Profile preferences toggles state
  const [emailNotif, setEmailNotif] = useState(true);
  const [erpUpdates, setErpUpdates] = useState(true);
  const [announcementAlerts, setAnnouncementAlerts] = useState(false);

  // Selected Unit state for Syllabus Viewer
  const [selectedUnit, setSelectedUnit] = useState(1);
  const [bookViewMode, setBookViewMode] = useState<'directory' | 'view'>('directory');

  // Dynamic finalized curriculum count
  const [finalizedCount, setFinalizedCount] = useState(0);
  const { departments, regulations, selectedDepartment, selectedRegulation, setSelectedRegulation } = useContextStore();

  useEffect(() => {
    const fetchCourses = async () => {
      if (!selectedRegulation?._id) return;
      setIsLoading(true);
      try {
        const res = await api.courses.listByReg(selectedRegulation._id);
        const versions = res.versions || [];
        
        // Faculty should see all Approved courses
        const approved = versions.filter((v: any) => v.status === 'Approved');
        setApprovedCourses(approved);
        setFinalizedCount(approved.length);
        
        if (approved.length > 0 && !selectedCourseCode) {
          setSelectedCourseCode(approved[0].courseId?.code);
        }
      } catch (err) {
        console.error('[Faculty] Failed to fetch courses:', err);
        setApprovedCourses([]);
        setFinalizedCount(0);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourses();
  }, [selectedRegulation, selectedCourseCode]);

  // Dropdown states for filters
  const [deptFilter, setDeptFilter] = useState('All');
  const [semFilter, setSemFilter] = useState('All');
  const [regFilter, setRegFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  // Synchronize regFilter with selectedRegulation on change
  useEffect(() => {
    if (selectedRegulation?.code) {
      setRegFilter(selectedRegulation.code);
    }
  }, [selectedRegulation]);

  const handleRegChange = (regCode: string) => {
    setRegFilter(regCode);
    const matchedReg = regulations.find(r => r.code === regCode);
    if (matchedReg) {
      setSelectedRegulation(matchedReg);
    }
  };

  // Filtered approved courses for Course File Viewer
  const filteredCourses = approvedCourses.filter(item => {
    // 1. Department Filter
    if (deptFilter !== 'All') {
      const itemDeptCode = item.courseId?.departmentId?.code || item.courseId?.department?.code || '';
      if (itemDeptCode.toLowerCase() !== deptFilter.toLowerCase()) {
        return false;
      }
    }

    // 2. Semester Filter
    if (semFilter !== 'All') {
      if (String(item.semester) !== String(semFilter)) {
        return false;
      }
    }

    // 3. Regulation Filter
    if (regFilter !== 'All') {
      const itemRegCode = item.regulationId?.code || selectedRegulation?.code || '';
      if (itemRegCode.toLowerCase() !== regFilter.toLowerCase()) {
        return false;
      }
    }

    // 4. Course Type (Level) Filter
    if (typeFilter !== 'All') {
      const itemLevel = item.level || '';
      if (itemLevel.toLowerCase() !== typeFilter.toLowerCase()) {
        return false;
      }
    }

    return true;
  });

  const semesters = Array.from(new Set(approvedCourses.map(item => item.semester))).sort((a, b) => a - b);

  // Synchronize selectedCourseCode when filteredCourses list changes
  useEffect(() => {
    if (activeTab === 'course-file') {
      if (filteredCourses.length > 0) {
        const exists = filteredCourses.some(item => item.courseId?.code === selectedCourseCode);
        if (!exists) {
          setSelectedCourseCode(filteredCourses[0].courseId?.code || '');
        }
      } else {
        setSelectedCourseCode('');
      }
    }
  }, [deptFilter, semFilter, regFilter, typeFilter, approvedCourses, activeTab]);

  // Notifications Category filter state
  const [activeNotifTab, setActiveNotifTab] = useState<'All' | 'Updates' | 'Announcements' | 'System'>('All');

  // Recent activity list state with empty state fallbacks
  const [recentActivities] = useState<any[]>([
    { action: 'Viewed syllabus', course: 'CS3301', time: '2 hours ago' },
    { action: 'Opened course file', course: 'CS3301', time: 'Yesterday' }
  ]);

  // Static descriptions matching PO1-PO12
  const programOutcomes = [
    { code: 'PO1', title: 'Engineering Knowledge', desc: 'Apply the knowledge of mathematics, science, engineering fundamentals, and an engineering specialization to the solution of complex engineering problems.' },
    { code: 'PO2', title: 'Problem Analysis', desc: 'Identify, formulate, review research literature, and analyze complex engineering problems reaching substantiated conclusions using first principles of mathematics, natural sciences, and engineering sciences.' },
    { code: 'PO3', title: 'Design/Development of Solutions', desc: 'Design solutions for complex engineering problems and design system components or processes that meet the specified needs with appropriate consideration for the public health and safety, and the cultural, societal, and environmental considerations.' },
    { code: 'PO4', title: 'Conduct Investigations of Complex Problems', desc: 'Use research-based knowledge and research methods including design of experiments, analysis and interpretation of data, and synthesis of the information to provide valid conclusions.' },
    { code: 'PO5', title: 'Modern Tool Usage', desc: 'Create, select, and apply appropriate techniques, resources, and modern engineering and IT tools including prediction and modeling to complex engineering activities with an understanding of the limitations.' },
    { code: 'PO6', title: 'The Engineer and Society', desc: 'Apply reasoning informed by the contextual knowledge to assess societal, health, safety, legal and cultural issues and the consequent responsibilities relevant to the professional engineering practice.' },
    { code: 'PO7', title: 'Environment and Sustainability', desc: 'Understand the impact of the professional engineering solutions in societal and environmental contexts, and demonstrate the knowledge of, and need for sustainable development.' },
    { code: 'PO8', title: 'Ethics', desc: 'Apply ethical principles and commit to professional ethics and responsibilities and norms of the engineering practice.' },
    { code: 'PO9', title: 'Individual and Team Work', desc: 'Function effectively as an individual, and as a member or leader in diverse teams, and in multidisciplinary settings.' },
    { code: 'PO10', title: 'Communication', desc: 'Communicate effectively on complex engineering activities with the engineering community and with society at large, such as, being able to comprehend and write effective reports and design documentation, make effective presentations, and give and receive clear instructions.' },
    { code: 'PO11', title: 'Project Management and Finance', desc: 'Demonstrate knowledge and understanding of the engineering and management principles and apply these to one’s own work, as a member and leader in a team, to manage projects and in multidisciplinary environments.' },
    { code: 'PO12', title: 'Life-long Learning', desc: 'Recognize the need for, and have the preparation and ability to engage in independent and life-long learning in the broadest context of technological change.' }
  ];

  const programSpecificOutcomes = [
    { code: 'PSO1', title: 'Core Software Competence', desc: 'Design and develop efficient software solutions utilizing algorithms, data structures, and object-oriented paradigms.' },
    { code: 'PSO2', title: 'Infrastructure & Cloud Config', desc: 'Deploy, secure, and monitor applications across web, mobile, database and cloud architectural pipelines.' },
    { code: 'PSO3', title: 'Modern Systems Design', desc: 'Apply software engineering tools and agile methodologies to construct scalable enterprise platforms.' }
  ];



  // explorer courses state handled dynamically

  // Notifications feed list
  const notificationsList = [
    { id: 1, title: 'CSE R2023 semester 5 curriculum finalized', desc: 'The curriculum scheme and syllabus drafts for Semester 5 of regulation R2023 have been fully approved by HOD.', time: '2 hours ago', cat: 'Updates', type: 'success' },
    { id: 2, title: 'Syllabus reference materials updated', desc: 'New prescribed textbooks and reference books have been appended to CS3301 course definition by coordinator.', time: '1 day ago', cat: 'Updates', type: 'info' },
    { id: 3, title: 'Annual Academic Audit Schedule', desc: 'The internal curriculum audit for NBA accreditation readiness will commence from June 15th.', time: '3 days ago', cat: 'Announcements', type: 'warning' },
    { id: 4, title: 'System Maintenance: Backup successfully run', desc: 'Global curriculum metadata tables successfully backed up onto secondary university storage node.', time: '5 days ago', cat: 'System', type: 'system' }
  ];

  return (
    <div className="space-y-6 font-sans w-full max-w-none">

      {/* ============================================================== */}
      {/* 1. DASHBOARD PAGE */}
      {/* ============================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-fadeIn w-full">

          {/* ── Welcome Header ───────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-border shadow-card p-6 flex flex-col sm:flex-row items-start gap-5 w-full">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-sm flex-shrink-0">
              {getInitials()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-text-subtle uppercase tracking-widest">Aditya University · Faculty Portal</p>
              <h1 className="text-xl font-bold text-text-primary mt-0.5">Welcome back, {user?.name || 'Ms. S. Anusha'}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px] font-semibold">{getRoleLabel()}</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold">{getDepartmentName()}</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-success-50 text-success-700 border border-success-100 text-[11px] font-semibold">{getDepartmentCode()} · Active Semester</span>
              </div>
            </div>
          </div>

          {/* ── Overview Stat Cards ────────────────────────── */}
          <div className="grid gap-6 w-full" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            {/* Card 1: Assigned Courses */}
            <div className="bg-white rounded-2xl border border-border shadow-card p-6 flex items-center gap-5 hover:shadow-card-md hover:border-border-medium transition-all w-full">
              <div className="w-11 h-11 rounded-xl bg-success-50 border border-success-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-success-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-black text-text-primary leading-none">{approvedCourses.length}</p>
                <p className="text-[11px] font-semibold text-text-muted mt-1">Assigned Courses</p>
                <p className="text-[10px] text-text-subtle mt-0.5">This Semester</p>
              </div>
            </div>

            {/* Card 2: Finalized Curriculum */}
            <div className="bg-white rounded-2xl border border-border shadow-card p-6 flex items-center gap-5 hover:shadow-card-md hover:border-border-medium transition-all w-full">
              <div className="w-11 h-11 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-primary-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-black text-text-primary leading-none">{finalizedCount}</p>
                <p className="text-[11px] font-semibold text-text-muted mt-1">Finalized Curriculum</p>
              </div>
            </div>
          </div>

          {/* ── Assigned Courses Section ──────────────────── */}
          <div className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-6 w-full">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-text-subtle">Assigned Courses</h3>
              <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-extrabold uppercase font-sans tracking-wide">{approvedCourses.length} Total</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                <div className="col-span-full py-8 text-center text-slate-500 font-semibold animate-pulse">Loading approved courses...</div>
              ) : approvedCourses.length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-500 font-semibold">No approved courses found for this regulation.</div>
              ) : (
                approvedCourses.slice(0, showAllCourses ? approvedCourses.length : 3).map((v) => {
                  const course = v.courseId || {};
                  return (
                    <div key={v._id} className="bg-slate-50/50 rounded-xl border border-slate-200 p-4 flex flex-col justify-between hover:shadow-sm hover:bg-slate-50 transition-all space-y-4">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold font-mono text-indigo-650 bg-indigo-50/80 border border-indigo-100 px-2 py-0.5 rounded-lg">{course.code}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold border bg-primary-50 text-primary-700 border-primary-100`}>
                            {v.category || 'Theory'}
                          </span>
                        </div>
                        
                        <h4 className="text-xs font-extrabold text-slate-800 mt-2.5 leading-snug">{course.title}</h4>
                        
                        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] text-slate-500 font-bold">
                          <span>Semester {v.semester}</span>
                          <span>|</span>
                          <span>{selectedDepartment?.code || 'Dept'}</span>
                          <span>|</span>
                          <span>{selectedRegulation?.code || 'Reg'}</span>
                        </div>
                        
                        <p className="text-[10px] text-slate-455 font-bold mt-1.5">Credits: {v.credits?.C || 3}</p>
                      </div>

                      <div className="flex gap-2 pt-2.5 border-t border-slate-200/60 text-[11px] font-bold">
                        <button
                          onClick={() => {
                            setSelectedCourseCode(course.code);
                            setActiveTab('course-file');
                          }}
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg transition-all text-center flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Open Course Files</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCourseCode(course.code);
                            setActiveTab('syllabus-view');
                          }}
                          className="flex-1 py-2 bg-white hover:bg-slate-105 border border-slate-300 text-slate-700 rounded-lg transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-550" />
                          <span>View Syllabus</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {approvedCourses.length > 3 && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => setShowAllCourses(!showAllCourses)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  {showAllCourses ? 'View Less' : 'View More'}
                </button>
              </div>
            )}
          </div>

          {/* ── Recent Activity ───────────────────────────── */}
          <div className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-6 w-full">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-text-subtle">Recent Activity</h3>
              <button onClick={() => setActiveTab('notifications')} className="text-[11px] text-primary-600 font-semibold hover:underline">View All</button>
            </div>

            <div className="space-y-3">
              {recentActivities && recentActivities.length > 0 ? (
                <div className="space-y-3">
                  {recentActivities.map((act, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs border-b border-border-light pb-3 last:border-b-0 last:pb-0">
                      <div className="w-2 h-2 rounded-full bg-warning-500 mt-1.5 flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2">
                          <h4 className="font-semibold text-text-primary">{act.action}</h4>
                          <span className="text-[10px] text-text-subtle font-medium flex-shrink-0">{act.time}</span>
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5">Course Code: <span className="font-semibold text-text-secondary">{act.course}</span> - Data Structures</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-text-subtle font-medium text-xs flex flex-col items-center justify-center gap-2">
                  <span className="text-2xl">📌</span>
                  <span>You have not accessed any course files recently.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. COURSE FILE VIEWER PAGE */}
      {/* ============================================================== */}
      {activeTab === 'course-file' && (() => {
        const activeCourse = filteredCourses.find(item => item.courseId?.code === selectedCourseCode) || filteredCourses[0];
        return (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 font-sans">Course File Viewer</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
              
              {/* Left Filter Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">FILTERS</h3>
                
                <div className="space-y-3.5 text-xs font-bold text-slate-500">
                  <div className="space-y-1">
                    <span>Regulation</span>
                    <select 
                      value={regFilter} 
                      onChange={(e) => handleRegChange(e.target.value)} 
                      className="w-full border border-slate-300 rounded-lg p-2 text-slate-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="All">All</option>
                      {regulations.map(reg => (
                        <option key={reg._id} value={reg.code}>{reg.code}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span>Department</span>
                    <select 
                      value={deptFilter} 
                      onChange={(e) => setDeptFilter(e.target.value)} 
                      className="w-full border border-slate-300 rounded-lg p-2 text-slate-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="All">All Departments</option>
                      {departments.map(dept => (
                        <option key={dept._id} value={dept.code}>{dept.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span>Semester</span>
                    <select 
                      value={semFilter} 
                      onChange={(e) => setSemFilter(e.target.value)} 
                      className="w-full border border-slate-300 rounded-lg p-2 text-slate-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="All">All Semesters</option>
                      {semesters.map(sem => (
                        <option key={sem} value={String(sem)}>Semester {sem}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span>Course Type</span>
                    <select 
                      value={typeFilter} 
                      onChange={(e) => setTypeFilter(e.target.value)} 
                      className="w-full border border-slate-300 rounded-lg p-2 text-slate-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="All">All</option>
                      <option value="Foundation">Foundation Course</option>
                      <option value="Intermediate">Intermediate Course</option>
                      <option value="Advanced">Advanced Course</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span>Course Name</span>
                    <select 
                      value={selectedCourseCode} 
                      onChange={(e) => setSelectedCourseCode(e.target.value)} 
                      className="w-full border border-slate-300 rounded-lg p-2 text-slate-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                    >
                      {filteredCourses.length === 0 ? (
                        <option value="">No courses matching filters</option>
                      ) : (
                        filteredCourses.map(item => (
                          <option key={item._id} value={item.courseId?.code}>
                            {item.courseId?.code} - {item.courseId?.title}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Right Course Panel */}
              <div className="md:col-span-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                {!activeCourse ? (
                  <div className="text-center py-16 text-slate-500">
                    <BookOpen className="w-16 h-16 mx-auto text-slate-300 mb-4 stroke-[1.5]" />
                    <h3 className="font-extrabold text-slate-800 text-sm">No courses matching filters</h3>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting the Department, Semester, Regulation, or Course Type filters on the left.</p>
                  </div>
                ) : (
                  <>
                    {/* Header block */}
                    <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                      {(() => {
                        const fmt = (v: number | undefined) => (v === 0 || !v) ? '-' : v;
                        const creditsC = fmt(activeCourse.credits?.C);
                        const l = fmt(activeCourse.credits?.L);
                        const t = fmt(activeCourse.credits?.T);
                        const p = fmt(activeCourse.credits?.P);
                        const s = fmt(activeCourse.credits?.S);
                        
                        return (
                          <>
                            <div>
                              <h2 className="text-base font-extrabold text-slate-800">{activeCourse.courseId?.code} - {activeCourse.courseId?.title}</h2>
                              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{selectedDepartment?.code || 'Dept'} / Semester {activeCourse.semester} / {selectedRegulation?.code || 'Reg'}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[9px] font-bold text-emerald-700 uppercase tracking-wider">
                                Finalized
                              </span>
                              <div className="text-right font-sans">
                                <span className="block text-[8px] font-bold text-slate-400 leading-none">L  T  P  S  C</span>
                                <strong className="block text-xs text-slate-700 leading-none mt-1.5 font-mono">{l}  {t}  {p}  {s}  {creditsC}</strong>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <div className="text-xs font-bold text-slate-700 space-y-1">
                      <span>Course Code: {activeCourse.courseId?.code}</span>
                    </div>

                    {/* Course outcomes definitions list */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Course Outcomes:</h4>
                      <p className="text-[11px] text-slate-500 font-medium">At the end of the course, student will be able to:</p>
                      <div className="space-y-2 pt-1 font-medium text-slate-600 text-xs">
                        {(() => {
                          const outcomes = activeCourse.courseOutcomes || [];
                          if (outcomes.length === 0) return <p className="text-slate-400 italic">No Course Outcomes defined.</p>;
                          return outcomes.map((co: any) => (
                            <div key={co.coCode} className="flex gap-2 leading-relaxed">
                              <strong className="text-blue-900 font-bold flex-shrink-0 w-8">{co.coCode}:</strong>
                              <span>{co.description}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    {/* Mappings Matrix Readonly Table */}
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Mapping of Course Outcomes with Program Outcomes (PO) and Program Specific Outcomes (PSO):
                      </h4>
                      
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-center border-collapse text-[10px]">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-400 uppercase font-bold font-sans">
                              <th className="p-2.5 border-r border-slate-200 text-left pl-3 font-extrabold w-16">CO/PO</th>
                              {Array.from({ length: 12 }, (_, i) => `PO ${i + 1}`).map(po => (
                                <th key={po} className="p-2 border-r border-slate-200 font-semibold">{po}</th>
                              ))}
                              {Array.from({ length: 3 }, (_, i) => `PSO ${i + 1}`).map(pso => (
                                <th key={pso} className="p-2 border-r border-slate-200 text-blue-900 font-bold bg-blue-50/20">{pso}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const coMap = activeCourse.coPoMappings || [];
                              const psoMap = activeCourse.coPsoMappings || [];
                              const coCodes = activeCourse.courseOutcomes?.map((co: any) => co.coCode) || ['CO1', 'CO2', 'CO3', 'CO4', 'CO5'];

                              return coCodes.map((coCode: string) => {
                                const poData = coMap.find((m: any) => m.coCode === coCode)?.po || {};
                                const psoData = psoMap.find((m: any) => m.coCode === coCode)?.pso || {};
                                
                                return (
                                  <tr key={coCode} className="border-b border-slate-100 hover:bg-slate-50/20 font-bold text-slate-700 font-mono">
                                    <td className="p-2.5 border-r border-slate-200 text-left pl-3 font-sans text-xs text-blue-900 font-black">
                                      {coCode}
                                    </td>
                                    {Array.from({ length: 12 }, (_, i) => `PO${i + 1}`).map(po => {
                                      const val = poData[po] || 0;
                                      const bg = val === 3 ? 'bg-emerald-50 text-emerald-700' :
                                                 val === 2 ? 'bg-blue-50/50 text-blue-700' :
                                                 val === 1 ? 'bg-slate-50 text-slate-500' : 'text-slate-300';
                                      return (
                                        <td key={po} className={`p-2 border-r border-slate-150 ${bg}`}>
                                          {val > 0 ? val : '-'}
                                        </td>
                                      );
                                    })}
                                    {Array.from({ length: 3 }, (_, i) => `PSO${i + 1}`).map(pso => {
                                      const val = psoData[pso] || 0;
                                      const bg = val === 3 ? 'bg-emerald-50 text-emerald-700' :
                                                 val === 2 ? 'bg-blue-50/50 text-blue-700' :
                                                 val === 1 ? 'bg-slate-50 text-slate-500' : 'text-slate-300';
                                      return (
                                        <td key={pso} className={`p-2 border-r border-slate-150 bg-blue-50/10 ${bg}`}>
                                          {val > 0 ? val : '-'}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Descriptions Reference panel */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                        <Award className="w-4 h-4 text-blue-800" />
                        <span>Program Outcomes (PO) & PSO Reference Descriptions</span>
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[10px]">
                        
                        {/* Left Column POs */}
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          <span className="font-bold text-slate-400 uppercase tracking-wider block">Core Program Outcomes (POs)</span>
                          {programOutcomes.map((po) => (
                            <div key={po.code} className="space-y-0.5 leading-normal">
                              <strong className="text-slate-800 font-bold block">{po.code}: {po.title}</strong>
                              <p className="text-slate-500 font-medium">{po.desc}</p>
                            </div>
                          ))}
                        </div>

                        {/* Right Column PSOs */}
                        <div className="space-y-3">
                          <span className="font-bold text-slate-400 uppercase tracking-wider block">Program Specific Outcomes (PSOs)</span>
                          {programSpecificOutcomes.map((pso) => (
                            <div key={pso.code} className="space-y-0.5 leading-normal">
                              <strong className="text-blue-900 font-bold block">{pso.code}: {pso.title}</strong>
                              <p className="text-slate-500 font-medium">{pso.desc}</p>
                            </div>
                          ))}
                        </div>

                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* 3. SYLLABUS VIEWER PAGE */}
      {/* ============================================================== */}
      {activeTab === 'syllabus-view' && (() => {
        const activeCourse = filteredCourses.find(item => item.courseId?.code === selectedCourseCode) || filteredCourses[0];
        return (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 font-sans">Syllabus Viewer</h1>
              <p className="text-xs text-slate-500 mt-1 font-semibold">Browse approved unit-wise syllabi, references, practicals, and course outcomes.</p>
            </div>

            {/* Top Filters bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-bold text-slate-500">
              <div className="space-y-1">
                <span>Regulation</span>
                <select 
                  value={regFilter} 
                  onChange={(e) => handleRegChange(e.target.value)} 
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-700 bg-white font-semibold outline-none cursor-pointer focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">All</option>
                  {regulations.map(reg => (
                    <option key={reg._id} value={reg.code}>{reg.code}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-1">
                <span>Department</span>
                <select 
                  value={deptFilter} 
                  onChange={(e) => setDeptFilter(e.target.value)} 
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-700 bg-white font-semibold outline-none cursor-pointer focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept._id} value={dept.code}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span>Semester</span>
                <select 
                  value={semFilter} 
                  onChange={(e) => setSemFilter(e.target.value)} 
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-700 bg-white font-semibold outline-none cursor-pointer focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">All Semesters</option>
                  {semesters.map(sem => (
                    <option key={sem} value={String(sem)}>Semester {sem}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span>Course</span>
                <select 
                  value={selectedCourseCode}
                  onChange={(e) => setSelectedCourseCode(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-700 bg-white font-semibold outline-none cursor-pointer focus:ring-1 focus:ring-blue-500"
                >
                  {filteredCourses.length === 0 ? (
                    <option value="">No courses matching filters</option>
                  ) : (
                    filteredCourses.map(item => (
                      <option key={item._id} value={item.courseId?.code}>{item.courseId?.code} - {item.courseId?.title}</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Split grid layout */}
            {!activeCourse ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-500">
                <BookOpen className="w-16 h-16 mx-auto text-slate-300 mb-4 stroke-[1.5]" />
                <h3 className="font-extrabold text-slate-800 text-sm">No courses matching filters</h3>
                <p className="text-xs text-slate-400 mt-1">Try adjusting the Regulation, Department, or Semester filters above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                
                {/* Left Units list */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">UNITS</h4>
                  
                  <div className="space-y-2">
                    {(() => {
                      const units = activeCourse.syllabusUnits || [];
                      if (units.length === 0) return <p className="text-slate-400 italic">No units defined.</p>;
                      return units.map((u: any, idx: number) => (
                        <div 
                          key={u._id || idx}
                          onClick={() => setSelectedUnit(u.unitNumber)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer text-left space-y-1 ${
                            selectedUnit === u.unitNumber 
                              ? 'border-blue-600 bg-blue-50/10' 
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`text-[11px] font-bold block ${selectedUnit === u.unitNumber ? 'text-blue-900' : 'text-slate-700'}`}>
                            Unit {u.unitNumber}: {u.title}
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold block font-mono">{u.hours || 10} contact hours</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Right details card */}
                <div className="md:col-span-3 space-y-6">
                  
                  {/* Unit Content card */}
                  {(() => {
                    const units = activeCourse.syllabusUnits || [];
                    const unit = units.find((u: any) => u.unitNumber === selectedUnit) || units[0];
                    
                    if (!unit) return <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-500 font-semibold">Select a unit to view details.</div>;

                    return (
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 relative">
                        <span className="absolute top-4 right-4 px-2 py-0.5 bg-slate-100 text-slate-455 border border-slate-250 rounded text-[9px] font-bold font-mono">
                          Unit {unit.unitNumber}
                        </span>

                        <div className="space-y-1 border-b border-slate-100 pb-3">
                          <h3 className="text-base font-extrabold text-slate-800">{unit.title}</h3>
                          <p className="text-[10px] text-slate-455 font-semibold uppercase tracking-wide">
                            {`${activeCourse.courseId?.code} / ${activeCourse.courseId?.title}`}
                          </p>
                        </div>

                        <div className="text-xs font-semibold text-slate-600 leading-relaxed space-y-4">
                          <p className="pl-3 border-l-2 border-blue-600">{unit.description}</p>
                          <p>{unit.topics?.join(', ')}</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Textbooks list card */}
                  <div className="bg-emerald-50/20 border border-emerald-250 rounded-2xl p-6 space-y-3.5">
                    <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-emerald-100 pb-2">
                      <BookOpen className="w-4 h-4 text-emerald-700" />
                      <span>Textbooks</span>
                    </h4>
                    
                    <div className="space-y-2 text-xs font-bold text-emerald-900 leading-relaxed">
                      {(() => {
                        const textbooks = activeCourse.textbooks || [];
                        if (textbooks.length === 0) return <p className="text-emerald-700 italic font-semibold">No textbooks defined.</p>;
                        return textbooks.map((bk: any, idx: number) => (
                          <p key={idx} className="font-semibold">{`${idx + 1}. ${bk.title || bk}${bk.author ? `, ${bk.author}` : ''}${bk.publisher ? `, ${bk.publisher}` : ''}`}</p>
                        ));
                      })()}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* 4.5 CURRICULUM BOOK */}
      {/* ============================================================== */}
      {activeTab === 'builder' && (
        <div className="space-y-6">
          {bookViewMode === 'view' ? (
            <div className="space-y-4">
              <button
                onClick={() => setBookViewMode('directory')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-semibold cursor-pointer w-fit"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Directory
              </button>
              <CurriculumBookGenerator />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-xl font-extrabold text-slate-800">Curriculum Books Directory</h2>
                <p className="text-sm text-slate-500 mt-1">Access the generated curriculum books for your department's regulations.</p>
              </div>

              <div className="space-y-8 animate-fadeIn">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">
                    {selectedDepartment?.name || 'Your Department'} Regulations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {regulations.map((reg: any) => (
                      <div key={reg._id} className="border border-slate-200 rounded-xl p-5 hover:border-blue-300 transition-colors bg-slate-50 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-100/50 rounded-bl-full -z-0 group-hover:scale-110 transition-transform"></div>
                        <h4 className="font-extrabold text-slate-800 text-lg relative z-10">{reg.code}</h4>
                        <p className="text-xs text-slate-500 font-medium mb-4 relative z-10">Academic Year: {reg.academicYear}</p>
                        
                        <div className="flex flex-wrap gap-2 relative z-10">
                          <button
                            onClick={() => {
                              setSelectedRegulation(reg);
                              setBookViewMode('view');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Book
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. PROFILE PAGE */}
      {/* ============================================================== */}
      {activeTab === 'profile' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Green success banner — only shown after save */}
          {(showProfileSuccess || profileSuccess) && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between gap-3 font-semibold">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 flex-shrink-0" />
                <span>Profile updated successfully.</span>
              </div>
              <button onClick={() => setShowProfileSuccess(false)} className="text-emerald-600 hover:text-emerald-800 transition-colors" aria-label="Dismiss">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div>
            <h1 className="text-xl font-extrabold text-slate-800 font-sans">Profile</h1>
            <p className="text-xs text-slate-500 mt-1 font-semibold">Manage your profile and preferences.</p>
          </div>

          {/* Faculty Info Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-850">Faculty Information</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Your professional details and contact information</p>
              </div>
              {/* Faculty profile is read-only — managed by Admin */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 font-medium">
                <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>Profile managed by Admin</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 text-xs">
              
              {/* Full Name */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Full Name</span>
                  <strong className="text-slate-800 font-bold text-xs mt-0.5 block">{user?.name || 'Ms. S. Anusha'}</strong>
                </div>
              </div>

              {/* Designation */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Designation</span>
                  <strong className="text-slate-800 font-bold text-xs mt-0.5 block">{user?.role === 'Faculty' ? 'Assistant Professor' : user?.role || 'Associate Professor'}</strong>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Email</span>
                  <strong className="text-slate-855 font-mono text-xs mt-0.5 block">{user?.email || 'anusha.faculty@aditya.edu.in'}</strong>
                </div>
              </div>

              {/* Employee ID */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 border border-orange-100 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Employee ID</span>
                  <strong className="text-slate-800 font-mono text-xs mt-0.5 block">FAC-{user?.id?.substring(0, 4) || '1024'}</strong>
                </div>
              </div>

              {/* Department */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 border border-red-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Department</span>
                  <strong className="text-slate-800 font-bold text-xs mt-0.5 block">{user?.department?.name || 'Computer Science and Engineering'}</strong>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Phone Number</span>
                  <strong className="text-slate-800 font-mono text-xs mt-0.5 block">+91 98765 43210</strong>
                </div>
              </div>

            </div>
          </div>

          {/* Preferences Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-855">Preferences</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Customize your application experience</p>
            </div>

            <div className="divide-y divide-slate-100">
              
              {/* Toggle 1 */}
              <div className="py-4 first:pt-0 flex justify-between items-center text-xs">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-800">Email Notifications</h4>
                  <p className="text-slate-500 font-medium">Receive email updates about important activities</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={emailNotif} 
                    onChange={(e) => setEmailNotif(e.target.checked)} 
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Toggle 2 */}
              <div className="py-4 flex justify-between items-center text-xs">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-800">ERP Updates</h4>
                  <p className="text-slate-500 font-medium">Stay updated with general portal updates and patch logs</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={erpUpdates} 
                    onChange={(e) => setErpUpdates(e.target.checked)} 
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Toggle 3 */}
              <div className="py-4 last:pb-0 flex justify-between items-center text-xs">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-800">Announcement Alerts</h4>
                  <p className="text-slate-500 font-medium">Get notifications for department announcement circulars</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={announcementAlerts} 
                    onChange={(e) => setAnnouncementAlerts(e.target.checked)} 
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

            </div>
          </div>

          {/* Security Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-sans">Security & Access</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Manage your credentials and login safety</p>
            </div>
            
            <div className="divide-y divide-slate-100 text-xs font-bold text-slate-500 font-sans">
              
              {/* Change Password */}
              <div className="py-4 first:pt-0 flex justify-between items-center">
                <div className="space-y-0.5 text-left">
                  <h4 className="font-bold text-slate-800">Change Password</h4>
                  <p className="text-slate-500 font-medium font-sans">Update your account login credentials</p>
                </div>
                <button 
                  onClick={() => setChangePasswordModalOpen(true)}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg font-bold shadow-sm cursor-pointer"
                >
                  Reset Password
                </button>
              </div>

              {/* Two Factor Authentication */}
              <div className="py-4 last:pb-0 flex justify-between items-center">
                <div className="space-y-0.5 text-left">
                  <h4 className="font-bold text-slate-800">Two Factor Authentication (2FA)</h4>
                  <p className="text-slate-500 font-medium font-sans">Add an extra layer of security to your ERP account</p>
                </div>
                <button className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg font-bold shadow-sm cursor-pointer">
                  Enable 2FA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FacultyDashboard;
