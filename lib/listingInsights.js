// lib/listingInsights.js — host-facing "boost this listing" suggestions.
// Pure rules over data the caller already fetched: a completeness checklist
// (things the listing itself is missing) plus a price comparison against
// similar active listings. No I/O here — server.js does the querying,
// views/listing.js and views/dashboard.js do the rendering.

// A listing's own completeness — the fields that make it look finished and
// findable. Items are skipped when they don't apply to that vertical (e.g.
// "capacity" doesn't mean much for a storage unit).
export function completenessChecklist(listing) {
  const amenities = Array.isArray(listing.amenities) ? listing.amenities : JSON.parse(listing.amenities || '[]');
  const items = [];

  items.push({
    key: 'active',
    label: 'Publish your listing',
    tip: "Draft and inactive listings don't show up in search — switch the status to Active when you're ready.",
    done: listing.status === 'active',
  });
  items.push({
    key: 'photo',
    label: 'Add a placeholder photo',
    tip: 'A blank listing card gets skipped over in search — pick an emoji that fits, at least until real photos are supported.',
    done: !!listing.photo_emoji,
  });
  items.push({
    key: 'description',
    label: 'Write a fuller description',
    tip: 'Listings with more detail tend to get more questions and bookings — aim for a few sentences, not one line.',
    done: (listing.description || '').trim().length >= 80,
  });
  items.push({
    key: 'amenities',
    label: 'List at least 3 amenities',
    tip: 'Renters compare on this — an empty or one-item list makes your listing look bare next to others.',
    done: amenities.length >= 3,
  });
  items.push({
    key: 'address',
    label: 'Add a street address',
    tip: 'Powers your public Google Maps link and makes your printable QR poster point renters to the right spot.',
    done: !!(listing.address && listing.address.trim()),
  });
  if (listing.vertical !== 'storage') {
    items.push({
      key: 'capacity',
      label: 'Set a capacity',
      tip: 'Guests want to know how many people it fits before they ask.',
      done: !!listing.capacity,
    });
  }
  if (listing.vertical !== 'stay') {
    items.push({
      key: 'size_label',
      label: 'Add a size / layout label',
      tip: "e.g. '2BR / 65 sqm' — helps renters size it up at a glance.",
      done: !!(listing.size_label && listing.size_label.trim()),
    });
  }

  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length };
}

// Compares this listing's price against other active listings in the same
// vertical + city. Needs at least 2 comparables to say anything — with
// fewer, "average" isn't meaningful. Returns null when there's no tip to
// give (not enough comparables, or price is already within a normal band).
export function priceTip(listing, comparableListings) {
  const comps = comparableListings.filter((l) => l.id !== listing.id);
  if (comps.length < 2) return null;
  const avg = comps.reduce((sum, l) => sum + l.price_amount, 0) / comps.length;
  if (avg <= 0) return null;
  const diff = (listing.price_amount - avg) / avg;
  if (diff > 0.15) return { direction: 'above', avg, diffPercent: Math.round(diff * 100), sampleSize: comps.length };
  if (diff < -0.15) return { direction: 'below', avg, diffPercent: Math.round(Math.abs(diff) * 100), sampleSize: comps.length };
  return null;
}
