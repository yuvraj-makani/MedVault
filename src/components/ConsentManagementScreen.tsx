import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Lock,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  UserCheck,
} from 'lucide-react';
import { getErrorMessage, updateConsent } from '../api';
import type { AccessLogEntry, ConsentGrant, ConsentScope } from '../types';

interface ConsentManagementScreenProps {
  consents: ConsentGrant[];
  accessLogs: AccessLogEntry[];
  onRefresh: () => Promise<void>;
}

export const ConsentManagementScreen: React.FC<ConsentManagementScreenProps> = ({
  consents,
  accessLogs,
  onRefresh,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<Record<string, ConsentScope>>({});

  const handleDecision = async (
    consent: ConsentGrant,
    status: 'approved' | 'revoked'
  ) => {
    setBusyId(consent.id);
    setErrorMsg(null);
    try {
      const scope = selectedScopes[consent.id] ?? consent.scope;
      await updateConsent(consent.id, status, scope);
      await onRefresh();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Could not update consent permissions.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Consent Management &amp; Access Log
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Approve or revoke physician access to your private records. Changes take effect
          immediately across all backend API routes and file downloads.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Doctor Access Requests & Grants */}
      <div className="space-y-4">
        <h2 className="font-display text-base font-bold text-slate-900">
          Physician Access Requests &amp; Active Grants
        </h2>

        <div className="grid grid-cols-1 gap-4">
          {consents.map((grant) => {
            const isBusy = busyId === grant.id;
            const currentScope = selectedScopes[grant.id] ?? grant.scope;

            return (
              <div
                key={grant.id}
                className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-display text-base font-bold text-slate-900">
                      {grant.doctorName}
                    </h3>
                    {grant.status === 'approved' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approved
                      </span>
                    )}
                    {grant.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded">
                        <Clock className="w-3.5 h-3.5" />
                        Pending Your Approval
                      </span>
                    )}
                    {grant.status === 'revoked' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded">
                        <ShieldOff className="w-3.5 h-3.5" />
                        Revoked (Backend Blocked)
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                    <span>{grant.doctorSpecialty}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700">{grant.doctorHospital}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{grant.id}</span>
                  </div>

                  <p className="text-sm text-slate-700 pt-1">
                    <span className="text-slate-500">Purpose:</span> {grant.purpose}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 min-w-0 max-w-full">
                  <select
                    aria-label={`Access scope for ${grant.doctorName}`}
                    value={currentScope}
                    onChange={(e) =>
                      setSelectedScopes((prev) => ({
                        ...prev,
                        [grant.id]: e.target.value as ConsentScope,
                      }))
                    }
                    className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-800"
                  >
                    <option value="Full History">Scope: Full History</option>
                    <option value="Labs & Allergies Only">Scope: Labs &amp; Allergies Only</option>
                  </select>

                  {grant.status !== 'approved' ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDecision(grant, 'approved')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isBusy ? 'Updating...' : 'Approve Access'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDecision(grant, 'approved')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                      <span>Update Scope</span>
                    </button>
                  )}

                  {grant.status !== 'revoked' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDecision(grant, 'revoked')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 bg-white border border-rose-300 rounded-lg hover:bg-rose-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Revoke Access</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit & Access Logs */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Private Vault Access &amp; Audit Log
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable server-side record of every view, file download, approval, revocation, and
              blocked attempt.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {accessLogs.length} events
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-medium">Timestamp</th>
                <th className="py-2.5 px-4 font-medium">Actor</th>
                <th className="py-2.5 px-4 font-medium">Action</th>
                <th className="py-2.5 px-4 font-medium">Outcome</th>
                <th className="py-2.5 px-4 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accessLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                    {log.actorName}{' '}
                    <span className="text-slate-400 font-normal">({log.actorRole})</span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span
                      className={`font-mono font-semibold ${
                        log.outcome === 'ALLOWED' ? 'text-teal-700' : 'text-rose-700'
                      }`}
                    >
                      {log.outcome}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
