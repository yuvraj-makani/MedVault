import React, { useMemo, useState } from 'react';
import { compareRecordDates, ISO_DATE_RE, type MedicalRecord } from '../types';

interface BiomarkerChartsProps {
  records: MedicalRecord[];
  onSelectRecord?: (record: MedicalRecord) => void;
}

interface DataPoint {
  date: string;
  value: number;
  hospital: string;
  record: MedicalRecord;
}

function extractNumericMetric(records: MedicalRecord[], keyword: string): DataPoint[] {
  const points: DataPoint[] = [];
  const sorted = [...records]
    .filter((r) => ISO_DATE_RE.test(r.date))
    .sort((a, b) => compareRecordDates(a, b, 'asc'));
  for (const rec of sorted) {
    for (const fact of rec.facts) {
      if (fact.label.toLowerCase().includes(keyword.toLowerCase())) {
        const numeric = parseFloat(fact.value.replace(/[^0-9.]/g, ''));
        if (!Number.isNaN(numeric)) {
          points.push({
            date: rec.date,
            value: numeric,
            hospital: rec.hospital,
            record: rec,
          });
        }
      }
    }
  }
  return points;
}

export const BiomarkerCharts: React.FC<BiomarkerChartsProps> = ({ records, onSelectRecord }) => {
  const [metric, setMetric] = useState<'hba1c' | 'glucose'>('hba1c');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points = useMemo(() => {
    return metric === 'hba1c'
      ? extractNumericMetric(records, 'hba1c')
      : extractNumericMetric(records, 'fasting glucose');
  }, [records, metric]);

  const hospitalStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const rec of records) {
      map.set(rec.hospital, (map.get(rec.hospital) ?? 0) + 1);
    }
    const total = Math.max(records.length, 1);
    return Array.from(map.entries())
      .map(([hospital, count]) => ({
        hospital,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [records]);

  const chartWidth = 540;
  const chartHeight = 200;
  const padLeft = 44;
  const padRight = 24;
  const padTop = 22;
  const padBottom = 34;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = chartHeight - padTop - padBottom;

  const minVal = metric === 'hba1c' ? 5.2 : 80;
  const maxVal = metric === 'hba1c' ? 6.8 : 130;

  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? padLeft + plotW / 2
        : padLeft + (i / (points.length - 1)) * plotW;
    const clamped = Math.min(Math.max(p.value, minVal), maxVal);
    const y = padTop + (1 - (clamped - minVal) / (maxVal - minVal)) * plotH;
    return { ...p, x, y };
  });

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const areaPoints =
    coords.length > 0
      ? `${coords[0].x},${padTop + plotH} ${polylinePoints} ${coords[coords.length - 1].x},${padTop + plotH}`
      : '';

  const thresholdValue = metric === 'hba1c' ? 6.0 : 100;
  const thresholdY =
    padTop + (1 - (thresholdValue - minVal) / (maxVal - minVal)) * plotH;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Cross-Hospital Glycemic Trend
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Unified lab values pulled from CityCare &amp; Metro Health records
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMetric('hba1c');
                setHoveredIdx(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                metric === 'hba1c'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              HbA1c (%)
            </button>
            <button
              type="button"
              onClick={() => {
                setMetric('glucose');
                setHoveredIdx(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                metric === 'glucose'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Glucose (mg/dL)
            </button>
          </div>
        </div>

        {coords.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-slate-500">
            No {metric === 'hba1c' ? 'HbA1c' : 'Fasting Glucose'} measurements in accessible records.
          </div>
        ) : (
          <div className="relative">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto overflow-visible"
              role="img"
              aria-label={`Cross-hospital ${metric === 'hba1c' ? 'HbA1c' : 'Fasting Glucose'} chart`}
            >
              <defs>
                <linearGradient id="medvaultTealArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0D9488" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#0D9488" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {[0, 0.5, 1].map((t, idx) => {
                const val = minVal + (maxVal - minVal) * (1 - t);
                const y = padTop + t * plotH;
                return (
                  <g key={idx}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={padLeft + plotW}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono tabular-nums"
                    >
                      {metric === 'hba1c' ? val.toFixed(1) : Math.round(val)}
                    </text>
                  </g>
                );
              })}

              {/* Reference threshold line */}
              <line
                x1={padLeft}
                y1={thresholdY}
                x2={padLeft + plotW}
                y2={thresholdY}
                stroke="#D97706"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padLeft + plotW}
                y={thresholdY - 5}
                textAnchor="end"
                className="fill-amber-700 text-[10px] font-medium"
              >
                Ref {metric === 'hba1c' ? '6.0%' : '100 mg/dL'}
              </text>

              {coords.length > 1 && (
                <>
                  <polygon points={areaPoints} fill="url(#medvaultTealArea)" />
                  <polyline
                    fill="none"
                    stroke="#0D9488"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={polylinePoints}
                  />
                </>
              )}

              {coords.map((pt, i) => {
                const isHovered = hoveredIdx === i;
                return (
                  <g
                    key={pt.record.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect ${pt.record.id} (${pt.date}, ${metric === 'hba1c' ? `${pt.value}%` : `${pt.value} mg/dL`})`}
                    className="cursor-pointer focus:outline-none"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onFocus={() => setHoveredIdx(i)}
                    onBlur={() => setHoveredIdx(null)}
                    onClick={() => onSelectRecord?.(pt.record)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectRecord?.(pt.record);
                      }
                    }}
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6.5 : 4.5}
                      fill="#FFFFFF"
                      stroke="#0D9488"
                      strokeWidth="2.5"
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 11}
                      textAnchor="middle"
                      className="fill-slate-900 text-[11px] font-mono font-semibold tabular-nums"
                    >
                      {metric === 'hba1c' ? `${pt.value}%` : pt.value}
                    </text>
                    <text
                      x={pt.x}
                      y={padTop + plotH + 18}
                      textAnchor="middle"
                      className="fill-slate-500 text-[10px] font-mono tabular-nums"
                    >
                      {pt.date.slice(0, 7)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hoveredIdx !== null && coords[hoveredIdx] && (
              <div className="mt-2 flex items-center justify-between text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <span>
                  <strong className="text-slate-900 font-mono">{coords[hoveredIdx].record.id}</strong>
                  {' · '}
                  {coords[hoveredIdx].hospital}
                  {' · '}
                  {coords[hoveredIdx].date}
                </span>
                <span className="font-mono font-semibold text-teal-700 tabular-nums">
                  {coords[hoveredIdx].value} {metric === 'hba1c' ? '%' : 'mg/dL'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Records by Care Facility
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-5">
            Consolidated across {hospitalStats.length} independent hospital networks
          </p>

          <div className="space-y-4">
            {hospitalStats.map((item, idx) => {
              const barColor =
                idx === 0 ? 'bg-teal-600' : idx === 1 ? 'bg-slate-800' : 'bg-teal-400';
              return (
                <div key={item.hospital}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-800 truncate pr-2">
                      {item.hospital}
                    </span>
                    <span className="font-mono text-xs text-slate-600 tabular-nums shrink-0">
                      {item.count} {item.count === 1 ? 'record' : 'records'} ({item.pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all duration-300`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Total Accessible Records</span>
          <span className="font-mono font-semibold text-slate-900 tabular-nums">
            {records.length}
          </span>
        </div>
      </div>
    </div>
  );
};
