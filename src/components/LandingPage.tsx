import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Lock,
  ShieldAlert,
  Stethoscope,
  Upload,
} from 'lucide-react';
import type { Role } from '../types';

export type WorkspaceScreen =
  | 'patient-dashboard'
  | 'upload'
  | 'timeline'
  | 'consents'
  | 'doctor-dashboard'
  | 'ai-summary';

interface LandingPageProps {
  onLaunchDemo: (role: Role, screen: WorkspaceScreen, doctorId?: string) => void;
  loadingRole: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchDemo, loadingRole }) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Top Bar Contract: Brand Wordmark — 4 Single-Line Nav Links — 1 Primary Action */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            MedVault
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#problem"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Problem
            </a>
            <a
              href="#architecture"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Workflow
            </a>
            <a
              href="#demo-journey"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Demo Journey
            </a>
            <a
              href="#safeguards"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Safeguards
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              disabled={loadingRole}
              onClick={() => onLaunchDemo('patient', 'patient-dashboard')}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              {loadingRole ? 'Starting Demo...' : 'Launch Demo'}
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Split */}
        <section className="max-w-7xl mx-auto px-6 pt-12 pb-10 lg:pt-16 lg:pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-medium text-teal-700 mb-3 tracking-wide">
                Patient-Owned Medical Vault · Synthetic Hackathon Prototype
              </p>
              <h1
                className="font-display font-bold tracking-tight text-slate-900 leading-[1.08]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
              >
                One unified medical timeline across every hospital you visit.
              </h1>
              <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                Patients struggle to gather scattered PDFs, lab printouts, and discharge summaries.
                Physicians waste consultation minutes hunting for missing allergies and prior labs.
                MedVault gives patients private control over their records and gives approved
                doctors a source-linked clinical brief in seconds.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  disabled={loadingRole}
                  onClick={() => onLaunchDemo('patient', 'patient-dashboard')}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Enter Patient Vault</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={loadingRole}
                  onClick={() => onLaunchDemo('doctor', 'doctor-dashboard', 'doc-vikram')}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                >
                  <Stethoscope className="w-4 h-4 text-teal-700" />
                  <span>Doctor Portal (Demo Only)</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[300px] lg:min-h-[400px] rounded-2xl border border-slate-200 overflow-hidden bg-slate-100">
                {!heroImgFailed ? (
                  <img
                    src="/src/assets/images/hero_medvault_clinic_1795293533512.jpg"
                    alt="Doctor and patient reviewing a unified medical timeline together on a clinical tablet"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-50 to-teal-50">
                    <Stethoscope className="w-12 h-12 text-teal-700 mb-3" />
                    <p className="font-display font-semibold text-slate-900">
                      Unified Cross-Hospital Clinical Brief
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      CityCare Hospital · Sunrise Medical Center · Metro Health Clinic
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4-Column Quantitative Strip below hero */}
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums">3</div>
              <div className="text-sm font-medium text-slate-700 mt-1">Synthetic Hospitals</div>
              <div className="text-xs text-slate-500 mt-0.5">
                CityCare, Sunrise &amp; Metro Health
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums">9</div>
              <div className="text-sm font-medium text-slate-700 mt-1">Seeded Records</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Labs, imaging, Rx &amp; discharge PDFs
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
              <div className="font-mono text-2xl font-bold text-amber-900 tabular-nums">1</div>
              <div className="text-sm font-medium text-amber-900 mt-1">Allergy Conflict Flagged</div>
              <div className="text-xs text-amber-800 mt-0.5">
                Mild vs. Severe Penicillin mismatch
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="font-mono text-2xl font-bold text-teal-700 tabular-nums">100%</div>
              <div className="text-sm font-medium text-slate-700 mt-1">Backend Consent Gated</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Revocation blocks API &amp; file downloads
              </div>
            </div>
          </div>
        </section>

        {/* Problem & Solution */}
        <section id="problem" className="border-t border-slate-200 bg-slate-50/60 py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-2xl mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Two sides of the same broken record workflow
              </h2>
              <p className="mt-3 text-slate-600">
                Care spans multiple clinics and labs, yet neither patients nor physicians have a
                single trustworthy view.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-7">
                <div className="text-xs font-semibold text-rose-700 uppercase tracking-wider mb-2">
                  Problem 1 · Patient Portability Gap
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900">
                  Patients struggle to gather and carry portable digital medical records
                </h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  Patients accumulate lab reports, imaging, prescriptions, and discharge PDFs
                  across separate clinics without a single portable copy. MedVault solves this with
                  AI-powered digitization, a searchable unified medical timeline, and a one-click
                  Portable Health Passport PDF.
                </p>
              </div>

              <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-7">
                <div className="text-xs font-semibold text-teal-700 uppercase tracking-wider mb-2">
                  Problem 2 · Fragmented Clinical Context
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900">
                  Doctors cannot access consolidated histories across hospital systems
                </h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  Outpatient clinicians rarely see urgent-care encounters or conflicting allergy logs
                  from other facilities. With patient-approved consent, MedVault delivers scoped
                  cross-hospital timelines, discrepancy alerts, and source-linked clinical summaries
                  built from accessible records.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Core Architecture / Capabilities */}
        <section id="architecture" className="py-16 border-t border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-2xl mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                How MedVault connects patient portability with clinical context
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-slate-200 p-6 bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <Upload className="w-5 h-5 text-teal-700 shrink-0" />
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    01. AI Digitization, Unified Timeline &amp; Health Passport
                  </h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Upload PDFs or images into private storage, extract structured clinical data for
                  patient verification, browse a unified cross-facility timeline, and export a
                  Portable Health Passport PDF anytime.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-6 bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <Lock className="w-5 h-5 text-teal-700 shrink-0" />
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    02. Consent-Controlled Doctor Access
                  </h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Doctors request access with explicit clinical scope (Full History or Labs &amp;
                  Allergies Only). Patients approve or revoke in one click; backend routes and file
                  downloads enforce every decision immediately.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-6 bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    03. Automated Allergy Discrepancy Flagging
                  </h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Cross-hospital allergy entries are compared automatically across accessible records.
                  Conflicting severities for the same substance are surfaced for explicit physician
                  verification rather than silently overwritten.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-6 bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <FileSearch className="w-5 h-5 text-teal-700 shrink-0" />
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    04. Source-Linked Doctor AI Summary
                  </h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Generates a structured clinical brief strictly from consent-approved records.
                  Every extracted finding cites its original record ID, shows verbatim source text,
                  and links directly to the permitted document.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Preconfigured Judge Demo Journey */}
        <section id="demo-journey" className="py-16 border-t border-slate-200 bg-slate-50/70">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Preconfigured Demo Journey for Judges
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Explore the complete end-to-end patient and physician loop using synthetic data for
                  Ananya Sharma.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <button
                type="button"
                onClick={() => onLaunchDemo('patient', 'patient-dashboard')}
                className="text-left rounded-xl border border-slate-200 bg-white p-5 hover:border-teal-600 transition-colors group"
              >
                <div className="font-mono text-xs font-semibold text-teal-700 mb-2">STEP 01</div>
                <div className="font-display font-bold text-slate-900 group-hover:text-teal-800">
                  Inspect Unified Vault
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  View Ananya’s 9 records across 3 hospitals, glycemic trend chart, and the flagged
                  Penicillin discrepancy.
                </p>
                <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                  <span>Open Patient Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onLaunchDemo('patient', 'upload')}
                className="text-left rounded-xl border border-slate-200 bg-white p-5 hover:border-teal-600 transition-colors group"
              >
                <div className="font-mono text-xs font-semibold text-teal-700 mb-2">STEP 02</div>
                <div className="font-display font-bold text-slate-900 group-hover:text-teal-800">
                  Upload &amp; Extract File
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Upload a PDF or image to private backend storage, extract fields with review
                  warnings, and see it persist in Timeline.
                </p>
                <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                  <span>Open Upload Screen</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onLaunchDemo('patient', 'consents')}
                className="text-left rounded-xl border border-slate-200 bg-white p-5 hover:border-teal-600 transition-colors group"
              >
                <div className="font-mono text-xs font-semibold text-teal-700 mb-2">STEP 03</div>
                <div className="font-display font-bold text-slate-900 group-hover:text-teal-800">
                  Approve or Revoke Consent
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Approve Dr. Meera Iyer’s pending request or revoke Dr. Vikram Rao and watch the
                  backend enforce 403 blocks.
                </p>
                <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                  <span>Open Consent Controls</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onLaunchDemo('doctor', 'ai-summary', 'doc-vikram')}
                className="text-left rounded-xl border border-slate-200 bg-white p-5 hover:border-teal-600 transition-colors group"
              >
                <div className="font-mono text-xs font-semibold text-teal-700 mb-2">STEP 04</div>
                <div className="font-display font-bold text-slate-900 group-hover:text-teal-800">
                  Source-Linked AI Brief
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Switch to Dr. Vikram Rao (Demo Only) and generate a clinical brief where every fact
                  links to its source record.
                </p>
                <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                  <span>Open Doctor AI Summary</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* Safeguards */}
        <section id="safeguards" className="py-14 border-t border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-900 text-white p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7">
                <h2 className="font-display text-2xl font-bold tracking-tight">
                  Built with strict demo &amp; clinical boundaries
                </h2>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-2xl">
                  All records, patient identities, and hospitals in MedVault are 100% synthetic.
                  Files are stored in private server storage outside public static directories and
                  streamed only after verifying server-side role and consent status.
                </p>
              </div>
              <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Private non-public file storage</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Server-enforced RBAC &amp; audit log</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>No clinical advice or diagnosis</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Server-side AI keys only</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>MedVault Hackathon Prototype · Synthetic Demo Data Only</span>
          <span>Role switching is strictly for demonstration purposes</span>
        </div>
      </footer>
    </div>
  );
};
