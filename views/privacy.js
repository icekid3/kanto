// views/privacy.js — Privacy Policy. Draft text for review before publishing;
// see the disclaimer at the top of the page itself and PHASE-NOTES.md.
// References the Philippines Data Privacy Act of 2012 (RA 10173) — has a
// lawyer confirm this before Kanto is opened to the public.
const LAST_UPDATED = 'September 2026';

export function privacyView() {
  const body = `
    <div class="legal-page">
      <h1>Privacy Policy</h1>
      <p class="legal-meta">Last updated: ${LAST_UPDATED} · Draft — not yet reviewed by a lawyer</p>

      <div class="legal-callout">
        This is a first draft written for Kanto's Phase 1 demo, referencing the Philippines Data
        Privacy Act of 2012 (RA 10173). It has not been reviewed by a lawyer and should not be
        relied on as final before Kanto is opened to the public. Get it reviewed by a
        Philippine-licensed lawyer before that happens.
      </div>

      <h2>1. What information we collect</h2>
      <p>We collect the information you give us directly when using Kanto:</p>
      <ul>
        <li>Account details: your name, email address, and password (stored as a salted hash — we
        never store your actual password).</li>
        <li>Listing details, if you're a Host: title, description, address, price, photos,
        amenities, and availability.</li>
        <li>Booking, application, and inquiry details: dates, messages you send through the
        platform, and — if you apply for a long-term lease — any move-in date, employment
        information, or previous-landlord reference you choose to provide, along with your consent
        to that reference being contacted.</li>
        <li>Sandbox payment records: currently simulated transaction records, not real financial
        account details.</li>
        <li>Basic usage data: which listings you view, recorded either against your account
        (signed in) or a randomly generated identifier stored in a cookie (signed out), so Hosts
        can see aggregate performance stats like views and contacts for their own listings.</li>
      </ul>

      <h2>2. How we use it</h2>
      <p>We use this information to: operate the marketplace (create your account, show and manage
      listings, process bookings and applications); let Hosts and Guests communicate about a
      specific booking, application, or inquiry; show Hosts aggregate analytics about their own
      listings; and keep the platform secure (for example, session login).</p>

      <h2>3. Who we share it with</h2>
      <p>We don't sell your personal information. We share it only as necessary for the
      marketplace to function:</p>
      <ul>
        <li>With the other party to a specific transaction — for example, a Guest's booking
        details are shared with the Host of that listing, and a rental applicant's reference
        details are shared only with the Host they applied to.</li>
        <li>With our hosting provider, to run the service.</li>
      </ul>
      <p>We don't currently use third-party advertising or analytics trackers.</p>

      <h2>4. How long we keep it</h2>
      <p>We keep account and transaction data for as long as your account is active, or as needed
      to resolve disputes. Note: while Kanto runs on free/demo hosting, the underlying database can
      be reset without notice — this is a limitation of the current infrastructure, not a privacy
      protection, and shouldn't be relied on to remove your data (use the request below instead).</p>

      <h2>5. Security</h2>
      <p>Passwords are hashed and salted, never stored in plain text. Sessions use random,
      httpOnly session tokens. That said, no system is perfectly secure, and this demo has not had
      an independent security review.</p>

      <h2>6. Your rights under the Data Privacy Act (RA 10173)</h2>
      <p>As a data subject under Philippine law, you have the right to: be informed about how your
      data is processed; access the data we hold about you; ask us to correct inaccurate data;
      object to or withdraw consent for certain processing; ask us to erase or block data that's
      no longer needed or was unlawfully processed; request a copy of your data in a portable
      format; and claim damages if you're harmed by unlawful processing. To exercise any of these,
      contact us using the details below.</p>

      <h2>7. Cookies</h2>
      <p>We use a session cookie to keep you logged in, and, for signed-out visitors, an anonymous
      identifier cookie used only to avoid double-counting a listing view. We don't use advertising
      cookies.</p>

      <h2>8. Children's privacy</h2>
      <p>Kanto is not directed at, and should not be used by, anyone under 18.</p>

      <h2>9. Data Protection Officer / contact</h2>
      <p>For any privacy question, correction, or data request:
      <span class="legal-placeholder">[Data Protection Officer name and contact email]</span>.
      You may also raise concerns with the National Privacy Commission (privacy.gov.ph).</p>

      <h2>10. Changes to this policy</h2>
      <p>We'll update this page as Kanto develops, particularly before moving from demo/sandbox
      mode to real payments and real user data at scale, and will update the date above when we do.</p>

      <p class="legal-footnote">See also our <a href="/terms">Terms of Service</a>.</p>
    </div>
  `;
  return { title: 'Privacy Policy', body };
}
