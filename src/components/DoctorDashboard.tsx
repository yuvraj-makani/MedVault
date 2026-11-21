import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Lock,
  Send,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { ApiError, requestDoctorConsent, verifyAllergyDiscrepancy } from '../api';
import type {
  AllergyDiscrepancy,
  AuthUser,
  ConsentGrant,
  MedicalRecord,
  PatientProfile,
} from '../types';
import { BiomarkerCharts } from './BiomarkerCharts';

interface DoctorDashboardProps {
  currentDoctor: AuthUser;
  patient: PatientProfile | null;
  consent: ConsentGrant | null;
  records: MedicalRecord[];
  discrepancies: AllergyDiscrepancy[];
  blockedState: { status: string; message: string; consent: ConsentGrant | null } | null;
  loading: boolean;
  onSelectRecord: (record: MedicalRecord) => void;
  onOpenAiSummary: () => void;
  onRefreshDoctor: () => Promise<void>;
  onSwitchToPatientConsents: () => void;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({
  currentDoctor,
  patient,
  consent,
  records,
  discrepancies,
  blockedState,
  loading,
  onSelectRecord,
  onOpenAiSummary,
  onRefreshDoctor,
  onSwitchToPatientConsents,
}) => {
  const [requestPurpose, setRequestPurpose] = useState(
    'Pre-consultation cross-hospital history & allergy reconciliation'
  );
  const [requestScope, setRequestScope] = useState<'Full History' | 'Labs & Allergies Only'>(
    'Full History'
  );
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestDone, setRequestDone] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [verificationNote, setVerificationNote] = useState(
    'Confirmed with patient: treat Penicillin / beta-lactam class as severe anaphylaxis contraindication across all prescribing systems.'
  );
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestSubmitting(true);
    setRequestError(null);
    try {
      await requestDoctorConsent(requestPurpose, requestScope);
      setRequestDone(true);
      await onRefreshDoctor();
    } catch (err) {
      setRequestError(err instanceof ApiError ? err.message : 'Failed to send access request.');
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleVerifyDiscrepancy = async (substance: string) => {
    if (!verificationNote.trim()) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      await verifyAllergyDiscrepancy(substance, verificationNote.trim());
      await onRefreshDoctor();
    } catch (err) {
      setVerifyError(err instanceof ApiError ? err.message : 'Failed to save verification note.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-28 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
        <div className="h-64 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
      </div>
    );
  }

  // Backend 403 Consent Enforcement State
  if (blockedState) {
    return (
      <div className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-6">
          <div className="flex items-start gap-3.5">
            <Lock className="w-6 h-6 text-rose-700 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-mono font-semibold text-rose-700 uppercase tracking-wide">
                HTTP 403 · Backend Consent Enforcement Active
              </div>
              <h1 className="font-display text-xl font-bold text-slate-900 mt-1">
                Patient Records Locked for {currentDoctor.name}
              </h1>
              <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                {blockedState.message} Current consent status:{' '}
                <span className="font-mono font-semibold text-rose-800">
                  {blockedState.status.toUpperCase()}
                </span>
                . This blocked attempt has been recorded in Ananya Sharma&apos;s security audit log.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onSwitchToPatientConsents}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors text-left max-w-full sm:whitespace-nowrap"
                >
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Switch to Ananya Sharma to Approve (Demo Only)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Submit / Re-submit Access Request */}
        <form
          onSubmit={handleRequestAccess}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <h2 className="font-display text-base font-bold text-slate-900">
            Request Access from Ananya Sharma
          </h2>
          <p className="text-xs text-slate-600">
            Submit a formal consent request specifying clinical scope and purpose.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Clinical Purpose
              </label>
              <input
                type="text"
                required
                value={requestPurpose}
                onChange={(e) => setRequestPurpose(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Requested Scope
              </label>
              <select
                value={requestScope}
                onChange={(e) =>
                  setRequestScope(e.target.value as 'Full History' | 'Labs & Allergies Only')
                }
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="Full History">Full History</option>
                <option value="Labs & Allergies Only">Labs &amp; Allergies Only</option>
              </select>
            </div>
          </div>

          {requestDone && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs text-teal-900">
              Access request submitted and set to Pending. Switch to Ananya Sharma&apos;s Consent
              Management screen to approve it.
            </div>
          )}

          {requestError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
              {requestError}
            </div>
          )}

          <button
            type="submit"
            disabled={requestSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
            <span>{requestSubmitting ? 'Sending Request...' : 'Send Consent Request'}</span>
          </button>
        </form>
      </div>
    );
  }

  if (!patient || !consent) return null;

  return (
    <div className="space-y-6">
      {/* Approved Patient Clinical Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Consent Approved ({consent.scope})
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{patient.medvaultId}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">DOB {patient.dob}</span>
            <span aria-hidden="true">·</span>
            <span>Blood Group {patient.bloodGroup}</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 mt-1.5">
            Patient Clinical View: {patient.name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Viewing as {currentDoctor.name} ({currentDoctor.specialty} · {currentDoctor.hospital})
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAiSummary}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 self-start lg:self-center"
        >
          <Sparkles className="w-4 h-4" />
          <span>Open AI Doctor Summary</span>
        </button>
      </div>

      {/* Flagged Allergy Discrepancy Requiring Physician Verification */}
      {discrepancies.map((disc) => (
        <div
          key={disc.substance}
          className={`rounded-xl border p-5 ${
            disc.requiresVerification
              ? 'border-amber-300 bg-amber-50/80'
              : 'border-teal-200 bg-teal-50/50'
          }`}
        >
          <div className="flex items-start gap-3">
            {disc.requiresVerification ? (
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Allergy Discrepancy Alert: {disc.substance}
                  </h2>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      disc.requiresVerification
                        ? 'bg-amber-200/80 text-amber-950'
                        : 'bg-teal-100 text-teal-900'
                    }`}
                  >
                    {disc.requiresVerification ? 'Doctor Verification Required' : 'Verified'}
                  </span>
                </div>
                <p className="text-sm text-slate-700 mt-1">
                  Conflicting severity levels documented across facilities. Verify with the patient
                  before prescribing beta-lactams.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {disc.entries.map((entry) => {
                  const rec = records.find((r) => r.id === entry.sourceRecordId);
                  return (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-slate-200 bg-white p-3.5 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-slate-900">{entry.hospital}</span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            entry.severity === 'Severe'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {entry.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{entry.reaction}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
                        <span>{entry.recordedAt}</span>
                        {rec && (
                          <button
                            type="button"
                            onClick={() => onSelectRecord(rec)}
                            className="text-teal-700 font-semibold hover:underline"
                          >
                            Source: {entry.sourceRecordId}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {disc.resolutionNote ? (
                <div className="rounded-lg border border-teal-200 bg-white px-4 py-3 text-xs text-slate-700">
                  <span className="font-semibold text-teal-800">
                    Verified by {disc.resolvedByDoctor}:
                  </span>{' '}
                  {disc.resolutionNote}
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-white p-4 space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-800">
                    Record Physician Verification Note
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={verificationNote}
                      onChange={(e) => setVerificationNote(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <button
                      type="button"
                      disabled={verifying}
                      onClick={() => handleVerifyDiscrepancy(disc.substance)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      {verifying ? 'Saving...' : 'Confirm Verification'}
                    </button>
                  </div>
                  {verifyError && (
                    <div className="text-xs text-rose-700 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{verifyError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Biomarker Charts */}
      <BiomarkerCharts records={records} onSelectRecord={onSelectRecord} />

      {/* Accessible Patient Records Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Consent-Approved Records ({records.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Scoped by patient grant: {consent.scope}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-medium">ID</th>
                <th className="py-2.5 px-4 font-medium">Date</th>
                <th className="py-2.5 px-4 font-medium">Hospital</th>
                <th className="py-2.5 px-4 font-medium">Category</th>
                <th className="py-2.5 px-4 font-medium">Record Title</th>
                <th className="py-2.5 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-teal-700 tabular-nums whitespace-nowrap">
                    {rec.id}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {rec.date}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                    {rec.hospital}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                    {rec.category}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-slate-900">{rec.title}</td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onSelectRecord(rec)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-teal-700" />
                      <span>Inspect &amp; PDF</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
