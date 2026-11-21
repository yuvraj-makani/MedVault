export type Role = 'patient' | 'doctor';

export type RecordCategory =
  | 'Lab Report'
  | 'Consultation'
  | 'Prescription'
  | 'Imaging'
  | 'Discharge Summary'
  | 'Allergy & Immunization';

export interface ExtractedFact {
  label: string;
  value: string;
  unit?: string;
  flag?: 'normal' | 'borderline' | 'high' | 'low' | 'critical';
  uncertainty?: string;
}

export interface AllergyMention {
  substance: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  reaction: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  title: string;
  category: RecordCategory;
  hospital: string;
  clinician: string;
  date: string;
  summary: string;
  facts: ExtractedFact[];
  medications: string[];
  allergiesMentioned: AllergyMention[];
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  extractionStatus:
    | 'Seeded Synthetic'
    | 'Extracted — Review Required'
    | 'Verified by Patient'
    | 'Manual Entry';
  extractionNotes?: string;
  scopeRedacted?: boolean;
  createdAt: string;
}

export interface AllergyEntry {
  id: string;
  substance: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  reaction: string;
  hospital: string;
  recordedAt: string;
  sourceRecordId: string;
}

export interface AllergyDiscrepancy {
  substance: string;
  entries: AllergyEntry[];
  requiresVerification: boolean;
  resolutionNote?: string;
  resolvedByDoctor?: string;
  resolvedAt?: string;
}

export interface ConsentGrant {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorHospital: string;
  purpose: string;
  scope: 'Full History' | 'Labs & Allergies Only';
  status: 'pending' | 'approved' | 'revoked';
  requestedAt: string;
  updatedAt: string;
}

export interface AccessLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  targetId?: string;
  outcome: 'ALLOWED' | 'DENIED';
  detail: string;
}

export interface PatientProfile {
  id: string;
  medvaultId: string;
  name: string;
  dob: string;
  age: number;
  bloodGroup: string;
  city: string;
  avatarUrl: string;
}

export interface AuthUser {
  id: string;
  name: string;
  role: Role;
  specialty?: string;
  hospital?: string;
  avatarUrl: string;
  medvaultId?: string;
}

export interface AISummaryFinding {
  category: string;
  statement: string;
  sourceRecordId: string;
  sourceHospital: string;
  sourceDate: string;
  uncertainty?: string;
  citationVerified?: boolean;
}

export interface AISummaryMedication {
  medication: string;
  context: string;
  sourceRecordId: string;
  sourceHospital: string;
  citationVerified?: boolean;
}

export interface AISummaryConflict {
  substance: string;
  conflictSummary: string;
  sourceRecordIds: string[];
  actionRequired: string;
}

export interface AISummaryResult {
  generatedAt: string;
  model: string;
  recordCountUsed: number;
  accessibleRecordIds: string[];
  executiveBrief: string;
  keyFindings: AISummaryFinding[];
  activeMedications: AISummaryMedication[];
  allergyConflicts: AISummaryConflict[];
  uncertaintiesAndGaps: string[];
  disclaimer: string;
  isSampleDemo?: boolean;
}

export interface ExtractionDraft {
  title: string;
  category: RecordCategory;
  hospital: string;
  clinician: string;
  date: string;
  summary: string;
  facts: ExtractedFact[];
  medications: string[];
  allergiesMentioned: AllergyMention[];
  extractionNotes: string;
  model: string;
}
