import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  BarChart3,
  BookOpen,
  Check,
  Clock,
  Download,
  Edit3,
  Eye,
  FileDown,
  FileText,
  Maximize2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { api } from '../../../services/api';
import { useContextStore } from '../../../store/contextStore';
import { RichTextEditor } from '../../../components/common/RichTextEditor';
import { HighFidelityPdfTemplate } from './HighFidelityPdfTemplate';

type CurriculumStatus = 'Draft' | 'Published' | 'Archived';

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://127.0.0.1:5000';

const getBookFilePath = (book: any) => book?.filePath || book?.uploadedFile || '';
const getBookFileUrl = (book: any) => {
  const filePath = getBookFilePath(book);
  if (!filePath) return '';
  if (/^https?:\/\//i.test(filePath)) return filePath;
  return `${API_ORIGIN}${filePath}`;
};

const getSectionHtml = (section: any) => (
  section?.sectionContent?.html
  || section?.sectionContent?.htmlContent
  || section?.sectionContent?.body
  || ''
);

export const CurriculumBookManager = () => {
  const [activeTab, setActiveTab] = useState('library');
  const [books, setBooks] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfZoom, setPdfZoom] = useState(100);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { selectedDepartment } = useContextStore();

  const [uploadData, setUploadData] = useState({
    title: '',
    regulation: 'R24',
    academicYear: '2024-2025',
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (selectedDepartment?._id) {
      fetchBooks();
    }
  }, [selectedDepartment?._id]);

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const res = await api.curriculumBooks.list({ departmentId: selectedDepartment?._id });
      const nextBooks = res.curriculumBooks || [];
      setBooks(nextBooks);
      if (nextBooks.length > 0) {
        await handleSelectBook(nextBooks[0]._id);
      } else {
        setSelectedBook(null);
        setSections([]);
        setVersions([]);
      }
    } catch (err) {
      console.error('Failed to fetch curriculum books', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBook = async (id: string) => {
    try {
      setLoading(true);
      const [bookRes, versionRes] = await Promise.all([
        api.curriculumBooks.get(id),
        api.curriculumBooks.versionHistory(id),
      ]);
      setSelectedBook(bookRes.curriculumBook);
      setSections(bookRes.sections || []);
      setVersions(versionRes.versions || []);
      setGeneratedUrl('');
      setPdfPage(1);
      setPdfZoom(100);
      // Load credit summary in the background
      setTimeout(() => fetchCreditSummary(bookRes.curriculumBook), 0);
    } catch (err) {
      console.error('Failed to fetch curriculum book details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !selectedDepartment?._id) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('curriculumFile', file);
      formData.append('departmentId', selectedDepartment._id);
      formData.append('title', uploadData.title);
      formData.append('regulation', uploadData.regulation);
      formData.append('academicYear', uploadData.academicYear);

      const res = await api.curriculumBooks.upload(formData);
      setFile(null);
      setUploadData({ title: '', regulation: 'R24', academicYear: '2024-2025' });
      await fetchBooks();
      if (res.curriculumBook?._id) {
        await handleSelectBook(res.curriculumBook._id);
        setActiveTab('edit');
      }
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBook = async () => {
    if (!selectedBook) return;
    try {
      setLoading(true);
      const res = await api.curriculumBooks.update(selectedBook._id, { sections });
      setSelectedBook(res.curriculumBook);
      setSections(res.sections || sections);
      await handleSelectBook(selectedBook._id);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!selectedBook) return;
    try {
      setLoading(true);
      await api.curriculumBooks.createVersion({
        curriculumBookId: selectedBook._id,
        changeSummary: 'Manual HOD snapshot',
      });
      await handleSelectBook(selectedBook._id);
    } catch (err: any) {
      alert(`Version creation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: CurriculumStatus) => {
    if (!selectedBook) return;
    try {
      setLoading(true);
      await api.curriculumBooks.updateStatus(selectedBook._id, status);
      await handleSelectBook(selectedBook._id);
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!selectedBook) return;
    const confirmed = window.confirm('Restore this version as a new draft version?');
    if (!confirmed) return;
    try {
      setLoading(true);
      await api.curriculumBooks.restoreVersion(selectedBook._id, versionId);
      await handleSelectBook(selectedBook._id);
      setActiveTab('edit');
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const [creditSummary, setCreditSummary] = useState<any>(null);
  const [creditLoading, setCreditLoading] = useState(false);

  const fetchCreditSummary = async (book: any) => {
    if (!book || !selectedDepartment?._id) return;
    try {
      setCreditLoading(true);
      // Find regulation ID
      const regCode = book.regulation;
      const regRes = await api.regulations.list();
      const reg = (regRes.regulations || []).find((r: any) => r.code === regCode);
      if (!reg?._id) return;
      const res = await api.curriculumBooks.creditSummary({
        regulationId: reg._id,
        departmentId: selectedDepartment._id
      });
      setCreditSummary(res);
    } catch (err) {
      console.error('Credit summary failed:', err);
    } finally {
      setCreditLoading(false);
    }
  };

  const handleExportPdf = async () => {
    if (!selectedBook) return;
    try {
      setLoading(true);
      await handleSaveBook();
      const res = await api.curriculumBooks.exportPdf({ curriculumBookId: selectedBook._id });
      const url = res.url ? `${API_ORIGIN}${res.url}` : '';
      setGeneratedUrl(url);
      if (res.html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(res.html);
          printWindow.document.close();
          printWindow.focus();
        }
      }
    } catch (err: any) {
      alert(`PDF generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSectionHtmlChange = (index: number, html: string) => {
    const updated = [...sections];
    updated[index] = {
      ...updated[index],
      sectionContent: {
        ...(updated[index].sectionContent || {}),
        html,
      },
    };
    setSections(updated);
  };

  const handleProgramInfoChange = (index: number, field: 'vision' | 'mission', html: string) => {
    const updated = [...sections];
    updated[index] = {
      ...updated[index],
      sectionContent: {
        ...(updated[index].sectionContent || {}),
        [field]: html,
      },
    };
    setSections(updated);
  };

  const handleAddSection = () => {
    setSections(prev => [
      ...prev,
      {
        sectionType: 'Custom',
        sectionTitle: `Section ${prev.length + 1}`,
        sectionContent: { html: '' },
        orderNumber: prev.length + 1,
      },
    ]);
  };

  const handleRemoveSection = (index: number) => {
    setSections(prev => prev.filter((_, idx) => idx !== index).map((section, idx) => ({
      ...section,
      orderNumber: idx + 1,
    })));
  };

  const fileUrl = getBookFileUrl(selectedBook);
  const isPdf = selectedBook?.fileType === 'PDF' || /\.pdf($|\?)/i.test(fileUrl);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[800px]">
      <div className="border-b border-slate-200 p-6 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 bg-slate-50">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Curriculum Book Management</h2>
          <p className="text-sm text-slate-500">Upload, edit, version, publish, archive, and generate official curriculum books.</p>
        </div>
        {selectedBook && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium min-w-[260px]"
              value={selectedBook._id}
              onChange={(event) => handleSelectBook(event.target.value)}
            >
              {books.map(book => (
                <option key={book._id} value={book._id}>{book.title} ({book.regulation}) - v{book.currentVersion}</option>
              ))}
            </select>
            <button onClick={handleSaveBook} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
              <Save className="w-4 h-4" /> Save Draft
            </button>
            <button onClick={handleCreateVersion} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
              <Check className="w-4 h-4" /> Snapshot
            </button>
            <button onClick={() => handleStatusChange('Published')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
              <FileDown className="w-4 h-4" /> Publish
            </button>
            <button onClick={() => handleStatusChange('Archived')} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
              <Archive className="w-4 h-4" /> Archive
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap border-b border-slate-200">
        {[
          { id: 'library', icon: BookOpen, label: 'Library' },
          { id: 'upload', icon: Upload, label: 'Upload' },
          { id: 'view', icon: Eye, label: 'View File' },
          { id: 'edit', icon: Edit3, label: 'Edit Content' },
          { id: 'versions', icon: Clock, label: 'Versions' },
          { id: 'preview', icon: FileText, label: 'Generate PDF' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-6 bg-slate-50/30 overflow-y-auto">
        {loading && <div className="text-center py-10 font-medium text-slate-500">Loading curriculum data...</div>}

        {!loading && activeTab === 'library' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {books.map(book => (
              <button
                type="button"
                key={book._id}
                onClick={() => {
                  handleSelectBook(book._id);
                  setActiveTab('edit');
                }}
                className={`text-left bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition-all ${selectedBook?._id === book._id ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">{book.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{book.regulation} - AY {book.academicYear}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${book.status === 'Published' ? 'bg-emerald-50 text-emerald-700' : book.status === 'Archived' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                    {book.status}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                    <span className="block text-slate-400 font-bold uppercase text-[10px]">Version</span>
                    <strong className="text-slate-800">v{book.currentVersion}</strong>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                    <span className="block text-slate-400 font-bold uppercase text-[10px]">Format</span>
                    <strong className="text-slate-800">{book.fileType || 'PDF'}</strong>
                  </div>
                </div>
                <p className="mt-3 text-[11px] font-semibold text-slate-500 truncate">{book.originalFileName || getBookFilePath(book)}</p>
              </button>
            ))}
            {books.length === 0 && (
              <div className="xl:col-span-3 bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
                <BookOpen className="w-8 h-8 mx-auto text-slate-400" />
                <p className="mt-3 text-sm font-bold text-slate-600">No curriculum books uploaded yet.</p>
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800">Upload Curriculum Book</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Book Title</label>
                <input required type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm" value={uploadData.title} onChange={event => setUploadData({ ...uploadData, title: event.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Regulation</label>
                  <input required type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm" value={uploadData.regulation} onChange={event => setUploadData({ ...uploadData, regulation: event.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Academic Year</label>
                  <input required type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm" value={uploadData.academicYear} onChange={event => setUploadData({ ...uploadData, academicYear: event.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">PDF or DOCX File</label>
                <input required type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm" onChange={event => setFile(event.target.files?.[0] || null)} />
              </div>
              <button type="submit" disabled={!file} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm disabled:opacity-50 transition-colors">
                Upload & Open Editor
              </button>
            </form>
          </div>
        )}

        {!loading && activeTab === 'view' && selectedBook && (
          <div className="h-full bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap gap-2 justify-between items-center">
              <span className="text-sm font-bold text-slate-700">{selectedBook.originalFileName || 'Uploaded curriculum file'}</span>
              <div className="flex items-center gap-2">
                {isPdf && (
                  <>
                    <button onClick={() => setPdfPage(Math.max(1, pdfPage - 1))} className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-bold">Prev</button>
                    <input type="number" min={1} value={pdfPage} onChange={event => setPdfPage(Math.max(1, Number(event.target.value) || 1))} className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-bold text-center" />
                    <button onClick={() => setPdfPage(pdfPage + 1)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-bold">Next</button>
                    <button onClick={() => setPdfZoom(Math.max(50, pdfZoom - 10))} className="h-8 w-8 inline-flex items-center justify-center bg-white border border-slate-200 rounded-md"><ZoomOut className="w-4 h-4" /></button>
                    <button onClick={() => setPdfZoom(Math.min(200, pdfZoom + 10))} className="h-8 w-8 inline-flex items-center justify-center bg-white border border-slate-200 rounded-md"><ZoomIn className="w-4 h-4" /></button>
                    <button onClick={() => iframeRef.current?.requestFullscreen()} className="h-8 w-8 inline-flex items-center justify-center bg-white border border-slate-200 rounded-md"><Maximize2 className="w-4 h-4" /></button>
                    <Search className="w-4 h-4 text-slate-500" />
                  </>
                )}
                <a href={fileUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:underline bg-white border border-slate-200 rounded-md">Open</a>
              </div>
            </div>
            {isPdf ? (
              <iframe
                ref={iframeRef}
                src={`${fileUrl}#page=${pdfPage}&zoom=${pdfZoom}`}
                className="flex-1 w-full h-[650px]"
                title="Curriculum PDF Viewer"
              />
            ) : (
              <div className="p-10 text-center">
                <FileText className="w-10 h-10 mx-auto text-slate-400" />
                <p className="mt-3 text-sm font-bold text-slate-700">DOCX uploaded and stored with version metadata.</p>
                <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex mt-4 items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">
                  <Download className="w-4 h-4" /> Download File
                </a>
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'edit' && selectedBook && (
          <div className="max-w-4xl mx-auto space-y-8 pb-20">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-4 z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{selectedBook.title}</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">{selectedBook.regulation} - AY {selectedBook.academicYear} - v{selectedBook.currentVersion}</p>
              </div>
              <button onClick={handleAddSection} className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                <Plus className="w-4 h-4" /> Add Page / Section
              </button>
            </div>
            {sections.map((section, index) => (
              <div key={section._id || index} className="bg-white mx-auto rounded-sm border border-slate-300 shadow-[0_10px_40px_rgba(0,0,0,0.1)] relative" style={{ width: '100%', maxWidth: '210mm', minHeight: '297mm', padding: '20mm 15mm' }}>
                {/* A4 Watermark Simulation for Preview mode */}
                {editingSectionIndex !== index && (
                  <div className="absolute inset-0 grid place-items-center pointer-events-none overflow-hidden opacity-5 z-0">
                    <div className="transform -rotate-45 text-6xl font-bold font-serif whitespace-nowrap">ADITYA UNIVERSITY</div>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-4">
                  <input
                    value={section.sectionTitle || ''}
                    onChange={event => {
                      const updated = [...sections];
                      updated[index] = { ...updated[index], sectionTitle: event.target.value };
                      setSections(updated);
                    }}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-800"
                  />
                  <button 
                    onClick={() => setEditingSectionIndex(editingSectionIndex === index ? null : index)} 
                    className={`h-9 px-3 inline-flex items-center justify-center rounded-lg border text-sm font-bold transition-colors ${editingSectionIndex === index ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {editingSectionIndex === index ? <><Check className="w-4 h-4 mr-1.5" /> Done Editing</> : <><Edit3 className="w-4 h-4 mr-1.5" /> Edit Section</>}
                  </button>
                  <button onClick={() => handleRemoveSection(index)} className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {editingSectionIndex === index ? (
                  section.sectionType === 'ProgramInfo' ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Vision</label>
                        <RichTextEditor value={section.sectionContent?.vision || ''} minHeight={180} onChange={html => handleProgramInfoChange(index, 'vision', html)} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Mission</label>
                        <RichTextEditor value={section.sectionContent?.mission || ''} minHeight={180} onChange={html => handleProgramInfoChange(index, 'mission', html)} />
                      </div>
                    </div>
                  ) : (
                    <RichTextEditor value={getSectionHtml(section)} minHeight={280} onChange={html => handleSectionHtmlChange(index, html)} />
                  )
                ) : (
                  <div className="relative z-10 w-full font-serif">
                    {section.sectionType === 'ProgramInfo' ? (
                      <div className="space-y-6 text-slate-800">
                        <div>
                          <h4 className="text-sm font-bold text-slate-600 uppercase mb-2 border-b border-slate-200 pb-1">Vision</h4>
                          <div className="prose prose-slate max-w-none prose-p:text-justify prose-p:leading-relaxed" dangerouslySetInnerHTML={{ __html: section.sectionContent?.vision || '<p class="text-slate-400 italic">No vision defined.</p>' }} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-600 uppercase mb-2 border-b border-slate-200 pb-1">Mission</h4>
                          <div className="prose prose-slate max-w-none prose-p:text-justify prose-p:leading-relaxed" dangerouslySetInnerHTML={{ __html: section.sectionContent?.mission || '<p class="text-slate-400 italic">No mission defined.</p>' }} />
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-slate max-w-none prose-p:text-justify prose-p:leading-relaxed prose-headings:font-bold prose-a:text-blue-600" dangerouslySetInnerHTML={{ __html: getSectionHtml(section) || '<p class="text-slate-400 italic">Empty section content.</p>' }} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && activeTab === 'versions' && selectedBook && (
          <div className="max-w-4xl mx-auto space-y-4">
            {versions.map(version => (
              <div key={version._id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Version {version.versionNumber}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{version.changeSummary || 'Saved version'} - {new Date(version.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Edited by {version.editedBy?.name || version.modifiedBy?.name || 'System'}</p>
                </div>
                <button onClick={() => handleRestoreVersion(version._id)} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Restore
                </button>
              </div>
            ))}
            {versions.length === 0 && <p className="text-sm text-slate-500 text-center py-10">No versions created yet.</p>}
          </div>
        )}

        {!loading && activeTab === 'preview' && selectedBook && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Generate & Preview Curriculum Book PDF</h3>
                <p className="text-xs text-slate-500 mt-1">Pixel-perfect A4 layout matching the official university curriculum format.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={handleExportPdf} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50">
                  <FileDown className="w-4 h-4" /> Generate PDF (Puppeteer)
                </button>
                {generatedUrl && (
                  <a href={generatedUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">
                    ⬇ Download PDF
                  </a>
                )}
              </div>
            </div>

            {/* Credit Division Summary Panel */}
            {creditSummary && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800 text-sm">Credit Division Summary — Live from Database</h3>
                  <span className="ml-auto px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                    Total: {creditSummary.grandTotal} Credits
                  </span>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="text-left px-3 py-2 font-bold border border-slate-200">Category</th>
                        <th className="text-center px-3 py-2 font-bold border border-slate-200">Credits (DB)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(creditSummary.categoryTotals || {}).map(([cat, credits]: [string, any]) => (
                        <tr key={cat} className="hover:bg-slate-50">
                          <td className="px-3 py-2 border border-slate-200 font-semibold">{cat}</td>
                          <td className="px-3 py-2 border border-slate-200 text-center font-bold text-blue-700">{credits}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold">
                        <td className="px-3 py-2 border border-slate-200">Total</td>
                        <td className="px-3 py-2 border border-slate-200 text-center text-emerald-700">{creditSummary.grandTotal}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="rounded-lg bg-blue-50 p-2 border border-blue-100">
                    <p className="font-black text-blue-700">{creditSummary.fcCount}</p>
                    <p className="text-blue-500 font-semibold">Foundation Courses (FC)</p>
                    <p className="text-blue-600 font-bold">{creditSummary.fcCredits} credits</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2 border border-emerald-100">
                    <p className="font-black text-emerald-700">{creditSummary.icCount}</p>
                    <p className="text-emerald-500 font-semibold">Intermediate Courses (IC)</p>
                    <p className="text-emerald-600 font-bold">{creditSummary.icCredits} credits</p>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-2 border border-purple-100">
                    <p className="font-black text-purple-700">{creditSummary.acCount}</p>
                    <p className="text-purple-500 font-semibold">Advanced Courses (AC)</p>
                    <p className="text-purple-600 font-bold">{creditSummary.acCredits} credits</p>
                  </div>
                </div>
              </div>
            )}
            {creditLoading && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-center text-sm text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin inline mr-2" /> Loading credit summary...
              </div>
            )}

            <HighFidelityPdfTemplate book={selectedBook} sections={sections} />
          </div>
        )}
      </div>
    </div>
  );
};

export default CurriculumBookManager;
