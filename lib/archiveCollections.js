/**
 * archiveCollections.js
 *
 * Defines the trusted Counterparty art collections that UNATRARE archives.
 * Each entry describes how to discover and display the collection.
 *
 * Adding a new collection:
 *   1. Add an entry here
 *   2. Go to /admin → Archive tab → Import Assets → paste asset names
 *   3. Run scrape to download + hash all images
 *
 * Discovery methods:
 *   'xcp_search'  — query XCP API for assets matching keyword patterns
 *   'manual'      — admin provides asset list via admin panel import
 */

export const COLLECTIONS = {
  rarepepe: {
    id: 'rarepepe',
    name: 'Rare Pepe',
    tagline: 'The original Counterparty art collection. Series 1–38. 1,774 cards.',
    description:
      'Rare Pepe began in 2016 on the Counterparty protocol. ' +
      'Artists submitted cards to a committee for approval into numbered series. ' +
      '1,774 unique cards across 36 original series plus Series 37–38. ' +
      'The genesis of Bitcoin-native art collecting.',
    seriesCount: 38,
    totalExpected: 1774,
    color: '#b4ff6f',
    accentColor: '#00cc44',
    icon: '🐸',
    // XCP API search terms — assets matching these patterns are candidates
    // NOT all matches will be Rare Pepes; the series/card fields in the
    // Enhanced Asset Info JSON are used to confirm membership.
    searchKeywords: ['PEPE'],
    // Known assets whose names don't contain the search keywords above.
    // Add any discovered exceptions here.
    knownExceptions: [
      'TRUMPRARE', 'BERNIERES', 'CARLTONPEPE', 'GOXPEPE',
    ],
    // XCP issuance block range (approximate) — helps filter API results
    blockFirst: 428000,  // September 2016
    blockLast:  600000,  // 2019 — S37/38 added later but within this range
    // Validation: asset's Enhanced Asset Info JSON must have series 1–38
    validateSeries: (s) => Number.isInteger(s) && s >= 1 && s <= 38,
    // External reference (read-only, not scraped from here)
    directoryUrl: 'https://rarepepedirectory.com',
  },

  // ── Future collections — uncomment + fill in when ready ──────────
  // fakerares: {
  //   id: 'fakerares',
  //   name: 'Fake Rares',
  //   tagline: 'Community-created Rare Pepe tribute cards.',
  //   seriesCount: null,
  //   totalExpected: null,
  //   color: '#ff6b6b',
  //   searchKeywords: ['FAKER', 'FAKE'],
  //   validateSeries: () => true,
  //   directoryUrl: 'https://fakerares.org',
  // },
};

/**
 * Returns collection config by id, or null if not found.
 */
export function getCollection(id) {
  return COLLECTIONS[id] ?? null;
}

/**
 * Returns all collection ids.
 */
export function getCollectionIds() {
  return Object.keys(COLLECTIONS);
}
