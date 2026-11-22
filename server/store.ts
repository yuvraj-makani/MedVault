import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AccessLogEntry,
  AllergyDiscrepancy,
  AllergyEntry,
  AuthUser,
  ConsentGrant,
  MedicalRecord,
  PatientProfile,
} from '../src/types.js';
import { buildSyntheticClinicalPdf } from './pdfGen.js';

export const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
export const PRIVATE_UPLOAD_DIR = path.resolve(STORAGE_ROOT, 'private_uploads');
const DB_FILE = path.resolve(STORAGE_ROOT, 'medvault-db.json');

export interface AllergyResolution {
  substance: string;
  resolutionNote: string;
  resolvedByDoctor: string;
  resolvedAt: string;
}

export interface MedVaultDatabase {
  patient: PatientProfile;
  doctors: AuthUser[];
  records: MedicalRecord[];
  consents: ConsentGrant[];
  allergyResolutions: Record<string, AllergyResolution>;
  accessLogs: AccessLogEntry[];
}

export function resolveSafeUploadPath(storageKey: string): string {
  const safeBase = path.basename(storageKey);
  const resolved = path.resolve(PRIVATE_UPLOAD_DIR, safeBase);
  if (!resolved.startsWith(PRIVATE_UPLOAD_DIR + path.sep)) {
    throw new Error('Blocked invalid private storage path.');
  }
  return resolved;
}

function renderRecordPdfBuffer(patient: PatientProfile, rec: MedicalRecord): Promise<Buffer> {
  return buildSyntheticClinicalPdf({
    recordId: rec.id,
    patientName: patient.name,
    medvaultId: patient.medvaultId,
    dob: patient.dob,
    hospital: rec.hospital,
    clinician: rec.clinician,
    category: rec.category,
    date: rec.date,
    title: rec.title,
    summary: rec.summary,
    facts: rec.facts,
    medications: rec.medications,
    allergies: rec.allergiesMentioned,
  });
}

async function buildInitialSeedState(): Promise<MedVaultDatabase> {
  const patient: PatientProfile = {
    id: 'patient-ananya',
    medvaultId: 'MV-IND-4082',
    name: 'Ananya Sharma',
    dob: '1994-05-14',
    age: 32,
    bloodGroup: 'B+',
    city: 'Bengaluru',
    avatarUrl: '/src/assets/images/avatar_patient_ananya_1795293532980.jpg',
  };

  const doctors: AuthUser[] = [
    {
      id: 'doc-vikram',
      name: 'Dr. Vikram Rao',
      role: 'doctor',
      specialty: 'Internal Medicine',
      hospital: 'CityCare Hospital',
      avatarUrl: '/src/assets/images/avatar_doctor_vikram_1795293533311.jpg',
    },
    {
      id: 'doc-meera',
      name: 'Dr. Meera Iyer',
      role: 'doctor',
      specialty: 'Cardiology & Metabolic Care',
      hospital: 'Sunrise Medical Center',
      avatarUrl: '/src/assets/images/avatar_doctor_vikram_1795293533311.jpg',
    },
  ];

  const records: MedicalRecord[] = [
    {
      id: 'REC-101',
      patientId: patient.id,
      title: 'Outpatient Drug Sensitivity & Allergy Intake',
      category: 'Allergy & Immunization',
      hospital: 'CityCare Hospital',
      clinician: 'Dr. Kavita Rao',
      date: '2024-03-18',
      summary:
        'Routine allergy intake after outpatient amoxicillin therapy. Patient reported localized forearm hives developing 6 hours post-dose; resolved with oral cetirizine.',
      facts: [
        { label: 'Documented Trigger', value: 'Penicillin (Amoxicillin)', flag: 'borderline' },
        { label: 'Reaction Phenotype', value: 'Mild urticarial skin rash', flag: 'borderline' },
        { label: 'Airway Involvement', value: 'None reported', flag: 'normal' },
      ],
      medications: ['Cetirizine 10mg PRN (completed)'],
      allergiesMentioned: [
        {
          substance: 'Penicillin',
          severity: 'Mild',
          reaction: 'Mild localized skin rash / urticaria (low severity, self-limiting)',
        },
      ],
      fileName: 'citycare_allergy_intake_2024_03.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 0,
      storageKey: 'rec_101_citycare_allergy.pdf',
      extractionStatus: 'Seeded Synthetic',
      createdAt: '2024-03-18T10:15:00.000Z',
    },
    {
      id: 'REC-102',
      patientId: patient.id,
      title: 'Comprehensive Metabolic & Glycemic Panel',
      category: 'Lab Report',
      hospital: 'Metro Health Clinic',
      clinician: 'Dr. R. Subramanian (Pathology)',
      date: '2024-09-12',
      summary:
        'Baseline annual preventive lab panel showing borderline elevated HbA1c and fasting plasma glucose with normal renal and hepatic function.',
      facts: [
        { label: 'HbA1c', value: '6.1', unit: '%', flag: 'borderline' },
        { label: 'Fasting Glucose', value: '108', unit: 'mg/dL', flag: 'borderline' },
        { label: 'Serum Creatinine', value: '0.82', unit: 'mg/dL', flag: 'normal' },
        { label: 'eGFR', value: '>90', unit: 'mL/min/1.73m²', flag: 'normal' },
      ],
      medications: [],
      allergiesMentioned: [],
      fileName: 'metro_metabolic_panel_2024_09.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 0,
      storageKey: 'rec_102_metro_metabolic.pdf',
      extractionStatus: 'Seeded Synthetic',
      createdAt: '2024-09-12T08:40:00.000Z',
    },
    {
      id: 'REC-103',
      patientId: patient.id,
      title: 'Chest Radiograph (PA View) & Sinus Screening',
      category: 'Imaging',
      hospital: 'Sunrise Medical Center',
      clinician: 'Dr. S. Kulkarni (Radiology)',
      date: '2025-01-22',
      summary:
        'Ordered for persistent post-viral cough lasting 3 weeks. Lung fields clear without consolidation or pleural effusion; mild bilateral maxillary sinus mucosal thickening.',
      facts: [
        { label: 'Chest X-Ray (PA)', value: 'Clear lung fields, normal cardiac silhouette', flag: 'normal' },
        { label: 'Maxillary Sinuses', value: 'Mild mucosal thickening', flag: 'borderline' },
        { label: 'SpO2 at Scan', value: '99', unit: '%', flag: 'normal' },
      ],
      medications: ['Saline nasal spray'],
      allergiesMentioned: [],
      fileName: 'sunrise_chest_xray_2025_01.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 0,
      storageKey: 'rec_103_sunrise_imaging.pdf',
      extractionStatus: 'Seeded Synthetic',
      createdAt: '2025-01-22T14:20:00.000Z',
    },
    {
      id: 'REC-104',
      patientId: patient.id,
      title: 'Urgent Care Acute Hypersensitivity Encounter',
      category: 'Consultation',
      hospital: 'Sunrise Medical Center',
      clinician: 'Dr. Arjun Deshmukh',
      date: '2025-04-08',
      summary:
        'Emergency presentation 25 minutes after beta-lactam antibiotic exposure for sinusitis. Developed facial angioedema, wheezing, and hypotension; stabilized with IM epinephrine and IV hydrocortisone.',
      facts: [
        { label: 'Acute Trigger', value: 'Beta-lactam / Penicillin class', flag: 'critical' },
        { label: 'Clinical Presentation', value: 'Facial angioedema & bronchospasm', flag: 'critical' },
        { label: 'BP on Arrival', value: '88/56', unit: 'mmHg', flag: 'critical' },
        { label: 'Post-Treatment BP', value: '116/74', unit: 'mmHg', flag: 'normal' },
      ],
      medications: ['Epinephrine 0.3mg IM (emergency)', 'Prednisolone 40mg x 3 days (completed)'],
      allergiesMentioned: [
        {
          substance: 'Penicillin',
          severity: 'Severe',
          reaction: 'Severe anaphylaxis with bronchospasm and facial angioedema (strict avoidance)',
        },
      ],
      fileName: 'sunrise_emergency_anaphylaxis_2025_04.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 0,
      storageKey: 'rec_104_sunrise_emergency.pdf',
      extractionStatus: 'Seeded Synthetic',
      createdAt: '2025-04-08T19:05:00.000Z',
    },
    {
      id: 'REC-105',
      patientId: patient.id,
      title: 'Lipid Profile & Glycemic Progression Lab',
      category: 'Lab Report',
      hospital: 'CityCare Hospital',
      clinician: 'Dr. M. Chatterjee (Diagnostics)',
      date: '2025-07-19',
      summary:
        'Six-month metabolic follow-up showing mild upward drift in HbA1c (6.4%) and borderline elevated LDL cholesterol.',
      facts: [
        { label: 'HbA1c', value: '6.4', unit: '%', flag: 'high' },
        { label: 'Fasting Glucose', value: '116', unit: 'mg/dL', flag: 'high' },
        { label: 'LDL Cholesterol', value: '134', unit: 'mg/dL', flag: 'borderline' },
        { label: 'HDL Cholesterol', value: '48', unit: 'mg/dL', flag: 'normal' },
        { label: 'Triglycerides', value: '162', unit: 'mg/dL', flag: 'borderline' },
      ],
      medications: [],
      allergiesMentioned: [],
      fileName: 'citycare_lipid_glycemic_2025_07.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 0,
      storageKey: 'rec_105_citycare_labs.pdf',
      extractionStatus: 'Seeded Synthetic',
      createdAt: '2025-07-19T09:10:00.000Z',
    },
    {
      id: 'REC-106',
      patientId: patient.id,
      title: 'Endocrinology Outpatient Prescription & Plan',
      category: 'Prescription',
      hospital: 'Metro Health Clinic',
      clinician: 'Dr. Neha Kulkarni',
      date: '2025-10-03',
      summary:
        'Initiated low-dose Metformin monotherapy alongside Vitamin D3 repletion after serum 25-OH Vitamin D measured 18 ng/mL.',
      facts: [
        { label: 'Serum 25-OH Vitamin D', value: '18', unit: 'ng/mL', flag: 'low' },
        { label: 'BMI', value: '24.6', unit: 'kg/m²', flag: 'normal' },
        { label: 'Blood Pressure', value: '122/78', unit: 'mmHg', flag: 'normal' },
      ],
      medications: [
        'Metformin 500mg once daily with dinner',
        'Cholecalciferol (Vitamin D3) 60,000 IU weekly x 8 weeks',
      ],
      allergiesMentioned: [],
      fileName: 'metro_endocrinology_rx_2025_10.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 0,
      storageKey: 'rec_106_metro_rx.pdf',
      extractionStatus: 'Seeded Synthetic',
      createdAt: '2025-10-03T11:30:00.000Z',
    },
    {
      id: 'REC-107',
      patientId: patient.id,
      title: 'Complete Blood Count, Thyroid & Glycemic Check',
      category: 'Lab Report',
      hospital: 'CityCare Hospital',
      clinician: 'Dr. M. Chatterjee (Diagnostics)',
      date: '2026-01-15',
      summary:
        '3-month response review on Metformin 500mg. HbA1c improved from 6.4% to 6.0%; mild borderline anemia noted with Hemoglobin 11.8 g/dL.',
      facts: [
        { label: 'HbA1c', value: '6.0', unit: '%', flag: 'borderline' },
        { label: 'Fasting Glucose', value: '102', unit: 'mg/dL', flag: 'borderline' },
        { label: 'Hemoglobin', value: '11.8', unit: 'g/dL', flag: 'low' },
        { label: 'TSH', value: '3.1', unit: 'mIU/L', flag: 'normal' },
      ],
      medications: ['Metformin 500mg once daily with dinner', 'Elemental Iron + Folic Acid daily'],
      allergiesMentioned: [],
      fileName: 'citycare_cbc_thyroid_2026_01.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 0,
      storageKey: 'rec_107_citycare_cbc.pdf',
      extractionStatus: 'Seeded Synthetic',
      createdAt: '2026-01-15T08:55:00.000Z',
    },
    {
      id: 'REC-108',
      patientId: patient.id,
      title: 'Day-Care Laparoscopic Appendectomy Discharge Summary',
      category: 'Discharge Summary',
      hospital: 'Sunrise Medical Center',
      clinician: 'Dr. Rohit Menon (General Surgery)',
      date: '2026-05-28',
      summary:
        'Uncomplicated laparoscopic appendectomy for early acute appendicitis. Non-beta-lactam antimicrobial prophylaxis selected due to documented penicillin allergy.',
      facts: [
        { label: 'Procedure', value: 'Laparoscopic appendectomy (uncomplicated)', flag: 'normal' },
        { label: 'Discharge Temperature', value: '98.4', unit: '°F', flag: 'normal' },
        { label: 'Surgical Prophylaxis Note', value: 'Penicillin-safe macrolide regimen used', flag: 'normal' },
      ],
      medications: [
        'Azithromycin 500mg once daily x 3 days (completed)',
        'Pantoprazole 40mg once daily x 5 days (completed)',
        'Metformin 500mg once daily (resumed post-op)',
      ],
      allergiesMentioned: [],
      fileName: 'sunrise_discharge_summary_2026_05.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 0,
      storageKey: 'rec_108_sunrise_discharge.pdf',
      extractionStatus: 'Seeded Synthetic',
      createdAt: '2026-05-28T16:45:00.000Z',
    },
    {
      id: 'REC-109',
      patientId: patient.id,
      title: 'Quarterly Cardiometabolic & Hemoglobin Follow-Up',
      category: 'Lab Report',
      hospital: 'Metro Health Clinic',
      clinician: 'Dr. Neha Kulkarni',
      date: '2026-09-10',
      summary:
        'Excellent glycemic and hematologic normalization. HbA1c now 5.8%, fasting glucose 96 mg/dL, and hemoglobin recovered to 12.6 g/dL.',
      facts: [
        { label: 'HbA1c', value: '5.8', unit: '%', flag: 'normal' },
        { label: 'Fasting Glucose', value: '96', unit: 'mg/dL', flag: 'normal' },
        { label: 'Hemoglobin', value: '12.6', unit: 'g/dL', flag: 'normal' },
        { label: 'LDL Cholesterol', value: '112', unit: 'mg/dL', flag: 'normal' },
        { label: 'Blood Pressure', value: '118/76', unit: 'mmHg', flag: 'normal' },
      ],
      medications: ['Metformin 500mg once daily with dinner'],
      allergiesMentioned: [],
      fileName: 'metro_followup_2026_09.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 0,
      storageKey: 'rec_109_metro_followup.pdf',
      extractionStatus: 'Seeded Synthetic',
      createdAt: '2026-09-10T10:05:00.000Z',
    },
  ];

  // Materialize synthetic PDFs into PRIVATE_UPLOAD_DIR
  fs.mkdirSync(PRIVATE_UPLOAD_DIR, { recursive: true });
  for (const rec of records) {
    const pdfBuffer = await renderRecordPdfBuffer(patient, rec);
    const destPath = resolveSafeUploadPath(rec.storageKey);
    fs.writeFileSync(destPath, pdfBuffer);
    rec.fileSizeBytes = pdfBuffer.length;
  }

  const consents: ConsentGrant[] = [
    {
      id: 'CON-201',
      patientId: patient.id,
      doctorId: 'doc-vikram',
      doctorName: 'Dr. Vikram Rao',
      doctorSpecialty: 'Internal Medicine',
      doctorHospital: 'CityCare Hospital',
      purpose: 'Annual Preventive & Cross-Hospital Medication Reconciliation',
      scope: 'Full History',
      status: 'approved',
      requestedAt: '2026-11-18T09:30:00.000Z',
      updatedAt: '2026-11-18T11:15:00.000Z',
    },
    {
      id: 'CON-202',
      patientId: patient.id,
      doctorId: 'doc-meera',
      doctorName: 'Dr. Meera Iyer',
      doctorSpecialty: 'Cardiology & Metabolic Care',
      doctorHospital: 'Sunrise Medical Center',
      purpose: 'Pre-Consultation Cardiometabolic & Allergy History Review',
      scope: 'Full History',
      status: 'pending',
      requestedAt: '2026-11-21T08:45:00.000Z',
      updatedAt: '2026-11-21T08:45:00.000Z',
    },
  ];

  const accessLogs: AccessLogEntry[] = [
    {
      id: 'LOG-001',
      timestamp: '2026-11-18T11:15:00.000Z',
      actorId: patient.id,
      actorName: patient.name,
      actorRole: 'patient',
      action: 'APPROVE_CONSENT',
      targetId: 'CON-201',
      outcome: 'ALLOWED',
      detail: 'Approved Full History access for Dr. Vikram Rao (CityCare Hospital).',
    },
    {
      id: 'LOG-002',
      timestamp: '2026-11-21T08:45:00.000Z',
      actorId: 'doc-meera',
      actorName: 'Dr. Meera Iyer',
      actorRole: 'doctor',
      action: 'REQUEST_CONSENT',
      targetId: 'CON-202',
      outcome: 'ALLOWED',
      detail: 'Requested Full History consent for pre-consultation review.',
    },
  ];

  return {
    patient,
    doctors,
    records,
    consents,
    allergyResolutions: {},
    accessLogs,
  };
}

let dbCache: MedVaultDatabase | null = null;

function saveDb(db: MedVaultDatabase): void {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  const tempFile = DB_FILE + '.tmp';
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tempFile, DB_FILE);
  dbCache = db;
}

export async function initDb(): Promise<MedVaultDatabase> {
  if (dbCache) {
    fs.mkdirSync(PRIVATE_UPLOAD_DIR, { recursive: true });
    return dbCache;
  }

  fs.mkdirSync(PRIVATE_UPLOAD_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw) as MedVaultDatabase;
      dbCache = parsed;
      for (const rec of dbCache.records) {
        const filePath = resolveSafeUploadPath(rec.storageKey);
        if (!fs.existsSync(filePath)) {
          const pdfBuffer = await renderRecordPdfBuffer(dbCache.patient, rec);
          fs.writeFileSync(filePath, pdfBuffer);
          rec.fileSizeBytes = pdfBuffer.length;
        }
      }
      return dbCache;
    } catch {
      // Fallback to fresh seed if corrupted
    }
  }

  const seeded = await buildInitialSeedState();
  saveDb(seeded);
  return seeded;
}

export function getDb(): MedVaultDatabase {
  if (!dbCache) {
    throw new Error('Database not initialized. Call initDb() at server startup.');
  }
  return dbCache;
}

export function mutateDb(mutator: (db: MedVaultDatabase) => void): MedVaultDatabase {
  const db = getDb();
  mutator(db);
  saveDb(db);
  return db;
}

export async function resetDemoDb(): Promise<MedVaultDatabase> {
  if (fs.existsSync(PRIVATE_UPLOAD_DIR)) {
    for (const fileName of fs.readdirSync(PRIVATE_UPLOAD_DIR)) {
      const target = resolveSafeUploadPath(fileName);
      if (fs.statSync(target).isFile()) {
        fs.unlinkSync(target);
      }
    }
  }
  const seeded = await buildInitialSeedState();
  saveDb(seeded);
  return seeded;
}

export function appendAccessLog(
  db: MedVaultDatabase,
  entry: Omit<AccessLogEntry, 'id' | 'timestamp'>
): void {
  const log: AccessLogEntry = {
    id: `LOG-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  db.accessLogs.unshift(log);
  if (db.accessLogs.length > 200) {
    db.accessLogs = db.accessLogs.slice(0, 200);
  }
}

export function computeAllergiesAndDiscrepanciesForRecords(
  records: MedicalRecord[],
  allergyResolutions: Record<string, AllergyResolution>
): {
  entries: AllergyEntry[];
  discrepancies: AllergyDiscrepancy[];
} {
  const entries: AllergyEntry[] = [];
  for (const rec of records) {
    for (let i = 0; i < rec.allergiesMentioned.length; i++) {
      const a = rec.allergiesMentioned[i];
      entries.push({
        id: `${rec.id}-ALG-${i + 1}`,
        substance: a.substance,
        severity: a.severity,
        reaction: a.reaction,
        hospital: rec.hospital,
        recordedAt: rec.date,
        sourceRecordId: rec.id,
      });
    }
  }

  const bySubstance = new Map<string, AllergyEntry[]>();
  for (const entry of entries) {
    const key = entry.substance.trim().toLowerCase();
    const list = bySubstance.get(key) ?? [];
    list.push(entry);
    bySubstance.set(key, list);
  }

  const discrepancies: AllergyDiscrepancy[] = [];
  for (const [key, list] of bySubstance.entries()) {
    const severities = new Set(list.map((item) => item.severity));
    if (list.length > 1 && severities.size > 1) {
      const resolution = allergyResolutions[key];
      discrepancies.push({
        substance: list[0].substance,
        entries: list,
        requiresVerification: !resolution,
        resolutionNote: resolution?.resolutionNote,
        resolvedByDoctor: resolution?.resolvedByDoctor,
        resolvedAt: resolution?.resolvedAt,
      });
    }
  }

  return { entries, discrepancies };
}

export function computeAllergiesAndDiscrepancies(db: MedVaultDatabase): {
  entries: AllergyEntry[];
  discrepancies: AllergyDiscrepancy[];
} {
  return computeAllergiesAndDiscrepanciesForRecords(db.records, db.allergyResolutions);
}
