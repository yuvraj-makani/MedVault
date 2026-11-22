import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Lock,
  Pill,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';
import { fetchSecureFileBlobUrl, getErrorMessage, verifyUploadedRecord } from '../api';
import type { MedicalRecord } from '../types';

interface RecordDetailModalProps {
  record: MedicalRecord | null;
  canVerify?: boolean;
  onRecordVerified?: (updated: MedicalRecord) => void;
  onClose: () => void;
}

export const RecordDetailModal: React.FC<RecordDetailModalProps> = ({
  record,
  canVerify = false,
  onRecordVerified,
  onClose,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    let activeUrl: string | null = null;
    setPreviewUrl(null);
    setFileError(null);
    setVerifyError(null);

    if (!record || record.scopeRedacted) return;

    const loadPreview = async () => {
      setLoadingFile(true);
      try {
        const { blobUrl, contentType } = await fetchSecureFileBlobUrl(record.id);
        activeUrl = blobUrl;
        setPreviewUrl(blobUrl);
        setPreviewType(contentType);
      } catch (err) {
        setFileError(getErrorMessage(err, 'Could not load private document preview.'));
      } finally {
        setLoadingFile(false);
      }
    };

    void loadPreview();

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [record]);

  useEffect(() => {
    if (!record) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [record, onClose]);

  if (!record) return null;

  const handleMarkVerified = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const { record: updated } = await verifyUploadedRecord(record.id);
      onRecordVerified?.(updated);
    } catch (err) {
      setVerifyError(getErrorMessage(err, 'Unable to verify record.'));
    } finally {
      setVerifying(false);
    }
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = record.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-modal-title"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums mb-1">
              <span className="font-semibold text-teal-700">{record.id}</span>
              <span aria-hidden="true">·</span>
              <span>{record.category}</span>
              <span aria-hidden="true">·</span>
              <span>{record.extractionStatus}</span>
            </div>
            <h2 id="record-modal-title" className="text-lg font-bold text-slate-900 truncate">
              {record.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors shrink-0"
            aria-label="Close record details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Provenance metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100 text-sm">
            <div className="flex items-center gap-2.5 text-slate-700">
              <Building2 className="w-4 h-4 text-teal-700 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-slate-500">Issuing Facility</div>
                <div className="font-medium truncate">{record.hospital}</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700">
              <User className="w-4 h-4 text-teal-700 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-slate-500">Attending Clinician</div>
                <div className="font-medium truncate">{record.clinician}</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700">
              <Calendar className="w-4 h-4 text-teal-700 shrink-0" />
              <div>
                <div className="text-xs text-slate-500">Document Date</div>
                <div className="font-mono font-medium tabular-nums">{record.date}</div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <h3 className="text-sm font-semibold text-slate-900">Clinical Summary</h3>
              {canVerify && record.extractionStatus === 'Extracted — Review Required' && (
                <button
                  type="button"
                  disabled={verifying}
                  onClick={() => void handleMarkVerified()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{verifying ? 'Verifying...' : 'Confirm & Verify Extraction'}</span>
                </button>
              )}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{record.summary}</p>
            {verifyError && (
              <div className="mt-2 text-xs text-rose-700">{verifyError}</div>
            )}
            {record.extractionNotes && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{record.extractionNotes}</span>
              </div>
            )}
          </div>

          {/* Facts Table */}
          {record.facts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Extracted Observations &amp; Results
              </h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Observation</th>
                      <th className="py-2.5 px-3 font-medium">Value</th>
                      <th className="py-2.5 px-3 font-medium">Status Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {record.facts.map((fact, idx) => {
                      const flagStyle =
                        fact.flag === 'critical' || fact.flag === 'high'
                          ? 'text-rose-700 font-semibold'
                          : fact.flag === 'borderline' || fact.flag === 'low'
                          ? 'text-amber-700 font-medium'
                          : 'text-emerald-700';
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 text-slate-800 font-medium">{fact.label}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-900">
                            {fact.value} {fact.unit || ''}
                            {fact.uncertainty && (
                              <span className="block text-xs font-sans text-amber-700 mt-0.5">
                                Note: {fact.uncertainty}
                              </span>
                            )}
                          </td>
                          <td className={`py-2.5 px-3 text-xs uppercase tracking-wide ${flagStyle}`}>
                            {fact.flag || 'normal'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Medications & Allergies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {record.medications.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-2">
                  <Pill className="w-4 h-4 text-teal-700" />
                  <span>Documented Medications</span>
                </div>
                <ul className="space-y-1.5 text-sm text-slate-700">
                  {record.medications.map((m, i) => (
                    <li key={i} className="leading-snug">
                      • {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {record.allergiesMentioned.length > 0 && (
              <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-900 mb-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Allergies Recorded in This Document</span>
                </div>
                <ul className="space-y-2 text-sm">
                  {record.allergiesMentioned.map((a, i) => (
                    <li key={i} className="text-rose-900">
                      <span className="font-semibold">{a.substance}</span>
                      {' — '}
                      <span className="font-medium">{a.severity}</span>: {a.reaction}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Private Storage File Preview */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2 min-w-0">
                <Lock className="w-4 h-4 text-teal-700 shrink-0" />
                <span className="text-xs font-medium text-slate-700 truncate">
                  Private Vault File: <span className="font-mono">{record.fileName}</span>
                </span>
                <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
                  ({Math.max(1, Math.round(record.fileSizeBytes / 1024))} KB)
                </span>
              </div>
              {previewUrl && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </button>
              )}
            </div>

            <div className="bg-slate-100/70 min-h-[260px] flex items-center justify-center p-3">
              {record.scopeRedacted && (
                <div className="text-sm text-amber-900 flex flex-col items-center gap-2 px-6 text-center max-w-md">
                  <Lock className="w-6 h-6 text-amber-700" />
                  <p className="font-semibold">
                    Private Document Restricted Under &ldquo;Labs &amp; Allergies Only&rdquo; Scope
                  </p>
                  <p className="text-xs text-slate-600">
                    Non-lab consultation PDFs cannot be viewed or downloaded unless the patient
                    grants Full History access.
                  </p>
                </div>
              )}
              {!record.scopeRedacted && loadingFile && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
                  <span>Decrypting &amp; verifying consent for private document...</span>
                </div>
              )}
              {fileError && (
                <div className="text-sm text-rose-700 flex items-center gap-2 px-4 text-center">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}
              {!loadingFile && !fileError && previewUrl && previewType.startsWith('image/') && (
                <img
                  src={previewUrl}
                  alt={record.title}
                  className="max-h-[420px] w-auto rounded-lg border border-slate-200 bg-white object-contain"
                />
              )}
              {!loadingFile && !fileError && previewUrl && previewType === 'application/pdf' && (
                <object
                  data={previewUrl}
                  type="application/pdf"
                  aria-label={record.title}
                  className="w-full h-[360px] rounded-lg border border-slate-200 bg-white"
                >
                  <div className="h-[260px] flex flex-col items-center justify-center p-6 text-center bg-white rounded-lg border border-slate-200">
                    <FileText className="w-8 h-8 text-teal-700 mb-2" />
                    <p className="text-sm font-medium text-slate-900">
                      PDF Ready ({record.fileName})
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Embedded PDF viewing is restricted inside this preview frame. Download the
                      verified file to open it in your PDF reader.
                    </p>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                </object>
              )}
              {!loadingFile &&
                !fileError &&
                previewUrl &&
                !previewType.startsWith('image/') &&
                previewType !== 'application/pdf' && (
                  <div className="text-center text-sm text-slate-600">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p>Preview unavailable for {previewType}. Use Download File above.</p>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
