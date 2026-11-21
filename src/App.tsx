import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  FileCheck2,
  Home,
  LayoutDashboard,
  Menu,
  RotateCcw,
  Sparkles,
  Stethoscope,
  Upload,
  User,
  X,
} from 'lucide-react';
import {
  ApiError,
  createDemoSession,
  fetchDoctorOverview,
  fetchPatientDashboard,
  resetDemoData,
} from './api';
import { AiSummaryScreen, type CachedAiSummaryEntry } from './components/AiSummaryScreen';
import { ConsentManagementScreen } from './components/ConsentManagementScreen';
import { DoctorDashboard } from './components/DoctorDashboard';
import { LandingPage, type WorkspaceScreen } from './components/LandingPage';
import { PatientDashboard } from './components/PatientDashboard';
import { RecordDetailModal } from './components/RecordDetailModal';
import { TimelineScreen } from './components/TimelineScreen';
import { UploadRecordScreen } from './components/UploadRecordScreen';
import type {
  AccessLogEntry,
  AllergyDiscrepancy,
  AllergyEntry,
  AuthUser,
  ConsentGrant,
  MedicalRecord,
  PatientProfile,
  Role,
} from './types';

export default function App() {
  const [viewMode, setViewMode] = useState<'landing' | 'workspace'>('landing');
  const [screen, setScreen] = useState<WorkspaceScreen>('patient-dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walkthroughOpen, setWalkthroughOpen] = useState(true);

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [doctors, setDoctors] = useState<AuthUser[]>([]);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Patient state
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [allergies, setAllergies] = useState<AllergyEntry[]>([]);
  const [discrepancies, setDiscrepancies] = useState<AllergyDiscrepancy[]>([]);
  const [consents, setConsents] = useState<ConsentGrant[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLogEntry[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);

  // Doctor state
  const [docPatient, setDocPatient] = useState<PatientProfile | null>(null);
  const [docConsent, setDocConsent] = useState<ConsentGrant | null>(null);
  const [docRecords, setDocRecords] = useState<MedicalRecord[]>([]);
  const [docDiscrepancies, setDocDiscrepancies] = useState<AllergyDiscrepancy[]>([]);
  const [docBlocked, setDocBlocked] = useState<{
    status: string;
    message: string;
    consent: ConsentGrant | null;
  } | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);

  // Lifted AI Summary cache keyed strictly by doctor + consent + records + discrepancy version
  const [aiSummaryCacheByDoctor, setAiSummaryCacheByDoctor] = useState<
    Record<string, CachedAiSummaryEntry | null>
  >({});

  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const loadPatientData = useCallback(async () => {
    setPatientLoading(true);
    setGlobalError(null);
    try {
      const data = await fetchPatientDashboard();
      setPatient(data.patient);
      setRecords(data.records);
      setAllergies(data.allergies);
      setDiscrepancies(data.discrepancies);
      setConsents(data.consents);
      setAccessLogs(data.accessLogs);
      setAiConfigured(data.aiConfigured);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to load patient dashboard.');
    } finally {
      setPatientLoading(false);
    }
  }, []);

  const loadDoctorData = useCallback(async (doctorId?: string) => {
    setDoctorLoading(true);
    setGlobalError(null);
    setDocBlocked(null);
    try {
      const data = await fetchDoctorOverview();
      setDocPatient(data.patient);
      setDocConsent(data.consent);
      setDocRecords(data.records);
      setDocDiscrepancies(data.discrepancies);
      setAiConfigured(data.aiConfigured);
      if (doctorId && data.recordsMatchSeed === false) {
        setAiSummaryCacheByDoctor((prev) =>
          prev[doctorId]?.summary.isSampleDemo ? { ...prev, [doctorId]: null } : prev
        );
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setDocRecords([]);
        setDocPatient(null);
        setDocConsent(null);
        if (doctorId) {
          setAiSummaryCacheByDoctor((prev) => ({ ...prev, [doctorId]: null }));
        }
        setDocBlocked({
          status: String(err.data.consentStatus || 'revoked'),
          message: err.message,
          consent: (err.data.consent as ConsentGrant) ?? null,
        });
      } else {
        setGlobalError(err instanceof Error ? err.message : 'Failed to load doctor dashboard.');
      }
    } finally {
      setDoctorLoading(false);
    }
  }, []);

  const switchRoleAndOpen = useCallback(
    async (role: Role, targetScreen: WorkspaceScreen, doctorId?: string) => {
      setAuthLoading(true);
      setGlobalError(null);
      setMobileMenuOpen(false);
      try {
        const session = await createDemoSession(role, doctorId);
        // State transition triggers the single authoritative data-load effect below
        setCurrentUser(session.user);
        setDoctors(session.doctors);
        setAiConfigured(session.aiConfigured);
        setViewMode('workspace');
        setScreen(targetScreen);
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : 'Could not switch demo session.');
      } finally {
        setAuthLoading(false);
      }
    },
    []
  );

  // Single authoritative data loader for workspace role/screen changes (prevents duplicate API calls & audit logs)
  const currentUserId = currentUser?.id ?? null;
  const currentUserRole = currentUser?.role ?? null;

  useEffect(() => {
    if (viewMode !== 'workspace' || !currentUserId || !currentUserRole) return;
    if (
      currentUserRole === 'patient' &&
      (screen === 'patient-dashboard' || screen === 'consents' || screen === 'timeline')
    ) {
      void loadPatientData();
    } else if (
      currentUserRole === 'doctor' &&
      (screen === 'doctor-dashboard' || screen === 'ai-summary')
    ) {
      void loadDoctorData(currentUserId);
    }
  }, [viewMode, currentUserId, currentUserRole, screen, loadPatientData, loadDoctorData]);

  // Expected cache key for the active doctor's current permissions & records
  const expectedSummaryCacheKey = useMemo(() => {
    if (!currentUserId || currentUserRole !== 'doctor' || !docConsent || docConsent.status !== 'approved') {
      return '';
    }
    const recSig = [...docRecords]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((r) => `${r.id}:${r.extractionStatus}:${r.date}:${r.summary.length}`)
      .join('|');
    const discSig = docDiscrepancies
      .map((d) => `${d.substance}:${d.resolvedAt ?? 'unverified'}`)
      .join('|');
    return `${currentUserId}::${docConsent.scope}::${docConsent.updatedAt}::${recSig}::${discSig}`;
  }, [currentUserId, currentUserRole, docConsent, docRecords, docDiscrepancies]);

  const handleResetDemo = async () => {
    setResetting(true);
    setGlobalError(null);
    try {
      await resetDemoData();
      setAiSummaryCacheByDoctor({});
      if (currentUser?.role === 'doctor') {
        await createDemoSession('doctor', currentUser.id);
        setScreen('doctor-dashboard');
        await loadDoctorData(currentUser.id);
      } else {
        await createDemoSession('patient');
        setScreen('patient-dashboard');
        await loadPatientData();
      }
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Unable to reset demo data.');
    } finally {
      setResetting(false);
    }
  };

  if (viewMode === 'landing') {
    return (
      <LandingPage
        onLaunchDemo={(role, targetScreen, doctorId) => {
          void switchRoleAndOpen(role, targetScreen, doctorId);
        }}
        loadingRole={authLoading}
      />
    );
  }

  const isPatient = currentUser?.role === 'patient';

  const patientNav: { id: WorkspaceScreen; label: string; icon: React.ReactNode }[] = [
    { id: 'patient-dashboard', label: 'Patient Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'timeline', label: 'Medical Timeline', icon: <Clock className="w-4 h-4" /> },
    { id: 'upload', label: 'Upload Record', icon: <Upload className="w-4 h-4" /> },
    { id: 'consents', label: 'Consent & Audit Log', icon: <FileCheck2 className="w-4 h-4" /> },
  ];

  const doctorNav: { id: WorkspaceScreen; label: string; icon: React.ReactNode }[] = [
    { id: 'doctor-dashboard', label: 'Doctor Dashboard', icon: <Stethoscope className="w-4 h-4" /> },
    { id: 'ai-summary', label: 'AI Doctor Summary', icon: <Sparkles className="w-4 h-4" /> },
  ];

  const navItems = isPatient ? patientNav : doctorNav;

  const screenTitleMap: Record<WorkspaceScreen, string> = {
    'patient-dashboard': 'Patient Dashboard',
    timeline: 'Medical Timeline',
    upload: 'Upload Medical Record',
    consents: 'Consent Management',
    'doctor-dashboard': 'Doctor Dashboard',
    'ai-summary': 'AI Doctor Summary',
  };

  const walkthroughSteps: {
    step: string;
    label: string;
    active: boolean;
    onClick: () => void;
  }[] = [
    {
      step: 'Step 1',
      label: 'Explore unified medical records.',
      active: isPatient && (screen === 'patient-dashboard' || screen === 'timeline'),
      onClick: () => {
        if (isPatient) {
          setScreen('patient-dashboard');
        } else {
          void switchRoleAndOpen('patient', 'patient-dashboard');
        }
      },
    },
    {
      step: 'Step 2',
      label: 'Upload and digitize a medical report.',
      active: isPatient && screen === 'upload',
      onClick: () => {
        if (isPatient) {
          setScreen('upload');
        } else {
          void switchRoleAndOpen('patient', 'upload');
        }
      },
    },
    {
      step: 'Step 3',
      label: 'Approve doctor access.',
      active: isPatient && screen === 'consents',
      onClick: () => {
        if (isPatient) {
          setScreen('consents');
        } else {
          void switchRoleAndOpen('patient', 'consents');
        }
      },
    },
    {
      step: 'Step 4',
      label: 'View the AI Doctor Summary.',
      active: !isPatient && screen === 'ai-summary',
      onClick: () => {
        if (!isPatient && currentUser?.id === 'doc-vikram') {
          setScreen('ai-summary');
        } else {
          void switchRoleAndOpen('doctor', 'ai-summary', 'doc-vikram');
        }
      },
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-4">
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            onClick={() => setViewMode('landing')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2"
          >
            <Activity className="w-5 h-5 text-teal-700" />
            <span>MedVault</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setScreen(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-50 text-teal-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* DEMO ONLY Role Switcher */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold text-amber-800 uppercase tracking-wider">
              Demo Only Switcher
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Issues a real backend session token for testing patient vs. physician RBAC.
          </p>

          <div className="space-y-1.5 pt-1">
            <button
              type="button"
              disabled={authLoading}
              onClick={() => void switchRoleAndOpen('patient', 'patient-dashboard')}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs border transition-colors flex items-center gap-2 ${
                currentUser?.id === 'patient-ananya'
                  ? 'border-teal-600 bg-white text-slate-900 font-semibold'
                  : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
              }`}
            >
              <User className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span className="truncate">Ananya Sharma (Patient)</span>
            </button>

            {doctors.map((doc) => (
              <button
                key={doc.id}
                type="button"
                disabled={authLoading}
                onClick={() => void switchRoleAndOpen('doctor', 'doctor-dashboard', doc.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs border transition-colors flex items-center gap-2 ${
                  currentUser?.id === doc.id
                    ? 'border-teal-600 bg-white text-slate-900 font-semibold'
                    : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                <span className="truncate">{doc.name} (Doctor)</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom utilities */}
      <div className="space-y-2 pt-4 border-t border-slate-200">
        <button
          type="button"
          disabled={resetting}
          onClick={() => void handleResetDemo()}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{resetting ? 'Resetting Demo...' : 'Reset Demo Data'}</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('landing')}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Back to Landing Page</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-50 w-72 max-w-[85vw] bg-white h-full border-r border-slate-200 overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Workspace Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-slate-500 flex items-center gap-2 truncate">
              <span className="font-medium text-slate-700">
                {isPatient ? 'Patient Portal' : 'Doctor Portal'}
              </span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900 truncate">
                {screenTitleMap[screen]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-block text-xs text-slate-500 whitespace-nowrap">
              {currentUser?.name}
            </span>
            <button
              type="button"
              disabled={authLoading}
              onClick={() =>
                void switchRoleAndOpen(
                  isPatient ? 'doctor' : 'patient',
                  isPatient ? 'doctor-dashboard' : 'patient-dashboard',
                  isPatient ? 'doc-vikram' : undefined
                )
              }
              className="px-3.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0"
            >
              {isPatient ? 'Switch to Doctor (Demo)' : 'Switch to Patient (Demo)'}
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
          {/* Compact Collapsible "Explore MedVault" Walkthrough */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setWalkthroughOpen((prev) => !prev)}
              className="w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Compass className="w-4 h-4 text-teal-700 shrink-0" />
                <span>Explore MedVault</span>
                <span className="text-slate-400 font-normal hidden sm:inline">
                  — 4-step interactive demo walkthrough
                </span>
              </div>
              {walkthroughOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
              )}
            </button>

            {walkthroughOpen && (
              <div className="px-4 pb-3.5 pt-1 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {walkthroughSteps.map((item) => (
                  <button
                    key={item.step}
                    type="button"
                    disabled={authLoading}
                    onClick={item.onClick}
                    className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                      item.active
                        ? 'border-teal-600 bg-teal-50/60'
                        : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-mono text-[11px] font-semibold text-teal-700">
                      {item.step}
                    </div>
                    <div className="text-xs font-medium text-slate-900 mt-0.5 leading-snug">
                      {item.label}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {globalError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {globalError}
            </div>
          )}

          {isPatient && screen === 'patient-dashboard' && (
            <>
              {patientLoading && !patient ? (
                <div className="space-y-4">
                  <div className="h-28 rounded-xl border border-slate-200 bg-white animate-pulse" />
                  <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
                </div>
              ) : (
                patient && (
                  <PatientDashboard
                    patient={patient}
                    records={records}
                    allergies={allergies}
                    discrepancies={discrepancies}
                    consents={consents}
                    onSelectRecord={(rec) => setSelectedRecord(rec)}
                    onNavigate={(s) => setScreen(s)}
                  />
                )
              )}
            </>
          )}

          {isPatient && screen === 'upload' && (
            <UploadRecordScreen
              aiConfigured={aiConfigured}
              onUploaded={() => {
                setAiSummaryCacheByDoctor({});
                void loadPatientData();
              }}
              onGoTimeline={() => setScreen('timeline')}
            />
          )}

          {isPatient && screen === 'timeline' && (
            <TimelineScreen
              records={records}
              onSelectRecord={(rec) => setSelectedRecord(rec)}
              onGoUpload={() => setScreen('upload')}
              canUpload
            />
          )}

          {isPatient && screen === 'consents' && (
            <ConsentManagementScreen
              consents={consents}
              accessLogs={accessLogs}
              onRefresh={async () => {
                setAiSummaryCacheByDoctor({});
                await loadPatientData();
              }}
            />
          )}

          {!isPatient && screen === 'doctor-dashboard' && currentUser && (
            <DoctorDashboard
              currentDoctor={currentUser}
              patient={docPatient}
              consent={docConsent}
              records={docRecords}
              discrepancies={docDiscrepancies}
              blockedState={docBlocked}
              loading={doctorLoading}
              onSelectRecord={(rec) => setSelectedRecord(rec)}
              onOpenAiSummary={() => setScreen('ai-summary')}
              onRefreshDoctor={() => loadDoctorData(currentUser.id)}
              onSwitchToPatientConsents={() =>
                void switchRoleAndOpen('patient', 'consents')
              }
            />
          )}

          {!isPatient && screen === 'ai-summary' && currentUser && (
            <AiSummaryScreen
              currentDoctor={currentUser}
              accessibleRecords={docRecords}
              expectedCacheKey={expectedSummaryCacheKey}
              cachedEntry={aiSummaryCacheByDoctor[currentUser.id] ?? null}
              blockedMessage={docBlocked ? docBlocked.message : null}
              aiConfigured={aiConfigured}
              doctorLoading={doctorLoading}
              onCacheUpdate={(entry) =>
                setAiSummaryCacheByDoctor((prev) => ({
                  ...prev,
                  [currentUser.id]: entry,
                }))
              }
              onSelectRecord={(rec) => setSelectedRecord(rec)}
              onGoConsentFallback={() => setScreen('doctor-dashboard')}
            />
          )}
        </main>
      </div>

      {/* Private Document & Record Detail Modal */}
      <RecordDetailModal
        record={selectedRecord}
        canVerify={isPatient}
        onRecordVerified={(updated) => {
          setSelectedRecord(updated);
          setAiSummaryCacheByDoctor({});
          void loadPatientData();
        }}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}
