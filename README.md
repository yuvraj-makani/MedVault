<div align="center">

# 🩺 MedVault

### Your Health. One Secure Vault.

**An AI-assisted, patient-controlled platform for unified, portable medical records.**

*Built for Prompt Wars | Hackathon prototype*

</div>

---

## 📖 Overview

Medical records are often scattered across hospitals, clinics, paper prescriptions, and disconnected systems. This can make it difficult for clinicians to review a patient's history and for patients to carry their own medical information between appointments.

**MedVault** is a prototype that brings synthetic medical records from multiple hospitals into one searchable view, helps digitize medical documents using AI, provides source-linked summaries for clinicians, and enables patients to control record sharing. It also generates a **Portable Health Passport PDF** that patients can take outside the platform.

> **Important:** MedVault is a hackathon demonstration using fictional patients and synthetic records. Its hospital connections are simulated; it does not currently integrate with live hospital systems or India's ABDM/ABHA network. It is **not** a certified electronic health record system or a clinical decision-support product suitable for real patient care.

## 🎯 Problem Statements

### PS1 — Fragmented medical histories across hospitals

Doctors treating patients in emergencies or follow-up visits may not have a consolidated view of previous diagnoses, prescriptions, allergies, and ongoing medication information because records are maintained separately.

**MedVault's approach:** A unified clinical timeline and consent-restricted doctor view combine information from multiple *fictional demo hospitals*, supported by source-linked AI summaries and discrepancy flags requiring clinician review.

### PS2 — Limited patient access to portable digital records

Patients often carry physical folders of reports, images, and prescriptions between healthcare providers.

**MedVault's approach:** Patients can upload and organize PDF/image documents, review AI-extracted information, download individual files, and export a consolidated Health Passport PDF.

## ✨ Features

| Feature | What it does |
| --- | --- |
| **Unified Patient Dashboard** | Presents patient information, recent records, participating demo hospitals, and documented allergy discrepancies. |
| **Searchable Medical Timeline** | Filters medical records by keyword, hospital, and category. |
| **AI Document Extraction** | Uses server-side Gemini to extract structured information from supported uploaded medical PDFs/images; users can review and edit multiple allergies, observations, and medications. |
| **Verification Workflow** | Allows extracted details to be reviewed and marked as patient-verified; unclear details should not be treated as confirmed clinical facts. |
| **Doctor Dashboard** | Shows only records available under an approved consent grant. |
| **Consent & Audit Trail** | Supports access requests, approval, limited sharing scope, revocation, and access-event logging. |
| **AI Doctor Summary** | Produces source-linked summaries of permitted records, with citation checking and permission-sensitive caching. |
| **Cross-Hospital Discrepancy Alerts** | Flags conflicting documented allergy details for clinician review without automatically resolving the conflict. |
| **Portable Health Passport** | Generates a PDF containing demographics, documented allergies, medications, laboratory observations, and a dated record index. |
| **Sample AI Summary Fallback** | Displays a clearly labeled pre-generated summary when the live Gemini service is unavailable, **only** for the unchanged synthetic seed dataset and only within the doctor's active consent scope. |
| **Responsive Interface** | Designed for desktop and mobile, including a guided demo walkthrough. |

### Built-in demo workflow

1. Open **Ananya Sharma's** patient dashboard.
2. Explore medical records from **CityCare Hospital**, **Sunrise Medical Center**, and **Metro Health Clinic**.
3. Review the documented **Penicillin allergy discrepancy** and the original record references.
4. Approve a doctor's access request in **Consent Management**.
5. Switch to the authorized doctor and open the **AI Doctor Summary**.
6. If live AI is unavailable, use **View Sample AI Summary** and note its explicit demo-data label.
7. Download the **Health Passport PDF**.
8. Upload a synthetic document, review extracted fields, verify, and save it to the timeline.
9. Revoke doctor access and demonstrate that protected records become inaccessible.

> **Demo tip:** The sample AI summary is intentionally disabled when the original seeded records change. If the Gemini quota is exhausted, demonstrate the doctor summary **before uploading** a new record, or reset the synthetic demo dataset first.

## 🏗️ Architecture

```text
                       ┌───────────────────────────────┐
                       │ React + TypeScript Frontend   │
                       │ Patient / Doctor / Demo UI    │
                       └───────────────┬───────────────┘
                                       │ authenticated API requests
                       ┌───────────────▼───────────────┐
                       │ Node.js / TypeScript Server   │
                       │ RBAC, Consent, Audit, Routes  │
                       └───────┬─────────────┬─────────┘
                               │             │
                  ┌────────────▼──────┐  ┌───▼──────────────────┐
                  │ Local JSON Store  │  │ Gemini Integration   │
                  │ + Private Uploads │  │ Extraction / Summary │
                  └───────────────────┘  └──────────────────────┘
                               │
                       ┌───────▼────────┐
                       │ pdf-lib Export │
                       │ Health Passport│
                       └────────────────┘
```

### Tech stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Node.js / TypeScript API server
- **AI:** Google Gemini via `@google/genai` (server-side)
- **PDF generation:** `pdf-lib`
- **Storage for demo:** Local JSON database and private filesystem uploads
- **Testing:** TypeScript checks, Vite production build, HTTP/API tests, Playwright + headless Chromium browser tests
- **Development tool:** Google AI Studio

## 🚀 Local Setup

### Prerequisites

- Node.js and npm compatible with this repository's `package.json`
- A Gemini API key **if you want live AI extraction and summary generation**

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/medvault.git
cd medvault
npm install
```

### Environment variables

The backend reads the API key from the environment:

```env
GEMINI_API_KEY=your_api_key_here
```

Set the variable using the environment mechanism supported by your local setup or deployment platform. **Never commit real credentials or `.env` files.** Check the project's existing server entry point and `package.json` scripts for any additional settings.

### Run the app

```bash
npm run dev
```

Open the local URL printed in your terminal. In the reported AI Studio test environment, the full-stack app was served at `http://127.0.0.1:3000`; your local port may differ.

### Build and type-check

```bash
npm run build
npm run lint
```

> The commands above reflect the scripts used in the reported project QA. Confirm that your exported repository's `package.json` still includes them. If `npm run dev` only starts the Vite frontend in your export, use the repository's full-stack start script to run the backend as well.

## 🔐 Privacy, Security & Consent

The prototype implements several protections in its demo environment:

- Backend role checks and consent-gated medical-record endpoints
- **Full History** and **Labs & Allergies Only** sharing scopes
- Redaction and protected file retrieval for restricted views
- Consent revocation and invalidation of permission-sensitive AI summaries
- Server-side checks of AI citations against accessible records
- Private storage outside static public routes
- Audit events for record access and consent actions
- Basic rate limiting on AI endpoints

**Security limitation:** This implementation uses demo authentication, a single-process local JSON store, and filesystem persistence. These are suitable for a controlled prototype, **not for real patient information or production healthcare deployment**. Deploy only with synthetic data unless a comprehensive privacy, security, compliance, and clinical-safety review has been completed.

## 🤖 AI Reliability and Safety

- Gemini runs on the server rather than exposing API keys in the browser.
- Clinical facts are tied to source records, and unknown citations are marked unverified.
- Extracted medical information is reviewable and may require user verification.
- Discrepancy alerts highlight records needing professional review; they do **not** diagnose or determine treatment.
- Generated summaries are aids to record navigation, **not medical advice**.
- When the live Gemini service is unavailable, the optional **Sample Demo (Not Live AI)** summary is clearly labeled and restricted to unchanged seeded records plus active doctor permissions.

## 🧪 Testing and Verification

The following outcomes were **reported by Google AI Studio's automated QA**, not independently certified:

- TypeScript (`tsc --noEmit`) and Vite production build passed.
- Patient and doctor dashboards rendered at desktop (**1280×800**) and mobile (**390×844**) sizes with no horizontal overflow in tested screens.
- Portable Health Passport generated a downloadable, structurally valid PDF.
- PDF upload, side-by-side preview, multi-allergy edit, save, and timeline persistence passed browser tests.
- Consent approval, restricted-scope access, and revocation returned the expected results in API/browser tests.
- Sample-summary fallback was tested with a **real upstream Gemini quota failure**, not a mocked response.
- The sample summary correctly stopped working when seed records changed or doctor consent was revoked.

**Known limitations:** Live Gemini availability depends on quota and service conditions; the latest live AI summary UI response was not re-tested after a cache-key fix due to quota exhaustion, though a mocked response validated its rendering and caching behavior. Inline PDF previews may depend on browser PDF support. Local persistence is not appropriate for multi-instance/cloud serverless deployments without changes.

## 🧭 Roadmap

- Integration with participating healthcare providers using established interoperability standards such as HL7 FHIR
- Evaluation of ABDM-compatible workflows and consent requirements (no live integration claimed)
- Production database and durable encrypted object storage
- Real authentication, stronger session management, observability, and security auditing
- Patient-controlled time-limited grants and more granular permissions
- Expanded clinical data visualization and accessibility support
- Formal usability, privacy, security, and clinical-safety validation

## 📦 Repository Hygiene

Before publishing the repository, ensure these paths and secrets are excluded from version control:

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
storage/medvault-db.json
storage/private_uploads/
```

Do **not** publish real API keys, uploaded documents, private health data, or runtime session secrets. If a secret was previously committed, **rotate it**; simply removing it in a later commit does not erase its history.

## 🏆 Prompt Wars

MedVault was developed through iterative prompting with Google AI Studio, followed by technical audits, targeted fixes, source-code checks, and browser/API testing. The demo focuses on two connected outcomes:

1. **For clinicians:** A consolidated, consent-restricted view of multi-hospital medical history.
2. **For patients:** A digital vault and portable PDF summary of their own records.

**Tagline:** *Your Health. One Secure Vault.*

---

<div align="center">

**MedVault** · Built for a Prompt Wars hackathon · Synthetic demo data only

</div>
