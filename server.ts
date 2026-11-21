import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import type { AISummaryResult, AuthUser, MedicalRecord, RecordCategory } from './src/types.js';
import { extractMedicalDocument, generateDoctorSummary, isAiConfigured } from './server/gemini.js';
import { buildHealthPassportPdf, buildSyntheticClinicalPdf } from './server/pdfGen.js';
import { buildSampleAiSummary, recordsMatchOriginalSeed } from './server/sampleSummary.js';
import {
  appendAccessLog,
  computeAllergiesAndDiscrepancies,
  computeAllergiesAndDiscrepanciesForRecords,
  getDb,
  initDb,
  mutateDb,
  resetDemoDb,
  resolveSafeUploadPath,
} from './server/store.js';

dotenv.config();

const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload a PDF, PNG, JPEG, or WebP file.'));
    }
  },
});

interface TokenPayload {
  userId: string;
  role: 'patient' | 'doctor';
  iat: number;
  exp: number;
}

function signToken(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

interface AuthedRequest extends express.Request {
  authUser?: AuthUser;
}

function resolveUserById(userId: string): AuthUser | null {
  const db = getDb();
  if (userId === db.patient.id) {
    return {
      id: db.patient.id,
      name: db.patient.name,
      role: 'patient',
      avatarUrl: db.patient.avatarUrl,
      medvaultId: db.patient.medvaultId,
    };
  }
  const doc = db.doctors.find((d) => d.id === userId);
  return doc ?? null;
}

function requireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please select a demo session.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please re-authenticate.' });
    return;
  }
  const user = resolveUserById(payload.userId);
  if (!user || user.role !== payload.role) {
    res.status(401).json({ error: 'Account not found.' });
    return;
  }
  req.authUser = user;
  next();
}

function filterRecordsByScope(
  records: MedicalRecord[],
  scope: 'Full History' | 'Labs & Allergies Only'
): MedicalRecord[] {
  if (scope === 'Full History') return records;
  const result: MedicalRecord[] = [];
  for (const r of records) {
    if (r.category === 'Lab Report' || r.category === 'Allergy & Immunization') {
      result.push(r);
    } else if (r.allergiesMentioned.length > 0) {
      // Redact non-lab/non-allergy consultation/discharge notes under Labs & Allergies Only
      result.push({
        ...r,
        title: `Allergy Record Reference (${r.category} Redacted)`,
        clinician: 'Redacted (Labs & Allergies Only Scope)',
        summary:
          'Clinical consultation narrative, non-allergy observations, and attached PDF are restricted under the patient\'s "Labs & Allergies Only" consent scope.',
        facts: [],
        medications: [],
        scopeRedacted: true,
      });
    }
  }
  return result;
}

function isFileAccessibleUnderScope(
  record: MedicalRecord,
  scope: 'Full History' | 'Labs & Allergies Only'
): boolean {
  if (scope === 'Full History') return true;
  return record.category === 'Lab Report' || record.category === 'Allergy & Immunization';
}

const aiRateLimitMap = new Map<string, number[]>();
const AI_RATE_LIMIT_MAX = 10;
const AI_RATE_LIMIT_WINDOW_MS = 60_000;

function rateLimitAi(
  req: AuthedRequest,
  res: express.Response,
  next: express.NextFunction
): void {
  const key = req.authUser?.id || req.ip || 'anonymous';
  const now = Date.now();
  const windowStart = now - AI_RATE_LIMIT_WINDOW_MS;
  const recent = (aiRateLimitMap.get(key) ?? []).filter((ts) => ts > windowStart);

  if (recent.length >= AI_RATE_LIMIT_MAX) {
    const oldest = recent[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + AI_RATE_LIMIT_WINDOW_MS - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({
      error: `AI rate limit reached (${AI_RATE_LIMIT_MAX} requests per minute). Please retry in ${retryAfterSec}s.`,
    });
    return;
  }

  recent.push(now);
  aiRateLimitMap.set(key, recent);
  next();
}

const serverAiSummaryCache = new Map<
  string,
  {
    cacheKey: string;
    summary: AISummaryResult;
  }
>();

function buildSummaryCacheKey(params: {
  doctorId: string;
  patientId: string;
  scope: string;
  consentUpdatedAt: string;
  records: MedicalRecord[];
  discrepancies: ReturnType<typeof computeAllergiesAndDiscrepancies>['discrepancies'];
}): string {
  const recSig = params.records
    .map((r) => `${r.id}:${r.extractionStatus}:${r.date}:${r.summary.length}`)
    .join('|');
  const discSig = params.discrepancies
    .map((d) => `${d.substance}:${d.resolvedAt ?? 'unverified'}`)
    .join('|');
  return crypto
    .createHash('sha256')
    .update(`${params.doctorId}::${params.patientId}::${params.scope}::${params.consentUpdatedAt}::${recSig}::${discSig}`)
    .digest('hex');
}

async function startServer() {
  // Initialize seeded DB & private PDFs on startup
  await initDb();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, aiConfigured: isAiConfigured() });
  });

  // Demo-only role switcher issuing real server-signed Bearer tokens
  app.post('/api/auth/demo-session', (req, res) => {
    const { role, doctorId } = req.body as { role?: string; doctorId?: string };
    const db = getDb();

    let user: AuthUser | undefined;
    if (role === 'patient') {
      user = {
        id: db.patient.id,
        name: db.patient.name,
        role: 'patient',
        avatarUrl: db.patient.avatarUrl,
        medvaultId: db.patient.medvaultId,
      };
    } else if (role === 'doctor') {
      const targetId = typeof doctorId === 'string' && doctorId ? doctorId : 'doc-vikram';
      user = db.doctors.find((d) => d.id === targetId);
    }

    if (!user) {
      res.status(400).json({ error: 'Invalid demo role or doctor selection.' });
      return;
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      iat: Date.now(),
      exp: Date.now() + 12 * 60 * 60 * 1000,
    });

    res.json({
      isDemoOnly: true,
      token,
      user,
      doctors: db.doctors,
      aiConfigured: isAiConfigured(),
    });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    res.json({
      user: req.authUser,
      doctors: db.doctors,
      aiConfigured: isAiConfigured(),
    });
  });

  // Patient dashboard (Patient role strictly enforced)
  app.get('/api/patient/dashboard', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'patient') {
      mutateDb((db) => {
        appendAccessLog(db, {
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          action: 'ACCESS_DENIED',
          targetId: 'PATIENT_DASHBOARD',
          outcome: 'DENIED',
          detail: 'Doctor role attempted to access private patient dashboard endpoint.',
        });
      });
      res.status(403).json({ error: 'Patient role required for this endpoint.' });
      return;
    }

    const db = getDb();
    const { entries, discrepancies } = computeAllergiesAndDiscrepancies(db);
    const sortedRecords = [...db.records].sort((a, b) => b.date.localeCompare(a.date));

    res.json({
      patient: db.patient,
      records: sortedRecords,
      allergies: entries,
      discrepancies,
      consents: db.consents,
      accessLogs: db.accessLogs,
      aiConfigured: isAiConfigured(),
    });
  });

  // Records list (RBAC: patient owns all; doctor requires approved consent)
  app.get('/api/records', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const db = getDb();

    if (user.role === 'patient') {
      const sorted = [...db.records].sort((a, b) => b.date.localeCompare(a.date));
      res.json({ records: sorted });
      return;
    }

    const consent = db.consents.find((c) => c.doctorId === user.id);
    if (!consent || consent.status !== 'approved') {
      mutateDb((draft) => {
        appendAccessLog(draft, {
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          action: 'ACCESS_DENIED',
          targetId: 'RECORDS_LIST',
          outcome: 'DENIED',
          detail: `Blocked records query by ${user.name} (consent status: ${consent?.status ?? 'none'}).`,
        });
      });
      res.status(403).json({
        error: 'Patient consent is required to access medical records.',
        consentStatus: consent?.status ?? 'none',
        consent,
      });
      return;
    }

    const accessible = filterRecordsByScope(db.records, consent.scope).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    res.json({ records: accessible, scope: consent.scope });
  });

  // Portable Health Passport PDF export (Patient role strictly enforced)
  app.get('/api/patient/health-passport', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'patient') {
      res.status(403).json({ error: 'Only the patient can export their Health Passport.' });
      return;
    }

    const db = getDb();
    const { entries, discrepancies } = computeAllergiesAndDiscrepancies(db);
    const generatedAt = new Date().toISOString();

    const pdfBuffer = await buildHealthPassportPdf({
      patient: db.patient,
      records: db.records,
      allergies: entries,
      discrepancies,
      generatedAt,
    });

    mutateDb((draft) => {
      appendAccessLog(draft, {
        actorId: user.id,
        actorName: user.name,
        actorRole: 'patient',
        action: 'EXPORT_HEALTH_PASSPORT',
        targetId: db.patient.medvaultId,
        outcome: 'ALLOWED',
        detail: `Exported Portable Health Passport PDF (${db.records.length} records).`,
      });
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Ananya_Sharma_Health_Passport.pdf"'
    );
    res.send(pdfBuffer);
  });

  // Server-side AI extraction preview for uploaded PDF / Image (Patient only, rate limited)
  app.post('/api/records/extract', requireAuth, rateLimitAi, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'patient') {
      res.status(403).json({ error: 'Only the patient can upload and extract records.' });
      return;
    }

    upload.single('file')(req, res, async (err) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'File upload failed.' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'Please select a PDF or image file to analyze.' });
        return;
      }

      if (!isAiConfigured()) {
        res.status(503).json({
          aiUnavailable: true,
          error:
            'AI extraction is unavailable because GEMINI_API_KEY is not configured. You can complete the form manually and upload the file to private storage.',
        });
        return;
      }

      try {
        const draft = await extractMedicalDocument({
          buffer: req.file.buffer,
          mimeType: req.file.mimetype,
          fileName: req.file.originalname,
        });
        res.json({ draft });
      } catch (aiErr) {
        const raw = aiErr instanceof Error ? aiErr.message : 'Gemini extraction failed.';
        let friendly = raw;
        try {
          const parsedErr = JSON.parse(raw) as { error?: { message?: string } };
          if (parsedErr?.error?.message) {
            friendly = parsedErr.error.message.split('\n')[0].trim();
          }
        } catch {
          // keep raw message
        }
        res.status(502).json({
          aiUnavailable: true,
          error: `Document extraction could not complete (${friendly}). You can retry or enter record details manually and save this file securely.`,
        });
      }
    });
  });

  // Persist uploaded medical record + file to private storage (Patient only)
  app.post('/api/records', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'patient') {
      res.status(403).json({ error: 'Only the patient can upload records to their vault.' });
      return;
    }

    upload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid file upload.' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'A PDF or image file is required.' });
        return;
      }

      const body = req.body as Record<string, string | undefined>;
      const title = (body.title ?? '').trim();
      const hospital = (body.hospital ?? '').trim();
      const clinician = (body.clinician ?? 'Not specified').trim();
      const date = (body.date ?? '').trim();
      const summary = (body.summary ?? '').trim();
      const categoryRaw = (body.category ?? 'Lab Report').trim();
      const extractionStatusRaw = (body.extractionStatus ?? 'Manual Entry').trim();
      const extractionNotes = (body.extractionNotes ?? '').trim();

      if (!title || !hospital || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !summary) {
        res.status(400).json({ error: 'Title, hospital, valid date (YYYY-MM-DD), and summary are required.' });
        return;
      }

      const validCategories: RecordCategory[] = [
        'Lab Report',
        'Consultation',
        'Prescription',
        'Imaging',
        'Discharge Summary',
        'Allergy & Immunization',
      ];
      const category: RecordCategory = validCategories.includes(categoryRaw as RecordCategory)
        ? (categoryRaw as RecordCategory)
        : 'Lab Report';

      let facts: MedicalRecord['facts'] = [];
      let medications: string[] = [];
      let allergiesMentioned: MedicalRecord['allergiesMentioned'] = [];

      try {
        if (body.factsJson) facts = JSON.parse(body.factsJson);
        if (body.medicationsJson) medications = JSON.parse(body.medicationsJson);
        if (body.allergiesJson) allergiesMentioned = JSON.parse(body.allergiesJson);
      } catch {
        res.status(400).json({ error: 'Malformed structured facts or allergy JSON.' });
        return;
      }

      const dbNow = getDb();
      const maxExistingNum = dbNow.records.reduce((max, r) => {
        const parsed = parseInt(r.id.replace('REC-', ''), 10);
        return Number.isFinite(parsed) && parsed > max ? parsed : max;
      }, 100);
      const nextNum = maxExistingNum + 1;
      const recordId = `REC-${nextNum}`;
      const extMap: Record<string, string> = {
        'application/pdf': '.pdf',
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/webp': '.webp',
      };
      const ext = extMap[req.file.mimetype] || '.bin';
      const storageKey = `rec_${nextNum}_${crypto.randomBytes(6).toString('hex')}${ext}`;
      const destPath = resolveSafeUploadPath(storageKey);

      fs.writeFileSync(destPath, req.file.buffer);

      const newRecord: MedicalRecord = {
        id: recordId,
        patientId: dbNow.patient.id,
        title,
        category,
        hospital,
        clinician: clinician || 'Not specified',
        date,
        summary,
        facts: Array.isArray(facts) ? facts : [],
        medications: Array.isArray(medications) ? medications : [],
        allergiesMentioned: Array.isArray(allergiesMentioned) ? allergiesMentioned : [],
        fileName: req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'),
        mimeType: req.file.mimetype,
        fileSizeBytes: req.file.size,
        storageKey,
        extractionStatus:
          extractionStatusRaw === 'Extracted — Review Required' ||
          extractionStatusRaw === 'Verified by Patient'
            ? extractionStatusRaw
            : 'Manual Entry',
        extractionNotes: extractionNotes || undefined,
        createdAt: new Date().toISOString(),
      };

      mutateDb((db) => {
        db.records.unshift(newRecord);
        appendAccessLog(db, {
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          action: 'UPLOAD_RECORD',
          targetId: newRecord.id,
          outcome: 'ALLOWED',
          detail: `Uploaded "${newRecord.title}" (${newRecord.hospital}) to private vault storage.`,
        });
      });
      serverAiSummaryCache.clear();

      res.status(201).json({ record: newRecord });
    });
  });

  // Allow patient to verify or correct an extracted record after upload
  app.patch('/api/records/:id/verify', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'patient') {
      res.status(403).json({ error: 'Only the patient can verify extracted records.' });
      return;
    }

    const body = req.body as Partial<MedicalRecord>;
    let updatedRecord: MedicalRecord | undefined;

    mutateDb((db) => {
      const target = db.records.find((r) => r.id === req.params.id);
      if (!target) return;
      if (typeof body.title === 'string' && body.title.trim()) target.title = body.title.trim();
      if (typeof body.hospital === 'string' && body.hospital.trim()) target.hospital = body.hospital.trim();
      if (typeof body.clinician === 'string' && body.clinician.trim()) target.clinician = body.clinician.trim();
      if (typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) target.date = body.date;
      if (typeof body.summary === 'string' && body.summary.trim()) target.summary = body.summary.trim();
      if (Array.isArray(body.facts)) target.facts = body.facts;
      if (Array.isArray(body.medications)) target.medications = body.medications;
      if (Array.isArray(body.allergiesMentioned)) target.allergiesMentioned = body.allergiesMentioned;
      target.extractionStatus = 'Verified by Patient';
      updatedRecord = target;

      appendAccessLog(db, {
        actorId: user.id,
        actorName: user.name,
        actorRole: 'patient',
        action: 'VERIFY_RECORD',
        targetId: target.id,
        outcome: 'ALLOWED',
        detail: `Patient verified extracted clinical data for ${target.id}.`,
      });
    });

    if (!updatedRecord) {
      res.status(404).json({ error: 'Medical record not found.' });
      return;
    }
    serverAiSummaryCache.clear();
    res.json({ record: updatedRecord });
  });

  // Private file download / preview endpoint with strict backend RBAC + path confinement
  app.get('/api/records/:id/file', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const db = getDb();
    const record = db.records.find((r) => r.id === req.params.id);

    if (!record) {
      res.status(404).json({ error: 'Medical record not found.' });
      return;
    }

    if (user.role === 'doctor') {
      const consent = db.consents.find((c) => c.doctorId === user.id);
      const accessible =
        consent && consent.status === 'approved'
          ? isFileAccessibleUnderScope(record, consent.scope)
          : false;

      if (!accessible) {
        mutateDb((draft) => {
          appendAccessLog(draft, {
            actorId: user.id,
            actorName: user.name,
            actorRole: user.role,
            action: 'ACCESS_DENIED',
            targetId: record.id,
            outcome: 'DENIED',
            detail: `Blocked private file access for ${record.id} requested by ${user.name}.`,
          });
        });
        res.status(403).json({ error: 'Consent denied or outside approved scope for this file.' });
        return;
      }
    }

    let filePath: string;
    try {
      filePath = resolveSafeUploadPath(record.storageKey);
    } catch {
      res.status(400).json({ error: 'Invalid file reference.' });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Stored file missing from private vault.' });
      return;
    }

    mutateDb((draft) => {
      appendAccessLog(draft, {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'DOWNLOAD_FILE',
        targetId: record.id,
        outcome: 'ALLOWED',
        detail: `${user.name} accessed private document "${record.fileName}" (${record.id}).`,
      });
    });

    res.setHeader('Content-Type', record.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `inline; filename="${record.fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  });

  // Consent Management endpoints
  app.get('/api/consents', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const db = getDb();

    if (user.role === 'patient') {
      res.json({
        consents: db.consents,
        accessLogs: db.accessLogs,
      });
      return;
    }

    const mine = db.consents.filter((c) => c.doctorId === user.id);
    res.json({ consents: mine });
  });

  app.post('/api/consents/request', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'doctor') {
      res.status(403).json({ error: 'Only doctors can submit an access request.' });
      return;
    }

    const { purpose, scope } = req.body as { purpose?: string; scope?: string };
    const cleanPurpose = (purpose ?? '').trim() || 'Clinical consultation and cross-hospital history review';
    const cleanScope = scope === 'Labs & Allergies Only' ? 'Labs & Allergies Only' : 'Full History';

    let updatedGrant: ReturnType<typeof getDb>['consents'][number] | null = null;
    mutateDb((db) => {
      const existing = db.consents.find((c) => c.doctorId === user.id);
      const now = new Date().toISOString();
      if (existing) {
        existing.status = 'pending';
        existing.purpose = cleanPurpose;
        existing.scope = cleanScope;
        existing.requestedAt = now;
        existing.updatedAt = now;
        updatedGrant = existing;
      } else {
        updatedGrant = {
          id: `CON-${201 + db.consents.length}`,
          patientId: db.patient.id,
          doctorId: user.id,
          doctorName: user.name,
          doctorSpecialty: user.specialty || 'Physician',
          doctorHospital: user.hospital || 'Partner Hospital',
          purpose: cleanPurpose,
          scope: cleanScope,
          status: 'pending',
          requestedAt: now,
          updatedAt: now,
        };
        db.consents.unshift(updatedGrant);
      }

      appendAccessLog(db, {
        actorId: user.id,
        actorName: user.name,
        actorRole: 'doctor',
        action: 'REQUEST_CONSENT',
        targetId: updatedGrant.id,
        outcome: 'ALLOWED',
        detail: `${user.name} submitted a ${cleanScope} access request: "${cleanPurpose}".`,
      });
    });

    res.status(201).json({ consent: updatedGrant });
  });

  app.patch('/api/consents/:id', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'patient') {
      res.status(403).json({ error: 'Only the patient can approve or revoke consent.' });
      return;
    }

    const { status, scope } = req.body as { status?: string; scope?: string };
    if (status !== 'approved' && status !== 'revoked') {
      res.status(400).json({ error: 'Status must be "approved" or "revoked".' });
      return;
    }

    let resultGrant: ReturnType<typeof getDb>['consents'][number] | undefined;
    mutateDb((db) => {
      const target = db.consents.find((c) => c.id === req.params.id);
      if (!target) return;
      target.status = status;
      if (scope === 'Full History' || scope === 'Labs & Allergies Only') {
        target.scope = scope;
      }
      target.updatedAt = new Date().toISOString();
      resultGrant = target;

      appendAccessLog(db, {
        actorId: user.id,
        actorName: user.name,
        actorRole: 'patient',
        action: status === 'approved' ? 'APPROVE_CONSENT' : 'REVOKE_CONSENT',
        targetId: target.id,
        outcome: 'ALLOWED',
        detail:
          status === 'approved'
            ? `Approved ${target.scope} access for ${target.doctorName} (${target.doctorHospital}).`
            : `Revoked medical record access for ${target.doctorName} (${target.doctorHospital}).`,
      });
    });

    if (!resultGrant) {
      res.status(404).json({ error: 'Consent grant not found.' });
      return;
    }

    serverAiSummaryCache.delete(resultGrant.doctorId);
    res.json({ consent: resultGrant });
  });

  // Doctor Dashboard overview (Strict consent check enforced on backend)
  app.get('/api/doctor/overview', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'doctor') {
      res.status(403).json({ error: 'Doctor role required for this endpoint.' });
      return;
    }

    const db = getDb();
    const consent = db.consents.find((c) => c.doctorId === user.id);

    if (!consent || consent.status !== 'approved') {
      mutateDb((draft) => {
        appendAccessLog(draft, {
          actorId: user.id,
          actorName: user.name,
          actorRole: 'doctor',
          action: 'ACCESS_DENIED',
          targetId: db.patient.id,
          outcome: 'DENIED',
          detail: `Denied Doctor Dashboard access to ${user.name} (consent: ${consent?.status ?? 'none'}).`,
        });
      });
      res.status(403).json({
        error: 'Access blocked by patient consent policy.',
        consentStatus: consent?.status ?? 'none',
        consent: consent ?? null,
        patientName: db.patient.name,
      });
      return;
    }

    const accessibleRecords = filterRecordsByScope(db.records, consent.scope).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    const { entries, discrepancies } = computeAllergiesAndDiscrepanciesForRecords(
      accessibleRecords,
      db.allergyResolutions
    );

    mutateDb((draft) => {
      appendAccessLog(draft, {
        actorId: user.id,
        actorName: user.name,
        actorRole: 'doctor',
        action: 'VIEW_RECORDS',
        targetId: db.patient.id,
        outcome: 'ALLOWED',
        detail: `${user.name} viewed ${accessibleRecords.length} consent-approved records (${consent.scope}).`,
      });
    });

    res.json({
      patient: db.patient,
      consent,
      records: accessibleRecords,
      allergies: entries,
      discrepancies,
      aiConfigured: isAiConfigured(),
      recordsMatchSeed: recordsMatchOriginalSeed(db.records),
    });
  });

  // Doctor verifies conflicting allergy discrepancy
  app.post('/api/doctor/verify-allergy', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'doctor') {
      res.status(403).json({ error: 'Only an authorized doctor can verify allergy conflicts.' });
      return;
    }

    const db = getDb();
    const consent = db.consents.find((c) => c.doctorId === user.id);
    if (!consent || consent.status !== 'approved') {
      res.status(403).json({ error: 'Active patient consent is required to verify clinical alerts.' });
      return;
    }

    const { substance, resolutionNote } = req.body as { substance?: string; resolutionNote?: string };
    const cleanSubstance = (substance ?? '').trim().toLowerCase();
    const cleanNote = (resolutionNote ?? '').trim();

    if (!cleanSubstance || !cleanNote) {
      res.status(400).json({ error: 'Substance and verification note are required.' });
      return;
    }

    mutateDb((draft) => {
      draft.allergyResolutions[cleanSubstance] = {
        substance: substance!.trim(),
        resolutionNote: cleanNote,
        resolvedByDoctor: `${user.name} (${user.hospital})`,
        resolvedAt: new Date().toISOString(),
      };
      appendAccessLog(draft, {
        actorId: user.id,
        actorName: user.name,
        actorRole: 'doctor',
        action: 'VERIFY_ALLERGY_CONFLICT',
        targetId: substance!.trim(),
        outcome: 'ALLOWED',
        detail: `${user.name} logged clinical verification for ${substance!.trim()} allergy conflict.`,
      });
    });

    const updated = computeAllergiesAndDiscrepancies(getDb());
    serverAiSummaryCache.clear();
    res.json({ discrepancies: updated.discrepancies });
  });

  // Source-linked AI Doctor Summary (Strict consent check + rate limit + versioned cache)
  app.post('/api/doctor/ai-summary', requireAuth, rateLimitAi, async (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'doctor') {
      res.status(403).json({ error: 'Doctor role required to generate clinical summary.' });
      return;
    }

    const db = getDb();
    const consent = db.consents.find((c) => c.doctorId === user.id);
    if (!consent || consent.status !== 'approved') {
      serverAiSummaryCache.delete(user.id);
      mutateDb((draft) => {
        appendAccessLog(draft, {
          actorId: user.id,
          actorName: user.name,
          actorRole: 'doctor',
          action: 'ACCESS_DENIED',
          targetId: 'AI_SUMMARY',
          outcome: 'DENIED',
          detail: `Blocked AI summary generation for ${user.name} (consent: ${consent?.status ?? 'none'}).`,
        });
      });
      res.status(403).json({
        error: 'Active patient consent is required to generate an AI summary.',
        consentStatus: consent?.status ?? 'none',
      });
      return;
    }

    const accessibleRecords = filterRecordsByScope(db.records, consent.scope).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const { discrepancies } = computeAllergiesAndDiscrepanciesForRecords(
      accessibleRecords,
      db.allergyResolutions
    );
    const resolutionText = discrepancies
      .map((d) => (d.resolutionNote ? `${d.substance}: ${d.resolutionNote} (Verified by ${d.resolvedByDoctor})` : null))
      .filter(Boolean)
      .join('; ');

    const forceRegenerate = Boolean((req.body as { force?: boolean } | undefined)?.force);
    const cacheKey = buildSummaryCacheKey({
      doctorId: user.id,
      patientId: db.patient.id,
      scope: consent.scope,
      consentUpdatedAt: consent.updatedAt,
      records: accessibleRecords,
      discrepancies,
    });

    const cached = serverAiSummaryCache.get(user.id);
    if (!forceRegenerate && cached && cached.cacheKey === cacheKey) {
      res.json({
        summary: cached.summary,
        accessibleRecords,
        discrepancies,
        cached: true,
        cacheKey,
      });
      return;
    }

    if (!isAiConfigured()) {
      res.status(503).json({
        aiUnavailable: true,
        recordsMatchSeed: recordsMatchOriginalSeed(db.records),
        error:
          'AI synthesis is unavailable because GEMINI_API_KEY is not configured on the server. Inspect the primary source records directly below.',
        accessibleRecords,
        discrepancies,
      });
      return;
    }

    try {
      const summary = await generateDoctorSummary({
        patientName: db.patient.name,
        records: accessibleRecords,
        allergyDiscrepancyNote: resolutionText || undefined,
      });

      serverAiSummaryCache.set(user.id, { cacheKey, summary });

      mutateDb((draft) => {
        appendAccessLog(draft, {
          actorId: user.id,
          actorName: user.name,
          actorRole: 'doctor',
          action: 'GENERATE_AI_SUMMARY',
          targetId: db.patient.id,
          outcome: 'ALLOWED',
          detail: `${user.name} generated a source-linked AI summary across ${accessibleRecords.length} approved records.`,
        });
      });

      res.json({ summary, accessibleRecords, discrepancies, cached: false, cacheKey });
    } catch (aiErr) {
      const raw = aiErr instanceof Error ? aiErr.message : 'Upstream Gemini error.';
      let friendly = raw;
      try {
        const parsedErr = JSON.parse(raw) as { error?: { message?: string } };
        if (parsedErr?.error?.message) {
          friendly = parsedErr.error.message.split('\n')[0].trim();
        }
      } catch {
        // keep raw message
      }
      res.status(502).json({
        aiUnavailable: true,
        recordsMatchSeed: recordsMatchOriginalSeed(db.records),
        error: `AI synthesis could not complete (${friendly}). Review the primary source records directly below.`,
        accessibleRecords,
        discrepancies,
      });
    }
  });

  // Explicit pre-generated sample fallback (strict RBAC + scope + unmodified seed validation)
  app.post('/api/doctor/ai-summary/sample', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'doctor') {
      res.status(403).json({ error: 'Doctor role required to view clinical summary.' });
      return;
    }

    const db = getDb();
    const consent = db.consents.find((c) => c.doctorId === user.id);
    if (!consent || consent.status !== 'approved') {
      serverAiSummaryCache.delete(user.id);
      mutateDb((draft) => {
        appendAccessLog(draft, {
          actorId: user.id,
          actorName: user.name,
          actorRole: 'doctor',
          action: 'ACCESS_DENIED',
          targetId: 'AI_SUMMARY_SAMPLE',
          outcome: 'DENIED',
          detail: `Blocked sample AI summary access for ${user.name} (consent: ${consent?.status ?? 'none'}).`,
        });
      });
      res.status(403).json({
        error: 'Active patient consent is required to view the sample AI summary.',
        consentStatus: consent?.status ?? 'none',
      });
      return;
    }

    const accessibleRecords = filterRecordsByScope(db.records, consent.scope).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const { discrepancies } = computeAllergiesAndDiscrepanciesForRecords(
      accessibleRecords,
      db.allergyResolutions
    );

    if (!recordsMatchOriginalSeed(db.records)) {
      res.status(409).json({
        recordsChanged: true,
        error:
          'Patient records have changed since the sample AI summary was captured. Pre-generated sample data cannot be shown as current for modified records.',
        accessibleRecords,
        discrepancies,
      });
      return;
    }

    const summary = buildSampleAiSummary({
      accessibleRecords,
      scope: consent.scope,
      discrepancies,
    });

    mutateDb((draft) => {
      appendAccessLog(draft, {
        actorId: user.id,
        actorName: user.name,
        actorRole: 'doctor',
        action: 'VIEW_SAMPLE_AI_SUMMARY',
        targetId: db.patient.id,
        outcome: 'ALLOWED',
        detail: `${user.name} viewed pre-generated demonstration AI summary across ${accessibleRecords.length} approved seeded records (${consent.scope}).`,
      });
    });

    res.json({
      summary,
      accessibleRecords,
      discrepancies,
      cached: false,
      isSampleDemo: true,
    });
  });

  // Secured Demo reset helper for judges (requires authenticated demo session)
  app.post('/api/demo/reset', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.authUser!;
    serverAiSummaryCache.clear();
    aiRateLimitMap.clear();
    await resetDemoDb();
    mutateDb((db) => {
      appendAccessLog(db, {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'DEMO_RESET',
        targetId: 'VAULT',
        outcome: 'ALLOWED',
        detail: `${user.name} reset demo data to initial synthetic state.`,
      });
    });
    res.json({ reset: true });
  });

  // Downloadable synthetic medical report PDF for testing upload & AI extraction
  app.get('/api/demo/sample-pdf', async (_req, res) => {
    const db = getDb();
    const pdfBuffer = await buildSyntheticClinicalPdf({
      recordId: 'SAMPLE-TEST',
      patientName: db.patient.name,
      medvaultId: db.patient.medvaultId,
      dob: db.patient.dob,
      hospital: 'Sunrise Medical Center',
      clinician: 'Dr. Meera Iyer (Cardiology & Metabolic Care)',
      category: 'Lab Report',
      date: '2026-11-18',
      title: 'Cardiometabolic Follow-Up & Lipid Profile Panel',
      summary:
        'Routine 2-month follow-up showing sustained glycemic control and improved LDL cholesterol on lifestyle therapy and low-dose Metformin. Resting ECG normal sinus rhythm.',
      facts: [
        { label: 'HbA1c', value: '5.7', unit: '%', flag: 'normal' },
        { label: 'Fasting Glucose', value: '94', unit: 'mg/dL', flag: 'normal' },
        { label: 'LDL Cholesterol', value: '104', unit: 'mg/dL', flag: 'normal' },
        { label: 'Blood Pressure', value: '116/74', unit: 'mmHg', flag: 'normal' },
        { label: 'Resting Heart Rate', value: '72', unit: 'bpm', flag: 'normal' },
      ],
      medications: [
        'Metformin 500mg once daily with evening meal',
        'Vitamin D3 2000 IU maintenance daily',
      ],
      allergies: [
        {
          substance: 'Penicillin',
          severity: 'Severe',
          reaction: 'Prior anaphylaxis documented; continue strict beta-lactam avoidance',
        },
      ],
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Ananya_Sharma_Sample_Lab_Report.pdf"'
    );
    res.send(pdfBuffer);
  });

  // Vite dev middleware vs production dist static serving
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'));
  if (isProd) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*all', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MedVault server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MedVault server:', err);
  process.exit(1);
});
