import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileImage,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { ApiError, extractRecordWithAi, uploadRecord } from '../api';
import type {
  AllergyMention,
  ExtractedFact,
  MedicalRecord,
  RecordCategory,
} from '../types';

interface UploadRecordScreenProps {
  aiConfigured: boolean;
  onUploaded: (record: MedicalRecord) => void;
  onGoTimeline: () => void;
}

const CATEGORIES: RecordCategory[] = [
  'Lab Report',
  'Consultation',
  'Prescription',
  'Imaging',
  'Discharge Summary',
  'Allergy & Immunization',
];

const KNOWN_HOSPITALS = [
  'CityCare Hospital',
  'Sunrise Medical Center',
  'Metro Health Clinic',
];

const HOSPITAL_OPTIONS = [...KNOWN_HOSPITALS, 'Other Clinic / Lab'];

function matchHospitalName(rawHospital: string): {
  selected: string;
  custom: string;
} {
  const normalized = rawHospital.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return { selected: 'Other Clinic / Lab', custom: '' };

  if (normalized.includes('citycare') || normalized.includes('city care')) {
    return { selected: 'CityCare Hospital', custom: '' };
  }
  if (normalized.includes('sunrise')) {
    return { selected: 'Sunrise Medical Center', custom: '' };
  }
  if (normalized.includes('metro health') || normalized.includes('metro clinic')) {
    return { selected: 'Metro Health Clinic', custom: '' };
  }
  return { selected: 'Other Clinic / Lab', custom: rawHospital.trim() };
}

export const UploadRecordScreen: React.FC<UploadRecordScreenProps> = ({
  aiConfigured,
  onUploaded,
  onGoTimeline,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RecordCategory>('Lab Report');
  const [hospital, setHospital] = useState('CityCare Hospital');
  const [customHospital, setCustomHospital] = useState('');
  const [clinician, setClinician] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState('');
  const [facts, setFacts] = useState<ExtractedFact[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<AllergyMention[]>([]);

  const [extracting, setExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<
    'Manual Entry' | 'Extracted — Review Required' | 'Verified by Patient'
  >('Manual Entry');
  const [extractionNotes, setExtractionNotes] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [downloadingSample, setDownloadingSample] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedRecord, setSavedRecord] = useState<MedicalRecord | null>(null);

  useEffect(() => {
    if (!file) {
      setLocalPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleFileChange = (selected: File | null) => {
    setSavedRecord(null);
    setSubmitError(null);
    setAiError(null);
    if (!selected) return;

    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];
    let normalizedFile = selected;
    if (!selected.type || selected.type === 'application/octet-stream') {
      const lower = selected.name.toLowerCase();
      const inferredType = lower.endsWith('.pdf')
        ? 'application/pdf'
        : lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
        ? 'image/jpeg'
        : lower.endsWith('.webp')
        ? 'image/webp'
        : '';
      if (inferredType) {
        normalizedFile = new File([selected], selected.name, { type: inferredType });
      }
    }

    if (!allowed.includes(normalizedFile.type)) {
      setSubmitError('Unsupported file format. Please select a PDF, PNG, JPEG, or WebP file.');
      return;
    }
    if (normalizedFile.size > 10 * 1024 * 1024) {
      setSubmitError('File exceeds 10 MB upload limit.');
      return;
    }
    setFile(normalizedFile);
    if (!title) {
      const cleanName = normalizedFile.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      setTitle(cleanName);
    }
  };

  const handleAnalyzeWithAi = async () => {
    if (!file) return;
    setExtracting(true);
    setAiError(null);
    try {
      const { draft } = await extractRecordWithAi(file);
      setTitle(draft.title);
      setCategory(draft.category);
      const matched = matchHospitalName(draft.hospital);
      setHospital(matched.selected);
      setCustomHospital(matched.custom);
      setClinician(draft.clinician);
      setDate(draft.date);
      setSummary(draft.summary);
      setFacts(Array.isArray(draft.facts) ? draft.facts : []);
      setMedications(Array.isArray(draft.medications) ? draft.medications : []);
      setAllergies(Array.isArray(draft.allergiesMentioned) ? draft.allergiesMentioned : []);
      setExtractionNotes(draft.extractionNotes);
      setExtractionStatus('Extracted — Review Required');
    } catch (err) {
      if (err instanceof ApiError) {
        setAiError(err.message);
      } else {
        setAiError('AI extraction could not be completed. You can enter the details manually.');
      }
    } finally {
      setExtracting(false);
    }
  };

  const handleDownloadSamplePdf = async () => {
    setSubmitError(null);
    setDownloadingSample(true);
    try {
      const res = await fetch('/api/demo/sample-pdf');
      if (!res.ok) throw new Error('Could not fetch sample PDF.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Ananya_Sharma_Sample_Lab_Report.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setSubmitError('Unable to download sample test PDF.');
    } finally {
      setDownloadingSample(false);
    }
  };

  const handleAttachSamplePdf = async () => {
    setSubmitError(null);
    try {
      const res = await fetch('/api/demo/sample-pdf');
      if (!res.ok) throw new Error('Could not fetch sample PDF.');
      const blob = await res.blob();
      const sampleFile = new File([blob], 'Ananya_Sharma_Sample_Lab_Report.pdf', {
        type: 'application/pdf',
      });
      handleFileChange(sampleFile);
    } catch {
      setSubmitError('Unable to load sample test PDF.');
    }
  };

  const addEmptyFact = () => {
    setFacts((prev) => [...prev, { label: '', value: '', unit: '', flag: 'normal' }]);
  };

  const updateFact = (idx: number, patch: Partial<ExtractedFact>) => {
    setFacts((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeFact = (idx: number) => {
    setFacts((prev) => prev.filter((_, i) => i !== idx));
  };

  const addMedication = () => {
    setMedications((prev) => [...prev, '']);
  };

  const updateMedication = (idx: number, val: string) => {
    setMedications((prev) => prev.map((m, i) => (i === idx ? val : m)));
  };

  const removeMedication = (idx: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== idx));
  };

  const addAllergy = () => {
    setAllergies((prev) => [...prev, { substance: '', severity: 'Mild', reaction: '' }]);
  };

  const updateAllergy = (idx: number, patch: Partial<AllergyMention>) => {
    setAllergies((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const removeAllergy = (idx: number) => {
    setAllergies((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!file) {
      setSubmitError('Please attach a PDF or image document to upload to private storage.');
      return;
    }
    const resolvedHospital = hospital === 'Other Clinic / Lab' ? customHospital.trim() : hospital;
    if (!title.trim() || !resolvedHospital || !date || !summary.trim()) {
      setSubmitError('Please complete title, hospital, date, and clinical summary.');
      return;
    }

    const cleanMedications = medications.map((m) => m.trim()).filter(Boolean);
    const cleanAllergies = allergies
      .filter((a) => a.substance.trim())
      .map((a) => ({
        substance: a.substance.trim(),
        severity: a.severity,
        reaction: a.reaction.trim() || 'Reported in uploaded record',
      }));
    const validFacts = facts.filter((f) => f.label.trim() && f.value.trim());

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title.trim());
    formData.append('category', category);
    formData.append('hospital', resolvedHospital);
    formData.append('clinician', clinician.trim() || 'Not specified');
    formData.append('date', date);
    formData.append('summary', summary.trim());
    formData.append('factsJson', JSON.stringify(validFacts));
    formData.append('medicationsJson', JSON.stringify(cleanMedications));
    formData.append('allergiesJson', JSON.stringify(cleanAllergies));
    formData.append('extractionStatus', extractionStatus);
    if (extractionNotes.trim()) {
      formData.append('extractionNotes', extractionNotes.trim());
    }

    setSubmitting(true);
    try {
      const { record } = await uploadRecord(formData);
      setSavedRecord(record);
      onUploaded(record);
      setFile(null);
      setTitle('');
      setCustomHospital('');
      setClinician('');
      setSummary('');
      setFacts([]);
      setMedications([]);
      setAllergies([]);
      setExtractionNotes('');
      setExtractionStatus('Manual Entry');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Failed to upload medical record.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Upload Medical Record
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Attach a PDF or image report to your private vault storage. Inspect the original document
          side-by-side with extracted fields and confirm accuracy before saving.
        </p>
      </div>

      {savedRecord && (
        <div className="rounded-xl border border-teal-300 bg-teal-50 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-teal-950 text-sm">
                Saved {savedRecord.id} to Private Storage &amp; Timeline ({savedRecord.extractionStatus})
              </div>
              <p className="text-xs text-teal-800 mt-0.5">
                &ldquo;{savedRecord.title}&rdquo; ({savedRecord.hospital}) is now persisted in your
                vault.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoTimeline}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
          >
            View in Timeline
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Private File Dropzone + Side-by-Side Preview Grid */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                01. Select PDF or Clinical Image
              </h2>
              <span className="text-xs text-slate-500">PDF, PNG, JPEG, WebP · Max 10 MB</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={downloadingSample}
                onClick={() => void handleDownloadSamplePdf()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-teal-700" />
                <span>{downloadingSample ? 'Preparing PDF...' : 'Download Sample PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleAttachSamplePdf()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Use Sample PDF</span>
              </button>
            </div>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileChange(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50/70 hover:bg-slate-50 hover:border-teal-600 transition-colors p-6 text-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
            {file ? (
              <div className="flex flex-col items-center">
                {file.type === 'application/pdf' ? (
                  <FileText className="w-8 h-8 text-teal-700 mb-2" />
                ) : (
                  <FileImage className="w-8 h-8 text-teal-700 mb-2" />
                )}
                <div className="text-sm font-semibold text-slate-900">{file.name}</div>
                <div className="text-xs font-mono text-slate-500 tabular-nums mt-0.5">
                  {file.type} · {Math.max(1, Math.round(file.size / 1024))} KB
                </div>
                <span className="mt-2 text-xs text-teal-700 font-medium">
                  Click or drop another file to replace
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <div className="text-sm font-medium text-slate-800">
                  Drag and drop a medical report here, or click to browse
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Stored privately on the server; accessible only with your consent.
                </p>
              </div>
            )}
          </div>

          {file && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-600">
                {aiConfigured
                  ? 'Optional: Use server-side Gemini extraction to pre-fill fields for side-by-side review.'
                  : 'AI extraction key not configured on server; complete fields manually below.'}
              </div>
              <button
                type="button"
                disabled={extracting || !aiConfigured}
                onClick={handleAnalyzeWithAi}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                {extracting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{extracting ? 'Extracting Document...' : 'Analyze with Gemini AI'}</span>
              </button>
            </div>
          )}

          {aiError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>{aiError}</span>
            </div>
          )}

          {extractionStatus === 'Extracted — Review Required' && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold inline-flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  AI Extracted — Review Required Against Original Document
                </span>
                <button
                  type="button"
                  onClick={() => setExtractionStatus('Verified by Patient')}
                  className="px-3 py-1.5 bg-white border border-amber-400 rounded-lg font-semibold text-amber-950 hover:bg-amber-100 transition-colors"
                >
                  Confirm &amp; Mark Verified
                </button>
              </div>
              {extractionNotes && <p className="text-amber-900">{extractionNotes}</p>}
            </div>
          )}

          {extractionStatus === 'Verified by Patient' && (
            <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs text-teal-900 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                <span>Fields verified by patient against attached primary document.</span>
              </div>
              <button
                type="button"
                onClick={() => setExtractionStatus('Extracted — Review Required')}
                className="text-teal-800 underline font-medium"
              >
                Re-open Review
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Side-by-Side Document Preview & Structured Record Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Uploaded Document Preview (shown whenever file is attached) */}
          {file && localPreviewUrl && (
            <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white overflow-hidden lg:sticky lg:top-20">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800 truncate">
                  Source Preview: {file.name}
                </span>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                  {Math.max(1, Math.round(file.size / 1024))} KB
                </span>
              </div>
              <div className="p-3 bg-slate-100/70">
                {file.type.startsWith('image/') ? (
                  <img
                    src={localPreviewUrl}
                    alt={file.name}
                    className="w-full max-h-[540px] object-contain rounded-lg border border-slate-200 bg-white"
                  />
                ) : (
                  <object
                    data={localPreviewUrl}
                    type="application/pdf"
                    aria-label={file.name}
                    className="w-full h-[520px] rounded-lg border border-slate-200 bg-white"
                  >
                    <div className="h-[260px] flex flex-col items-center justify-center p-5 text-center bg-white rounded-lg border border-slate-200">
                      <FileText className="w-8 h-8 text-teal-700 mb-2" />
                      <p className="text-xs font-semibold text-slate-900">{file.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        PDF attached and ready for extraction/upload. Inline preview is restricted in
                        this frame.
                      </p>
                    </div>
                  </object>
                )}
              </div>
            </div>
          )}

          {/* Right (or full width if no file yet): Editable Extracted Form */}
          <div
            className={`${
              file && localPreviewUrl ? 'lg:col-span-7' : 'lg:col-span-12'
            } rounded-xl border border-slate-200 bg-white p-6 space-y-5`}
          >
            <h2 className="font-display text-base font-bold text-slate-900">
              02. Record Details &amp; Clinical Metadata
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Complete Blood Count & HbA1c Follow-Up"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RecordCategory)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Document Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Hospital / Facility *
                </label>
                <select
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {HOSPITAL_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                {hospital === 'Other Clinic / Lab' && (
                  <input
                    type="text"
                    required
                    value={customHospital}
                    onChange={(e) => setCustomHospital(e.target.value)}
                    placeholder="Enter hospital or clinic name"
                    className="mt-2 w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Clinician / Lab Name
                </label>
                <input
                  type="text"
                  value={clinician}
                  onChange={(e) => setClinician(e.target.value)}
                  placeholder="e.g., Dr. Neha Kulkarni"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Clinical Summary *
                </label>
                <textarea
                  required
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Brief factual summary of key findings, visits, or discharge notes..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            {/* Extracted Observations */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-semibold text-slate-800">
                  Lab Values / Key Observations ({facts.length})
                </span>
                <button
                  type="button"
                  onClick={addEmptyFact}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Observation</span>
                </button>
              </div>

              {facts.length > 0 && (
                <div className="space-y-2.5">
                  {facts.map((fact, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Test / Label"
                          value={fact.label}
                          onChange={(e) => updateFact(idx, { label: e.target.value })}
                          className="sm:col-span-4 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          value={fact.value}
                          onChange={(e) => updateFact(idx, { value: e.target.value })}
                          className="sm:col-span-3 px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md"
                        />
                        <input
                          type="text"
                          placeholder="Unit"
                          value={fact.unit || ''}
                          onChange={(e) => updateFact(idx, { unit: e.target.value })}
                          className="sm:col-span-2 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                        />
                        <select
                          value={fact.flag || 'normal'}
                          onChange={(e) =>
                            updateFact(idx, {
                              flag: e.target.value as ExtractedFact['flag'],
                            })
                          }
                          className="sm:col-span-2 px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                        >
                          <option value="normal">normal</option>
                          <option value="borderline">borderline</option>
                          <option value="high">high</option>
                          <option value="low">low</option>
                          <option value="critical">critical</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeFact(idx)}
                          className="sm:col-span-1 p-1.5 text-slate-400 hover:text-rose-600"
                          aria-label="Remove observation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {fact.uncertainty && (
                        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                          Uncertainty noted: {fact.uncertainty}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Medications List */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-xs font-semibold text-slate-800">
                  Medications Mentioned ({medications.length})
                </span>
                <button
                  type="button"
                  onClick={addMedication}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Medication</span>
                </button>
              </div>
              {medications.length > 0 && (
                <div className="space-y-2">
                  {medications.map((med, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={med}
                        onChange={(e) => updateMedication(idx, e.target.value)}
                        placeholder="e.g., Metformin 500mg once daily with dinner"
                        className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => removeMedication(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600"
                        aria-label="Remove medication"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Multi-Allergy List */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-xs font-semibold text-slate-800">
                  Allergies Mentioned ({allergies.length})
                </span>
                <button
                  type="button"
                  onClick={addAllergy}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Allergy</span>
                </button>
              </div>

              {allergies.length > 0 && (
                <div className="space-y-2.5">
                  {allergies.map((alg, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-2"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Substance (e.g., Penicillin)"
                          value={alg.substance}
                          onChange={(e) => updateAllergy(idx, { substance: e.target.value })}
                          className="sm:col-span-7 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                        />
                        <select
                          value={alg.severity}
                          onChange={(e) =>
                            updateAllergy(idx, {
                              severity: e.target.value as AllergyMention['severity'],
                            })
                          }
                          className="sm:col-span-4 px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                        >
                          <option value="Mild">Mild</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Severe">Severe</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeAllergy(idx)}
                          className="sm:col-span-1 p-1.5 text-slate-400 hover:text-rose-600"
                          aria-label="Remove allergy"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Reaction description"
                        value={alg.reaction}
                        onChange={(e) => updateAllergy(idx, { reaction: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {submitError && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Save status:{' '}
                <strong className="text-slate-800">{extractionStatus}</strong>
              </span>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>{submitting ? 'Encrypting & Uploading...' : 'Save to Private Vault'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
