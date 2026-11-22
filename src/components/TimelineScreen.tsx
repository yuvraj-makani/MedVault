import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  FileText,
  Search,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { compareRecordDates, type MedicalRecord } from '../types';
import { HealthPassportButton } from './HealthPassportButton';

interface TimelineScreenProps {
  records: MedicalRecord[];
  onSelectRecord: (record: MedicalRecord) => void;
  onGoUpload?: () => void;
  canUpload?: boolean;
}

export const TimelineScreen: React.FC<TimelineScreenProps> = ({
  records,
  onSelectRecord,
  onGoUpload,
  canUpload = true,
}) => {
  const [search, setSearch] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [exportError, setExportError] = useState<string | null>(null);

  const hospitals = useMemo(
    () => ['All', ...Array.from(new Set(records.map((r) => r.hospital)))],
    [records]
  );

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(records.map((r) => r.category)))],
    [records]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records
      .filter((r) => (hospitalFilter === 'All' ? true : r.hospital === hospitalFilter))
      .filter((r) => (categoryFilter === 'All' ? true : r.category === categoryFilter))
      .filter((r) => {
        if (!q) return true;
        const haystack = [
          r.id,
          r.title,
          r.hospital,
          r.clinician,
          r.category,
          r.summary,
          ...r.medications,
          ...r.facts.map((f) => `${f.label} ${f.value}`),
          ...r.allergiesMentioned.map((a) => `${a.substance} ${a.reaction}`),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => compareRecordDates(a, b, 'desc'));
  }, [records, hospitalFilter, categoryFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Medical Records Timeline
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Search and filter chronological clinical history across all connected facilities.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 min-w-0 max-w-full">
          {canUpload && <HealthPassportButton onError={setExportError} />}
          {canUpload && onGoUpload && (
            <button
              type="button"
              onClick={onGoUpload}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Record</span>
            </button>
          )}
        </div>
      </div>

      {exportError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search HbA1c, Penicillin, Metformin, Dr. Deshmukh, REC-104..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={hospitalFilter}
              onChange={(e) => setHospitalFilter(e.target.value)}
              aria-label="Filter by hospital"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {hospitals.map((h) => (
                <option key={h} value={h}>
                  {h === 'All' ? 'All Hospitals' : h}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'All' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="font-mono tabular-nums">
            Showing {filtered.length} of {records.length} records
          </span>
          {(search || hospitalFilter !== 'All' || categoryFilter !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setHospitalFilter('All');
                setCategoryFilter('All');
              }}
              className="text-teal-700 font-medium hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Longitudinal Timeline */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <FileText className="w-9 h-9 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-800">No matching medical records</p>
          <p className="text-xs text-slate-500 mt-1">
            Try clearing your search query or selecting &ldquo;All Hospitals&rdquo;.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 border-l border-slate-200 space-y-5 ml-2">
          {filtered.map((rec) => {
            const hasAllergy = rec.allergiesMentioned.length > 0;
            return (
              <div key={rec.id} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute -left-[29px] top-6 w-2.5 h-2.5 rounded-full border-2 border-white ${
                    hasAllergy ? 'bg-amber-600' : 'bg-teal-600'
                  }`}
                />
                <div className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-teal-700 tabular-nums">
                          {rec.id}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-slate-700">{rec.hospital}</span>
                        <span aria-hidden="true">·</span>
                        <span>{rec.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {rec.date}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{rec.clinician}</span>
                      </div>

                      <h3 className="font-display text-base font-bold text-slate-900 mt-1.5">
                        {rec.title}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{rec.summary}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectRecord(rec)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 self-start"
                    >
                      <FileText className="w-3.5 h-3.5 text-teal-700" />
                      <span>Open Record &amp; File</span>
                    </button>
                  </div>

                  {/* Structured fact strip */}
                  {(rec.facts.length > 0 || hasAllergy) && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                      {rec.facts.slice(0, 4).map((f, i) => (
                        <div key={i} className="text-slate-600">
                          <span className="text-slate-500">{f.label}:</span>{' '}
                          <span className="font-mono font-semibold text-slate-900 tabular-nums">
                            {f.value}
                            {f.unit ? ` ${f.unit}` : ''}
                          </span>
                        </div>
                      ))}
                      {hasAllergy && (
                        <div className="inline-flex items-center gap-1.5 text-rose-700 font-semibold">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>
                            Allergy Logged: {rec.allergiesMentioned.map((a) => `${a.substance} (${a.severity})`).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
