import type {
  AISummaryResult,
  AllergyDiscrepancy,
  MedicalRecord,
} from '../src/types.js';

export const SEEDED_RECORD_IDS = [
  'REC-101',
  'REC-102',
  'REC-103',
  'REC-104',
  'REC-105',
  'REC-106',
  'REC-107',
  'REC-108',
  'REC-109',
] as const;

const SEEDED_ID_SET = new Set<string>(SEEDED_RECORD_IDS);

export function recordsMatchOriginalSeed(records: MedicalRecord[]): boolean {
  if (records.length !== SEEDED_RECORD_IDS.length) return false;
  const seen = new Set<string>();
  for (const rec of records) {
    if (!SEEDED_ID_SET.has(rec.id)) return false;
    if (rec.extractionStatus !== 'Seeded Synthetic') return false;
    seen.add(rec.id);
  }
  return seen.size === SEEDED_RECORD_IDS.length;
}

interface SampleFindingTemplate {
  category: string;
  statement: string;
  sourceQuote: string;
  sourceRecordId: string;
  uncertainty?: string;
  requiresFullRecord?: boolean;
  onlyWhenRedacted?: boolean;
}

interface SampleMedicationTemplate {
  medication: string;
  context: string;
  sourceQuote: string;
  sourceRecordId: string;
  requiresFullRecord?: boolean;
}

const SAMPLE_FINDINGS: SampleFindingTemplate[] = [
  {
    category: 'Allergy & Drug Safety',
    statement:
      'Outpatient allergy intake documented mild localized forearm hives developing 6 hours after amoxicillin (Penicillin) therapy, resolved with oral cetirizine.',
    sourceQuote:
      'Patient reported localized forearm hives developing 6 hours post-dose; resolved with oral cetirizine.',
    sourceRecordId: 'REC-101',
  },
  {
    category: 'Allergy & Drug Safety',
    statement:
      'Urgent care presentation 25 minutes after beta-lactam exposure documented severe anaphylaxis with facial angioedema, bronchospasm, and hypotension (88/56 mmHg), stabilized with IM epinephrine and IV hydrocortisone.',
    sourceQuote:
      'Developed facial angioedema, wheezing, and hypotension; stabilized with IM epinephrine and IV hydrocortisone.',
    sourceRecordId: 'REC-104',
    requiresFullRecord: true,
    uncertainty:
      'Conflicts with mild rash logged at CityCare Hospital (REC-101); reconcile before prescribing beta-lactams.',
  },
  {
    category: 'Allergy Reference (Scoped)',
    statement:
      'Penicillin allergy documented with Severe severity (severe anaphylaxis with bronchospasm and facial angioedema; strict avoidance). Encounter details beyond allergy status are restricted under Labs & Allergies Only scope.',
    sourceQuote:
      'Penicillin (Severe): Severe anaphylaxis with bronchospasm and facial angioedema (strict avoidance)',
    sourceRecordId: 'REC-104',
    onlyWhenRedacted: true,
    uncertainty:
      'Conflicts with mild rash logged at CityCare Hospital (REC-101); reconcile before prescribing beta-lactams.',
  },
  {
    category: 'Glycemic & Renal Baseline',
    statement:
      'Annual metabolic lab panel showed borderline elevated HbA1c (6.1%) and fasting glucose (108 mg/dL) with normal renal function (creatinine 0.82 mg/dL, eGFR >90 mL/min/1.73m²).',
    sourceQuote:
      'HbA1c (6.1%) and fasting glucose (108 mg/dL) remain mildly elevated in pre-diabetic range. Renal function normal.',
    sourceRecordId: 'REC-102',
  },
  {
    category: 'Respiratory Imaging',
    statement:
      'Chest radiograph (PA) for post-viral cough showed clear lung fields and normal cardiac silhouette with mild bilateral maxillary sinus mucosal thickening (SpO2 99%).',
    sourceQuote:
      'Lung fields clear without consolidation or pleural effusion; mild bilateral maxillary sinus mucosal thickening.',
    sourceRecordId: 'REC-103',
    requiresFullRecord: true,
  },
  {
    category: 'Metabolic & Lipid Drift',
    statement:
      'Follow-up lab panel documented upward progression in HbA1c (6.4%) and fasting glucose (116 mg/dL) alongside borderline LDL cholesterol (134 mg/dL) and triglycerides (162 mg/dL).',
    sourceQuote:
      'Upward trend in HbA1c and fasting glucose compared to 2024 baseline; advised specialist follow-up for lifestyle and pharmacotherapy consideration.',
    sourceRecordId: 'REC-105',
  },
  {
    category: 'Endocrinology Plan & Vitamin D',
    statement:
      'Initiated low-dose Metformin monotherapy and weekly Vitamin D3 repletion after serum 25-OH Vitamin D measured low at 18 ng/mL (BP 122/78 mmHg, BMI 24.6 kg/m²).',
    sourceQuote:
      'Initiated low-dose Metformin monotherapy and weekly Vitamin D repletion after suboptimal response to diet/exercise alone.',
    sourceRecordId: 'REC-106',
    requiresFullRecord: true,
  },
  {
    category: 'Hematology & Thyroid Labs',
    statement:
      'Three-month glycemic check improved HbA1c to 6.0% and fasting glucose to 102 mg/dL, with mild low hemoglobin (11.8 g/dL) and normal TSH (3.1 mIU/L).',
    sourceQuote:
      'Glycemic indices improved 3 months after starting Metformin. Mild normocytic anemia identified; iron supplementation recommended.',
    sourceRecordId: 'REC-107',
  },
  {
    category: 'Surgical History',
    statement:
      'Underwent uncomplicated day-care laparoscopic appendectomy using penicillin-safe macrolide prophylaxis (Azithromycin 500mg); discharged afebrile (98.4 °F).',
    sourceQuote:
      'Uncomplicated laparoscopic appendectomy performed under general anesthesia. Penicillin-safe antibiotic prophylaxis selected due to documented anaphylaxis alert.',
    sourceRecordId: 'REC-108',
    requiresFullRecord: true,
  },
  {
    category: 'Latest Cardiometabolic Lab',
    statement:
      'Most recent follow-up labs demonstrate normalized HbA1c (5.8%), fasting glucose (96 mg/dL), hemoglobin (12.6 g/dL), LDL cholesterol (112 mg/dL), and blood pressure (118/76 mmHg).',
    sourceQuote:
      'Sustained glycemic improvement (HbA1c 5.8%) and resolution of mild anemia. Patient reports good tolerance to Metformin 500mg.',
    sourceRecordId: 'REC-109',
  },
];

const SAMPLE_MEDICATIONS: SampleMedicationTemplate[] = [
  {
    medication: 'Metformin 500mg once daily with dinner',
    context: 'Documented in most recent metabolic follow-up for glycemic control (confirm active adherence with patient)',
    sourceQuote: 'Metformin 500mg once daily with dinner',
    sourceRecordId: 'REC-109',
  },
  {
    medication: 'Elemental Iron + Folic Acid daily',
    context: 'Documented alongside hemoglobin 11.8 g/dL in Jan 2026 lab review (confirm whether ongoing)',
    sourceQuote: 'Elemental Iron + Folic Acid daily (started)',
    sourceRecordId: 'REC-107',
  },
  {
    medication: 'Cholecalciferol (Vitamin D3) 60,000 IU weekly x 8 weeks',
    context: 'Prescribed Oct 2025 for 25-OH Vitamin D deficiency (18 ng/mL; confirm completion)',
    sourceQuote: 'Cholecalciferol (Vitamin D3) 60,000 IU weekly x 8 weeks',
    sourceRecordId: 'REC-106',
    requiresFullRecord: true,
  },
  {
    medication: 'Azithromycin 500mg once daily x 3 days (completed) & Pantoprazole 40mg x 5 days (completed)',
    context: 'Short post-operative regimen at appendectomy discharge (May 2026)',
    sourceQuote: 'Azithromycin 500mg once daily x 3 days (completed)',
    sourceRecordId: 'REC-108',
    requiresFullRecord: true,
  },
  {
    medication: 'Cetirizine 10mg PRN (completed)',
    context: 'Short-term symptomatic relief for 2024 amoxicillin-associated hives',
    sourceQuote: 'Cetirizine 10mg PRN (completed)',
    sourceRecordId: 'REC-101',
  },
];

export function buildSampleAiSummary(params: {
  accessibleRecords: MedicalRecord[];
  scope: 'Full History' | 'Labs & Allergies Only';
  discrepancies: AllergyDiscrepancy[];
}): AISummaryResult {
  const permittedMap = new Map(params.accessibleRecords.map((r) => [r.id, r]));

  const keyFindings: AISummaryResult['keyFindings'] = [];
  for (const item of SAMPLE_FINDINGS) {
    const rec = permittedMap.get(item.sourceRecordId);
    if (!rec) continue;
    if (item.requiresFullRecord && rec.scopeRedacted) continue;
    if (item.onlyWhenRedacted && !rec.scopeRedacted) continue;
    keyFindings.push({
      category: item.category,
      statement: item.statement,
      sourceRecordId: rec.id,
      sourceHospital: rec.hospital,
      sourceDate: rec.date,
      uncertainty: item.uncertainty,
      citationVerified: true,
      sourceQuote: item.sourceQuote,
      evidenceStatus: rec.scopeRedacted ? 'scope-restricted' : 'verified-record',
      explanation: rec.scopeRedacted
        ? `Record ${rec.id} is restricted to documented allergy entries under "Labs & Allergies Only" scope.`
        : `Verified against ${rec.id} (${rec.extractionStatus}) at ${rec.hospital}.`,
    });
  }

  const activeMedications: AISummaryResult['activeMedications'] = [];
  for (const med of SAMPLE_MEDICATIONS) {
    const rec = permittedMap.get(med.sourceRecordId);
    if (!rec) continue;
    if (med.requiresFullRecord && rec.scopeRedacted) continue;
    activeMedications.push({
      medication: med.medication,
      context: med.context,
      sourceRecordId: rec.id,
      sourceHospital: rec.hospital,
      citationVerified: true,
      sourceQuote: med.sourceQuote,
      evidenceStatus: 'verified-record',
    });
  }

  const allergyConflicts: AISummaryResult['allergyConflicts'] = params.discrepancies.map((d) => {
    const evidenceSnippets = d.entries
      .filter((e) => permittedMap.has(e.sourceRecordId))
      .map((e) => ({
        recordId: e.sourceRecordId,
        hospital: e.hospital,
        severity: e.severity,
        excerpt: `${e.substance} (${e.severity}): ${e.reaction}`,
      }));
    const conflictReason = `Conflicting severity levels recorded across care facilities for ${d.substance}: ${evidenceSnippets
      .map((s) => `${s.recordId} (${s.hospital}) logged ${s.severity}`)
      .join(' vs. ')}.`;

    return {
      substance: d.substance,
      conflictSummary: d.resolutionNote
        ? `${d.entries.length} cross-hospital entries reconciled: ${d.resolutionNote}`
        : `Conflicting ${d.substance} severity documented across facilities (${d.entries
            .map((e) => `${e.hospital}: ${e.severity}`)
            .join(' vs. ')}).`,
      conflictReason,
      sourceRecordIds: evidenceSnippets.map((s) => s.recordId),
      actionRequired: d.resolutionNote
        ? `Verified by ${d.resolvedByDoctor ?? 'Physician'}`
        : 'Confirm severe beta-lactam anaphylaxis risk directly with patient before prescribing.',
      evidenceSnippets,
    };
  });

  const executiveBrief =
    params.scope === 'Full History'
      ? 'Pre-generated demonstration summary across Ananya Sharma’s 9 original seeded synthetic records (REC-101 to REC-109) spanning CityCare Hospital, Sunrise Medical Center, and Metro Health Clinic. Key longitudinal highlights include HbA1c progression from 6.1% (REC-102) to 6.4% (REC-105) followed by improvement to 5.8% after Metformin initiation (REC-106, REC-109), uncomplicated laparoscopic appendectomy (REC-108), and a critical Penicillin severity discrepancy between mild urticaria (REC-101) and severe anaphylaxis (REC-104).'
      : 'Pre-generated demonstration summary restricted to your current "Labs & Allergies Only" consent scope (6 accessible records: REC-101, REC-102, redacted allergy reference REC-104, REC-105, REC-107, REC-109). Accessible lab results show HbA1c improving from 6.4% (REC-105) to 5.8% (REC-109) and hemoglobin normalizing from 11.8 g/dL (REC-107) to 12.6 g/dL (REC-109), alongside a flagged Penicillin allergy severity discrepancy (REC-101 vs. REC-104).';

  const uncertaintiesAndGaps = [
    'Pre-generated demonstration data — not a live AI response. Reflects only the 9 original seeded synthetic records.',
    'Medication lists reflect historical record documentation; confirm active vs. completed therapies directly with the patient.',
  ];

  if (params.scope === 'Labs & Allergies Only') {
    uncertaintiesAndGaps.push(
      'Active "Labs & Allergies Only" consent scope excludes non-lab imaging, prescription, consultation, and discharge records and redacts non-allergy clinical narrative.'
    );
  } else {
    uncertaintiesAndGaps.push(
      'No post-September 2026 follow-up lipid or renal measurements are present in the seeded baseline dataset.'
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    model: 'Pre-generated Demo Snapshot (Seeded Records Only)',
    recordCountUsed: params.accessibleRecords.length,
    accessibleRecordIds: params.accessibleRecords.map((r) => r.id),
    executiveBrief,
    keyFindings,
    activeMedications,
    allergyConflicts,
    uncertaintiesAndGaps,
    disclaimer:
      'Pre-generated demonstration data — not a live AI response. Informational overview of consent-approved seeded records only; not clinical advice or diagnosis.',
    isSampleDemo: true,
  };
}
