import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { ApiError, downloadHealthPassportPdf } from '../api';
import type {
  AllergyDiscrepancy,
  AllergyEntry,
  ConsentGrant,
  MedicalRecord,
  PatientProfile,
} from '../types';
import { BiomarkerCharts } from './BiomarkerCharts';
import type { WorkspaceScreen } from './LandingPage';

interface PatientDashboardProps {
  patient: PatientProfile;
  records: MedicalRecord[];
  allergies: AllergyEntry[];
  discrepancies: AllergyDiscrepancy[];
  consents: ConsentGrant[];
  onSelectRecord: (record: MedicalRecord) => void;
  onNavigate: (screen: WorkspaceScreen) => void;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({
  patient,
  records,
  allergies,
  discrepancies,
  consents,
  onSelectRecord,
  onNavigate,
}) => {
  const [avatarError, setAvatarError] = useState(false);
  const [exportingPassport, setExportingPassport] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleDownloadPassport = async () => {
    setExportingPassport(true);
    setExportError(null);
    try {
      await downloadHealthPassportPdf();
    } catch (err) {
      setExportError(
        err instanceof ApiError ? err.message : 'Unable to export Portable Health Passport.'
      );
    } finally {
      setExportingPassport(false);
    }
  };

  const hospitals = Array.from(new Set(records.map((r) => r.hospital)));
  const pendingConsents = consents.filter((c) => c.status === 'pending');
  const approvedConsents = consents.filter((c) => c.status === 'approved');

  const findRecordById = (id: string) => records.find((r) => r.id === id);

  return (
    <div className="space-y-6">
      {exportError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}
      {/* Patient Profile & Quick Action Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full border border-slate-200 overflow-hidden bg-slate-100 shrink-0">
            {!avatarError ? (
              <img
                src={patient.avatarUrl}
                alt={patient.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-display font-bold text-slate-600">
                AS
              </div>
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
              <span className="font-semibold text-teal-700">{patient.medvaultId}</span>
              <span aria-hidden="true">·</span>
              <span>DOB {patient.dob}</span>
              <span aria-hidden="true">·</span>
              <span>Blood Group {patient.bloodGroup}</span>
              <span aria-hidden="true">·</span>
              <span>{patient.city}</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900 mt-1">
              {patient.name}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 min-w-0 max-w-full">
          <button
            type="button"
            disabled={exportingPassport}
            onClick={() => void handleDownloadPassport()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            {exportingPassport ? (
              <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
            ) : (
              <Download className="w-4 h-4 text-teal-700" />
            )}
            <span>{exportingPassport ? 'Generating PDF...' : 'Download Health Passport'}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('consents')}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            Consent Requests ({pendingConsents.length} Pending)
          </button>
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Record</span>
          </button>
        </div>
      </div>

      {/* Allergy Discrepancy Alert (Always visible if conflicting records exist) */}
      {discrepancies.map((disc) => (
        <div
          key={disc.substance}
          className={`rounded-xl border p-5 ${
            disc.requiresVerification
              ? 'border-amber-300 bg-amber-50/80'
              : 'border-teal-200 bg-teal-50/50'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {disc.requiresVerification ? (
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Conflicting Allergy Record Detected: {disc.substance}
                  </h2>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      disc.requiresVerification
                        ? 'bg-amber-200/70 text-amber-950'
                        : 'bg-teal-100 text-teal-900'
                    }`}
                  >
                    {disc.requiresVerification ? 'Flagged for Doctor Verification' : 'Physician Verified'}
                  </span>
                </div>
                <p className="text-sm text-slate-700 mt-1">
                  Two hospitals recorded different severity levels for{' '}
                  <strong>{disc.substance}</strong>. Both entries are preserved below for clinician
                  reconciliation.
                </p>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {disc.entries.map((entry) => {
                    const sourceRec = findRecordById(entry.sourceRecordId);
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
                          {sourceRec && (
                            <button
                              type="button"
                              onClick={() => onSelectRecord(sourceRec)}
                              className="text-teal-700 font-semibold hover:underline"
                            >
                              Inspect {entry.sourceRecordId}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {disc.resolutionNote && (
                  <div className="mt-3 rounded-lg border border-teal-200 bg-white px-3.5 py-2.5 text-xs text-slate-700">
                    <span className="font-semibold text-teal-800">
                      Verified by {disc.resolvedByDoctor}:
                    </span>{' '}
                    {disc.resolutionNote}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Total Vault Records</div>
          <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {records.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Stored in private vault</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Connected Hospitals</div>
          <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {hospitals.length}
          </div>
          <div className="text-xs text-slate-500 mt-1 truncate">{hospitals.join(', ')}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Allergy Entries</div>
          <div className="font-mono text-2xl font-bold text-rose-700 tabular-nums mt-1">
            {allergies.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {discrepancies.filter((d) => d.requiresVerification).length > 0
              ? `${discrepancies.filter((d) => d.requiresVerification).length} conflict flagged`
              : discrepancies.length > 0
              ? `${discrepancies.length} verified by doctor`
              : 'No conflicts detected'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Active Doctor Consents</div>
          <div className="font-mono text-2xl font-bold text-teal-700 tabular-nums mt-1">
            {approvedConsents.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {pendingConsents.length} awaiting decision
          </div>
        </div>
      </div>

      {/* Connected Hospitals Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['CityCare Hospital', 'Sunrise Medical Center', 'Metro Health Clinic'].map((hosp) => {
          const hospRecords = records.filter((r) => r.hospital === hosp);
          const latest = hospRecords[0];
          return (
            <div key={hosp} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="w-4 h-4 text-teal-700 shrink-0" />
                  <h3 className="font-semibold text-slate-900 truncate">{hosp}</h3>
                </div>
                <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums shrink-0">
                  {hospRecords.length} docs
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {latest ? (
                  <>
                    Latest: <span className="text-slate-700 font-medium">{latest.title}</span> (
                    <span className="font-mono tabular-nums">{latest.date}</span>)
                  </>
                ) : (
                  'No records synced yet'
                )}
              </p>
            </div>
          );
        })}
      </div>

      {/* Biomarker & Hospital Charts */}
      <BiomarkerCharts records={records} onSelectRecord={onSelectRecord} />

      {/* Recent Timeline Preview */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Recent Medical Timeline
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest records across all care facilities
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('timeline')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
          >
            <span>View Full Timeline</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {records.slice(0, 5).map((rec) => (
            <div
              key={rec.id}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-teal-700 tabular-nums">
                    {rec.id}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{rec.hospital}</span>
                  <span aria-hidden="true">·</span>
                  <span>{rec.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {rec.date}
                  </span>
                </div>
                <div className="font-semibold text-slate-900 text-sm mt-1 truncate">
                  {rec.title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectRecord(rec)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                <FileText className="w-3.5 h-3.5 text-teal-700" />
                <span>Inspect Record</span>
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
          <span>
            All documents are stored in private server storage and accessible only to you and
            actively approved doctors.
          </span>
        </div>
      </div>
    </div>
  );
};
