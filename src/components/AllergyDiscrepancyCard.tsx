import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { AllergyDiscrepancy, MedicalRecord } from '../types';

interface AllergyDiscrepancyCardProps {
  discrepancy: AllergyDiscrepancy;
  records: MedicalRecord[];
  variant: 'patient' | 'doctor';
  onSelectRecord: (record: MedicalRecord) => void;
  children?: React.ReactNode;
}

export const AllergyDiscrepancyCard: React.FC<AllergyDiscrepancyCardProps> = ({
  discrepancy,
  records,
  variant,
  onSelectRecord,
  children,
}) => {
  const isDoctor = variant === 'doctor';
  const unverified = discrepancy.requiresVerification;

  return (
    <div
      className={`rounded-xl border p-5 ${
        unverified ? 'border-amber-300 bg-amber-50/80' : 'border-teal-200 bg-teal-50/50'
      }`}
    >
      <div className="flex items-start gap-3">
        {!unverified ? (
          <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
        ) : isDoctor ? (
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        )}

        <div className="flex-1 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-bold text-slate-900">
                {isDoctor
                  ? `Allergy Discrepancy Alert: ${discrepancy.substance}`
                  : `Conflicting Allergy Record Detected: ${discrepancy.substance}`}
              </h2>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  unverified
                    ? isDoctor
                      ? 'bg-amber-200/80 text-amber-950'
                      : 'bg-amber-200/70 text-amber-950'
                    : 'bg-teal-100 text-teal-900'
                }`}
              >
                {unverified
                  ? isDoctor
                    ? 'Doctor Verification Required'
                    : 'Flagged for Doctor Verification'
                  : isDoctor
                  ? 'Verified'
                  : 'Physician Verified'}
              </span>
            </div>

            <p className="text-sm text-slate-700 mt-1">
              {isDoctor ? (
                'Conflicting severity levels documented across facilities. Verify with the patient before prescribing beta-lactams.'
              ) : (
                <>
                  Two hospitals recorded different severity levels for{' '}
                  <strong>{discrepancy.substance}</strong>. Both entries are preserved below for
                  clinician reconciliation.
                </>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {discrepancy.entries.map((entry) => {
              const sourceRec = records.find((r) => r.id === entry.sourceRecordId);
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
                        {isDoctor
                          ? `Source: ${entry.sourceRecordId}`
                          : `Inspect ${entry.sourceRecordId}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {discrepancy.resolutionNote ? (
            <div className="rounded-lg border border-teal-200 bg-white px-4 py-3 text-xs text-slate-700">
              <span className="font-semibold text-teal-800">
                Verified by {discrepancy.resolvedByDoctor}:
              </span>{' '}
              {discrepancy.resolutionNote}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
};
