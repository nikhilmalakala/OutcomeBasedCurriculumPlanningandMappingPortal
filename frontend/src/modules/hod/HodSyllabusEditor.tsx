import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { 
  LayoutDashboard, BookOpen, Layers, Sparkles, FileSpreadsheet, FileText, 
  Database, BookMarked, CheckSquare, ArrowRightLeft, Eye, Bell, Users, 
  Search, Plus, Trash2, Edit, Save, Send, ArrowRight, ArrowLeft, 
  Download, Check, X, Printer, Settings, AlertTriangle, Info, FileDown, Calendar, CheckCircle2,
  User, Briefcase, Mail, Cpu, Building2, Phone, Clock, TrendingUp, ChevronRight, ChevronDown
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, HeadingLevel, Header, Footer, PageNumber, ImageRun } from 'docx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import adityaLogo from '../../assets/aditya-logo.png';
import { RichTextEditor } from '../../components/common/RichTextEditor';
import { PdfCoursePage, PdfCoursePageStyles } from '../../components/common/PdfCoursePage';

const escapeHtml = (value = ''): string => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const htmlToPlainText = (html = ''): string => String(html)
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const legacyUnitToHtml = (unit: any): string => {
  const parts = [];
  if (unit?.title) parts.push(`<p><strong>${escapeHtml(unit.title)}</strong></p>`);
  if (unit?.description) parts.push(`<p>${escapeHtml(unit.description).replace(/\n/g, '<br>')}</p>`);
  if (Array.isArray(unit?.topics) && unit.topics.some((topic: string) => topic?.trim())) {
    parts.push(`<p><strong>Topics:</strong> ${escapeHtml(unit.topics.filter(Boolean).join(', '))}</p>`);
  }
  if (unit?.practice) parts.push(`<p><strong>Practice:</strong> ${escapeHtml(unit.practice).replace(/\n/g, '<br>')}</p>`);
  return parts.join('');
};

const getUnitRichText = (unit: any): string => unit?.htmlContent || unit?.richTextContent || legacyUnitToHtml(unit);

const hasUnitRichText = (unit: any): boolean => htmlToPlainText(getUnitRichText(unit)).length > 0;


const formatTextbook = (t: any): string => {
  if (!t) return '';
  if (typeof t === 'string') return t;
  const parts = [];
  if (t.title) parts.push(t.title);
  if (t.author) parts.push(t.author);
  if (t.edition) parts.push(t.edition);
  if (t.publisher) parts.push(t.publisher);
  return parts.join(', ');
};

const formatOnlineResource = (r: any): string => {
  if (!r) return '';
  if (typeof r === 'string') return r;
  if (r.url) {
    return r.description ? `${r.url} - ${r.description}` : r.url;
  }
  return '';
};

interface HodSyllabusEditorProps {
  courseVersionId: string;
  onClose: () => void;
}

export const HodSyllabusEditor: React.FC<HodSyllabusEditorProps> = ({ courseVersionId, onClose }) => {
  const { user } = useAuthStore();
  const { setChangePasswordModalOpen } = useUIStore();
  
  const [assignedVersions, setAssignedVersions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('course-details');

  const getSubmissionStatusLabel = (status: string) => {
    switch (status) {
      case 'Draft': return 'Draft';
      case 'Pending HOD': return 'Under Review by HOD';
      case 'Approved': return 'Approved';
      case 'Returned': return 'Returned for Changes';
      default: return status || 'Draft';
    }
  };

  // Strict OBE Validation Engine
  const runOBEValidation = (v: any) => {
    const errors: string[] = [];

    if (!v) {
      return { 
        overallPassed: false, 
        errors: ['No course version loaded'], 
        checklist: [], 
        requiredChecklist: [],
        optionalChecklist: [],
        completionPercent: 0 
      };
    }

    // 1. Course Basic Details (Required)
    const hasCourseCode = !!v.courseId?.code;
    const hasCourseTitle = !!v.courseId?.title;
    const hasSemester = !!v.semester;
    const hasRegulation = !!v.regulationId?.code;
    const hasCredits = v.credits && 
      typeof v.credits.L === 'number' && 
      typeof v.credits.T === 'number' && 
      typeof v.credits.P === 'number' && 
      typeof v.credits.S === 'number' && 
      typeof v.credits.C === 'number';
    const hasCategory = !!(v.category && v.category.trim());
    const courseDetailsPassed = !!(hasCourseCode && hasCourseTitle && hasSemester && hasRegulation && hasCredits && hasCategory);
    let courseDetailsDetails = 'All basic details filled';
    if (!courseDetailsPassed) {
      const missing = [];
      if (!hasCourseCode) missing.push("Code missing");
      if (!hasCourseTitle) missing.push("Title missing");
      if (!hasSemester) missing.push("Semester missing");
      if (!hasRegulation) missing.push("Regulation missing");
      if (!hasCredits) missing.push("Credits incomplete");
      if (!hasCategory) missing.push("Category missing");
      courseDetailsDetails = missing.join(', ');
      errors.push(`Course Details Incomplete: ${courseDetailsDetails}`);
    }

    // 2. Minimum 5 COs (Required)
    const coCount = v.courseOutcomes?.length || 0;
    const min5Cos = coCount >= 5;
    const allCosFilled = coCount > 0 && v.courseOutcomes.every((co: any) => co.coCode?.trim() && co.description?.trim() && co.bloomLevel?.trim());
    const cosPassed = min5Cos && allCosFilled;
    let cosDetails = '';
    if (cosPassed) {
      cosDetails = `All ${coCount} COs valid`;
    } else if (coCount < 5) {
      cosDetails = `Only ${coCount} COs added (Minimum 5 Required)`;
      errors.push('Minimum 5 Course Outcomes (COs) are required.');
    } else {
      const incompleteCOs: string[] = [];
      v.courseOutcomes.forEach((co: any, idx: number) => {
        const name = co.coCode?.trim() || `CO${idx + 1}`;
        if (!co.coCode?.trim() || !co.description?.trim() || !co.bloomLevel?.trim()) {
          incompleteCOs.push(name);
        }
      });
      cosDetails = `Incomplete: ${incompleteCOs.join(', ')}`;
      errors.push(`All Course Outcomes must be fully defined. Incomplete: ${incompleteCOs.join(', ')}`);
    }

    // 3. CO-PO Mapping (Required)
    let coPoPassed = true;
    let coPoDetails = 'All COs mapped to POs';
    if (coCount === 0) {
      coPoPassed = false;
      coPoDetails = 'No COs defined';
      errors.push('Complete CO–PO mapping is required. No COs defined.');
    } else {
      const unmappedCOs: string[] = [];
      v.courseOutcomes.forEach((co: any) => {
        const mapping = v.coPoMappings?.find((m: any) => m.coCode === co.coCode);
        const hasMapping = mapping && mapping.po && Object.keys(mapping.po).some(key => mapping.po[key] > 0);
        if (!hasMapping) {
          coPoPassed = false;
          unmappedCOs.push(co.coCode);
        }
      });
      if (!coPoPassed) {
        coPoDetails = `Unmapped COs: ${unmappedCOs.join(', ')}`;
        errors.push(`Every CO must map to at least one PO. Unmapped: ${unmappedCOs.join(', ')}`);
      }
    }

    // 4. CO-PSO Mapping (Required)
    let coPsoPassed = true;
    let coPsoDetails = 'All COs mapped to PSOs';
    if (coCount === 0) {
      coPsoPassed = false;
      coPsoDetails = 'No COs defined';
      errors.push('Complete CO–PSO mapping is required. No COs defined.');
    } else {
      const unmappedPSOs: string[] = [];
      v.courseOutcomes.forEach((co: any) => {
        const mapping = v.coPsoMappings?.find((m: any) => m.coCode === co.coCode);
        const hasMapping = mapping && mapping.pso && Object.keys(mapping.pso).some(key => mapping.pso[key] > 0);
        if (!hasMapping) {
          coPsoPassed = false;
          unmappedPSOs.push(co.coCode);
        }
      });
      if (!coPsoPassed) {
        coPsoDetails = `Unmapped COs: ${unmappedPSOs.join(', ')}`;
        errors.push(`Every CO must map to at least one PSO. Unmapped: ${unmappedPSOs.join(', ')}`);
      }
    }

    // 5. Exactly 5 Syllabus Units (Required)
    const unitCount = v.syllabusUnits?.length || 0;
    const exactly5Units = unitCount === 5;
    const allUnitsFilled = unitCount > 0 && v.syllabusUnits.every((u: any) => hasUnitRichText(u));
    const syllabusPassed = exactly5Units && allUnitsFilled;
    let syllabusDetails = '';
    if (syllabusPassed) {
      syllabusDetails = '5 units fully defined';
    } else if (unitCount !== 5) {
      syllabusDetails = `Only ${unitCount} Units Added (Exactly 5 Required)`;
      errors.push(`Exactly 5 syllabus units are mandatory (Current: ${unitCount}).`);
    } else {
      const incompleteUnits: number[] = [];
      v.syllabusUnits.forEach((u: any, idx: number) => {
        if (!hasUnitRichText(u)) {
          incompleteUnits.push(idx + 1);
        }
      });
      syllabusDetails = `Unit ${incompleteUnits.join(', ')} incomplete`;
      errors.push(`All syllabus units must be complete. Incomplete: Unit ${incompleteUnits.join(', ')}`);
    }

    // 6. At Least 1 Reference Material (Required)
    const textbookCount = v.textbooks?.filter((t: any) => formatTextbook(t)?.trim()).length || 0;
    const referenceCount = v.referenceMaterials?.filter((r: any) => formatTextbook(r)?.trim()).length || 0;
    const totalRefs = textbookCount + referenceCount;
    const refMaterialPassed = totalRefs >= 1;
    let refMaterialDetails = '';
    if (refMaterialPassed) {
      refMaterialDetails = `${totalRefs} reference material(s) configured`;
    } else {
      refMaterialDetails = 'No textbooks or reference books added';
      errors.push('At least 1 Textbook or Reference Book is required.');
    }

    // Checklist array
    const requiredChecklist = [
      { label: 'Course Details Completed', passed: courseDetailsPassed, details: courseDetailsDetails },
      { label: 'Minimum 5 COs Added', passed: cosPassed, details: cosDetails },
      { label: 'CO-PO Mapping Complete', passed: coPoPassed, details: coPoDetails },
      { label: 'CO-PSO Mapping Complete', passed: coPsoPassed, details: coPsoDetails },
      { label: 'Exactly 5 Units Added', passed: syllabusPassed, details: syllabusDetails },
      { label: 'At Least 1 Reference Material Added', passed: refMaterialPassed, details: refMaterialDetails }
    ];

    const completedRequired = requiredChecklist.filter(t => t.passed).length;
    const totalRequired = requiredChecklist.length;
    const completionPercent = Math.round((completedRequired / totalRequired) * 100);

    const overallPassed = errors.length === 0;

    return {
      overallPassed,
      errors,
      checklist: requiredChecklist,
      requiredChecklist,
      optionalChecklist: [],
      completionPercent
    };
  };

  const calculateCourseProgress = (v: any) => {
    const valResult = runOBEValidation(v);
    const tasks = valResult.requiredChecklist.map((item: any) => ({
      label: item.label,
      completed: item.passed
    }));
    return {
      percent: valResult.completionPercent,
      tasks
    };
  };

  const downloadWorkSummaryPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFont('helvetica', 'normal');
      
      // Title Block
      doc.setFillColor(37, 99, 235); // Blue primary
      doc.rect(0, 0, 210, 35, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('ADITYA UNIVERSITY', 15, 15);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('OUTCOME BASED CURRICULUM PLANNING & MAPPING PORTAL', 15, 22);
      doc.text('WORK PROGRESS SUMMARY REPORT', 15, 28);
      
      // Coordinator Metadata
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Coordinator:', 15, 48);
      doc.text('Department:', 15, 54);
      doc.text('Report Date:', 15, 60);
      
      doc.setFont('helvetica', 'normal');
      doc.text(user?.name || 'Mr. N. Ramanjaneyulu', 40, 48);
      doc.text(user?.department?.name || 'Computer Science & Engineering', 40, 54);
      doc.text(new Date().toLocaleDateString(), 40, 60);

      // Add a dividing line
      doc.setDrawColor(220, 225, 230);
      doc.setLineWidth(0.5);
      doc.line(15, 66, 195, 66);
      
      // KPI Summary Section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('WORK COMPLETION STATISTICS', 15, 75);
      
      const total = assignedVersions.length;
      const completed = assignedVersions.filter(v => v.status === 'Approved' || v.status === 'Finalized').length;
      const pending = assignedVersions.filter(v => v.status === 'Draft' || v.status === 'In Progress' || v.status === 'Not Started').length;
      const review = assignedVersions.filter(v => v.status === 'Pending HOD').length;
      const returned = assignedVersions.filter(v => v.status === 'Returned').length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Assigned Courses: ${total}`, 20, 85);
      doc.text(`Completed & Approved: ${completed}`, 20, 91);
      doc.text(`Pending (In Progress): ${pending}`, 20, 97);
      doc.text(`Under Review by HOD: ${review}`, 110, 85);
      doc.text(`Returned for Correction: ${returned}`, 110, 91);
      doc.text(`Approval Completion Rate: ${rate}%`, 110, 97);
      
      doc.line(15, 105, 195, 105);
      
      // Course Assignments Grid Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('COURSE ASSIGNMENTS REPORT', 15, 114);
      
      // Draw Table Header
      let y = 122;
      doc.setFillColor(241, 245, 249);
      doc.rect(15, y, 180, 8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Code', 18, y + 5);
      doc.text('Course Name', 35, y + 5);
      doc.text('Regulation', 90, y + 5);
      doc.text('Semester', 110, y + 5);
      doc.text('Deadline', 130, y + 5);
      doc.text('Status', 165, y + 5);
      
      y += 8;
      
      // Draw Rows
      assignedVersions.forEach((v) => {
        doc.setFillColor(255, 255, 255);
        doc.rect(15, y, 180, 8, 'F');
        doc.setFont('helvetica', 'normal');
        doc.text(v.courseId?.code || '—', 18, y + 5);
        doc.text(v.courseId?.title?.substring(0, 32) || '—', 35, y + 5);
        doc.text(v.regulationId?.code || '—', 90, y + 5);
        doc.text(v.semester ? `Sem ${v.semester}` : '—', 110, y + 5);
        doc.text(v.deadline || '—', 130, y + 5);
        
        // Status indicator color
        if (v.status === 'Approved') {
          doc.setTextColor(22, 101, 52); // Green
        } else if (v.status === 'Returned') {
          doc.setTextColor(153, 27, 27); // Red
        } else if (v.status === 'Pending HOD') {
          doc.setTextColor(37, 99, 235); // Blue
        } else {
          doc.setTextColor(100, 110, 120); // Slate
        }
        
        doc.setFont('helvetica', 'bold');
        doc.text(v.status || 'Draft', 165, y + 5);
        doc.setTextColor(50, 50, 50); // Reset
        
        // Row divider
        doc.setDrawColor(241, 245, 249);
        doc.line(15, y + 8, 195, y + 8);
        y += 8;
      });

      // Footer stamp
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150, 150, 150);
      doc.text(`Official Academic System Report — Generated on ${new Date().toLocaleString()} by ${user?.name || 'Coordinator'}.`, 15, 285);
      
      doc.save(`Work_Progress_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('[PDF Gen] Failed:', err);
      alert('Failed to generate summary PDF.');
    }
  };

  const downloadActivityReportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFont('helvetica', 'normal');
      
      // Title Block
      doc.setFillColor(15, 23, 42); // Dark slate
      doc.rect(0, 0, 210, 35, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('ADITYA UNIVERSITY', 15, 15);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('OUTCOME BASED CURRICULUM PLANNING & MAPPING PORTAL', 15, 22);
      doc.text('COORDINATOR ACTIVITY & COMPLIANCE LOG REPORT', 15, 28);
      
      // Coordinator Metadata
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Coordinator:', 15, 48);
      doc.text('Department:', 15, 54);
      doc.text('Log Range:', 15, 60);
      
      doc.setFont('helvetica', 'normal');
      doc.text(user?.name || 'Mr. N. Ramanjaneyulu', 40, 48);
      doc.text(user?.department?.name || 'Computer Science & Engineering', 40, 54);
      doc.text(`All Assignments as of ${new Date().toLocaleDateString()}`, 40, 60);

      doc.setDrawColor(220, 225, 230);
      doc.setLineWidth(0.5);
      doc.line(15, 66, 195, 66);
      
      // Activity Milestones
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('ACTIVITY ROADMAP & AUDIT LOG', 15, 75);
      
      let y = 85;
      
      const addLogEntry = (date: string, title: string, desc: string, isDone = true) => {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        // Vertical line marker
        doc.line(20, y + 2, 20, y + 15);
        // Circle point
        doc.setFillColor(isDone ? 37 : 220, isDone ? 99 : 225, isDone ? 235 : 230); // blue vs grey
        doc.circle(20, y, 2.5, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(date, 30, y + 1);
        doc.text(title, 55, y + 1);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(desc, 55, y + 6);
        
        y += 15;
      };

      // Populate log entries based on status of courses dynamically
      const hasApproved = assignedVersions.some(v => v.status === 'Approved');
      const hasReturned = assignedVersions.some(v => v.status === 'Returned');
      const hasPending = assignedVersions.some(v => v.status === 'Pending HOD');
      
      addLogEntry('2026-05-10', 'Course Coordinator Assigned', 'Assigned by Dr. K. Raghavendra (HOD) to coordinate syllabus creation.', true);
      
      if (hasApproved) {
        addLogEntry('2026-05-28', 'CS302 Syllabus Structure Built', 'Units mapped and CO definition uploaded.', true);
        addLogEntry('2026-05-30', 'CO-PO & CO-PSO Matrices Mapped', 'Outcome mapping levels finalized for Computer Networks.', true);
        addLogEntry('2026-06-01', 'CS302 Approved successfully', 'Syllabus and matrices approved by HOD and ready for accreditation.', true);
      } else {
        addLogEntry('2026-05-28', 'Syllabus Structures Initiated', 'Course outcomes and mapping models setup initiated.', true);
      }
      
      if (hasReturned) {
        addLogEntry('2026-06-02', 'CS301 Submitted to HOD', 'Submitted DBMS syllabus details for validation.', true);
        addLogEntry('2026-06-03', 'HOD Returned CS301', 'Feedback: "Please refine CO3 Bloom taxonomy and add lab practical objectives."', false);
      }
      
      if (hasPending) {
        addLogEntry('2026-06-04', 'CS303 Submitted to HOD', 'Submitted Operating Systems syllabus details for validation.', true);
        addLogEntry('2026-06-05', 'HOD Review In Progress', 'Review under progress by HOD panel.', true);
      }

      // Add a checklist list of compliance summary
      if (y > 200) {
        doc.addPage();
        y = 20;
      } else {
        y += 10;
      }
      
      doc.setDrawColor(220, 225, 230);
      doc.line(15, y, 195, y);
      y += 10;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('COMPLIANCE VERIFICATION CHECKLIST', 15, y);
      y += 10;
      
      assignedVersions.forEach((v) => {
        const progress = calculateCourseProgress(v);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${v.courseId?.code || '—'} – ${v.courseId?.title || '—'}`, 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`Progress: ${progress.percent}%`, 140, y);
        
        y += 6;
        
        // Show tasks inline
        const taskStrings = progress.tasks.map(t => `${t.completed ? '[X]' : '[ ]'} ${t.label}`).join('  |  ');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(taskStrings, 25, y);
        
        y += 10;
      });
      
      // Signature boxes
      y = Math.max(y + 10, 240);
      doc.setDrawColor(200, 200, 200);
      doc.line(15, y, 70, y);
      doc.line(135, y, 190, y);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Course Coordinator Signature', 20, y + 5);
      doc.text('Head of Department (HOD) Approval', 137, y + 5);

      // Save PDF
      doc.save(`Coordinator_Activity_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('[PDF Gen] Failed:', err);
      alert('Failed to generate activity report PDF.');
    }
  };

  const [activeVersion, setActiveVersion] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true); // smart preview panel toggle

  // Validation engine state variables
  const [validationFailedModalOpen, setValidationFailedModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [readinessChecklistOpen, setReadinessChecklistOpen] = useState(false);

  const reportValidation = activeVersion
    ? runOBEValidation(activeVersion)
    : {
        overallPassed: false,
        errors: [],
        checklist: [],
        requiredChecklist: [],
        optionalChecklist: [],
        completionPercent: 0
      };

  const reportStatusLabel = activeVersion?.status === 'Approved'
    ? 'Approved by HOD'
    : activeVersion?.status === 'Pending HOD'
      ? 'Under Review'
      : activeVersion?.status === 'Returned'
        ? 'Returned'
        : 'Draft';

  const reportMissingRequirements = reportValidation.requiredChecklist.filter((item: any) => !item.passed);
  const reportCheck = (label: string) => reportValidation.requiredChecklist.find((item: any) => item.label === label)?.passed ?? false;
  const reportReady = Boolean(activeVersion && reportValidation.overallPassed);
  const reportWarning = reportMissingRequirements.length > 0;

  const downloadReportPDF = async () => {
    if (!accrPreviewRef.current) return;
    try {
      const canvas = await html2canvas(accrPreviewRef.current, { scale: 2, useCORS: true, allowTaint: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pdfWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
      pdf.addImage(imgData, 'PNG', 0, 0, imgProps.width * ratio, imgProps.height * ratio);
      pdf.save(`${activeVersion?.courseId?.code || 'Accreditation_Report'}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('[PDF Export] Failed:', err);
      alert('Unable to generate download PDF. Please try again.');
    }
  };

  const downloadReportWord = async () => {
    if (!activeVersion) return;
    try {
      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'ACCREDITATION DOCUMENT PREVIEW', bold: true })],
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER
              }),
              new Paragraph({
                children: [new TextRun({ text: activeVersion.courseId?.title || 'Course Title', bold: true })],
                heading: HeadingLevel.HEADING_2,
                alignment: AlignmentType.CENTER
              }),
              new Paragraph({ children: [new TextRun({ text: `Course Code: ${activeVersion.courseId?.code || '—'}` })] }),
              new Paragraph({ children: [new TextRun({ text: `LTPSC: ${activeVersion.credits?.L || 0}-${activeVersion.credits?.T || 0}-${activeVersion.credits?.P || 0}-${activeVersion.credits?.S || 0}-${activeVersion.credits?.C || 0}` })] }),
              new Paragraph({ children: [new TextRun({ text: `Course Level: ${activeVersion.level || 'Foundation'} | Knowledge Level: ${activeVersion.knowledgeLevel || '—'}` })] }),

              ...(activeVersion.prerequisites?.length > 0 ? [
                new Paragraph({ children: [new TextRun({ text: `Prerequisites: ${activeVersion.prerequisites.join(', ')}` })] }),
                new Paragraph({ children: [] })
              ] : []),
              new Paragraph({ children: [] }),
              new Paragraph({ children: [new TextRun({ text: 'Course Outcomes', bold: true })] }),
              ...(activeVersion.courseOutcomes || []).map((co: any) => new Paragraph({ children: [new TextRun({ text: `${co.coCode}: ${co.description || 'Not defined yet.'}` })] })),
              new Paragraph({ children: [] }),
              new Paragraph({ children: [new TextRun({ text: 'CO-PO Mapping Matrix', bold: true })] }),
              ...(activeVersion.courseOutcomes || []).map((co: any) => {
                const mapping = activeVersion.coPoMappings?.find((m: any) => m.coCode === co.coCode) || { po: {} };
                const values = Array.from({ length: 12 }, (_, i) => mapping.po?.[`PO${i + 1}`] || 0).join(', ');
                return new Paragraph({ children: [new TextRun({ text: `${co.coCode}: [${values}]` })] });
              }),
              new Paragraph({ children: [] }),
              new Paragraph({ children: [new TextRun({ text: 'CO-PSO Mapping Matrix', bold: true })] }),
              ...(activeVersion.courseOutcomes || []).map((co: any) => {
                const mapping = activeVersion.coPsoMappings?.find((m: any) => m.coCode === co.coCode) || { pso: {} };
                const values = ['PSO1', 'PSO2', 'PSO3'].map((pso) => `${pso}:${mapping.pso?.[pso] || 0}`).join(', ');
                return new Paragraph({ children: [new TextRun({ text: `${co.coCode}: [${values}]` })] });
              }),
              new Paragraph({ children: [] }),
              new Paragraph({ children: [new TextRun({ text: 'Syllabus Units', bold: true })] }),
              ...(activeVersion.syllabusUnits || []).flatMap((unit: any, idx: number) => [
                new Paragraph({ children: [new TextRun({ text: `Unit ${idx + 1} - ${unit.title || 'Untitled'} (${unit.hours || 10} Hours)`, bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: unit.description || 'No description provided.' })] }),
                ...(unit.topics?.length > 0 ? [new Paragraph({ children: [new TextRun({ text: `Topics: ${unit.topics.join(', ')}`, italics: true })] })] : []),
                ...(unit.practice ? [new Paragraph({ children: [new TextRun({ text: `Practice: ${unit.practice}` })] })] : []),
                new Paragraph({ children: [] })
              ]),
              new Paragraph({ children: [] }),

              ...(activeVersion.textbooks?.filter((ref: any) => formatTextbook(ref).trim()).length > 0 ? [
                new Paragraph({ children: [new TextRun({ text: 'Prescribed Textbooks', bold: true })] }),
                ...activeVersion.textbooks.filter((ref: any) => formatTextbook(ref).trim()).map((ref: any) => new Paragraph({ children: [new TextRun({ text: `• ${formatTextbook(ref)}` })] })),
                new Paragraph({ children: [] })
              ] : []),
              ...(activeVersion.referenceMaterials?.filter((ref: any) => formatTextbook(ref).trim()).length > 0 ? [
                new Paragraph({ children: [new TextRun({ text: 'Reference Books', bold: true })] }),
                ...activeVersion.referenceMaterials.filter((ref: any) => formatTextbook(ref).trim()).map((ref: any) => new Paragraph({ children: [new TextRun({ text: `• ${formatTextbook(ref)}` })] })),
                new Paragraph({ children: [] })
              ] : []),
              ...(activeVersion.onlineResources?.filter((ref: any) => formatOnlineResource(ref).trim()).length > 0 ? [
                new Paragraph({ children: [new TextRun({ text: 'Web Links / Online Resources', bold: true })] }),
                ...activeVersion.onlineResources.filter((ref: any) => formatOnlineResource(ref).trim()).map((ref: any) => new Paragraph({ children: [new TextRun({ text: `• ${formatOnlineResource(ref)}` })] })),
                new Paragraph({ children: [] })
              ] : []),
              new Paragraph({ children: [new TextRun({ text: 'Assessment Pattern (CIE / SEE)', bold: true })] }),
              new Paragraph({ children: [new TextRun({ text: `CIE Marks: ${activeVersion.cieSee?.cieMaxMarks || '—'}` })] }),
              new Paragraph({ children: [new TextRun({ text: `SEE Marks: ${activeVersion.cieSee?.seeMaxMarks || '—'}` })] }),
              new Paragraph({ children: [new TextRun({ text: `CIE Breakup: ${activeVersion.cieSee?.cieBreakup || 'Not defined.'}` })] }),
              new Paragraph({ children: [new TextRun({ text: `SEE Breakup: ${activeVersion.cieSee?.seeBreakup || 'Not defined.'}` })] })
            ]
          }
        ]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${activeVersion.courseId?.code || 'Accreditation_Report'}_${new Date().toISOString().split('T')[0]}.docx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Word Export] Failed:', err);
      alert('Unable to generate Word document. Please try again.');
    }
  };

  // Strict OBE Validation Engine has been moved to the top of the component to prevent ReferenceError.


  const renderAccreditationDocumentPreview = () => {
    if (!activeVersion) return null;
    const departmentName = activeVersion.courseId?.departmentId?.name || user?.department?.name || 'Computer Science and Engineering';
    const departmentCode = activeVersion.courseId?.departmentId?.code || user?.department?.code || 'CSE';
    const regulationYear = activeVersion.regulationId?.academicYear || '2024';
    return (
      <>
        <PdfCoursePageStyles />
        <div className="bg-slate-400 p-4">
          <PdfCoursePage
            courseVersion={activeVersion}
            departmentName={departmentName}
            departmentCode={departmentCode}
            regulationYear={regulationYear}
            showFooter
          />
        </div>
      </>
    );
    return (
      <div
        className="bg-white mx-auto shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
        style={{
          width: '100%',
          minHeight: '1100px',
          padding: '36px 44px 60px 44px',
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: '10px',
          color: '#000',
          lineHeight: '1.5',
          position: 'relative',
          display: 'block',
        }}
      >
        <div style={{ position: 'absolute', top: '16px', right: '24px', textAlign: 'center' }}>
          <img src={adityaLogo} alt="Aditya University" style={{ width: '90px', display: 'block' }} />
        </div>

        <div style={{ textAlign: 'center', paddingRight: '100px', marginBottom: '10px' }}>
          <div style={{ fontWeight: 700, fontSize: '12px', letterSpacing: '0.01em' }}>
            {activeVersion.courseId?.title || 'Course Title'}
          </div>
          {activeVersion.offeredFor && activeVersion.offeredFor.length > 0 && (
            <div style={{ fontSize: '10px', marginTop: '2px', fontStyle: 'italic' }}>
              (Common to {activeVersion.offeredFor.join(' & ')})
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '6px', marginBottom: '10px' }}>
          <div>
            <span style={{ fontWeight: 700 }}>Course Code: </span>
            <span>{activeVersion.courseId?.code || '—'}</span>
            {activeVersion.category && (
              <span style={{ marginLeft: '16px' }}>
                <span style={{ fontWeight: 700 }}>Category: </span>
                <span>{activeVersion.category}</span>
              </span>
            )}
            {activeVersion.semester && (
              <span style={{ marginLeft: '16px' }}>
                <span style={{ fontWeight: 700 }}>Semester: </span>
                <span>{activeVersion.semester}</span>
              </span>
            )}
          </div>
          <table style={{ borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr>
                {['L','T','P','S','C'].map(h => (
                  <th key={h} style={{ border: '1px solid #000', padding: '2px 8px', fontWeight: 700, textAlign: 'center', background: '#f0f0f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {['L','T','P','S','C'].map(k => (
                  <td key={k} style={{ border: '1px solid #000', padding: '2px 8px', textAlign: 'center', fontWeight: 700 }}>
                    {activeVersion.credits?.[k] ?? 0}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>



        {activeVersion.prerequisites && activeVersion.prerequisites.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <span style={{ fontWeight: 700 }}>Prerequisites: </span>
            <span>{activeVersion.prerequisites.join(', ')}</span>
          </div>
        )}

        {/* Removed Course Objectives */}

        {activeVersion.courseOutcomes && activeVersion.courseOutcomes.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, marginBottom: '3px' }}>Course Outcomes:</div>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>At the end of the course, student will be able to:</div>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '10px' }}>
              <tbody>
                {activeVersion.courseOutcomes.map((co: any) => (
                  <tr key={co.coCode}>
                    <td style={{ padding: '1px 6px 1px 12px', fontWeight: 700, whiteSpace: 'nowrap', width: '36px', verticalAlign: 'top' }}>
                      {co.coCode}:
                    </td>
                    <td style={{ padding: '1px 4px', textAlign: 'justify' }}>
                      {co.description || 'Outcome statement not yet defined.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeVersion.courseOutcomes && activeVersion.courseOutcomes.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Mapping of Course Outcomes with Program Outcomes:</div>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '9px' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #000', padding: '2px 4px', fontWeight: 700, background: '#e8e8e8', textAlign: 'center' }}>CO/PO</th>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th key={i} style={{ border: '1px solid #000', padding: '2px 3px', fontWeight: 700, background: '#e8e8e8', textAlign: 'center', minWidth: '18px' }}>
                      PO{i+1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeVersion.courseOutcomes.map((co: any) => {
                  const coPo = activeVersion.coPoMappings?.find((m: any) => m.coCode === co.coCode);
                  return (
                    <tr key={co.coCode}>
                      <td style={{ border: '1px solid #000', padding: '2px 4px', fontWeight: 700, textAlign: 'center', background: '#f4f4f4' }}>
                        {co.coCode}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const val = coPo?.po?.[`PO${i+1}`] || 0;
                        return (
                          <td key={i} style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', fontWeight: val > 0 ? 700 : 400 }}>
                            {val > 0 ? val : ''}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeVersion.courseOutcomes && activeVersion.courseOutcomes.length > 0 && activeVersion.coPsoMappings && activeVersion.coPsoMappings.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Mapping of Course Outcomes with Program Specific Outcomes:</div>
            <table style={{ borderCollapse: 'collapse', fontSize: '9px' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #000', padding: '2px 6px', fontWeight: 700, background: '#e8e8e8', textAlign: 'center' }}>CO/PSO</th>
                  {['PSO1','PSO2','PSO3'].map(pso => (
                    <th key={pso} style={{ border: '1px solid #000', padding: '2px 10px', fontWeight: 700, background: '#e8e8e8', textAlign: 'center' }}>{pso}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeVersion.courseOutcomes.map((co: any) => {
                  const coPso = activeVersion.coPsoMappings?.find((m: any) => m.coCode === co.coCode);
                  return (
                    <tr key={co.coCode}>
                      <td style={{ border: '1px solid #000', padding: '2px 6px', fontWeight: 700, textAlign: 'center', background: '#f4f4f4' }}>
                        {co.coCode}
                      </td>
                      {['PSO1','PSO2','PSO3'].map(pso => {
                        const val = coPso?.pso?.[pso] || 0;
                        return (
                          <td key={pso} style={{ border: '1px solid #000', padding: '2px 10px', textAlign: 'center', fontWeight: val > 0 ? 700 : 400 }}>
                            {val > 0 ? val : ''}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeVersion.syllabusUnits && activeVersion.syllabusUnits.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            {activeVersion.syllabusUnits.map((u: any, idx: number) => {
              const romanNumerals = ['I','II','III','IV','V','VI','VII','VIII'];
              return (
                <div key={u.unitNumber || idx} style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '3px' }}>
                    UNIT – {romanNumerals[idx] || idx + 1}
                  </div>
                  <div 
                    style={{ textAlign: 'justify' }}
                    dangerouslySetInnerHTML={{ __html: getUnitRichText(u) }}
                  />
                </div>
              );
            })}
          </div>
        )}



        {activeVersion.textbooks && activeVersion.textbooks.filter((t: any) => formatTextbook(t).trim()).length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontWeight: 700, marginBottom: '3px' }}>Text Books:</div>
            <div style={{ margin: 0, paddingLeft: '24px' }}>
              {activeVersion.textbooks.filter((t: any) => formatTextbook(t).trim()).map((bVal: any, i: number) => {
                const book = formatTextbook(bVal);
                const commaIdx = book.indexOf(',');
                if (commaIdx !== -1) {
                  const title = book.substring(0, commaIdx).trim();
                  const details = book.substring(commaIdx + 1).trim();
                  return (
                    <div key={i} style={{ marginBottom: '8px' }}>
                      <div style={{ fontWeight: 700, marginBottom: '1px' }}>{title}:</div>
                      <div style={{ textAlign: 'justify' }}>{details}</div>
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ marginBottom: '8px', textAlign: 'justify' }}>{book}</div>
                );
              })}
            </div>
          </div>
        )}

        {activeVersion.referenceMaterials && activeVersion.referenceMaterials.filter((r: any) => formatTextbook(r).trim()).length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontWeight: 700, marginBottom: '3px' }}>Reference Books:</div>
            <div style={{ margin: 0, paddingLeft: '24px' }}>
              {activeVersion.referenceMaterials.filter((r: any) => formatTextbook(r).trim()).map((bVal: any, i: number) => {
                const book = formatTextbook(bVal);
                const commaIdx = book.indexOf(',');
                if (commaIdx !== -1) {
                  const title = book.substring(0, commaIdx).trim();
                  const details = book.substring(commaIdx + 1).trim();
                  return (
                    <div key={i} style={{ marginBottom: '8px' }}>
                      <div style={{ fontWeight: 700, marginBottom: '1px' }}>{title}:</div>
                      <div style={{ textAlign: 'justify' }}>{details}</div>
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ marginBottom: '8px', textAlign: 'justify' }}>{book}</div>
                );
              })}
            </div>
          </div>
        )}

        {activeVersion.onlineResources && activeVersion.onlineResources.filter((w: any) => formatOnlineResource(w).trim()).length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, marginBottom: '3px' }}>Web Links:</div>
            <ol style={{ margin: 0, paddingLeft: '18px' }}>
              {activeVersion.onlineResources.filter((w: any) => formatOnlineResource(w).trim()).map((link: any, i: number) => (
                <li key={i} style={{ marginBottom: '2px', wordBreak: 'break-all' }}>{formatOnlineResource(link)}</li>
              ))}
            </ol>
          </div>
        )}

      </div>
    );
  };

  // Search and Filters for My Assigned Courses
  const [courseSearch, setCourseSearch] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRegulation, setFilterRegulation] = useState('');

  // Local state for editing fields
  const [newPrereqText, setNewPrereqText] = useState('');
  const [newTextbookText, setNewTextbookText] = useState('');
  const [newReferenceText, setNewReferenceText] = useState('');
  const [newOnlineResourceText, setNewOnlineResourceText] = useState('');

  const [syllabusSections, setSyllabusSections] = useState({
    units: true,
    references: false,
    prerequisites: false,
    labsProjects: false
  });

  const [refForm, setRefForm] = useState({
    show: false,
    isEditing: false,
    originalType: null as 'Textbook' | 'Reference' | null,
    originalIndex: null as number | null,
    type: 'Textbook' as 'Textbook' | 'Reference',
    title: '',
    author: '',
    edition: '',
    publisher: '',
    year: ''
  });

  // Remarks popup / HOD Comments display state
  const [selectedRemarks, setSelectedRemarks] = useState<string | null>(null);

  // Profile Standardized States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [phoneVal, setPhoneVal] = useState('+91 9876543212');
  const [altEmailVal, setAltEmailVal] = useState('anusha.alt@aditya.edu.in');
  const [profileImageVal, setProfileImageVal] = useState('');
  const [showProfileSuccess, setShowProfileSuccess] = useState(false); // kept for local timeout logic
  const { profileSuccess, setProfileSuccess } = useUIStore();

  // Coordinator Preferences States
  const [facultySubNotif, setFacultySubNotif] = useState(true);
  const [courseFileUpdates, setCourseFileUpdates] = useState(true);
  const [hodReviewNotif, setHodReviewNotif] = useState(true);
  const [curriculumModAlerts, setCurriculumModAlerts] = useState(true);

  // Standard Bloom's taxonomy definitions
  const bloomLevels = [
    'K1 - Remember',
    'K2 - Understand',
    'K3 - Apply',
    'K4 - Analyze',
    'K5 - Evaluate',
    'K6 - Create'
  ];

  // Seed default fallback mockup if database has no assigned courses for this coordinator
  const loadData = async () => {
  setLoading(true);
  try {
    const res = await api.courses.getVersion(courseVersionId);
    if (res.version) {
      setActiveVersion(res.version);
    }
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};

  const loadCourseVersion = async (id: string) => {
    try {
      const res = await api.courses.getVersion(id);
      if (res.version) {
        setActiveVersion(res.version);
      }
    } catch (err) {
      console.error('[Coord] Failed to load version details', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save progress as draft
  const handleSaveDraft = async () => {
    if (!activeVersion) return;
    try {
      const coordinatorPayload = {
        courseOutcomes: activeVersion.courseOutcomes || [],
        coPoMappings: activeVersion.coPoMappings || [],
        coPsoMappings: activeVersion.coPsoMappings || [],
        syllabusUnits: activeVersion.syllabusUnits || [],
        labPracticals: [],
        miniProjects: [],
        textbooks: activeVersion.textbooks || [],
        referenceMaterials: activeVersion.referenceMaterials || [],
        journals: activeVersion.journals || [],
        onlineResources: activeVersion.onlineResources || [],
        objectives: activeVersion.objectives || [],
        prerequisites: activeVersion.prerequisites || [],
        cieSee: activeVersion.cieSee
      };

      // If it is mock data, simulate save
      if (activeVersion._id.startsWith('mock-')) {
        alert('Mock syllabus draft progress saved successfully!');
        return;
      }
      const res = await api.courses.saveDraft(activeVersion._id, coordinatorPayload);
      alert(res.message || 'Syllabus progress saved successfully as Draft!');
      loadCourseVersion(activeVersion._id);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  // Approve Syllabus (HOD capability)
  const handleApproveSyllabus = async () => {
    if (!activeVersion) return;
    try {
      const validationResult = runOBEValidation(activeVersion);
      if (!validationResult.overallPassed) {
        setValidationErrors(validationResult.errors);
        setValidationFailedModalOpen(true);
        return;
      }

      if (activeVersion._id.startsWith('mock-')) {
        const updatedVersion = { ...activeVersion, status: 'Approved' };
        setActiveVersion(updatedVersion);
        alert('Mock syllabus successfully approved!');
        return;
      }

      await api.courses.updateStatus(activeVersion._id, {
        status: 'Approved',
        comments: 'Directly approved by HOD from the Syllabus Editor.'
      });
      alert('Syllabus file successfully approved!');
      loadCourseVersion(activeVersion._id);
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  // A4 preview container ref for PDF capture
  const accrPreviewRef = useRef<HTMLDivElement>(null);

  // Helper: load logo as base64 via fetch+FileReader (reliable with Vite blob URLs)
  const getLogoBase64 = async (): Promise<string> => {
    try {
      const res = await fetch(adityaLogo);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return ''; // graceful fallback — no logo drawn if fetch fails
    }
  };



  // Cycle mapping weights: 0 -> 1 -> 2 -> 3 -> 0
  const handleMatrixCellClick = (coCode: string, type: 'po' | 'pso', code: string) => {
    if (!activeVersion || activeVersion.status === 'Pending HOD' || activeVersion.status === 'Approved') return;
    
    const key = type === 'po' ? 'coPoMappings' : 'coPsoMappings';
    const list = [...(activeVersion[key] || [])];
    let mapping = list.find((m: any) => m.coCode === coCode);
    
    if (!mapping) {
      mapping = { coCode, [type]: {} };
      list.push(mapping);
    }
    
    const subKey = type === 'po' ? 'po' : 'pso';
    const currentVal = mapping[subKey]?.[code] || 0;
    const nextVal = (currentVal + 1) % 4; // Cycles: 0, 1, 2, 3, 0
    
    mapping[subKey] = {
      ...mapping[subKey],
      [code]: nextVal
    };
    
    setActiveVersion({
      ...activeVersion,
      [key]: list
    });
  };

  // Add Course Outcome (CO)
  const handleAddCO = () => {
    if (!activeVersion) return;
    const nextCO = (activeVersion.courseOutcomes?.length || 0) + 1;
    const coCode = `CO${nextCO}`;
    
    const outcomes = [...(activeVersion.courseOutcomes || []), { coCode, description: '', bloomLevel: 'K3 - Apply' }];
    const coPo = [...(activeVersion.coPoMappings || []), { coCode, po: {} }];
    const coPso = [...(activeVersion.coPsoMappings || []), { coCode, pso: {} }];

    setActiveVersion({
      ...activeVersion,
      courseOutcomes: outcomes,
      coPoMappings: coPo,
      coPsoMappings: coPso
    });
  };

  const handleAddObjective = () => {
    if (!activeVersion) return;
    const objectives = activeVersion.objectives || [];
    if (objectives.length >= 6) {
      alert('A maximum of 6 Course Objectives is allowed.');
      return;
    }
    setActiveVersion({ ...activeVersion, objectives: [...objectives, ''] });
  };

  const handleUpdateObjective = (idx: number, value: string) => {
    if (!activeVersion) return;
    const objectives = [...(activeVersion.objectives || [])];
    objectives[idx] = value;
    setActiveVersion({ ...activeVersion, objectives });
  };

  const handleDeleteObjective = (idx: number) => {
    if (!activeVersion) return;
    const objectives = (activeVersion.objectives || []).filter((_: any, i: number) => i !== idx);
    setActiveVersion({ ...activeVersion, objectives });
  };

  const getObjectiveAlignmentCount = (objective: string) => {
    if (!objective?.trim() || !activeVersion?.courseOutcomes?.length) return 0;
    const objectiveTerms = objective
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term: string) => term.length > 4);

    return activeVersion.courseOutcomes.filter((co: any) => {
      const coText = (co.description || '').toLowerCase();
      return objectiveTerms.some((term: string) => coText.includes(term));
    }).length;
  };

  // Delete Course Outcome (CO)
  const handleDeleteCO = (idx: number) => {
    if (!activeVersion) return;
    const coCode = activeVersion.courseOutcomes[idx].coCode;
    const outcomes = activeVersion.courseOutcomes.filter((_: any, i: number) => i !== idx);
    const coPo = activeVersion.coPoMappings.filter((m: any) => m.coCode !== coCode);
    const coPso = activeVersion.coPsoMappings.filter((m: any) => m.coCode !== coCode);
    
    // Re-index remaining outcomes
    const reindexedOutcomes = outcomes.map((co: any, i: number) => ({
      ...co,
      coCode: `CO${i + 1}`
    }));
    const reindexedCoPo = coPo.map((m: any, i: number) => ({
      ...m,
      coCode: `CO${i + 1}`
    }));
    const reindexedCoPso = coPso.map((m: any, i: number) => ({
      ...m,
      coCode: `CO${i + 1}`
    }));

    setActiveVersion({
      ...activeVersion,
      courseOutcomes: reindexedOutcomes,
      coPoMappings: reindexedCoPo,
      coPsoMappings: reindexedCoPso
    });
  };

  // Syllabus Unit management
  const updateUnitField = (idx: number, field: string, value: any) => {
    if (!activeVersion) return;
    const units = [...activeVersion.syllabusUnits];
    units[idx] = {
      ...units[idx],
      [field]: value
    };
    setActiveVersion({ ...activeVersion, syllabusUnits: units });
  };

  const handleAddUnit = () => {
    if (!activeVersion) return;
    if (activeVersion.syllabusUnits.length >= 5) {
      alert('Syllabus allows a maximum of 5 Units.');
      return;
    }
    const units = [...activeVersion.syllabusUnits];
    const nextNum = units.length + 1;
    units.push({
      unitNumber: nextNum,
      htmlContent: '',
      plainText: '',
    });
    setActiveVersion({ ...activeVersion, syllabusUnits: units });
  };

  const handleDeleteUnit = (idx: number) => {
    if (!activeVersion) return;
    const units = activeVersion.syllabusUnits.filter((_: any, i: number) => i !== idx);
    // Re-index unit numbers
    const reindexed = units.map((u: any, i: number) => ({
      ...u,
      unitNumber: i + 1
    }));
    setActiveVersion({ ...activeVersion, syllabusUnits: reindexed });
  };

  // Prescribed items helpers
  const handleAddPrerequisite = () => {
    if (!newPrereqText.trim() || !activeVersion) return;
    const prerequisites = [...(activeVersion.prerequisites || []), newPrereqText.trim()];
    setActiveVersion({ ...activeVersion, prerequisites });
    setNewPrereqText('');
  };

  const handleRemovePrerequisite = (idx: number) => {
    if (!activeVersion) return;
    const prerequisites = activeVersion.prerequisites.filter((_: any, i: number) => i !== idx);
    setActiveVersion({ ...activeVersion, prerequisites });
  };

  const handleAddTextbook = () => {
    if (!newTextbookText.trim() || !activeVersion) return;
    const textbooks = [...(activeVersion.textbooks || []), { title: newTextbookText.trim(), author: '', publisher: '', edition: '' }];
    setActiveVersion({ ...activeVersion, textbooks });
    setNewTextbookText('');
  };

  const handleRemoveTextbook = (idx: number) => {
    if (!activeVersion) return;
    const textbooks = activeVersion.textbooks.filter((_: any, i: number) => i !== idx);
    setActiveVersion({ ...activeVersion, textbooks });
  };

  const handleAddReference = () => {
    if (!newReferenceText.trim() || !activeVersion) return;
    const referenceMaterials = [...(activeVersion.referenceMaterials || []), { title: newReferenceText.trim(), author: '', publisher: '', edition: '' }];
    setActiveVersion({ ...activeVersion, referenceMaterials });
    setNewReferenceText('');
  };

  const handleRemoveReference = (idx: number) => {
    if (!activeVersion) return;
    const referenceMaterials = activeVersion.referenceMaterials.filter((_: any, i: number) => i !== idx);
    setActiveVersion({ ...activeVersion, referenceMaterials });
  };

  const parseReferenceString = (str: string) => {
    const parts = str.split(',').map(s => s.trim());
    return {
      title: parts[0] || '',
      author: parts[1] || '',
      edition: parts[2] || '',
      publisher: parts[3] || '',
      year: parts[4] || ''
    };
  };

  const handleSaveReferenceMaterial = () => {
    if (!refForm.title.trim() || !refForm.author.trim() || !activeVersion) return;
    
    const newBook = {
      title: refForm.title.trim(),
      author: refForm.author.trim(),
      edition: refForm.edition.trim(),
      publisher: refForm.publisher.trim()
    };
    
    let textbooks = [...(activeVersion.textbooks || [])];
    let referenceMaterials = [...(activeVersion.referenceMaterials || [])];
    
    if (refForm.isEditing && refForm.originalIndex !== null && refForm.originalType !== null) {
      if (refForm.originalType === 'Textbook') {
        textbooks = textbooks.filter((_, idx) => idx !== refForm.originalIndex);
      } else {
        referenceMaterials = referenceMaterials.filter((_, idx) => idx !== refForm.originalIndex);
      }
    }
    
    if (refForm.type === 'Textbook') {
      textbooks.push(newBook);
    } else {
      referenceMaterials.push(newBook);
    }
    
    setActiveVersion({ ...activeVersion, textbooks, referenceMaterials });
    setRefForm({
      show: false,
      isEditing: false,
      originalType: null,
      originalIndex: null,
      type: 'Textbook',
      title: '',
      author: '',
      edition: '',
      publisher: '',
      year: ''
    });
  };

  const handleEditReference = (type: 'Textbook' | 'Reference', idx: number, val: any) => {
    const parsed = typeof val === 'string' ? parseReferenceString(val) : val;
    setRefForm({
      show: true,
      isEditing: true,
      originalType: type,
      originalIndex: idx,
      type: type,
      title: parsed.title || '',
      author: parsed.author || '',
      edition: parsed.edition || '',
      publisher: parsed.publisher || '',
      year: parsed.year || ''
    });
  };

  const handleAddOnlineResource = () => {
    if (!newOnlineResourceText.trim() || !activeVersion) return;
    const newResource = {
      url: newOnlineResourceText.trim(),
      description: ''
    };
    const onlineResources = [...(activeVersion.onlineResources || []), newResource];
    setActiveVersion({ ...activeVersion, onlineResources });
    setNewOnlineResourceText('');
  };

  const handleRemoveOnlineResource = (idx: number) => {
    if (!activeVersion) return;
    const onlineResources = (activeVersion.onlineResources || []).filter((_: any, i: number) => i !== idx);
    setActiveVersion({ ...activeVersion, onlineResources });
  };

  // Calculate dynamic metrics for progress indicators
  const getCOCount = () => activeVersion?.courseOutcomes?.length || 0;
  const getCOProgressPercent = () => Math.min((getCOCount() / 5) * 100, 100);
  
  const getMappingPercent = () => {
    if (!activeVersion) return 0;
    const totalCells = (activeVersion.courseOutcomes?.length || 0) * 15; // 12 POs + 3 PSOs
    if (totalCells === 0) return 0;
    
    let nonZeroCells = 0;
    activeVersion.coPoMappings?.forEach((m: any) => {
      if (m.po) {
        Object.values(m.po).forEach((v: any) => { if (v > 0) nonZeroCells++; });
      }
    });
    activeVersion.coPsoMappings?.forEach((m: any) => {
      if (m.pso) {
        Object.values(m.pso).forEach((v: any) => { if (v > 0) nonZeroCells++; });
      }
    });
    return Math.min(Math.round((nonZeroCells / totalCells) * 100), 100);
  };

  const getSyllabusPercent = () => {
    if (!activeVersion) return 0;
    const unitCount = activeVersion.syllabusUnits?.length || 0;
    let completeCount = 0;
    activeVersion.syllabusUnits?.forEach((u: any) => {
      if (u.title.trim() && u.description.trim()) completeCount++;
    });
    return Math.min(Math.round((completeCount / 5) * 100), 100);
  };

  const getReadinessPercent = () => {
    if (!activeVersion) return 0;
    const coPart = getCOProgressPercent() * 0.3;
    const mappingPart = getMappingPercent() * 0.3;
    const syllabusPart = getSyllabusPercent() * 0.4;
    return Math.round(coPart + mappingPart + syllabusPart);
  };

  // Print workspace Preview Document
  const handlePrint = () => {
    window.print();
  };

  const isLocked = false;

  return (
    <div className="space-y-6 font-sans">
      
      {/* 1. TOP HEADER BANNER (WORKSPACE CONTROL BAR) */}
      {activeVersion && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-premium flex flex-wrap items-center justify-between gap-4 no-print animate-fadeIn">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">HOD Syllabus Editor Workspace</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="bg-slate-100 border border-slate-300 font-extrabold text-xs text-blue-700 px-3 py-2 rounded-lg">
                  {activeVersion?.courseId?.code} — {activeVersion?.courseId?.title}
                </span>
                <span className={`px-2.5 py-1 text-[10px] rounded-lg font-bold border ${
                  activeVersion?.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  activeVersion?.status === 'Pending HOD' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  activeVersion?.status === 'Returned' ? 'bg-red-50 text-red-700 border-red-100 animate-pulse' :
                  'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  Status: {activeVersion?.status === 'Pending HOD' ? 'Submitted to HOD' : activeVersion?.status === 'Returned' ? 'Returned by HOD' : activeVersion?.status || 'Draft'}
                </span>
                {activeVersion?.comments && (
                  <button 
                    onClick={() => setSelectedRemarks(activeVersion.comments)}
                    className="text-[10px] text-red-600 underline font-bold"
                  >
                    View remarks
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPreviewOpen(!previewOpen)}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>{previewOpen ? 'Hide Preview' : 'Show Split Preview'}</span>
            </button>
            
            {activeVersion?.status !== 'Pending HOD' && activeVersion?.status !== 'Approved' && (
              <>
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all border border-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Close Editor</span>
                </button>
                <button
                  onClick={handleSaveDraft}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all border border-slate-300 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Draft</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 1.1 COURSE COMPLETION READINESS & LOCK WARNING BAR */}
      {activeVersion && (
        <div className="space-y-4 no-print">
          
          {/* Lock Banner */}
          {isLocked && (
            <div className="bg-amber-50 border border-amber-250 text-amber-900 px-5 py-3.5 rounded-2xl flex items-center gap-3 shadow-premium animate-fadeIn">
              <span className="text-base leading-none">🔒</span>
              <div className="text-xs font-bold font-sans">
                This course file is locked for editing because it has been {activeVersion.status === 'Approved' ? 'approved' : 'submitted to the HOD for approval'}. 
                {activeVersion.status === 'Pending HOD' && ' To request changes, ask the HOD to return it for correction.'}
              </div>
            </div>
          )}

          {/* Completion Readiness Widget Card */}
          {(() => {
            const valResult = runOBEValidation(activeVersion);
            const isCompleted = valResult.overallPassed;
            
            return (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center">
                      <svg className="w-10 h-10 transform -rotate-90">
                        <circle cx="20" cy="20" r="16" stroke="#E2E8F0" strokeWidth="3.5" fill="transparent" />
                        <circle cx="20" cy="20" r="16" stroke={isCompleted ? "#10B981" : "#3B82F6"} strokeWidth="3.5" fill="transparent"
                          strokeDasharray={`${2 * Math.PI * 16}`}
                          strokeDashoffset={`${2 * Math.PI * 16 * (1 - valResult.completionPercent / 100)}`}
                          className="transition-all duration-550 ease-out"
                        />
                      </svg>
                      <span className="absolute text-[10px] font-extrabold font-mono text-slate-800">{valResult.completionPercent}%</span>
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-855 uppercase tracking-wide flex items-center gap-1.5">
                        <span>Course Completion Readiness</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${isCompleted ? 'bg-green-50 text-green-700 border-green-150' : 'bg-blue-50 text-blue-700 border-blue-150'}`}>
                          {valResult.completionPercent}% Complete
                        </span>
                      </h3>
                      <div className="text-[10px] text-slate-500 font-bold mt-1">
                        {isCompleted ? (
                          <span className="text-emerald-600 block">✓ All OBE requirements satisfied. Ready for submission.</span>
                        ) : (
                          <div className="space-y-1 mt-1">
                            <span className="text-red-600 block">✗ Missing {valResult.requiredChecklist.filter((t: any) => !t.passed).length} mandatory OBE requirements before submission can be accepted.</span>
                            <div className="pl-2.5 border-l-2 border-red-200 space-y-0.5 mt-1 bg-red-50/20 py-1 pr-2 rounded-r">
                              <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-extrabold mb-1">Missing:</span>
                              {valResult.requiredChecklist.filter((t: any) => !t.passed).map((item: any, i: number) => (
                                <span key={i} className="text-[10px] text-red-700 font-bold block flex items-start gap-1">
                                  <span>✗</span>
                                  <span>{item.details}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={() => setReadinessChecklistOpen(!readinessChecklistOpen)}
                    className="text-[11px] font-extrabold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors cursor-pointer"
                  >
                    <span>{readinessChecklistOpen ? 'Hide Checklist' : 'Show Checklist'}</span>
                    <span className="text-[9px] transform transition-transform duration-200 block">{readinessChecklistOpen ? '▲' : '▼'}</span>
                  </button>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-550 ${isCompleted ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                    style={{ width: `${valResult.completionPercent}%` }}
                  />
                </div>

                {/* Checklist Expansion details */}
                {readinessChecklistOpen && (
                  <div className="border-t border-slate-100 pt-4 space-y-6 animate-slideDown">
                    {/* Required Section */}
                    <div>
                      <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                        <span>Required Elements ({valResult.requiredChecklist.filter((t: any) => t.passed).length} / {valResult.requiredChecklist.length})</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {valResult.requiredChecklist.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                            <span className={`text-sm leading-none font-bold font-mono ${item.passed ? 'text-emerald-500' : 'text-red-500'}`}>
                              {item.passed ? '✓' : '✗'}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-705 leading-tight">{item.label}</h4>
                              <p className={`text-[10px] font-semibold mt-1 leading-normal ${item.passed ? 'text-slate-500' : 'text-red-650'}`} title={item.details}>
                                {item.details || (item.passed ? 'Satisfied' : 'Pending details')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Optional Section */}
                    <div>
                      <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 border-t border-slate-100 pt-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        <span>Optional Elements ({valResult.optionalChecklist.filter((t: any) => t.passed).length} / {valResult.optionalChecklist.length})</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {valResult.optionalChecklist.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                            <span className={`text-sm leading-none font-bold font-mono ${item.passed ? 'text-emerald-500' : 'text-slate-450'}`}>
                              {item.passed ? '✓' : '○'}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-705 leading-tight">{item.label}</h4>
                              <p className={`text-[10px] font-semibold mt-1 leading-normal ${item.passed ? 'text-slate-500' : 'text-slate-400'}`} title={item.details}>
                                {item.details || (item.passed ? 'Satisfied' : 'Pending details')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      )}

      {/* ============================================================== */}
      {/* 2. SPLIT SCREEN WORKSPACE LAYOUT */}
      {/* ============================================================== */}
      <div className="grid grid-cols-12 gap-6 items-start">
        
        <div className={`transition-all duration-300 ${
          activeTab === 'dashboard' || activeTab === 'my-courses' || activeTab === 'profile' || activeTab === 'reports' || activeTab === 'work-progress'
            ? 'col-span-12' 
            : previewOpen ? 'col-span-7' : 'col-span-12'
        }`}>
          
          {/* ========================================================== */}
          {/* SYLLABUS EDITING WORKSPACE */}
          {/* ========================================================== */}
          {true && (
            <fieldset disabled={isLocked} className="space-y-6 border-0 p-0 m-0 min-w-0">
              
              {/* TAB 3: COURSE DETAILS */}
              {activeTab === 'course-details' && activeVersion && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">Course Information</h2>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Configured by HOD</p>
                </div>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-blue-700">
                  Read-only
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Course Details</h3>
                  <span className="text-[10px] font-bold text-blue-700">Configured by HOD</span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
                  {[
                    ['Course Code', activeVersion.courseId?.code || 'Not configured'],
                    ['Course Title', activeVersion.courseId?.title || 'Not configured'],
                    ['Regulation', activeVersion.regulationId?.code || 'Not configured'],
                    ['Semester', `Semester ${activeVersion.semester || '-'}`],
                    ['Course Type', activeVersion.category || 'Not configured'],
                    ['Credits', activeVersion.credits?.C ?? '-']
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{label}</dt>
                      <dd className="mt-1 font-bold text-slate-800">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">LTPSC Distribution</h3>
                  <span className="text-[10px] font-bold text-blue-700">Configured by HOD</span>
                </div>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    ['L', activeVersion.credits?.L ?? 0, 'Lecture'],
                    ['T', activeVersion.credits?.T ?? 0, 'Tutorial'],
                    ['P', activeVersion.credits?.P ?? 0, 'Practical'],
                    ['S', activeVersion.credits?.S ?? 0, 'Skill'],
                    ['C', activeVersion.credits?.C ?? 0, 'Credits']
                  ].map(([label, value, title]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-white px-2 py-3">
                      <span className="block text-[9px] font-extrabold uppercase text-slate-400">{title}</span>
                      <strong className="mt-1 block font-mono text-base text-slate-850">{value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Course Offered for Branches</h3>
                  <span className="text-[10px] font-bold text-blue-700">Configured by HOD</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(activeVersion.offeredFor || []).length > 0 ? (
                    activeVersion.offeredFor.map((branch: string) => (
                      <span key={branch} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">
                        {branch}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-semibold text-slate-500">No branches configured.</span>
                  )}
                </div>
              </div>

              {/* Removed Course Objectives Configured by HOD */}
               
              {/* Metadata display card */}
              <div className="hidden grid-cols-3 border border-slate-200 rounded-xl bg-slate-50/50 p-4 gap-4 text-xs font-bold text-slate-500">
                <div>
                  <span className="text-[9px] uppercase tracking-wide text-slate-400 block leading-none">Course Code</span>
                  <span className="text-blue-800 mt-1 block font-mono text-sm">{activeVersion.courseId?.code}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wide text-slate-400 block leading-none">Course Title</span>
                  <span className="text-slate-800 mt-1 block text-sm">{activeVersion.courseId?.title}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wide text-slate-400 block leading-none">Regulation & Sem</span>
                  <span className="text-slate-800 mt-1 block text-sm">{activeVersion.regulationId?.code} • Semester {activeVersion.semester}</span>
                </div>
              </div>

              {/* Removed Objectives List */}

            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 4: CO MANAGEMENT */}
          {/* ========================================================== */}
          {activeTab === 'cos' && activeVersion && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">Course Outcomes (COs) Workspace</h2>
                <button
                  onClick={handleAddCO}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add CO</span>
                </button>
              </div>


              {/* Minimum Check Warning */}
              {getCOCount() < 5 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-2.5 text-xs font-bold">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span>Minimum 5 Course Outcomes (COs) required for accreditation standards. Currently configured: {getCOCount()}</span>
                  </div>
                </div>
              )}

              {/* Outcomes table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 bg-slate-50/50 uppercase font-bold">
                      <th className="p-3 pl-4 w-20">CO No</th>
                      <th className="p-3">Course Outcome Statement</th>
                      <th className="p-3 w-40">Bloom's Level</th>
                      <th className="p-3 pr-4 text-right w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeVersion.courseOutcomes?.map((co: any, idx: number) => (
                      <tr key={co.coCode} className="border-b border-slate-100 hover:bg-slate-50/20 text-slate-600 font-medium">
                        <td className="p-3 pl-4">
                          <span className="text-amber-700 bg-amber-50 border border-amber-100 font-bold px-2 py-0.5 rounded font-mono">
                            {co.coCode}
                          </span>
                        </td>
                        <td className="p-3">
                          <input 
                            type="text"
                            value={co.description}
                            onChange={(e) => {
                              const list = [...activeVersion.courseOutcomes];
                              list[idx].description = e.target.value;
                              setActiveVersion({ ...activeVersion, courseOutcomes: list });
                            }}
                            className="w-full bg-transparent border-b border-transparent focus:border-blue-600 outline-none p-1 font-semibold text-slate-700"
                            placeholder="State the outcome statement details..."
                          />
                        </td>
                        <td className="p-3">
                          <select
                            value={co.bloomLevel}
                            onChange={(e) => {
                              const list = [...activeVersion.courseOutcomes];
                              list[idx].bloomLevel = e.target.value;
                              setActiveVersion({ ...activeVersion, courseOutcomes: list });
                            }}
                            className="bg-white border border-slate-350 rounded p-1.5 w-full font-semibold outline-none"
                          >
                            {bloomLevels.map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <button 
                            onClick={() => handleDeleteCO(idx)}
                            className="p-1 hover:bg-red-50 rounded text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {getCOCount() === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-slate-400 font-semibold uppercase">
                          No outcomes defined. Click "+ Add CO" button to start.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 5: CO-PO MAPPING */}
          {/* ========================================================== */}
          {activeTab === 'co-po' && activeVersion && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 animate-fadeIn">

              {/* Header + Legend */}
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800 tracking-tight">CO–PO Alignment Matrix</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Click any cell to cycle mapping level. Changes update PO averages and document preview in real time.</p>
                </div>
                {/* Legend */}
                <div className="flex-shrink-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-4">
                  <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">Legend</span>
                  <div className="flex items-center gap-3 text-[10px] font-bold">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-5 h-5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-extrabold flex items-center justify-center">3</span>
                      <span className="text-slate-600">High</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-5 h-5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-extrabold flex items-center justify-center">2</span>
                      <span className="text-slate-600">Medium</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-5 h-5 rounded bg-blue-50 border border-blue-100 text-blue-600 text-[9px] font-extrabold flex items-center justify-center">1</span>
                      <span className="text-slate-600">Low</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-5 h-5 rounded bg-slate-100 border border-slate-200 text-slate-400 text-[9px] font-extrabold flex items-center justify-center">–</span>
                      <span className="text-slate-500">None</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="text-left border-collapse select-none" style={{ tableLayout: 'fixed', minWidth: '100%' }}>
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-200">
                      <th className="sticky left-0 z-10 bg-slate-100 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider px-4 py-2 border-r border-slate-200" style={{ width: '80px', minWidth: '80px' }}>CO / PO</th>
                      {Array.from({ length: 12 }, (_, i) => `PO${i + 1}`).map(po => (
                        <th key={po} className="text-[10px] font-extrabold text-slate-500 uppercase text-center py-2 border-r border-slate-200 last:border-r-0" style={{ width: '52px', minWidth: '52px' }}>{po}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeVersion.courseOutcomes?.map((co: any, rowIdx: number) => {
                      const coPo = activeVersion.coPoMappings?.find((m: any) => m.coCode === co.coCode);
                      return (
                        <tr key={co.coCode} className={`border-b border-slate-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                          <td className="sticky left-0 z-10 px-4 font-extrabold text-blue-700 text-xs font-mono border-r border-slate-200 whitespace-nowrap" style={{ height: '44px', background: rowIdx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></span>
                              {co.coCode}
                            </span>
                          </td>
                          {Array.from({ length: 12 }, (_, i) => `PO${i + 1}`).map(po => {
                            const val = coPo?.po?.[po] || 0;
                            return (
                              <td
                                key={po}
                                onClick={() => handleMatrixCellClick(co.coCode, 'po', po)}
                                className={`matrix-cell border-r border-slate-100 last:border-r-0 mapping-${val}`}
                                title={`${co.coCode} × ${po}: Click to change (current: ${val === 0 ? 'None' : val === 1 ? 'Low' : val === 2 ? 'Medium' : 'High'})`}
                              >
                                {val > 0 ? val : '–'}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {/* Averages Row */}
                    <tr className="border-t-2 border-slate-200 bg-slate-100">
                      <td className="sticky left-0 z-10 px-4 text-[10px] font-extrabold text-slate-600 uppercase tracking-wide border-r border-slate-200 bg-slate-100" style={{ height: '36px' }}>Avg.</td>
                      {Array.from({ length: 12 }, (_, i) => `PO${i + 1}`).map(po => {
                        let total = 0, count = 0;
                        activeVersion.coPoMappings?.forEach((m: any) => {
                          const v = m.po?.[po] || 0;
                          if (v > 0) { total += v; count++; }
                        });
                        const avg = count > 0 ? (total / count).toFixed(1) : '–';
                        const numAvg = count > 0 ? total / count : 0;
                        const avgColor = numAvg === 0 ? 'text-slate-400' : numAvg >= 2.5 ? 'text-emerald-700 font-extrabold' : numAvg >= 1.5 ? 'text-amber-700 font-extrabold' : 'text-blue-600 font-extrabold';
                        return (
                          <td key={po} className={`text-center text-[10px] border-r border-slate-200 last:border-r-0 ${avgColor}`} style={{ height: '36px' }}>
                            {avg}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Row count info */}
              <p className="text-[10px] text-slate-400 font-medium">
                {activeVersion.courseOutcomes?.length || 0} Course Outcomes × 12 Program Outcomes — {activeVersion.coPoMappings?.reduce((acc: number, m: any) => acc + Object.values(m.po || {}).filter((v: any) => v > 0).length, 0) || 0} mappings defined
              </p>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 6: CO-PSO MAPPING */}
          {/* ========================================================== */}
          {activeTab === 'co-pso' && activeVersion && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 animate-fadeIn">

              {/* Header + Legend */}
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800 tracking-tight">CO–PSO Alignment Matrix</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Click any cell to cycle mapping level. Changes update PSO averages and document preview in real time.</p>
                </div>
                {/* Legend */}
                <div className="flex-shrink-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-4">
                  <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">Legend</span>
                  <div className="flex items-center gap-3 text-[10px] font-bold">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-5 h-5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-extrabold flex items-center justify-center">3</span>
                      <span className="text-slate-600">High</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-5 h-5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-extrabold flex items-center justify-center">2</span>
                      <span className="text-slate-600">Medium</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-5 h-5 rounded bg-blue-50 border border-blue-100 text-blue-600 text-[9px] font-extrabold flex items-center justify-center">1</span>
                      <span className="text-slate-600">Low</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-5 h-5 rounded bg-slate-100 border border-slate-200 text-slate-400 text-[9px] font-extrabold flex items-center justify-center">–</span>
                      <span className="text-slate-500">None</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="text-left border-collapse select-none" style={{ tableLayout: 'fixed', minWidth: '340px' }}>
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-200">
                      <th className="sticky left-0 z-10 bg-slate-100 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider px-4 py-2 border-r border-slate-200" style={{ width: '80px', minWidth: '80px' }}>CO / PSO</th>
                      {Array.from({ length: 3 }, (_, i) => `PSO${i + 1}`).map(pso => (
                        <th key={pso} className="text-[10px] font-extrabold text-slate-500 uppercase text-center py-2 border-r border-slate-200 last:border-r-0" style={{ width: '90px', minWidth: '90px' }}>{pso}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeVersion.courseOutcomes?.map((co: any, rowIdx: number) => {
                      const coPso = activeVersion.coPsoMappings?.find((m: any) => m.coCode === co.coCode);
                      return (
                        <tr key={co.coCode} className={`border-b border-slate-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                          <td className="sticky left-0 z-10 px-4 font-extrabold text-blue-700 text-xs font-mono border-r border-slate-200 whitespace-nowrap" style={{ height: '44px', background: rowIdx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></span>
                              {co.coCode}
                            </span>
                          </td>
                          {Array.from({ length: 3 }, (_, i) => `PSO${i + 1}`).map(pso => {
                            const val = coPso?.pso?.[pso] || 0;
                            return (
                              <td
                                key={pso}
                                onClick={() => handleMatrixCellClick(co.coCode, 'pso', pso)}
                                className={`matrix-cell border-r border-slate-100 last:border-r-0 mapping-${val}`}
                                title={`${co.coCode} × ${pso}: Click to change (current: ${val === 0 ? 'None' : val === 1 ? 'Low' : val === 2 ? 'Medium' : 'High'})`}
                              >
                                {val > 0 ? val : '–'}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {/* Averages Row */}
                    <tr className="border-t-2 border-slate-200 bg-slate-100">
                      <td className="sticky left-0 z-10 px-4 text-[10px] font-extrabold text-slate-600 uppercase tracking-wide border-r border-slate-200 bg-slate-100" style={{ height: '36px' }}>Avg.</td>
                      {Array.from({ length: 3 }, (_, i) => `PSO${i + 1}`).map(pso => {
                        let total = 0, count = 0;
                        activeVersion.coPsoMappings?.forEach((m: any) => {
                          const v = m.pso?.[pso] || 0;
                          if (v > 0) { total += v; count++; }
                        });
                        const avg = count > 0 ? (total / count).toFixed(1) : '–';
                        const numAvg = count > 0 ? total / count : 0;
                        const avgColor = numAvg === 0 ? 'text-slate-400' : numAvg >= 2.5 ? 'text-emerald-700 font-extrabold' : numAvg >= 1.5 ? 'text-amber-700 font-extrabold' : 'text-blue-600 font-extrabold';
                        return (
                          <td key={pso} className={`text-center text-[10px] border-r border-slate-200 last:border-r-0 ${avgColor}`} style={{ height: '36px' }}>
                            {avg}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Row count info */}
              <p className="text-[10px] text-slate-400 font-medium">
                {activeVersion.courseOutcomes?.length || 0} Course Outcomes × 3 Program Specific Outcomes — {activeVersion.coPsoMappings?.reduce((acc: number, m: any) => acc + Object.values(m.pso || {}).filter((v: any) => v > 0).length, 0) || 0} mappings defined
              </p>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 7: CONSOLIDATED SYLLABUS MANAGEMENT */}
          {/* ========================================================== */}
          {activeTab === 'syllabus' && activeVersion && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header block */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h1 className="text-xl font-bold text-slate-800">Syllabus Management Console</h1>
                <p className="text-xs text-slate-500 mt-1">Consolidated workspace to build syllabus units, reference materials, prerequisites, and practical specs.</p>
              </div>

              {/* Accordion Panels */}
              <div className="space-y-4">
                
                {/* 1. Syllabus Units */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSyllabusSections({ ...syllabusSections, units: !syllabusSections.units })}
                    className="w-full flex justify-between items-center p-4 bg-slate-50 border-b border-slate-100 hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">1. Syllabus Units (5 Units Mandatory)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeVersion.syllabusUnits?.length < 5 && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[9px] font-bold">
                          {activeVersion.syllabusUnits?.length || 0} / 5 Units
                        </span>
                      )}
                      {syllabusSections.units ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>

                  {syllabusSections.units && (
                    <div className="p-6 space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">Syllabus Builder (5 Units)</h3>
                        {activeVersion.syllabusUnits?.length < 5 && (
                          <button
                            type="button"
                            onClick={handleAddUnit}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Unit</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-4">
                        {activeVersion.syllabusUnits?.map((unit: any, idx: number) => (
                          <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3 relative text-xs">
                            <button 
                              type="button"
                              onClick={() => handleDeleteUnit(idx)}
                              className="absolute right-4 top-4 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="flex justify-between items-center pr-10">
                              <span className="font-extrabold text-blue-850">UNIT {unit.unitNumber}</span>
                            </div>

                            <div className="space-y-3 font-bold text-slate-500">
                              <div className="space-y-1">
                                <label className="text-xs uppercase tracking-wide">Unit Content (Paste Syllabus here)</label>
                                <RichTextEditor
                                  value={getUnitRichText(unit)}
                                  onChange={(html) => {
                                    const plainText = new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
                                    const units = [...activeVersion.syllabusUnits];
                                    units[idx] = {
                                      ...units[idx],
                                      htmlContent: html,
                                      richTextContent: html,
                                      plainText: plainText,
                                      lastUpdated: new Date().toISOString()
                                    };
                                    setActiveVersion({ ...activeVersion, syllabusUnits: units });
                                  }}
                                  minHeight={250}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Reference Materials */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSyllabusSections({ ...syllabusSections, references: !syllabusSections.references })}
                    className="w-full flex justify-between items-center p-4 bg-slate-50 border-b border-slate-100 hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <BookMarked className="w-5 h-5 text-blue-600" />
                      <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">2. Reference Materials (Minimum 1 Required)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-full text-[9px] font-bold">
                        {(activeVersion.textbooks?.length || 0) + (activeVersion.referenceMaterials?.length || 0)} Total
                      </span>
                      {syllabusSections.references ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>

                  {syllabusSections.references && (
                    <div className="p-6 space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">Textbooks & Reference Books</h3>
                        {!refForm.show && (
                          <button
                            type="button"
                            onClick={() => setRefForm({
                              show: true,
                              isEditing: false,
                              originalType: null,
                              originalIndex: null,
                              type: 'Textbook',
                              title: '',
                              author: '',
                              edition: '',
                              publisher: '',
                              year: ''
                            })}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Reference Material</span>
                          </button>
                        )}
                      </div>

                      {/* Reference Material Form */}
                      {refForm.show && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 text-xs font-bold text-slate-500">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <span className="text-slate-800 font-extrabold uppercase">{refForm.isEditing ? 'Edit Reference Material' : 'Add Reference Material'}</span>
                            <button type="button" onClick={() => setRefForm({ ...refForm, show: false })} className="text-slate-400 hover:text-slate-650">✕</button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span>Material Type *</span>
                              <select
                                value={refForm.type}
                                onChange={(e) => setRefForm({ ...refForm, type: e.target.value as any })}
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-blue-600"
                              >
                                <option value="Textbook">Prescribed Textbook</option>
                                <option value="Reference">Reference Book</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <span>Book Title *</span>
                              <input
                                type="text"
                                value={refForm.title}
                                onChange={(e) => setRefForm({ ...refForm, title: e.target.value })}
                                placeholder="e.g. Database System Concepts"
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                            <div className="space-y-1">
                              <span>Author(s) *</span>
                              <input
                                type="text"
                                value={refForm.author}
                                onChange={(e) => setRefForm({ ...refForm, author: e.target.value })}
                                placeholder="e.g. Silberschatz, Korth, Sudarshan"
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                            <div className="space-y-1">
                              <span>Edition</span>
                              <input
                                type="text"
                                value={refForm.edition}
                                onChange={(e) => setRefForm({ ...refForm, edition: e.target.value })}
                                placeholder="e.g. 7th Edition"
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                            <div className="space-y-1">
                              <span>Publisher</span>
                              <input
                                type="text"
                                value={refForm.publisher}
                                onChange={(e) => setRefForm({ ...refForm, publisher: e.target.value })}
                                placeholder="e.g. McGraw Hill"
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                            <div className="space-y-1">
                              <span>Year (optional)</span>
                              <input
                                type="text"
                                value={refForm.year}
                                onChange={(e) => setRefForm({ ...refForm, year: e.target.value })}
                                placeholder="e.g. 2020"
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 bg-white font-semibold outline-none focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setRefForm({ ...refForm, show: false })}
                              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-bold transition-all shadow-sm"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveReferenceMaterial}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all shadow-sm cursor-pointer"
                            >
                              Save Material
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Textbooks list */}
                      <div className="space-y-3">
                        <span className="text-slate-800 font-extrabold uppercase tracking-wider text-[11px]">Prescribed Textbooks</span>
                        <div className="space-y-2 text-xs">
                          {!activeVersion.textbooks || activeVersion.textbooks.length === 0 ? (
                            <div className="text-[10px] text-slate-400 italic p-3 text-center bg-slate-50 border border-dashed rounded-lg">
                              No prescribed textbooks added yet.
                            </div>
                          ) : (
                            activeVersion.textbooks.map((txt: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-slate-750 font-semibold">{formatTextbook(txt)}</span>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleEditReference('Textbook', idx, txt)}
                                    className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => handleRemoveTextbook(idx)} 
                                    className="p-1 text-red-500 hover:text-red-700 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Reference Books list */}
                      <div className="space-y-3 pt-3">
                        <span className="text-slate-800 font-extrabold uppercase tracking-wider text-[11px]">Reference Books</span>
                        <div className="space-y-2 text-xs">
                          {!activeVersion.referenceMaterials || activeVersion.referenceMaterials.length === 0 ? (
                            <div className="text-[10px] text-slate-400 italic p-3 text-center bg-slate-50 border border-dashed rounded-lg">
                              No reference books added yet.
                            </div>
                          ) : (
                            activeVersion.referenceMaterials.map((txt: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-slate-755 font-semibold">{formatTextbook(txt)}</span>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleEditReference('Reference', idx, txt)}
                                    className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => handleRemoveReference(idx)} 
                                    className="p-1 text-red-500 hover:text-red-700 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Web Links / Online Resources */}
                      <div className="space-y-2.5 pt-4 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-800 font-extrabold uppercase tracking-wider text-[11px]">Web Links / Online Resources</span>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={newOnlineResourceText}
                              onChange={(e) => setNewOnlineResourceText(e.target.value)}
                              placeholder="NPTEL/Coursera course web links..."
                              className="border rounded-lg px-2.5 py-1.5 w-64 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-blue-600" 
                            />
                            <button 
                              type="button" 
                              onClick={handleAddOnlineResource}
                              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] uppercase font-bold transition-colors cursor-pointer"
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2 text-xs">
                          {activeVersion.onlineResources?.map((txt: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-200">
                              <span className="text-slate-700 font-semibold font-mono text-[11px]">{formatOnlineResource(txt)}</span>
                              <button type="button" onClick={() => handleRemoveOnlineResource(idx)} className="text-red-500 px-1 font-extrabold hover:text-red-700">✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Prerequisites */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSyllabusSections({ ...syllabusSections, prerequisites: !syllabusSections.prerequisites })}
                    className="w-full flex justify-between items-center p-4 bg-slate-50 border-b border-slate-100 hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-blue-600" />
                      <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">3. Course Prerequisites (Optional)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-full text-[9px] font-bold">
                        {activeVersion.prerequisites?.length || 0} Tag(s)
                      </span>
                      {syllabusSections.prerequisites ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>

                  {syllabusSections.prerequisites && (
                    <div className="p-6 space-y-6">
                      <div className="space-y-4 text-xs font-bold text-slate-500">
                        <div className="flex gap-3 items-center">
                          <span className="w-40">Add Prerequisite Course</span>
                          <input 
                            type="text" 
                            value={newPrereqText} 
                            onChange={(e) => setNewPrereqText(e.target.value)}
                            placeholder="e.g. Data Structures (CS201)" 
                            className="flex-1 border rounded-lg p-2.5 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-blue-600" 
                          />
                          <button 
                            type="button" 
                            onClick={handleAddPrerequisite}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase transition-all shadow"
                          >
                            + Add Tag
                          </button>
                        </div>

                        <div className="space-y-2 pt-2">
                          <span>Prerequisite Courses checklist:</span>
                          <div className="flex flex-wrap gap-2">
                            {activeVersion.prerequisites?.map((prereq: string, idx: number) => (
                              <span key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold font-mono">
                                <span>{prereq}</span>
                                <button type="button" onClick={() => handleRemovePrerequisite(idx)} className="text-slate-400 hover:text-red-500 font-extrabold ml-1">✕</button>
                              </span>
                            ))}
                            {(activeVersion.prerequisites?.length || 0) === 0 && (
                              <span className="text-slate-400 text-xs italic font-semibold">No prerequisites configured.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </fieldset>
      )}

          {/* ========================================================== */}
          {/* TAB 13: REPORTS */}
          {/* ========================================================== */}
          {activeTab === 'reports' && activeVersion && (
            <div className="space-y-6 animate-fadeIn">
              {/* Reports Title Header */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-800">Reports Console</h1>
                  <p className="text-xs text-slate-500 mt-1">Preview and download live accreditation-ready syllabus documents based on completed coordinator work.</p>
                </div>
              </div>

              {/* Reports Dashboard Panels */}
              <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                {/* LEFT PANEL: Work Status & Readiness Checklist */}
                <div className="space-y-4">
                  {/* Course Report Status Card */}
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Course Report Status</h2>
                    <div className="mt-5 space-y-3.5 text-xs font-semibold">
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Assigned Course</span>
                        <span className="font-bold text-slate-800 text-right">{activeVersion.courseId?.title || 'No course selected'}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Course Code</span>
                        <span className="font-mono font-bold text-slate-800">{activeVersion.courseId?.code || '—'}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Regulation</span>
                        <span className="font-bold text-slate-800">{activeVersion.regulationId?.code || '—'}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Semester</span>
                        <span className="font-bold text-slate-800">Semester {activeVersion.semester || '—'}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Completion %</span>
                        <span className="font-bold text-blue-600 text-sm">{reportValidation.completionPercent}%</span>
                      </div>
                      <div className="flex justify-between items-center gap-4">
                        <span className="text-slate-500">Submission Status</span>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold border ${
                          activeVersion.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : activeVersion.status === 'Pending HOD'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              : activeVersion.status === 'Returned'
                                ? 'bg-red-50 text-red-700 border-red-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {getSubmissionStatusLabel(activeVersion.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Readiness Checklist Card */}
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Readiness Checklist</h3>
                      <p className="text-[10px] text-slate-400 mt-1 font-semibold">Mandatory export and HOD submission requirements.</p>
                    </div>
                    <div className="mt-5 grid gap-2.5">
                      {[
                        { label: 'Course Details Completed', passed: reportCheck('Course Details Completed') },
                        { label: 'Minimum 5 COs Added', passed: reportCheck('Minimum 5 COs Added') },
                        { label: 'CO-PO Mapping Complete', passed: reportCheck('CO-PO Mapping Complete') },
                        { label: 'CO-PSO Mapping Complete', passed: reportCheck('CO-PSO Mapping Complete') },
                        { label: 'Exactly 5 Units Added', passed: reportCheck('Exactly 5 Units Added') },
                        { label: 'At Least 1 Reference Material Added', passed: reportCheck('At Least 1 Reference Material Added') }
                      ].map((item, idx) => (
                        <div key={idx} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold flex items-center justify-between ${item.passed ? 'bg-emerald-50/50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                          <span>{item.label}</span>
                          <span className="font-bold text-sm">{item.passed ? '✅' : '❌'}</span>
                        </div>
                      ))}
                    </div>
                    {reportWarning ? (
                      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 animate-fadeIn">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>Cannot generate final report</span>
                        </div>
                        <p className="mt-2 text-[10px] font-bold text-red-500 uppercase tracking-wide">Missing requirements:</p>
                        <ul className="mt-2 list-disc list-inside space-y-1 text-[11px] font-semibold">
                          {reportMissingRequirements.map((item: any, idx: number) => (
                            <li key={idx}>{item.label}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-700 animate-fadeIn">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>🎉</span>
                          <span>Ready for official approval!</span>
                        </div>
                        <p className="mt-1 text-[10px] font-semibold text-emerald-600">All mandatory accreditation conditions are satisfied.</p>
                      </div>
                    )}
                    <div className="mt-5">
                      <button
                        onClick={handleApproveSyllabus}
                        disabled={!reportReady}
                        className={`w-full px-4 py-3 rounded-xl text-xs font-extrabold uppercase transition-all shadow-sm ${reportReady ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer' : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'}`}
                      >
                        Approve Syllabus
                      </button>
                    </div>
                  </div>
                </div>

                {/* RIGHT PANEL: Live Document Preview & Exports */}
                <div className="space-y-4">
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Accreditation Document Preview</h2>
                        <p className="text-xs text-slate-500 mt-1">Live document preview updates automatically as coordinator work changes.</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={downloadReportPDF}
                            disabled={!reportReady}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all shadow-sm ${reportReady ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
                          >
                            <FileDown className="w-4 h-4" /> Download PDF
                          </button>
                          <button
                            onClick={downloadReportWord}
                            disabled={!reportReady}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all shadow-sm ${reportReady ? 'bg-slate-900 hover:bg-slate-950 text-white cursor-pointer' : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
                          >
                            <FileText className="w-4 h-4" /> Download Word
                          </button>
                        </div>
                        {!reportReady && (
                          <p className="text-red-500 text-[9px] font-bold max-w-[280px] text-right mt-1.5 leading-normal">
                            Complete all mandatory curriculum requirements before exporting accreditation documents.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-300 border border-slate-200 rounded-2xl overflow-hidden mt-6 shadow-inner">
                      <div ref={accrPreviewRef} className="p-4">
                        {renderAccreditationDocumentPreview()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 13: WORK PROGRESS */}
          {/* ========================================================== */}
          {activeTab === 'work-progress' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header Title Panel */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-800">Work Progress Reports</h1>
                  <p className="text-xs text-slate-500 mt-1">Track assigned syllabus curriculum definitions, outline tasks status, and download verification records.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={downloadWorkSummaryPDF}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer uppercase font-sans tracking-wide"
                  >
                    <FileDown className="w-4 h-4" /> Work Summary PDF
                  </button>
                  <button
                    onClick={downloadActivityReportPDF}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-850 hover:bg-slate-950 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer uppercase font-sans tracking-wide"
                  >
                    <FileText className="w-4 h-4" /> Activity Report
                  </button>
                </div>
              </div>

              {/* 2. Work Completion Analytics (KPI Cards Grid) */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {(() => {
                  const total = assignedVersions.length;
                  const completed = assignedVersions.filter(v => v.status === 'Approved' || v.status === 'Finalized').length;
                  const pending = assignedVersions.filter(v => v.status === 'Draft' || v.status === 'In Progress' || v.status === 'Not Started').length;
                  const review = assignedVersions.filter(v => v.status === 'Pending HOD').length;
                  const returned = assignedVersions.filter(v => v.status === 'Returned').length;
                  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

                  return [
                    { label: 'Assigned Courses', val: total, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: BookOpen },
                    { label: 'Completed Courses', val: completed, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', icon: CheckCircle2 },
                    { label: 'Pending Courses', val: pending, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', icon: Clock },
                    { label: 'Under Review', val: review, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', icon: Search },
                    { label: 'Returned by HOD', val: returned, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', icon: AlertTriangle },
                    { label: 'Approval Rate %', val: `${rate}%`, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: TrendingUp, progress: rate }
                  ].map((card, idx) => (
                    <div key={idx} className={`bg-white border ${card.border} rounded-2xl p-4 flex flex-col justify-between hover:shadow-premium transition-all`}>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-tight">{card.label}</span>
                        <div className={`p-1.5 rounded-lg ${card.bg}`}>
                          <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className={`text-xl font-bold font-mono ${card.color}`}>{card.val}</div>
                        {card.progress !== undefined && (
                          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${card.progress}%` }}></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Bottom Main Content Section (2 Columns) */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Left Column: Course Assignment Report Table (col-span-2) */}
                <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Assigned Courses Directory</h2>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-1 rounded-full uppercase">HOD Approved Benchmarks</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider bg-slate-50">
                          <th className="py-3 px-4 rounded-l-lg">Code</th>
                          <th className="py-3 px-4">Course Name</th>
                          <th className="py-3 px-4">Dept</th>
                          <th className="py-3 px-2">Sem</th>
                          <th className="py-3 px-2">Reg</th>
                          <th className="py-3 px-4">Assigned Date</th>
                          <th className="py-3 px-4">Deadline</th>
                          <th className="py-3 px-4 rounded-r-lg">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-650">
                        {assignedVersions.map((v) => {
                          const statusClass = 
                            v.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' :
                            v.status === 'Returned' ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' :
                            v.status === 'Pending HOD' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-slate-50 text-slate-600 border-slate-200';
                          
                          return (
                            <tr key={v._id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3.5 px-4 font-mono text-slate-700">{v.courseId?.code || '—'}</td>
                              <td className="py-3.5 px-4 font-semibold text-slate-800">{v.courseId?.title || '—'}</td>
                              <td className="py-3.5 px-4 font-normal text-slate-500">{v.courseId?.departmentId?.code || 'CSE'}</td>
                              <td className="py-3.5 px-2 font-mono text-slate-600">{v.semester || '—'}</td>
                              <td className="py-3.5 px-2 font-mono text-slate-600">{v.regulationId?.code || '—'}</td>
                              <td className="py-3.5 px-4 font-normal text-slate-500 font-mono">{v.assignedDate || '2026-05-12'}</td>
                              <td className="py-3.5 px-4 font-semibold text-red-650 font-mono">{v.deadline || '2026-06-25'}</td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusClass}`}>
                                  {v.status === 'Pending HOD' ? 'Under Review' : v.status === 'Returned' ? 'Returned' : v.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Column: Pending Tasks & Timeline Checklist */}
                <div className="space-y-6">
                  
                  {/* Pending Tasks Panel */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                      <span>Pending Tasks Report</span>
                    </h2>
                    
                    <div className="space-y-4">
                      {assignedVersions.map((v) => {
                        const progress = calculateCourseProgress(v);
                        return (
                          <div key={v._id} className="border border-slate-100 rounded-xl p-3.5 space-y-2.5 bg-slate-50/50 hover:border-slate-250 transition-all">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 font-mono">{v.courseId?.code}</h4>
                                <p className="text-[11px] font-semibold text-slate-500 truncate w-[140px] sm:w-[200px]">{v.courseId?.title}</p>
                              </div>
                              <span className="text-xs font-bold text-slate-700 font-mono">{progress.percent}%</span>
                            </div>
                            
                            {/* Small progress bar */}
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${progress.percent === 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                style={{ width: `${progress.percent}%` }}
                              ></div>
                            </div>
                            
                            {/* Checklist tags */}
                            <div className="grid grid-cols-2 gap-1.5 text-[9px] pt-1">
                              {progress.tasks.map((task, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                  {task.completed ? (
                                    <span className="text-green-600 font-bold">✓</span>
                                  ) : (
                                    <span className="text-red-500 font-bold">✗</span>
                                  )}
                                  <span className={`font-semibold ${task.completed ? 'text-slate-600' : 'text-slate-400 font-normal'}`}>{task.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Course Completion Timeline */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span>Activity Log Timeline</span>
                    </h2>
                    
                    <div className="relative border-l border-slate-250 pl-5 ml-2.5 py-1 space-y-5">
                      {(() => {
                        const hasApproved = assignedVersions.some(v => v.status === 'Approved');
                        const hasReturned = assignedVersions.some(v => v.status === 'Returned');
                        const hasPending = assignedVersions.some(v => v.status === 'Pending HOD');
                        
                        const timelineItems = [
                          { title: 'Course Coordinator Assigned', desc: 'Assigned to coordinate syllabus profiles.', time: 'May 10', done: true }
                        ];
                        
                        if (hasApproved) {
                          timelineItems.push({ title: 'CO-PO Mappings Mapped', desc: 'CS302 outcome matrices configured.', time: 'May 30', done: true });
                          timelineItems.push({ title: 'CS302 Approved Successfully', desc: 'Computer Networks finalized by HOD.', time: 'Jun 01', done: true });
                        }
                        if (hasReturned) {
                          timelineItems.push({ title: 'CS301 Submitted to HOD', desc: 'Syllabus sent for validation review.', time: 'Jun 02', done: true });
                          timelineItems.push({ title: 'HOD Returned CS301', desc: 'Refine Bloom taxonomy levels in CO3.', time: 'Jun 03', done: false });
                        }
                        if (hasPending) {
                          timelineItems.push({ title: 'CS303 Submitted to HOD', desc: 'Operating Systems sent for approval.', time: 'Jun 04', done: true });
                        }
                        
                        // Sort by chronological reverse order for timeline feel
                        return timelineItems.reverse().map((item, idx) => (
                          <div key={idx} className="relative">
                            {/* Dot indicator */}
                            <span className={`absolute -left-[25.5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${item.done ? 'bg-blue-600 shadow-[0_0_0_2px_rgba(37,99,235,0.25)]' : 'bg-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.25)]'}`}></span>
                            <div className="flex justify-between items-start text-[11px] leading-tight">
                              <div>
                                <h4 className="font-bold text-slate-800">{item.title}</h4>
                                <p className="text-slate-400 font-semibold mt-0.5">{item.desc}</p>
                              </div>
                              <span className="font-mono text-slate-400 text-[9px] font-semibold whitespace-nowrap">{item.time}</span>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* ========================================================== */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Success banner */}
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

              {/* Coordinator Info Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-850">Coordinator Information</h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Professional details and coordinator settings.</p>
                  </div>
                  <div>
                    {!isEditingProfile ? (
                      <button 
                        onClick={() => setIsEditingProfile(true)}
                        className="flex items-center gap-1 px-4 py-2 bg-blue-650 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer font-sans"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Edit Profile</span>
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setIsEditingProfile(false);
                            setShowProfileSuccess(true);
                            setProfileSuccess(true);
                            setTimeout(() => { setShowProfileSuccess(false); setProfileSuccess(false); }, 4000);
                          }}
                          className="px-4 py-2 bg-blue-650 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer font-sans"
                        >
                          Save Changes
                        </button>
                        <button 
                          onClick={() => {
                            setIsEditingProfile(false);
                            setPhoneVal('+91 9876543212');
                            setAltEmailVal('anusha.alt@aditya.edu.in');
                            setProfileImageVal('');
                          }}
                          className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer font-sans"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
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
                      <strong className="text-slate-800 font-bold text-xs mt-0.5 block">Course Coordinator</strong>
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
                      <strong className="text-slate-800 font-mono text-xs mt-0.5 block">FAC-1024</strong>
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
                      {isEditingProfile ? (
                        <input 
                          type="text" 
                          value={phoneVal} 
                          onChange={(e) => setPhoneVal(e.target.value)} 
                          className="border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none mt-1 bg-white" 
                        />
                      ) : (
                        <strong className="text-slate-800 font-mono text-xs mt-0.5 block">{phoneVal}</strong>
                      )}
                    </div>
                  </div>

                  {/* Alternate Email */}
                  <div className="flex items-center gap-3 col-span-1">
                    <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Alternate Email</span>
                      {isEditingProfile ? (
                        <input 
                          type="text" 
                          value={altEmailVal} 
                          onChange={(e) => setAltEmailVal(e.target.value)} 
                          className="border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none mt-1 bg-white w-full max-w-[220px]" 
                        />
                      ) : (
                        <strong className="text-slate-855 font-mono text-xs mt-0.5 block truncate">{altEmailVal}</strong>
                      )}
                    </div>
                  </div>

                  {/* Profile Image */}
                  <div className="flex items-center gap-3 col-span-1">
                    <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {profileImageVal ? (
                        <img src={profileImageVal} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4.5 h-4.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Profile Image</span>
                      {isEditingProfile ? (
                        <input 
                          type="text" 
                          value={profileImageVal} 
                          onChange={(e) => setProfileImageVal(e.target.value)} 
                          placeholder="Image URL..." 
                          className="border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none mt-1 bg-white w-full max-w-[220px]" 
                        />
                      ) : (
                        <strong className="text-slate-800 font-mono text-xs mt-0.5 block truncate">{profileImageVal ? 'Custom Image Set' : 'Default Initials'}</strong>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Preferences Section */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-855">Preferences</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Customize your Coordinator experience.</p>
                </div>

                <div className="divide-y divide-slate-100">
                  
                  {/* Toggle 1 */}
                  <div className="py-4 first:pt-0 flex justify-between items-center text-xs">
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-slate-800">Faculty Submission Notifications</h4>
                      <p className="text-slate-500 font-medium">Receive alerts when assigned faculty update course material drafts</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={facultySubNotif} 
                        onChange={(e) => setFacultySubNotif(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-255 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Toggle 2 */}
                  <div className="py-4 flex justify-between items-center text-xs">
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-slate-800">Course File Updates</h4>
                      <p className="text-slate-500 font-medium">Get notifications about course credit and syllabus modifications</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={courseFileUpdates} 
                        onChange={(e) => setCourseFileUpdates(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-255 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Toggle 3 */}
                  <div className="py-4 flex justify-between items-center text-xs">
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-slate-800">HOD Review Notifications</h4>
                      <p className="text-slate-500 font-medium">Get notified when HOD approves or returns course syllabus files</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={hodReviewNotif} 
                        onChange={(e) => setHodReviewNotif(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-255 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Toggle 4 */}
                  <div className="py-4 last:pb-0 flex justify-between items-center text-xs">
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-slate-800">Curriculum Modification Alerts</h4>
                      <p className="text-slate-500 font-medium">Receive alerts for regulation mapping deadline schedule updates</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={curriculumModAlerts} 
                        onChange={(e) => setCurriculumModAlerts(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-255 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
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

        {/* RIGHT LIVE SYLLABUS DOCUMENT PREVIEW CONTAINER (COLLAPSIBLE SIDE-BY-SIDE SPLIT) */}
        {activeTab !== 'dashboard' && activeTab !== 'my-courses' && activeTab !== 'profile' && activeTab !== 'reports' && activeTab !== 'work-progress' && activeTab !== 'preview' && activeVersion && previewOpen && (
          <div className="col-span-5 bg-slate-300 border border-slate-300 rounded-xl shadow-premium overflow-hidden flex flex-col h-[750px] no-print animate-fadeIn sticky top-6">
            
            {/* Preview Toolbar */}
            <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-200 flex justify-between items-center flex-shrink-0">
              <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-wider">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Live Document Preview</span>
              </span>
            </div>

            {/* Document PDF Render Body — A4 Academic Style */}
            <div className="flex-1 overflow-y-auto bg-slate-400 p-4">
              {renderAccreditationDocumentPreview()}
            </div>
          </div>
        )}

      </div>

      {/* ============================================================== */}
      {/* 3. STICKY BOTTOM ACTIONS CONTROL BAR */}
      {/* ============================================================== */}
      {activeVersion && (
        <div className="bg-white p-4 border-t border-slate-200 shadow-premium flex items-center justify-between no-print sticky bottom-0 z-10 rounded-t-2xl animate-fadeIn">
          <button
            onClick={() => setActiveTab('my-courses')}
            className="px-5 py-2.5 border border-slate-350 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-extrabold uppercase transition-all cursor-pointer"
          >
            Cancel
          </button>
          
          <div className="flex gap-2">
            {activeVersion.status !== 'Pending HOD' && activeVersion.status !== 'Approved' && (
              <>
                <button
                  onClick={handleSaveDraft}
                  className="px-5 py-2.5 border border-slate-350 bg-slate-50 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-extrabold uppercase transition-all cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  onClick={() => {
                    handleSaveDraft();
                    // Go to next logical tab
                    const tabsOrder = [
                      'course-details', 'cos', 'co-po', 'co-pso', 
                      'syllabus', 'reports'
                    ];
                    const currentIdx = tabsOrder.indexOf(activeTab);
                    if (currentIdx !== -1 && currentIdx < tabsOrder.length - 1) {
                      setActiveTab(tabsOrder[currentIdx + 1]);
                    }
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-extrabold uppercase transition-all shadow cursor-pointer"
                >
                  Save & Next
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MODALS & POPUPS */}
      {/* ============================================================== */}

      {/* View HOD Remarks Modal */}
      {selectedRemarks && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn no-print">
          <div className="bg-white w-[500px] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5 text-red-600 animate-bounce" />
                <span>HOD Remarks / Return Feedback</span>
              </h3>
              <button onClick={() => setSelectedRemarks(null)} className="text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Your syllabus submission was returned for adjustments by the Head of Department with the following remarks feedback:
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-bold text-red-800 font-mono leading-relaxed">
                "{selectedRemarks}"
              </div>
              <div className="flex pt-2">
                <button 
                  onClick={() => setSelectedRemarks(null)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase transition-all text-center"
                >
                  Close & Acknowledge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submission Failed Modal */}
      {validationFailedModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn no-print">
          <div className="bg-white w-[550px] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-red-50">
              <h3 className="text-base font-bold text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
                <span>Submission Failed</span>
              </h3>
              <button 
                onClick={() => setValidationFailedModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 text-lg font-bold outline-none"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-605 font-bold leading-relaxed">
                The course syllabus cannot be submitted to the HOD because it does not meet all the Outcome-Based Education (OBE) compliance rules. Please resolve the following missing requirements:
              </p>
              
              <div className="max-h-[250px] overflow-y-auto border border-red-105 bg-red-50/20 rounded-xl p-4 space-y-2">
                {validationErrors.map((err, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-red-800 font-bold font-sans">
                    <span className="text-red-600 font-extrabold text-sm leading-none">✗</span>
                    <span className="leading-normal">{err}</span>
                  </div>
                ))}
              </div>

              <div className="flex pt-2">
                <button 
                  onClick={() => setValidationFailedModalOpen(false)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase transition-all text-center tracking-wider shadow cursor-pointer"
                >
                  Go Fix Issues
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// export default HodSyllabusEditor;
