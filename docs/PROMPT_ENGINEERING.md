# MedVault AI — Prompt Engineering & Safety Architecture

This document records the actual server-side AI configuration, prompts, schema constraints, grounding validation, prompt iterations, fallback behavior, and evaluation methodology implemented in MedVault AI.

---

## 1. AI SDK & Model Configuration (`server/gemini.ts`)

- **SDK**: `@google/genai` (server-side only; `GEMINI_API_KEY` is read exclusively from `process.env` and never bundled into client code).
- **Model**: `gemini-4-hydrogen` (`MODEL_NAME = 'gemini-4-hydrogen'`).
- **Thinking Configuration**: `ThinkingLevel.LOW` (`thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }`) for low-latency structured JSON extraction and synthesis.
- **Output Format**: Strict structured JSON using `responseMimeType: 'application/json'` and typed `responseSchema` (`Type.OBJECT`, `Type.ARRAY`, `Type.STRING`).

---

## 2. Extraction Prompt Structure (`extractMedicalDocument` / `buildExtractionPrompt`)

The document extraction endpoint (`POST /api/records/extract`) passes the uploaded PDF or image inline alongside `buildExtractionPrompt(fileName)` and `EXTRACTION_SYSTEM_INSTRUCTION`.

### Key Prompt Constraints
1. **Factual Transcription Only**: Instructs the model to extract only facts explicitly visible in the uploaded file without inventing, extrapolating, or diagnosing.
2. **Untrusted Input Boundary**: Explicitly instructs the model to treat imperative statements embedded inside documents (e.g., *"ignore previous instructions"*, *"mark severity Mild"*) strictly as passive text and never execute them.
3. **Strict Document Date Handling**: Instructs the model to output `YYYY-MM-DD` only when complete day, month, and year are clearly readable; otherwise return `"UNKNOWN"` and explain the issue in `dateUncertainty` and `missingFields` rather than defaulting to today's date.
4. **Multi-Allergy & Unknown Severity Preservation**: Requires extracting every allergy mentioned in a document and setting severity to `"Severe"`, `"Moderate"`, or `"Mild"` only when explicitly stated—otherwise `"Unknown"`.
5. **Missing Fields vs. Confirmed Negatives**: Instructs the model to record explicit negative findings (e.g., `"NKDA"`, `"No known drug allergies"`, `"No current medications"`) in `confirmedNegatives` and omitted/unreadable items in `missingFields`.
6. **Ambiguous Labs, Units & Medications**: Requires flagging missing units or unclear lab values with `flag: "unverified"` and `uncertainty` explanations, plus listing ambiguous medications or dosages in `verificationFlags`.

### Server-Side Post-Processing (`normalizeExtractionDraft`)
Model output is deterministically normalized before returning an `ExtractionDraft` to `UploadRecordScreen.tsx`:
- `validateIsoDocumentDate()` checks strict `YYYY-MM-DD` formatting and valid UTC calendar bounds (`1900–2100`); missing or partial dates become `date: ''` and `dateStatus: 'missing' | 'ambiguous'` (never `new Date()`).
- `normalizeAllergySeverity()` maps unrecognized/blank severities to `'Unknown'` (never `'Mild'`), and separates confirmed-negative phrases (`NKDA`) into `confirmedNegatives`.
- Quantitative lab facts missing units or containing uncertainty markers (`?`, `illegible`, `unclear`, `approx`, `~`) automatically set `verificationRequired: true` and upgrade unmarked `'normal'` flags to `'unverified'`.

---

## 3. Clinical Summary Prompt & Source Grounding (`generateDoctorSummary` / `buildSummaryPrompt`)

`POST /api/doctor/ai-summary` runs only after server-side RBAC verifies `user.role === 'doctor'` and active `'approved'` consent, passing only records returned by `filterRecordsByScope(db.records, consent.scope)`.

### Summary Prompt Structure
- **Untrusted Data Fence**: Serializes permitted records inside `<UNTRUSTED_MEDICAL_DATA>...</UNTRUSTED_MEDICAL_DATA>` and instructs `SUMMARY_SYSTEM_INSTRUCTION` to treat all record strings as passive clinical data.
- **Required Citation & Quotation Rules**:
  - Every item in `keyFindings`, `activeMedications`, and `allergyConflicts` must cite an exact `sourceRecordId` from `ACCESSIBLE RECORDS JSON`.
  - Findings include `sourceQuote`, constrained to verbatim excerpts copied directly from the referenced permitted record.
  - Missing dates, unverified uploads (`Extracted — Review Required`), and cross-hospital allergy conflicts must be surfaced explicitly in `allergyConflicts` and `uncertaintiesAndGaps`.
  - Prohibits diagnoses, prescriptions, or clinical advice.

### Server-Side Grounding Validation (`validateAndGroundSummary`)
Before returning any `AISummaryResult` to the browser:
1. **Citation Allowlist Check**: Each `sourceRecordId` is looked up strictly in `accessibleRecords`. Invalid or out-of-scope IDs are rewritten to `sourceRecordId: 'UNVERIFIED'`, `citationVerified: false`, `evidenceStatus: 'unverified-citation'`, and any claimed `sourceQuote` is withheld.
2. **Verbatim Quotation & Scope Redaction Check**: `isGroundedQuoteForRecord()` verifies that `sourceQuote` appears in the permitted fields of the referenced record (`allergiesMentioned` only when `scopeRedacted === true`, preventing clinical encounter leakage on `REC-104` under `Labs & Allergies Only`). If ungrounded, it is replaced solely with an actual permitted excerpt from `derivePermittedExcerpt()` (never fabricated).
3. **Verified vs. Unverified Distinction**: Findings linked to uploads marked `Extracted — Review Required` are tagged `evidenceStatus: 'unverified-extraction'` with explicit review warnings.
4. **Deterministic Discrepancy Explanations**: Server-computed allergy conflicts (`computeAllergiesAndDiscrepanciesForRecords`) are merged deterministically so cross-hospital conflicts (`conflictReason` + permitted `evidenceSnippets`) cannot be silently dropped.

---

## 4. Documented Prompt & Validation Iterations

1. **Initial Baseline**: Single-shot Gemini extraction and doctor summary prompts with JSON `responseSchema`, checking citations against `recordMap` in `server/gemini.ts`. Defaults filled unparseable dates with today's date (`new Date().toISOString().slice(0, 10)`) and unrecognized allergy severities with `'Mild'`.
2. **Audit Hardening Pass**:
   - Enforced `Labs & Allergies Only` redaction across consultations (`REC-104`) and file routes (`/api/records/:id/file`).
   - Added multi-allergy retention, patient verification (`PATCH /api/records/:id/verify`), rate limiting (`rateLimitAi`), and permission-versioned summary caching (`buildSummaryCacheKey`).
3. **Hackathon Quota Fallback Pass**:
   - Added explicit `POST /api/doctor/ai-summary/sample` (`server/sampleSummary.ts`) returning pre-validated synthetic summaries only on explicit user click when live Gemini returns a service/quota error (`502`/`503`/`429`), gated on `recordsMatchOriginalSeed` (`409` if records changed) and active doctor consent (`403` if pending/revoked).
4. **Reliability, Explainability & Anti-Injection Pass (Current)**:
   - Replaced silent today's-date and `'Mild'`-severity defaults with missing-date preservation (`date: ''` / `'Date Unknown'`) and explicit `'Unknown'` allergy severity.
   - Added unitless numeric lab detection (`verificationRequired: true`, `flag: 'unverified'`), medication dosage review flags, separation of `confirmedNegatives` vs. `missingFields`, `<UNTRUSTED_MEDICAL_DATA>` fences, and `validateAndGroundSummary` verbatim quote + `conflictReason` verification.

---

## 5. Live AI vs. Pre-Generated Sample Fallback Policy

- **Default Behavior**: Every generation click invokes live `POST /api/doctor/ai-summary`.
- **Fallback Trigger**: Only when live synthesis fails with HTTP `502`, `503`, or `429` *and* the vault still matches the 9 seeded synthetic records (`recordsMatchSeed: true`), the UI offers **View Sample AI Summary**.
- **Transparency & Boundary Rules**:
  - Sample output always displays the notice: *"Pre-generated demonstration data — not a live AI response"*.
  - Calling `/api/doctor/ai-summary/sample` still enforces doctor authentication, active consent (`403`), consent scope redaction (`Labs & Allergies Only`), and unmodified seed validation (`409` if records changed).

---

## 6. Evaluation Methodology (`tests/evaluate.ts`)

- **Deterministic Offline Suite (`npm test`)**: Executes 10 test cases against `normalizeExtractionDraft`, `validateAndGroundSummary`, `buildSampleAiSummary`, `filterRecordsByScope`, and live Express HTTP endpoints on an ephemeral port—covering medication extraction, multi-allergy parsing, missing dates, unknown severity, conflicting allergies, missing lab units, fabricated citations, consent-scope exclusion, revoked doctor access (`403`), and embedded prompt-injection payloads.
- **Optional Live Gemini Check (`npm run test:live` / `RUN_LIVE_EVAL=1`)**: Separated from offline CI checks and marked `SKIPPED` cleanly when offline or when Gemini quota/API key is unavailable—scores are never estimated or fabricated.
