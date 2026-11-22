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
  flag?: 'normal' | 'borderline' | 'high' | 'low' | 'critical' | 'unverified';
  uncertainty?: string;
  verificationRequired?: boolean;
}

export type AllergySeverity = 'Mild' | 'Moderate' | 'Severe' | 'Unknown';

export interface AllergyMention {
  substance: string;
  severity: AllergySeverity;
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
  dateStatus?: 'documented' | 'missing' | 'ambiguous';
  summary: string;
  facts: ExtractedFact[];
  medications: string[];
  allergiesMentioned: AllergyMention[];
  missingFields?: string[];
  confirmedNegatives?: string[];
  verificationFlags?: string[];
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
  severity: AllergySeverity;
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

export type ConsentScope = 'Full History' | 'Labs & Allergies Only';

export const RECORD_CATEGORIES: readonly RecordCategory[] = [
  'Lab Report',
  'Consultation',
  'Prescription',
  'Imaging',
  'Discharge Summary',
  'Allergy & Immunization',
] as const;

export const KNOWN_HOSPITALS: readonly string[] = [
  'CityCare Hospital',
  'Sunrise Medical Center',
  'Metro Health Clinic',
] as const;

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function compareRecordDates(
  a: Pick<MedicalRecord, 'date' | 'createdAt'>,
  b: Pick<MedicalRecord, 'date' | 'createdAt'>,
  order: 'asc' | 'desc' = 'desc'
): number {
  const aKey = ISO_DATE_RE.test(a.date) ? a.date : a.createdAt.slice(0, 10);
  const bKey = ISO_DATE_RE.test(b.date) ? b.date : b.createdAt.slice(0, 10);
  return order === 'desc' ? bKey.localeCompare(aKey) : aKey.localeCompare(bKey);
}

export function buildSummaryRecordSignature(
  records: Pick<MedicalRecord, 'id' | 'extractionStatus' | 'date' | 'summary' | 'facts' | 'allergiesMentioned'>[],
  discrepancies: Pick<AllergyDiscrepancy, 'substance' | 'resolvedAt'>[]
): string {
  const recSig = [...records]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (r) =>
        `${r.id}:${r.extractionStatus}:${r.date}:${r.summary.length}:${r.facts.length}:${r.allergiesMentioned.length}`
    )
    .join('|');
  const discSig = [...discrepancies]
    .sort((a, b) => a.substance.localeCompare(b.substance))
    .map((d) => `${d.substance}:${d.resolvedAt ?? 'unverified'}`)
    .join('|');
  return `${recSig}::${discSig}`;
}

export interface ConsentGrant {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorHospital: string;
  purpose: string;
  scope: ConsentScope;
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

export type EvidenceStatus =
  | 'verified-record'
  | 'unverified-extraction'
  | 'unverified-citation'
  | 'scope-restricted';

export interface AISummaryFinding {
  category: string;
  statement: string;
  sourceRecordId: string;
  sourceHospital: string;
  sourceDate: string;
  uncertainty?: string;
  citationVerified?: boolean;
  sourceQuote?: string;
  evidenceStatus?: EvidenceStatus;
  explanation?: string;
}

export interface AISummaryMedication {
  medication: string;
  context: string;
  sourceRecordId: string;
  sourceHospital: string;
  citationVerified?: boolean;
  sourceQuote?: string;
  evidenceStatus?: EvidenceStatus;
}

export interface AISummaryConflict {
  substance: string;
  conflictSummary: string;
  conflictReason?: string;
  sourceRecordIds: string[];
  actionRequired: string;
  evidenceSnippets?: {
    recordId: string;
    hospital: string;
    severity: string;
    excerpt: string;
  }[];
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
  dateStatus?: 'documented' | 'missing' | 'ambiguous';
  dateUncertainty?: string;
  summary: string;
  facts: ExtractedFact[];
  medications: string[];
  allergiesMentioned: AllergyMention[];
  missingFields?: string[];
  confirmedNegatives?: string[];
  verificationFlags?: string[];
  extractionNotes: string;
  model: string;
}
