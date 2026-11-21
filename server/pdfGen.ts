import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import type {
  AllergyDiscrepancy,
  AllergyEntry,
  MedicalRecord,
  PatientProfile,
} from '../src/types.js';

function sanitizeWinAnsi(input: string): string {
  return input
    .replace(/μ/g, 'u')
    .replace(/°/g, ' deg ')
    .replace(/²/g, '2')
    .replace(/—|–/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = sanitizeWinAnsi(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildSyntheticClinicalPdf(params: {
  recordId: string;
  patientName: string;
  medvaultId: string;
  dob: string;
  hospital: string;
  clinician: string;
  category: string;
  date: string;
  title: string;
  summary: string;
  facts: { label: string; value: string; unit?: string; flag?: string }[];
  medications: string[];
  allergies: { substance: string; severity: string; reaction: string }[];
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([612, 792]);
  const marginX = 50;
  let y = 742;

  const navy = rgb(0.06, 0.09, 0.16);
  const teal = rgb(0.05, 0.58, 0.53);
  const slate = rgb(0.35, 0.42, 0.5);
  const rose = rgb(0.75, 0.11, 0.25);
  const lineGray = rgb(0.86, 0.89, 0.92);

  page.drawText('MEDVAULT SYNTHETIC DEMO CLINICAL DOCUMENT', {
    x: marginX,
    y,
    size: 9,
    font: fontBold,
    color: teal,
  });
  y -= 20;

  page.drawText(sanitizeWinAnsi(`${params.hospital}  |  ${params.category}`), {
    x: marginX,
    y,
    size: 14,
    font: fontBold,
    color: navy,
  });
  y -= 18;

  page.drawText(
    sanitizeWinAnsi(`Record ID: ${params.recordId}      Document Date: ${params.date}`),
    { x: marginX, y, size: 10, font: fontRegular, color: slate }
  );
  y -= 15;

  page.drawText(
    sanitizeWinAnsi(
      `Patient: ${params.patientName} (${params.medvaultId})      DOB: ${params.dob}`
    ),
    { x: marginX, y, size: 10, font: fontRegular, color: slate }
  );
  y -= 15;

  page.drawText(sanitizeWinAnsi(`Attending Clinician: ${params.clinician}`), {
    x: marginX,
    y,
    size: 10,
    font: fontRegular,
    color: slate,
  });
  y -= 14;

  page.drawLine({
    start: { x: marginX, y },
    end: { x: 562, y },
    thickness: 1,
    color: lineGray,
  });
  y -= 22;

  for (const line of wrapText(params.title, 70)) {
    page.drawText(line, { x: marginX, y, size: 13, font: fontBold, color: navy });
    y -= 18;
  }
  y -= 4;

  for (const line of wrapText(params.summary, 86)) {
    page.drawText(line, { x: marginX, y, size: 10, font: fontRegular, color: navy });
    y -= 14;
  }

  if (params.facts.length > 0 && y > 140) {
    y -= 12;
    page.drawText('CLINICAL OBSERVATIONS & RESULTS', {
      x: marginX,
      y,
      size: 10,
      font: fontBold,
      color: teal,
    });
    y -= 16;

    for (const fact of params.facts) {
      if (y < 90) break;
      const unitStr = fact.unit ? ` ${fact.unit}` : '';
      const flagStr = fact.flag ? ` [${fact.flag.toUpperCase()}]` : '';
      const text = `- ${fact.label}: ${fact.value}${unitStr}${flagStr}`;
      for (const w of wrapText(text, 84)) {
        page.drawText(w, { x: marginX + 6, y, size: 10, font: fontRegular, color: navy });
        y -= 14;
      }
    }
  }

  if (params.medications.length > 0 && y > 120) {
    y -= 10;
    page.drawText('MEDICATIONS', {
      x: marginX,
      y,
      size: 10,
      font: fontBold,
      color: teal,
    });
    y -= 16;

    for (const med of params.medications) {
      if (y < 90) break;
      for (const w of wrapText(`- ${med}`, 84)) {
        page.drawText(w, { x: marginX + 6, y, size: 10, font: fontRegular, color: navy });
        y -= 14;
      }
    }
  }

  if (params.allergies.length > 0 && y > 100) {
    y -= 10;
    page.drawText('DOCUMENTED ALLERGY NOTE', {
      x: marginX,
      y,
      size: 10,
      font: fontBold,
      color: rose,
    });
    y -= 16;

    for (const allergy of params.allergies) {
      if (y < 80) break;
      const text = `- ${allergy.substance} (${allergy.severity}): ${allergy.reaction}`;
      for (const w of wrapText(text, 84)) {
        page.drawText(w, { x: marginX + 6, y, size: 10, font: fontBold, color: rose });
        y -= 14;
      }
    }
  }

  page.drawLine({
    start: { x: marginX, y: 62 },
    end: { x: 562, y: 62 },
    thickness: 1,
    color: lineGray,
  });
  page.drawText('SYNTHETIC HACKATHON DEMO DATA - NOT A REAL MEDICAL RECORD OR CLINICAL ADVICE', {
    x: marginX,
    y: 46,
    size: 8.5,
    font: fontBold,
    color: slate,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function buildHealthPassportPdf(params: {
  patient: PatientProfile;
  records: MedicalRecord[];
  allergies: AllergyEntry[];
  discrepancies: AllergyDiscrepancy[];
  generatedAt: string;
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(0.06, 0.09, 0.16);
  const teal = rgb(0.05, 0.58, 0.53);
  const slate = rgb(0.35, 0.42, 0.5);
  const amber = rgb(0.71, 0.33, 0.04);
  const rose = rgb(0.75, 0.11, 0.25);
  const lineGray = rgb(0.86, 0.89, 0.92);

  const marginX = 48;
  const maxWidthX = 564;
  const pages: PDFPage[] = [];

  let page = pdfDoc.addPage([612, 792]);
  pages.push(page);
  let y = 746;

  const ensureSpace = (needed: number) => {
    if (y - needed < 68) {
      page = pdfDoc.addPage([612, 792]);
      pages.push(page);
      y = 746;
      page.drawText(
        sanitizeWinAnsi(
          `MEDVAULT PORTABLE HEALTH PASSPORT  |  ${params.patient.name} (${params.patient.medvaultId})`
        ),
        { x: marginX, y, size: 8.5, font: fontBold, color: slate }
      );
      y -= 18;
      page.drawLine({
        start: { x: marginX, y },
        end: { x: maxWidthX, y },
        thickness: 0.75,
        color: lineGray,
      });
      y -= 20;
    }
  };

  const drawSectionHeading = (title: string, color = teal) => {
    ensureSpace(34);
    y -= 8;
    page.drawText(sanitizeWinAnsi(title), {
      x: marginX,
      y,
      size: 10.5,
      font: fontBold,
      color,
    });
    y -= 6;
    page.drawLine({
      start: { x: marginX, y },
      end: { x: maxWidthX, y },
      thickness: 0.75,
      color: lineGray,
    });
    y -= 14;
  };

  const drawWrapped = (
    text: string,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; maxChars?: number } = {}
  ) => {
    const size = opts.size ?? 9.5;
    const font = opts.bold ? fontBold : fontRegular;
    const color = opts.color ?? navy;
    const indent = opts.indent ?? 0;
    const maxChars = opts.maxChars ?? 88;
    for (const line of wrapText(text, maxChars)) {
      ensureSpace(size + 6);
      page.drawText(line, { x: marginX + indent, y, size, font, color });
      y -= size + 4;
    }
  };

  // Document Title Banner
  page.drawText('MEDVAULT PORTABLE HEALTH PASSPORT', {
    x: marginX,
    y,
    size: 15,
    font: fontBold,
    color: navy,
  });
  y -= 16;
  page.drawText(
    sanitizeWinAnsi(
      `Generated: ${params.generatedAt.slice(0, 19).replace('T', ' ')} UTC   |   Total Records: ${params.records.length}`
    ),
    { x: marginX, y, size: 9, font: fontRegular, color: teal }
  );
  y -= 14;
  drawWrapped(
    'SYNTHETIC DEMO RECORD SUMMARY: Compiled from patient-vault entries. Items marked "Extracted - Review Required" have not been verified by the patient or a clinician and must not be treated as confirmed medical facts.',
    { size: 8.5, color: slate, maxChars: 96 }
  );

  // 1. Patient Demographics
  drawSectionHeading('1. PATIENT DEMOGRAPHICS');
  drawWrapped(
    `Full Name: ${params.patient.name}    |    MedVault ID: ${params.patient.medvaultId}`,
    { bold: true }
  );
  drawWrapped(
    `Date of Birth: ${params.patient.dob} (Age ${params.patient.age})    |    Blood Group: ${params.patient.bloodGroup}    |    City: ${params.patient.city}`
  );

  // 2. Documented Allergies & Discrepancies
  drawSectionHeading('2. DOCUMENTED ALLERGIES & DISCREPANCIES', rose);
  if (params.allergies.length === 0) {
    drawWrapped('No allergies documented across stored records.', { color: slate });
  } else {
    for (const alg of params.allergies) {
      const sourceRec = params.records.find((r) => r.id === alg.sourceRecordId);
      const unverifiedTag =
        sourceRec?.extractionStatus === 'Extracted — Review Required'
          ? ' [UNVERIFIED EXTRACTION]'
          : '';
      drawWrapped(
        `- ${alg.substance} (${alg.severity})${unverifiedTag}: ${alg.reaction}  [${alg.sourceRecordId} | ${alg.hospital} | ${alg.recordedAt}]`,
        {
          bold: alg.severity === 'Severe',
          color: alg.severity === 'Severe' ? rose : navy,
          indent: 4,
        }
      );
    }
  }

  for (const disc of params.discrepancies) {
    ensureSpace(32);
    const statusLabel = disc.requiresVerification
      ? 'UNRESOLVED DISCREPANCY - PHYSICIAN VERIFICATION REQUIRED'
      : `PHYSICIAN VERIFIED (${disc.resolvedByDoctor})`;
    drawWrapped(`! Conflict Alert (${disc.substance}): ${statusLabel}`, {
      bold: true,
      color: disc.requiresVerification ? amber : teal,
      indent: 4,
    });
    if (disc.resolutionNote) {
      drawWrapped(`  Verification Note: ${disc.resolutionNote}`, {
        size: 9,
        color: slate,
        indent: 8,
      });
    }
  }

  // 3. Medications Documented in Medical Records (explicitly distinguished from confirmed active regimen)
  drawSectionHeading('3. MEDICATIONS DOCUMENTED IN RECORDS (RECONCILIATION REQUIRED)');
  drawWrapped(
    'Note: Entries below list medications as written inside source documents (including past/completed courses and unverified uploads). They are NOT confirmed active prescriptions until reconciled by a clinician.',
    { size: 8.5, color: slate, maxChars: 96 }
  );
  y -= 2;

  const medRows: { med: string; record: MedicalRecord }[] = [];
  const sortedAscDesc = [...params.records].sort((a, b) => b.date.localeCompare(a.date));
  for (const rec of sortedAscDesc) {
    for (const med of rec.medications) {
      medRows.push({ med, record: rec });
    }
  }

  if (medRows.length === 0) {
    drawWrapped('No medications documented in stored records.', { color: slate });
  } else {
    for (const row of medRows) {
      const statusSuffix =
        row.record.extractionStatus === 'Extracted — Review Required'
          ? ' [Unverified AI Extraction]'
          : '';
      drawWrapped(
        `- ${row.med}${statusSuffix}  [${row.record.id} | ${row.record.hospital} | ${row.record.date}]`,
        { indent: 4 }
      );
    }
  }

  // 4. Latest Available Laboratory Results
  drawSectionHeading('4. LATEST AVAILABLE LABORATORY RESULTS');
  const latestLabByMetric = new Map<
    string,
    { label: string; value: string; unit?: string; flag?: string; record: MedicalRecord }
  >();
  for (const rec of sortedAscDesc) {
    if (rec.category !== 'Lab Report') continue;
    for (const fact of rec.facts) {
      const key = fact.label.trim().toLowerCase();
      if (!latestLabByMetric.has(key)) {
        latestLabByMetric.set(key, {
          label: fact.label,
          value: fact.value,
          unit: fact.unit,
          flag: fact.flag,
          record: rec,
        });
      }
    }
  }

  if (latestLabByMetric.size === 0) {
    drawWrapped('No structured laboratory results available.', { color: slate });
  } else {
    for (const item of latestLabByMetric.values()) {
      const unitStr = item.unit ? ` ${item.unit}` : '';
      const flagStr = item.flag ? ` [${item.flag.toUpperCase()}]` : '';
      const verifyTag =
        item.record.extractionStatus === 'Extracted — Review Required'
          ? ' (UNVERIFIED EXTRACTION)'
          : '';
      drawWrapped(
        `- ${item.label}: ${item.value}${unitStr}${flagStr}${verifyTag}  (${item.record.date} | ${item.record.hospital} | ${item.record.id})`,
        { indent: 4 }
      );
    }
  }

  // 5. Chronological Medical History
  drawSectionHeading('5. CHRONOLOGICAL MEDICAL HISTORY');
  for (const rec of sortedAscDesc) {
    ensureSpace(38);
    const verifyLabel =
      rec.extractionStatus === 'Extracted — Review Required'
        ? 'Unverified AI Extraction - Review Required'
        : rec.extractionStatus;
    drawWrapped(
      `${rec.date}  |  ${rec.id}  |  ${rec.hospital}  |  ${rec.category}  (${verifyLabel})`,
      { bold: true, size: 9.5, color: teal }
    );
    drawWrapped(`${rec.title} — Clinician: ${rec.clinician}`, { bold: true, indent: 6 });
    drawWrapped(rec.summary, { size: 9, color: slate, indent: 6, maxChars: 90 });
    y -= 4;
  }

  // Stamp footers with page numbers
  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i++) {
    const p = pages[i];
    p.drawLine({
      start: { x: marginX, y: 50 },
      end: { x: maxWidthX, y: 50 },
      thickness: 0.75,
      color: lineGray,
    });
    p.drawText(
      `MedVault Portable Health Passport (Synthetic Demo - Not Clinical Advice)   |   Page ${i + 1} of ${totalPages}`,
      { x: marginX, y: 36, size: 8, font: fontRegular, color: slate }
    );
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
