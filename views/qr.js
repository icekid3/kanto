// views/qr.js — renders a listing's QR matrix (from lib/qrcode.js) as an
// SVG, and a print-friendly poster page a host can hang wherever they'd
// post a "for rent" sign. Uses the browser's own Print / Save as PDF —
// no image-file generation or download mechanism needed.
import { escapeHtml, peso, priceUnitLabel, verticalLabel } from '../lib/format.js';

// Render a QR module matrix as a crisp, scalable inline SVG. Dark modules
// become a single combined <path> (one draw call, not one <rect> per
// module) so the SVG stays small even at high versions.
export function qrMatrixToSvg(matrix, { moduleSize = 8, quietModules = 4 } = {}) {
  const { size, modules } = matrix;
  const dim = size + quietModules * 2;
  const px = dim * moduleSize;
  let path = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) {
        const x = (c + quietModules) * moduleSize;
        const y = (r + quietModules) * moduleSize;
        path += `M${x},${y}h${moduleSize}v${moduleSize}h-${moduleSize}z`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${px}" width="${px}" height="${px}" role="img" aria-label="QR code linking to this listing">
    <rect width="${px}" height="${px}" fill="#ffffff"/>
    <path d="${path}" fill="#000000"/>
  </svg>`;
}

export function qrPosterView({ listing, listingUrl, qrSvg }) {
  const body = `
    <div class="no-print" style="max-width:640px; margin:0 auto 20px;">
      <p style="color:var(--muted); font-size:0.9rem;">Print this page (or save as PDF) and post it wherever renters might see it — a tarp, a gate, a bulletin board. Scanning the code opens this listing directly.</p>
      <button class="btn btn-primary" onclick="window.print()" type="button">Print / Save as PDF</button>
      <a class="btn" style="margin-left:8px;" href="/listings/${listing.id}">← Back to listing</a>
    </div>

    <div class="qr-poster">
      <div class="qr-poster-vertical">${verticalLabel(listing.vertical)}</div>
      <h1 class="qr-poster-title">${escapeHtml(listing.title)}</h1>
      <div class="qr-poster-loc">${escapeHtml(listing.city)}${listing.region ? ', ' + escapeHtml(listing.region) : ''}</div>
      <div class="qr-poster-price">${peso(listing.price_amount)} <small>${priceUnitLabel(listing.price_unit)}</small></div>
      <div class="qr-poster-code">${qrSvg}</div>
      <div class="qr-poster-cta">Scan to view &amp; inquire</div>
      <div class="qr-poster-url">${escapeHtml(listingUrl)}</div>
    </div>
  `;
  return { title: `QR poster — ${listing.title}`, body };
}
