// views/terms.js — Terms of Service. Draft text for review before publishing;
// see the disclaimer at the top of the page itself and PHASE-NOTES.md.
const LAST_UPDATED = 'September 2026';

export function termsView() {
  const body = `
    <div class="legal-page">
      <h1>Terms of Service</h1>
      <p class="legal-meta">Last updated: ${LAST_UPDATED} · Draft — not yet reviewed by a lawyer</p>

      <div class="legal-callout">
        This is a first draft written for Kanto's Phase 1 demo. It has not been reviewed by a
        lawyer and should not be relied on as final before Kanto is opened to the public or
        handles real money. Get it reviewed by a Philippine-licensed lawyer before that happens.
      </div>

      <h2>1. What Kanto is</h2>
      <p>Kanto ("we", "us", "the platform") is an online marketplace that connects hosts and
      landlords ("Hosts") who list short-term stays, long-term leases, or storage and other
      rentable spaces, with guests and tenants ("Guests") who search for and book them. Kanto is
      currently a Phase 1 demo/prototype running on free hosting — not a finished commercial
      product. Payments processed today are simulated (sandbox) charges, not real money.</p>

      <h2>2. Who can use Kanto</h2>
      <p>You must be at least 18 years old and able to enter a binding contract under Philippine
      law to create an account. You're responsible for the accuracy of the information you give
      us and for keeping your password secure. One account per person.</p>

      <h2>3. Hosts</h2>
      <p>If you list a stay, lease, or space, you confirm that you have the legal right to rent it
      out, that your listing is accurate (price, photos, amenities, availability), and that you'll
      honor bookings and lease terms you accept. You're responsible for complying with any local
      laws, homeowners'-association or building rules, barangay permits, and tax obligations that
      apply to renting out your property. Kanto is not a party to the rental agreement between you
      and a Guest — we provide the platform that connects you.</p>

      <h2>4. Guests and tenants</h2>
      <p>When you book a stay, apply for a lease, or reserve a space, you agree to provide accurate
      information, pay the amounts you agree to, and treat the property and its owner respectfully.
      If you're applying for a long-term lease, you may be asked to consent to the Host contacting a
      previous landlord you provide as a reference — that consent is optional and specific to each
      application, and that information is shared only with the Host you're applying to.</p>

      <h2>5. Bookings, payments, and the current sandbox mode</h2>
      <p>Kanto's booking flow currently processes payments through a sandbox (simulated) charge —
      no real GCash, PayMaya, bank, or card transaction takes place today, and no real money moves
      between Guests and Hosts through the platform yet. Once Kanto integrates a real payment
      processor, this section will be replaced with real payment, escrow, refund, and cancellation
      terms, and you'll be notified before that change takes effect.</p>

      <h2>6. Messaging</h2>
      <p>Messages between a Guest and Host about a specific booking, application, or inquiry are
      visible only to the two of you — we don't currently have staff moderation of message content.
      Don't use messaging for anything illegal, harassing, or to try to move a transaction off the
      platform to avoid its terms.</p>

      <h2>7. Content you post</h2>
      <p>You keep ownership of the listing descriptions, photos, and other content you post. By
      posting it, you give Kanto permission to display it on the platform so the marketplace can
      function. Don't post content you don't have the rights to, or that's false, discriminatory,
      or illegal.</p>

      <h2>8. Prohibited conduct</h2>
      <p>You agree not to: list a property you don't have the right to rent; discriminate against
      Guests or applicants on a prohibited basis; misrepresent yourself or a listing; attempt to
      scrape, copy, or reverse-engineer the platform; or use Kanto for any fraudulent or unlawful
      purpose.</p>

      <h2>9. No warranty, and this is a demo</h2>
      <p>Kanto is currently provided "as is," as a Phase 1 prototype hosted on a free tier. We don't
      guarantee uptime, and demo data may be reset or lost without notice. We don't verify the
      identity of Hosts or Guests, inspect listed properties, or guarantee the accuracy of any
      listing — you're responsible for your own due diligence before booking, leasing, or hosting.</p>

      <h2>10. Limitation of liability</h2>
      <p>To the fullest extent allowed by law, Kanto and its operator aren't liable for disputes
      between Hosts and Guests, losses from relying on listing information, or losses arising from
      the demo/prototype nature of the service (downtime, data loss, or resets).</p>

      <h2>11. Suspension and termination</h2>
      <p>We may suspend or terminate an account that violates these terms or misuses the platform.
      You may stop using Kanto and request account deletion at any time.</p>

      <h2>12. Changes to these terms</h2>
      <p>We may update these terms as Kanto develops, especially before moving from demo/sandbox
      mode to handling real payments. We'll post the updated date above when we do.</p>

      <h2>13. Governing law</h2>
      <p>These terms are governed by the laws of the Republic of the Philippines.</p>

      <h2>14. Contact</h2>
      <p>Questions about these terms: <span class="legal-placeholder">[contact email]</span></p>

      <p class="legal-footnote">See also our <a href="/privacy">Privacy Policy</a>.</p>
    </div>
  `;
  return { title: 'Terms of Service', body };
}
