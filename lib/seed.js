// lib/seed.js
// Seeds two demo accounts and six sample listings (two per vertical) so
// Phase 1 has real data to click through instead of an empty shell.
// Safe to re-run: it skips seeding if listings already exist.
//
// Exported as seedIfEmpty() so server.js can call it automatically on
// startup -- important on a free-tier host with an ephemeral filesystem
// (e.g. Render's free plan wipes local files on every spin-down), where
// nobody's around to run `npm run seed` by hand after each restart.
import crypto from 'node:crypto';
import { get, run, all } from './db.js';
import { createUser } from './auth.js';

export function seedIfEmpty() {
  const already = get('SELECT COUNT(*) as n FROM listings');
  if (already.n > 0) {
    console.log(`Already seeded (${already.n} listings). Skipping.`);
    return;
  }

  let hostId, guestId;
  try {
    hostId = createUser({ name: 'Maria Santos', email: 'host@demo.app', password: 'Demo1234!', role: 'host' });
  } catch {
    hostId = get('SELECT id FROM users WHERE email = $e', { $e: 'host@demo.app' }).id;
  }
  try {
    guestId = createUser({ name: 'Ana Reyes', email: 'guest@demo.app', password: 'Demo1234!', role: 'guest' });
  } catch {
    guestId = get('SELECT id FROM users WHERE email = $e', { $e: 'guest@demo.app' }).id;
  }

  const listings = [
    {
      vertical: 'stay',
      title: 'Sunset Studio near Boracay Station 1',
      description: 'A breezy studio a five-minute walk from White Beach. Pool access, daily housekeeping, and a kitchenette for longer stays.',
      city: 'Malay, Aklan', region: 'Western Visayas',
      price_amount: 320000, price_unit: 'night', capacity: 2,
      size_label: 'Studio', amenities: ['WiFi', 'Aircon', 'Pool', 'Beach access'], photo_emoji: '🏖️',
    },
    {
      vertical: 'stay',
      title: 'BGC High-Rise 1BR with Skyline View',
      description: 'Fully furnished 1-bedroom on the 32nd floor. Steps from restos and offices — popular with business travelers.',
      city: 'Taguig', region: 'Metro Manila',
      price_amount: 450000, price_unit: 'night', capacity: 3,
      size_label: '1BR / 32nd flr', amenities: ['WiFi', 'Aircon', 'Gym', 'Parking'], photo_emoji: '🏙️',
    },
    {
      vertical: 'lease',
      title: 'Unfurnished 2BR Condo Unit, Lahug',
      description: 'Bare unit ready for move-in, 12-month minimum lease. Near IT Park and Ayala Center Cebu.',
      city: 'Cebu City', region: 'Central Visayas',
      price_amount: 1800000, price_unit: 'month', capacity: 4,
      size_label: '2BR / 65 sqm', amenities: ['Parking', 'Balcony', '24hr security'], photo_emoji: '🏢',
    },
    {
      vertical: 'lease',
      title: 'Quiet 1BR Apartment near Ateneo',
      description: 'Semi-furnished unit in a low-density building, walking distance to Ateneo de Davao. 6-month minimum lease.',
      city: 'Davao City', region: 'Davao Region',
      price_amount: 1200000, price_unit: 'month', capacity: 2,
      size_label: '1BR / 38 sqm', amenities: ['Water heater', 'Parking'], photo_emoji: '🏠',
    },
    {
      vertical: 'storage',
      title: 'Climate-Controlled Storage Unit',
      description: 'Indoor, air-conditioned unit for documents, furniture, or seasonal stock. Ground-floor access.',
      city: 'Quezon City', region: 'Metro Manila',
      price_amount: 180000, price_unit: 'month', capacity: null,
      size_label: '5 sqm', amenities: ['24/7 access', 'CCTV', 'Climate control'], photo_emoji: '📦',
    },
    {
      vertical: 'storage',
      title: 'Drive-Up Storage Locker',
      description: 'Load straight from your car or van. Good for inventory, appliances, or moving-house overflow.',
      city: 'Pasig', region: 'Metro Manila',
      price_amount: 320000, price_unit: 'month', capacity: null,
      size_label: '10 sqm', amenities: ['Drive-up access', 'CCTV'], photo_emoji: '🚪',
    },
  ];

  for (const l of listings) {
    run(
      `INSERT INTO listings (id, host_id, vertical, title, description, city, region, price_amount, price_unit, currency, capacity, size_label, amenities, photo_emoji, status)
       VALUES ($id, $hostId, $vertical, $title, $description, $city, $region, $price, $unit, 'PHP', $capacity, $size, $amenities, $emoji, 'active')`,
      {
        $id: crypto.randomUUID(),
        $hostId: hostId,
        $vertical: l.vertical,
        $title: l.title,
        $description: l.description,
        $city: l.city,
        $region: l.region,
        $price: l.price_amount,
        $unit: l.price_unit,
        $capacity: l.capacity,
        $size: l.size_label,
        $amenities: JSON.stringify(l.amenities),
        $emoji: l.photo_emoji,
      }
    );
  }

  console.log(`Seeded ${listings.length} listings.`);
  console.log('Demo host login: host@demo.app / Demo1234!');
  console.log('Demo guest login: guest@demo.app / Demo1234!');
}

// Only auto-run when invoked directly (`npm run seed` / `node lib/seed.js`),
// not when server.js imports seedIfEmpty() to call it itself on startup.
if (import.meta.url === `file://${process.argv[1]}`) {
  seedIfEmpty();
}
