import type {
  AISummaryResult,
  AccessLogEntry,
  AllergyDiscrepancy,
  AllergyEntry,
  AuthUser,
  ConsentGrant,
  ConsentScope,
  ExtractionDraft,
  MedicalRecord,
  PatientProfile,
  Role,
} from './types';

let memoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  memoryToken = token;
}

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

async function parseBlobError(res: Response, fallback: string): Promise<ApiError> {
  let errMsg = `${fallback} (${res.status})`;
  try {
    const json = (await res.json()) as { error?: string };
    if (json.error) errMsg = json.error;
  } catch {
    // ignore non-JSON error body
  }
  return new ApiError(errMsg, res.status);
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (memoryToken) {
    headers.set('Authorization', `Bearer ${memoryToken}`);
  }
  if (!(init.body instanceof FormData) && !headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { error: text || 'Unexpected server response.' };
  }

  if (!res.ok) {
    throw new ApiError(
      typeof json.error === 'string' ? json.error : `Request failed (${res.status})`,
      res.status,
      json
    );
  }

  return json as T;
}

export async function createDemoSession(
  role: Role,
  doctorId?: string
): Promise<{
  isDemoOnly: boolean;
  token: string;
  user: AuthUser;
  doctors: AuthUser[];
  aiConfigured: boolean;
}> {
  const data = await apiFetch<{
    isDemoOnly: boolean;
    token: string;
    user: AuthUser;
    doctors: AuthUser[];
    aiConfigured: boolean;
  }>('/api/auth/demo-session', {
    method: 'POST',
    body: JSON.stringify({ role, doctorId }),
  });
  setAuthToken(data.token);
  return data;
}

export async function fetchPatientDashboard(): Promise<{
  patient: PatientProfile;
  records: MedicalRecord[];
  allergies: AllergyEntry[];
  discrepancies: AllergyDiscrepancy[];
  consents: ConsentGrant[];
  accessLogs: AccessLogEntry[];
  aiConfigured: boolean;
}> {
  return apiFetch('/api/patient/dashboard');
}

export async function extractRecordWithAi(file: File): Promise<{ draft: ExtractionDraft }> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch('/api/records/extract', {
    method: 'POST',
    body: formData,
  });
}

export async function uploadRecord(formData: FormData): Promise<{ record: MedicalRecord }> {
  return apiFetch('/api/records', {
    method: 'POST',
    body: formData,
  });
}

export async function fetchSecureFileBlobUrl(
  recordId: string
): Promise<{ blobUrl: string; contentType: string }> {
  const headers = new Headers();
  if (memoryToken) {
    headers.set('Authorization', `Bearer ${memoryToken}`);
  }
  const res = await fetch(`/api/records/${encodeURIComponent(recordId)}/file`, { headers });
  if (!res.ok) {
    throw await parseBlobError(res, 'Unable to open private file');
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  return { blobUrl, contentType: res.headers.get('Content-Type') || blob.type };
}

export async function requestDoctorConsent(
  purpose: string,
  scope: ConsentScope
): Promise<{ consent: ConsentGrant }> {
  return apiFetch('/api/consents/request', {
    method: 'POST',
    body: JSON.stringify({ purpose, scope }),
  });
}

export async function updateConsent(
  consentId: string,
  status: 'approved' | 'revoked',
  scope?: ConsentScope
): Promise<{ consent: ConsentGrant }> {
  return apiFetch(`/api/consents/${encodeURIComponent(consentId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, scope }),
  });
}

export async function fetchDoctorOverview(): Promise<{
  patient: PatientProfile;
  consent: ConsentGrant;
  records: MedicalRecord[];
  allergies: AllergyEntry[];
  discrepancies: AllergyDiscrepancy[];
  aiConfigured: boolean;
  recordsMatchSeed?: boolean;
}> {
  return apiFetch('/api/doctor/overview');
}

export async function verifyAllergyDiscrepancy(
  substance: string,
  resolutionNote: string
): Promise<{ discrepancies: AllergyDiscrepancy[] }> {
  return apiFetch('/api/doctor/verify-allergy', {
    method: 'POST',
    body: JSON.stringify({ substance, resolutionNote }),
  });
}

export async function downloadHealthPassportPdf(): Promise<void> {
  const headers = new Headers();
  if (memoryToken) {
    headers.set('Authorization', `Bearer ${memoryToken}`);
  }
  const res = await fetch('/api/patient/health-passport', { headers });
  if (!res.ok) {
    throw await parseBlobError(res, 'Unable to generate Health Passport');
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = 'Ananya_Sharma_Health_Passport.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
}

export async function verifyUploadedRecord(
  recordId: string,
  updates: Partial<MedicalRecord> = {}
): Promise<{ record: MedicalRecord }> {
  return apiFetch(`/api/records/${encodeURIComponent(recordId)}/verify`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function generateAiDoctorSummary(force = false): Promise<{
  summary: AISummaryResult;
  accessibleRecords: MedicalRecord[];
  discrepancies: AllergyDiscrepancy[];
  cached?: boolean;
  cacheKey?: string;
}> {
  return apiFetch('/api/doctor/ai-summary', {
    method: 'POST',
    body: JSON.stringify({ force }),
  });
}

export async function fetchSampleAiDoctorSummary(): Promise<{
  summary: AISummaryResult;
  accessibleRecords: MedicalRecord[];
  discrepancies: AllergyDiscrepancy[];
  cached?: boolean;
  isSampleDemo?: boolean;
}> {
  return apiFetch('/api/doctor/ai-summary/sample', {
    method: 'POST',
  });
}

export async function resetDemoData(): Promise<{ reset: boolean }> {
  return apiFetch('/api/demo/reset', {
    method: 'POST',
  });
}
