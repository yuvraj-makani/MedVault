import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { AISummaryResult, ExtractionDraft, MedicalRecord } from '../src/types.js';

const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isAiConfigured(): boolean {
  return getGeminiClient() !== null;
}

export async function extractMedicalDocument(params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<ExtractionDraft> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const base64Data = params.buffer.toString('base64');

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType,
            data: base64Data,
          },
        },
        {
          text: `Analyze this uploaded medical document (${params.fileName}) and extract structured factual data for a patient's personal record vault.
Rules:
- Extract ONLY facts explicitly visible in the document. Never invent, extrapolate, or diagnose.
- If any field (such as hospital name, date, clinician, or a lab unit/value) is illegible, missing, or ambiguous, leave it conservative and explicitly note the uncertainty in extractionNotes or the fact's uncertainty field.
- Categorize as one of: "Lab Report", "Consultation", "Prescription", "Imaging", "Discharge Summary", "Allergy & Immunization".
- Format date as YYYY-MM-DD if visible, otherwise use today's date and note the uncertainty.`,
        },
      ],
    },
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction:
        'You are a careful medical document transcription assistant. Return strictly valid JSON matching the schema. Never give medical advice or invent unstated facts.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Short descriptive title of the medical record.' },
          category: {
            type: Type.STRING,
            description:
              'One of: Lab Report, Consultation, Prescription, Imaging, Discharge Summary, Allergy & Immunization',
          },
          hospital: { type: Type.STRING, description: 'Issuing hospital or clinic name, or "Unknown Facility" if missing.' },
          clinician: { type: Type.STRING, description: 'Doctor or lab technician name, or "Not specified".' },
          date: { type: Type.STRING, description: 'Document date in YYYY-MM-DD format.' },
          summary: { type: Type.STRING, description: 'Concise factual summary of what is in the document.' },
          facts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.STRING },
                unit: { type: Type.STRING },
                flag: { type: Type.STRING, description: 'One of: normal, borderline, high, low, critical' },
                uncertainty: { type: Type.STRING, description: 'Optional note if value/unit was partially unclear.' },
              },
              required: ['label', 'value'],
            },
          },
          medications: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          allergiesMentioned: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                substance: { type: Type.STRING },
                severity: { type: Type.STRING, description: 'Mild, Moderate, or Severe' },
                reaction: { type: Type.STRING },
              },
              required: ['substance', 'severity', 'reaction'],
            },
          },
          extractionNotes: {
            type: Type.STRING,
            description: 'Notes about legibility, missing fields, or items requiring patient/clinician verification.',
          },
        },
        required: ['title', 'category', 'hospital', 'clinician', 'date', 'summary', 'facts', 'medications', 'allergiesMentioned', 'extractionNotes'],
      },
    },
  });

  const text = (response.text ?? '').trim();
  if (!text) {
    throw new Error('Empty response returned from Gemini extraction model.');
  }

  const parsed = JSON.parse(text) as Omit<ExtractionDraft, 'model'>;
  const validCategories = [
    'Lab Report',
    'Consultation',
    'Prescription',
    'Imaging',
    'Discharge Summary',
    'Allergy & Immunization',
  ] as const;

  const category = validCategories.includes(parsed.category as (typeof validCategories)[number])
    ? parsed.category
    : 'Lab Report';

  return {
    title: parsed.title || params.fileName,
    category,
    hospital: parsed.hospital || 'Unspecified Facility',
    clinician: parsed.clinician || 'Not specified',
    date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : new Date().toISOString().slice(0, 10),
    summary: parsed.summary || 'Uploaded document processed. Review fields carefully.',
    facts: Array.isArray(parsed.facts) ? parsed.facts : [],
    medications: Array.isArray(parsed.medications) ? parsed.medications : [],
    allergiesMentioned: Array.isArray(parsed.allergiesMentioned)
      ? parsed.allergiesMentioned.map((a) => ({
          substance: a.substance,
          severity: a.severity === 'Severe' || a.severity === 'Moderate' ? a.severity : 'Mild',
          reaction: a.reaction,
        }))
      : [],
    extractionNotes:
      parsed.extractionNotes || 'AI-extracted fields require human verification against the attached original file.',
    model: MODEL_NAME,
  };
}

export async function generateDoctorSummary(params: {
  patientName: string;
  records: MedicalRecord[];
  allergyDiscrepancyNote?: string;
}): Promise<AISummaryResult> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const recordContext = params.records.map((r) => ({
    id: r.id,
    date: r.date,
    hospital: r.hospital,
    category: r.category,
    clinician: r.clinician,
    title: r.title,
    summary: r.summary,
    facts: r.facts,
    medications: r.medications,
    allergiesMentioned: r.allergiesMentioned,
  }));

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Synthesize the following consent-approved medical records for patient ${params.patientName} into a structured clinical review brief for an attending physician.

CRITICAL GROUNDING RULES:
1. Every single item in keyFindings, activeMedications, and allergyConflicts MUST cite the exact sourceRecordId (e.g. "REC-101") from the provided records.
2. NEVER invent lab numbers, dates, medications, or diagnoses not present in the JSON below.
3. Explicitly detect and highlight conflicting records (especially conflicting allergy severities across different hospitals).
4. Explicitly state uncertainties, missing longitudinal intervals, or unverified extractions in uncertaintiesAndGaps.
5. Do NOT offer clinical advice, treatment recommendations, or definitive diagnoses—present factual cross-hospital history for physician review only.

${params.allergyDiscrepancyNote ? `Doctor allergy verification note on file: ${params.allergyDiscrepancyNote}\n` : ''}
ACCESSIBLE RECORDS JSON:
${JSON.stringify(recordContext, null, 2)}`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction:
        'You are a factual medical record synthesizer for physicians. Every extracted fact must link to its exact sourceRecordId. Never diagnose or prescribe.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          executiveBrief: {
            type: Type.STRING,
            description: '2-3 sentence factual overview referencing source record IDs inline.',
          },
          keyFindings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                statement: { type: Type.STRING },
                sourceRecordId: { type: Type.STRING },
                sourceHospital: { type: Type.STRING },
                sourceDate: { type: Type.STRING },
                uncertainty: { type: Type.STRING },
              },
              required: ['category', 'statement', 'sourceRecordId', 'sourceHospital', 'sourceDate'],
            },
          },
          activeMedications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                medication: { type: Type.STRING },
                context: { type: Type.STRING },
                sourceRecordId: { type: Type.STRING },
                sourceHospital: { type: Type.STRING },
              },
              required: ['medication', 'context', 'sourceRecordId', 'sourceHospital'],
            },
          },
          allergyConflicts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                substance: { type: Type.STRING },
                conflictSummary: { type: Type.STRING },
                sourceRecordIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                actionRequired: { type: Type.STRING },
              },
              required: ['substance', 'conflictSummary', 'sourceRecordIds', 'actionRequired'],
            },
          },
          uncertaintiesAndGaps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['executiveBrief', 'keyFindings', 'activeMedications', 'allergyConflicts', 'uncertaintiesAndGaps'],
      },
    },
  });

  const text = (response.text ?? '').trim();
  if (!text) {
    throw new Error('Empty response returned from Gemini summary model.');
  }

  const parsed = JSON.parse(text) as {
    executiveBrief: string;
    keyFindings: AISummaryResult['keyFindings'];
    activeMedications: AISummaryResult['activeMedications'];
    allergyConflicts: AISummaryResult['allergyConflicts'];
    uncertaintiesAndGaps: string[];
  };

  const recordMap = new Map(params.records.map((r) => [r.id, r]));

  const validatedFindings: AISummaryResult['keyFindings'] = (
    Array.isArray(parsed.keyFindings) ? parsed.keyFindings : []
  ).map((f) => {
    const sourceRec = recordMap.get(f.sourceRecordId);
    if (!sourceRec) {
      return {
        category: f.category,
        statement: f.statement,
        sourceRecordId: 'UNVERIFIED',
        sourceHospital: 'Unverified Source',
        sourceDate: 'N/A',
        uncertainty:
          f.uncertainty ||
          'Source citation could not be verified against permitted records.',
        citationVerified: false,
      };
    }
    return {
      category: f.category,
      statement: f.statement,
      sourceRecordId: sourceRec.id,
      sourceHospital: sourceRec.hospital,
      sourceDate: sourceRec.date,
      uncertainty: f.uncertainty,
      citationVerified: true,
    };
  });

  const validatedMedications: AISummaryResult['activeMedications'] = (
    Array.isArray(parsed.activeMedications) ? parsed.activeMedications : []
  ).map((m) => {
    const sourceRec = recordMap.get(m.sourceRecordId);
    if (!sourceRec) {
      return {
        medication: m.medication,
        context: `${m.context} (Citation could not be verified against permitted records)`,
        sourceRecordId: 'UNVERIFIED',
        sourceHospital: 'Unverified Source',
        citationVerified: false,
      };
    }
    return {
      medication: m.medication,
      context: m.context,
      sourceRecordId: sourceRec.id,
      sourceHospital: sourceRec.hospital,
      citationVerified: true,
    };
  });

  const validatedConflicts: AISummaryResult['allergyConflicts'] = (
    Array.isArray(parsed.allergyConflicts) ? parsed.allergyConflicts : []
  ).map((c) => ({
    substance: c.substance,
    conflictSummary: c.conflictSummary,
    sourceRecordIds: Array.isArray(c.sourceRecordIds)
      ? c.sourceRecordIds.filter((id) => recordMap.has(id))
      : [],
    actionRequired: c.actionRequired,
  }));

  return {
    generatedAt: new Date().toISOString(),
    model: MODEL_NAME,
    recordCountUsed: params.records.length,
    accessibleRecordIds: params.records.map((r) => r.id),
    executiveBrief: parsed.executiveBrief,
    keyFindings: validatedFindings,
    activeMedications: validatedMedications,
    allergyConflicts: validatedConflicts,
    uncertaintiesAndGaps: Array.isArray(parsed.uncertaintiesAndGaps)
      ? parsed.uncertaintiesAndGaps
      : [],
    disclaimer:
      'Informational synthesis generated from consent-approved records only. Not clinical advice or diagnosis. Verify all findings against linked primary source documents.',
  };
}
