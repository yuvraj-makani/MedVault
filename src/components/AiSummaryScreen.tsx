import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileWarning,
  Info,
  Loader2,
  Lock,
  Pill,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { ApiError, fetchSampleAiDoctorSummary, generateAiDoctorSummary } from '../api';
import type {
  AISummaryResult,
  AllergyDiscrepancy,
  AuthUser,
  MedicalRecord,
} from '../types';

export interface CachedAiSummaryEntry {
  cacheKey: string;
  serverCacheKey?: string;
  summary: AISummaryResult;
  accessibleRecords: MedicalRecord[];
  discrepancies: AllergyDiscrepancy[];
  fromCache: boolean;
}

interface AiSummaryScreenProps {
  currentDoctor: AuthUser;
  accessibleRecords: MedicalRecord[];
  expectedCacheKey: string;
  cachedEntry: CachedAiSummaryEntry | null;
  blockedMessage: string | null;
  aiConfigured: boolean;
  doctorLoading: boolean;
  onCacheUpdate: (entry: CachedAiSummaryEntry | null) => void;
  onSelectRecord: (record: MedicalRecord) => void;
  onGoConsentFallback: () => void;
}

export const AiSummaryScreen: React.FC<AiSummaryScreenProps> = ({
  currentDoctor,
  accessibleRecords,
  expectedCacheKey,
  cachedEntry,
  blockedMessage,
  aiConfigured,
  doctorLoading,
  onCacheUpdate,
  onSelectRecord,
  onGoConsentFallback,
}) => {
  const [loading, setLoading] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canShowSampleFallback, setCanShowSampleFallback] = useState(false);
  const [recordsChangedNotice, setRecordsChangedNotice] = useState<string | null>(null);
  const [fallbackRecords, setFallbackRecords] = useState<MedicalRecord[]>(accessibleRecords);
  const [fallbackDiscrepancies, setFallbackDiscrepancies] = useState<AllergyDiscrepancy[]>([]);

  useEffect(() => {
    setErrorMsg(null);
    setCanShowSampleFallback(false);
    setRecordsChangedNotice(null);
    setFallbackRecords(accessibleRecords);
  }, [expectedCacheKey, accessibleRecords]);

  const activeEntry =
    cachedEntry && expectedCacheKey && cachedEntry.cacheKey === expectedCacheKey
      ? cachedEntry
      : null;
  const summary = activeEntry?.summary ?? null;

  const handleGenerate = async (force = false) => {
    setLoading(true);
    setErrorMsg(null);
    setCanShowSampleFallback(false);
    setRecordsChangedNotice(null);
    try {
      const data = await generateAiDoctorSummary(force);
      onCacheUpdate({
        cacheKey: expectedCacheKey,
        serverCacheKey: data.cacheKey,
        summary: data.summary,
        accessibleRecords: data.accessibleRecords,
        discrepancies: data.discrepancies,
        fromCache: Boolean(data.cached),
      });
      setFallbackRecords(data.accessibleRecords);
      setFallbackDiscrepancies(data.discrepancies);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          onCacheUpdate(null);
        }
        setErrorMsg(err.message);
        const nextRecords = Array.isArray(err.data.accessibleRecords)
          ? (err.data.accessibleRecords as MedicalRecord[])
          : accessibleRecords;
        if (Array.isArray(err.data.accessibleRecords)) {
          setFallbackRecords(nextRecords);
        }
        if (Array.isArray(err.data.discrepancies)) {
          setFallbackDiscrepancies(err.data.discrepancies as AllergyDiscrepancy[]);
        }

        const isServiceOrQuotaError =
          err.status === 502 || err.status === 503 || err.status === 429;
        const seedEligible =
          err.data.recordsMatchSeed === true ||
          (err.data.recordsMatchSeed !== false &&
            nextRecords.length > 0 &&
            nextRecords.every((r) => r.extractionStatus === 'Seeded Synthetic'));

        if (isServiceOrQuotaError && seedEligible) {
          setCanShowSampleFallback(true);
        } else if (isServiceOrQuotaError && err.data.recordsMatchSeed === false) {
          setRecordsChangedNotice(
            'Pre-generated sample AI summary is disabled because the patient’s records have been modified from the seeded baseline.'
          );
        }
      } else {
        setErrorMsg('Failed to generate AI clinical summary.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSampleSummary = async () => {
    setLoadingSample(true);
    setRecordsChangedNotice(null);
    try {
      const data = await fetchSampleAiDoctorSummary();
      setErrorMsg(null);
      setCanShowSampleFallback(false);
      onCacheUpdate({
        cacheKey: expectedCacheKey,
        summary: data.summary,
        accessibleRecords: data.accessibleRecords,
        discrepancies: data.discrepancies,
        fromCache: false,
      });
      setFallbackRecords(data.accessibleRecords);
      setFallbackDiscrepancies(data.discrepancies);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          onCacheUpdate(null);
          setErrorMsg(err.message);
          setCanShowSampleFallback(false);
        } else if (err.status === 409) {
          setCanShowSampleFallback(false);
          setRecordsChangedNotice(err.message);
          if (Array.isArray(err.data.accessibleRecords)) {
            setFallbackRecords(err.data.accessibleRecords as MedicalRecord[]);
          }
          if (Array.isArray(err.data.discrepancies)) {
            setFallbackDiscrepancies(err.data.discrepancies as AllergyDiscrepancy[]);
          }
        } else {
          setErrorMsg(err.message);
        }
      } else {
        setErrorMsg('Failed to load sample AI summary.');
      }
    } finally {
      setLoadingSample(false);
    }
  };

  const openCitation = (recordId: string) => {
    const match =
      activeEntry?.accessibleRecords.find((r) => r.id === recordId) ??
      fallbackRecords.find((r) => r.id === recordId) ??
      accessibleRecords.find((r) => r.id === recordId);
    if (match) {
      onSelectRecord(match);
    }
  };

  if (doctorLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-xl border border-slate-200 bg-white animate-pulse" />
        <div className="h-56 rounded-xl border border-slate-200 bg-white animate-pulse" />
      </div>
    );
  }

  if (blockedMessage) {
    return (
      <div className="max-w-2xl rounded-xl border border-rose-200 bg-rose-50/70 p-6">
        <div className="flex items-start gap-3">
          <Lock className="w-6 h-6 text-rose-700 shrink-0 mt-0.5" />
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">
              AI Summary Blocked — Patient Consent Required
            </h1>
            <p className="text-sm text-slate-700 mt-1.5">{blockedMessage}</p>
            <button
              type="button"
              onClick={onGoConsentFallback}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Return to Doctor Portal / Request Access
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            AI Doctor Summary
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Source-linked synthesis generated for {currentDoctor.name} from{' '}
            <span className="font-mono font-semibold tabular-nums">
              {accessibleRecords.length}
            </span>{' '}
            consent-approved records.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || loadingSample}
          onClick={() => void handleGenerate(Boolean(summary && !summary.isSampleDemo))}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 self-start md:self-center"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>
            {loading
              ? 'Synthesizing Approved Records...'
              : summary?.isSampleDemo
              ? 'Retry Live Gemini AI'
              : summary
              ? 'Regenerate AI Summary'
              : 'Generate Source-Linked Summary'}
          </span>
        </button>
      </div>

      {/* Explicit Medical Disclaimer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-2.5 text-xs text-slate-600">
        <FileWarning className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <span>
          <strong>Clinical Synthesis Notice:</strong> This summary organizes factual entries from
          accessible patient records for physician review only. It does not provide clinical advice,
          diagnoses, or treatment recommendations. Every claim must be verified against its linked
          primary record.
        </span>
      </div>

      {!aiConfigured && !errorMsg && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>
            Server notice: <code className="font-mono">GEMINI_API_KEY</code> is not configured.
            Clicking generate will report the real unavailability state without simulating AI output.
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 text-sm text-amber-950">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">AI Synthesis Unavailable</div>
                <p className="text-xs text-amber-900 mt-1">{errorMsg}</p>
              </div>
            </div>

            {canShowSampleFallback && (
              <button
                type="button"
                disabled={loadingSample || loading}
                onClick={() => void handleLoadSampleSummary()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-white border border-amber-400 rounded-lg hover:bg-amber-100 disabled:opacity-60 transition-colors sm:whitespace-nowrap shrink-0 self-start"
              >
                {loadingSample ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                ) : (
                  <Info className="w-3.5 h-3.5 text-amber-700" />
                )}
                <span>View Sample AI Summary</span>
              </button>
            )}
          </div>

          {recordsChangedNotice && (
            <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
              {recordsChangedNotice}
            </div>
          )}

          {fallbackDiscrepancies.length > 0 && (
            <div className="pt-2 border-t border-amber-200 text-xs text-amber-950">
              <strong>Primary Allergy Conflicts Detected:</strong>{' '}
              {fallbackDiscrepancies
                .map((d) => `${d.substance} (${d.entries.length} conflicting entries)`)
                .join(', ')}
            </div>
          )}

          <div className="pt-2 border-t border-amber-200">
            <div className="text-xs font-semibold text-slate-800 mb-2">
              Un-summarized Accessible Source Records ({fallbackRecords.length}):
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {fallbackRecords.map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => onSelectRecord(rec)}
                  className="text-left rounded-lg border border-slate-200 bg-white p-3 hover:border-teal-600 transition-colors"
                >
                  <div className="font-mono text-xs text-teal-700 font-semibold tabular-nums">
                    {rec.id} · {rec.date} · {rec.hospital}
                  </div>
                  <div className="text-xs font-semibold text-slate-900 mt-0.5">{rec.title}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading && !summary && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-700 mb-3" />
          <p className="font-display font-semibold text-slate-900">
            Synthesizing {accessibleRecords.length} Approved Records...
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Validating every clinical claim against its source record ID.
          </p>
        </div>
      )}

      {!summary && !loading && !errorMsg && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <Sparkles className="w-9 h-9 text-teal-700 mx-auto mb-3" />
          <h2 className="font-display text-lg font-bold text-slate-900">
            Ready to Synthesize {accessibleRecords.length} Approved Records
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-lg mx-auto">
            Click &ldquo;Generate Source-Linked Summary&rdquo; to invoke the server-side Gemini
            clinical synthesizer. Every extracted fact is verified against your permitted records.
          </p>
        </div>
      )}

      {summary && (
        <div className="space-y-6">
          {summary.isSampleDemo && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-950">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm text-amber-950">
                    Pre-generated demonstration data — not a live AI response
                  </div>
                  <p className="text-xs text-amber-900 mt-0.5">
                    Showing the validated synthetic fallback across your{' '}
                    <span className="font-mono font-semibold">{summary.recordCountUsed}</span>{' '}
                    consent-approved seeded records.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleGenerate(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-900 bg-white border border-teal-300 rounded-lg hover:bg-teal-50 disabled:opacity-60 transition-colors sm:whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Retry Live Gemini AI</span>
              </button>
            </div>
          )}

          {/* Executive Brief */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Cross-Hospital Executive Brief
                </h2>
                {summary.isSampleDemo ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded">
                    <Info className="w-3 h-3" />
                    Sample Demo (Not Live AI)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3" />
                    {activeEntry?.fromCache ? 'Cached for Current Permissions' : 'Freshly Synthesized'}
                  </span>
                )}
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                Model: {summary.model} · {summary.recordCountUsed} records ·{' '}
                {new Date(summary.generatedAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed">{summary.executiveBrief}</p>
          </div>

          {/* Conflicting Data / Allergy Conflicts */}
          {summary.allergyConflicts.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-6 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-700" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  Flagged Allergy &amp; Clinical Conflicts
                </h2>
              </div>
              {summary.allergyConflicts.map((c, idx) => (
                <div key={idx} className="rounded-lg border border-amber-200 bg-white p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-slate-900">{c.substance}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.sourceRecordIds.map((rid) => (
                        <button
                          key={rid}
                          type="button"
                          onClick={() => openCitation(rid)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded hover:bg-teal-100 transition-colors"
                        >
                          <span>{rid}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-700">{c.conflictSummary}</p>
                  {c.conflictReason && (
                    <div className="text-xs text-amber-950 bg-amber-50/70 border border-amber-200 rounded px-2.5 py-1.5">
                      <span className="font-semibold">Why flagged:</span> {c.conflictReason}
                    </div>
                  )}
                  {c.evidenceSnippets && c.evidenceSnippets.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                      {c.evidenceSnippets.map((snippet, sIdx) => (
                        <div
                          key={sIdx}
                          className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700"
                        >
                          <div className="font-mono font-semibold text-slate-900">
                            {snippet.recordId} · {snippet.hospital} ({snippet.severity})
                          </div>
                          <div className="mt-0.5 text-slate-600">&ldquo;{snippet.excerpt}&rdquo;</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs font-medium text-amber-900">
                    Verification Required: {c.actionRequired}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Source-Linked Key Findings */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-base font-bold text-slate-900 mb-4">
              Source-Linked Clinical Findings
            </h2>
            <div className="divide-y divide-slate-100">
              {summary.keyFindings.map((finding, idx) => {
                const sourceRec = accessibleRecords.find((r) => r.id === finding.sourceRecordId);
                const isVerified = finding.citationVerified !== false && Boolean(sourceRec);
                const isUnverifiedExtraction =
                  finding.evidenceStatus === 'unverified-extraction' ||
                  sourceRec?.extractionStatus === 'Extracted — Review Required';
                const isScopeRestricted =
                  finding.evidenceStatus === 'scope-restricted' || Boolean(sourceRec?.scopeRedacted);

                return (
                  <div
                    key={idx}
                    className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">
                          {finding.category}
                        </span>
                        {!isVerified ? (
                          <span className="text-[11px] font-medium text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                            Unverified Citation
                          </span>
                        ) : isUnverifiedExtraction ? (
                          <span className="text-[11px] font-medium text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded">
                            Unverified Extraction
                          </span>
                        ) : isScopeRestricted ? (
                          <span className="text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                            Scope-Restricted Reference
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                            Verified Source
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-900 leading-relaxed">{finding.statement}</p>

                      {isVerified && finding.sourceQuote && (
                        <blockquote className="text-xs text-slate-700 bg-slate-50 border-l-2 border-teal-600 pl-3 pr-2.5 py-1.5 rounded-r">
                          <span className="font-semibold text-slate-800">Original Source Text:</span>{' '}
                          &ldquo;{finding.sourceQuote}&rdquo;
                        </blockquote>
                      )}

                      {finding.explanation && (
                        <p className="text-[11px] text-slate-500">{finding.explanation}</p>
                      )}

                      {finding.uncertainty && (
                        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1 inline-block">
                          Uncertainty: {finding.uncertainty}
                        </p>
                      )}
                    </div>

                    {isVerified && sourceRec ? (
                      <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openCitation(finding.sourceRecordId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap"
                        >
                          <span>
                            {finding.sourceRecordId} · {finding.sourceHospital}
                          </span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                        <span className="text-[11px] text-slate-500">
                          {isScopeRestricted
                            ? 'Full PDF restricted by consent scope'
                            : 'Open original permitted document'}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg whitespace-nowrap shrink-0 self-start">
                        Unverified Source
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Medications + Uncertainties */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-4">
                <Pill className="w-4 h-4 text-teal-700" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  Documented Medications (Source-Linked)
                </h2>
              </div>
              <div className="space-y-3">
                {summary.activeMedications.map((med, idx) => {
                  const sourceRec = accessibleRecords.find((r) => r.id === med.sourceRecordId);
                  const isVerified = med.citationVerified !== false && Boolean(sourceRec);
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-200 p-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-900">
                            {med.medication}
                          </span>
                          {med.evidenceStatus === 'unverified-extraction' && (
                            <span className="text-[10px] font-medium text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded">
                              Unverified Upload
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">{med.context}</div>
                        {isVerified && med.sourceQuote && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            Source entry: &ldquo;{med.sourceQuote}&rdquo;
                          </div>
                        )}
                      </div>
                      {isVerified ? (
                        <button
                          type="button"
                          onClick={() => openCitation(med.sourceRecordId)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded hover:bg-teal-100 whitespace-nowrap shrink-0"
                        >
                          <span>{med.sourceRecordId}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-mono text-amber-800 bg-amber-50 border border-amber-200 rounded whitespace-nowrap shrink-0">
                          Unverified
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  Uncertainties, Gaps &amp; Review Checklist
                </h2>
              </div>
              <ul className="space-y-2.5 text-sm text-slate-700">
                {summary.uncertaintiesAndGaps.map((gap, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono text-xs text-amber-700 mt-0.5">•</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                {summary.disclaimer}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
