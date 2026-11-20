export interface LeadFormInput {
  platform: "meta" | "linkedin" | "google" | "tiktok";
  offer: string;
  audience_role: string;
  what_we_do_with_lead: string;
  sales_motion: "self_serve" | "high_touch_sales" | "hybrid";
}

export function buildLeadFormPrompt(input: LeadFormInput): string {
  return `Design a high-converting native lead form for ${input.platform}.

NATIVE LEAD FORM RULES (cross-platform):
- Every additional question costs completions. Ask the MINIMUM that lets sales follow up.
- Pre-fillable fields (name, email, phone, company) cost less than custom questions.
- Custom questions should be QUALIFYING — not "what's your favorite color".
- Multiple-choice beats free-text for completion rate; free-text beats nothing.

PLATFORM-SPECIFIC LIMITS:
- Meta Instant Form: up to 15 questions, recommend ≤ 5. Intro headline ≤ 60 chars. Greeting ≤ 280 chars.
- LinkedIn Lead Gen Form: up to 12 questions, recommend ≤ 4. Headline ≤ 70. Intro ≤ 70. Privacy text required.
- Google Lead Form Extension: up to 10 questions, headline ≤ 30, description ≤ 200.
- TikTok Instant Form: up to 10 questions, intro headline ≤ 50.

INPUT:
- Platform: ${input.platform}
- Offer the lead is signing up for: ${input.offer}
- Audience role: ${input.audience_role}
- What we'll do with the lead: ${input.what_we_do_with_lead}
- Sales motion: ${input.sales_motion}

GENERATE:
1. Intro headline + greeting (platform-appropriate length, front-load the value).
2. Questions array — minimum viable to qualify for the sales motion, counting every field (pre-filled contact fields included) and staying within the platform's recommended maximum above:
   - self_serve: 2-3 questions.
   - hybrid: 3-4 questions.
   - high_touch_sales: up to the platform's recommended maximum (LinkedIn: 4, Meta: 5), with at least one BANT-flavored qualifier.
3. Privacy policy line (placeholder URL).
4. Thank-you screen — what does the lead see immediately? What CTA shows up next?
5. Auto-responder email subject + 3-line body (calendly placeholder, expectation set).
6. Sales handoff brief — what info gets passed to sales/CRM, in what shape.

Return ONLY valid JSON:
{
  "intro": {
    "headline": "string",
    "headline_chars": 0,
    "greeting": "string",
    "greeting_chars": 0
  },
  "questions": [
    {
      "field": "name | email | phone | company | job_title | custom",
      "label": "string",
      "type": "text | email | phone | select | multi_select",
      "options": ["string"] ,
      "required": true,
      "pre_fillable_by_platform": true,
      "qualifier": "string — what this answer tells sales, or empty"
    }
  ],
  "privacy_policy_text": "string (mention link placeholder)",
  "thank_you_screen": {
    "headline": "string",
    "body": "string",
    "next_cta_text": "string",
    "next_cta_url_placeholder": "string"
  },
  "auto_responder_email": {
    "subject": "string",
    "body_lines": ["string", "string", "string"]
  },
  "sales_handoff": {
    "fields_passed": ["string"],
    "qualification_summary_template": "string",
    "recommended_response_sla_hours": 0
  }
}`;
}
