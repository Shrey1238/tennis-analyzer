# Privacy Policy

**Effective date:** [DATE]

**⚠️ This is a starting template, not legal advice.** Have a lawyer review
this before you rely on it — especially the sections on video handling,
children's privacy, and any users outside the US, which are flagged below.

---

## 1. Who we are

[YOUR COMPANY/PROJECT NAME] ("we," "us") operates [APP NAME], a tool that
analyzes tennis swing videos and provides technique feedback. This policy
explains what data we collect, why, and what your rights are.

Contact: [YOUR CONTACT EMAIL]

## 2. What we collect

- **Account information**: email address and password (password is
  handled by our authentication provider, Supabase, and never stored by
  us in plain text).
- **Height**: used only to calibrate speed estimates from your video; not
  used for any other purpose.
- **Swing videos**: processed to detect body position. **[FLAG FOR LEGAL
  REVIEW: state clearly and accurately whether videos are (a) processed
  entirely in the user's browser and never uploaded to a server, (b)
  uploaded and stored, or (c) uploaded, processed, and immediately
  deleted. As currently built, analysis runs client-side in the browser
  and no video file is transmitted to our servers — confirm this is
  still true before publishing, and update this section if that ever
  changes.]**
- **Analysis results**: the technique metrics and feedback generated from
  your videos (elbow angle, knee bend, torso lean, estimated speed,
  session labels you provide) — these are stored so you can track
  progress over time.
- **Payment information**: handled entirely by Stripe, our payment
  processor. We never see or store your card details — we only receive
  confirmation that a payment succeeded and which plan it was for.
- **Usage data**: basic technical data (browser type, timestamps) that a
  hosting provider like Vercel or Netlify collects automatically.

## 3. How we use it

- To provide the swing analysis and feedback you request.
- To track your free-analysis usage and enforce plan limits.
- To process payments (via Stripe) and manage your subscription.
- To show you your own progress history over time.
- To communicate with you about your account (e.g. password resets,
  billing issues) — we do not send marketing email unless you opt in.

We do not sell your data. We do not use your videos or swing data to
train any model beyond the pose-detection library we use, which is a
pre-built third-party tool, not something we train ourselves.

## 4. Who we share data with

- **Supabase** — hosts our database and handles authentication.
- **Stripe** — processes payments.
- **[Your hosting provider, e.g. Vercel/Netlify]** — hosts the website
  itself.

Each of these providers has their own privacy policy governing how they
handle data on our behalf. We do not share your data with anyone else,
except where required by law.

## 5. Data retention and deletion

You can delete your swing history at any time from within the app. **[FLAG
FOR LEGAL REVIEW: decide and state your actual policy — e.g. what happens
to data when a user deletes their account entirely; how long data is kept
after a subscription is cancelled.]** To request full account deletion,
contact [YOUR CONTACT EMAIL].

## 6. Children's privacy

**[FLAG FOR LEGAL REVIEW — important given the product]**: this service
is not directed at children under 13 (or the relevant age in your
jurisdiction), and we do not knowingly collect data from them. Given that
tennis is played by minors and a parent or coach might reasonably use
this tool to film a child's swing, you should decide deliberately whether
to (a) prohibit accounts for minors, (b) require parental consent for
minors' accounts, or (c) explicitly design for a "coach/parent films,
adult account holds the data" model — and get legal guidance on which
approach fits your target users and jurisdiction (COPPA in the US has
specific requirements if minors do use the service directly).

## 7. International users

**[FLAG FOR LEGAL REVIEW]**: if you expect users outside the US
(especially the EU/UK), you likely need GDPR-specific language (legal
basis for processing, right to erasure, data portability, an EU
representative if required) beyond what's covered here. This template is
written with a US-first product in mind.

## 8. Your rights

You can access, correct, or delete your account information at any time.
Contact [YOUR CONTACT EMAIL] with any requests or questions.

## 9. Changes to this policy

We'll update the effective date above if this policy changes, and will
notify users of material changes via email or an in-app notice.

## 10. Contact

Questions about this policy: [YOUR CONTACT EMAIL]
