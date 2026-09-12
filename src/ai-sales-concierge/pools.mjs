/**
 * Official Relax Fix UAE training locations.
 * Source of truth: https://www.relaxfixuae.com/ (sitemap location pages + homepage).
 * Do not invent addresses, prices, or coordinates beyond documented sources.
 *
 * Conflict note:
 * - business_settings.locations lists customer neighborhood options (Al Muroor, etc.),
 *   not the four training venues. Website location pages override for pool venues.
 */

export const POOL_DATA_SOURCE = {
  primary: "https://www.relaxfixuae.com/",
  sitemap: "https://www.relaxfixuae.com/sitemap.xml",
  pages: [
    "https://www.relaxfixuae.com/locations/najda-street",
    "https://www.relaxfixuae.com/locations/ics-al-falah",
    "https://www.relaxfixuae.com/locations/ics-khalifa",
    "https://www.relaxfixuae.com/locations/ics-mushrif",
  ],
  retrievedAt: "2026-08-14",
};

/** @typedef {{ id: string, name: string, nameAr: string, emirate: string, area: string, areaAr: string, address: string|null, mapUrl: string, lat: number|null, lng: number|null, coordPrecision: 'exact_plus_code'|'area_centroid'|null, coordNote: string|null, services: string[], constraints: string[], sourceUrl: string }} Pool */

/** @type {Pool[]} */
export const RELAX_FIX_POOLS = [
  {
    id: "najda-street",
    name: "Najda Street",
    nameAr: "نجدة ستريت (النجدة)",
    emirate: "Abu Dhabi",
    area: "Al Danah / Al Najda",
    areaAr: "الدانة / النجدة",
    address:
      "ICS Al Danah — International Community School, Al Najda St, Al Danah, E11, Abu Dhabi",
    mapUrl: "https://maps.app.goo.gl/XL9weMpSJcpVDNCV6",
    // Official Google Maps place URL on the website includes plus code F9PG+R56
    lat: 24.4870375,
    lng: 54.375390625,
    coordPrecision: "exact_plus_code",
    coordNote: "Decoded from official Maps plus code F9PG+R56 on website place link",
    services: ["kids_swimming", "water_confidence"],
    constraints: ["limited_availability", "hours_are_general_not_guaranteed"],
    sourceUrl: "https://www.relaxfixuae.com/locations/najda-street",
  },
  {
    id: "ics-al-falah",
    name: "ICS Al Falah",
    nameAr: "ICS الفلاح",
    emirate: "Abu Dhabi",
    area: "Al Falah",
    areaAr: "الفلاح",
    address:
      "International Community Schools — ICS Al Falah City, Suhail Bilqaz Al Muhairi St, Al Falah, 1E, Abu Dhabi",
    mapUrl: "https://maps.app.goo.gl/b5LULVrArcD8BwhF9",
    // Exact pool GPS not published on website schema; area centroid from official address locality
    lat: 24.4371131,
    lng: 54.7118179,
    coordPrecision: "area_centroid",
    coordNote: "Nominatim centroid for official address area Al Falah, Abu Dhabi",
    services: ["kids_swimming", "water_confidence"],
    constraints: ["limited_availability", "hours_are_general_not_guaranteed"],
    sourceUrl: "https://www.relaxfixuae.com/locations/ics-al-falah",
  },
  {
    id: "ics-khalifa",
    name: "ICS Khalifa",
    nameAr: "ICS مدينة خليفة",
    emirate: "Abu Dhabi",
    area: "Khalifa City",
    areaAr: "مدينة خليفة",
    address:
      "International Community Schools — ICS Khalifa City, Khalifa City, SE38, Abu Dhabi",
    mapUrl: "https://maps.app.goo.gl/cbWqzLqDSYXmEFyS9",
    lat: 24.4201314,
    lng: 54.5749535,
    coordPrecision: "area_centroid",
    coordNote: "Nominatim centroid for official address area Khalifa City, Abu Dhabi",
    services: ["kids_swimming", "water_confidence"],
    constraints: ["limited_availability", "hours_are_general_not_guaranteed"],
    sourceUrl: "https://www.relaxfixuae.com/locations/ics-khalifa",
  },
  {
    id: "ics-mushrif",
    name: "ICS Mushrif",
    nameAr: "ICS المشرف",
    emirate: "Abu Dhabi",
    area: "Al Mushrif",
    areaAr: "المشرف",
    address:
      "International Community Schools — ICS Mushrif, 24th Street, Al Mushrif Area, Abu Dhabi",
    mapUrl: "https://maps.app.goo.gl/Rgu2vKH7JDigAQQx6",
    lat: 24.4410852,
    lng: 54.3842182,
    coordPrecision: "area_centroid",
    coordNote: "Nominatim centroid for official address area Al Mushrif, Abu Dhabi",
    services: ["kids_swimming", "water_confidence"],
    constraints: ["limited_availability", "hours_are_general_not_guaranteed"],
    sourceUrl: "https://www.relaxfixuae.com/locations/ics-mushrif",
  },
];

/**
 * Customer-area aliases used only to understand where the customer is.
 * Coordinates are public area centroids (Nominatim) for nearest-pool math — not Relax Fix venues.
 */
export const CUSTOMER_AREA_ALIASES = [
  { id: "al_barsha", labelAr: "البرشاء", labelEn: "Al Barsha", lat: 25.0994892, lng: 55.2017252, patterns: [/البرشاء|برشاء|barsha/i] },
  { id: "deira", labelAr: "ديرة", labelEn: "Deira", lat: 25.2727936, lng: 55.305334, patterns: [/ديرة|ديره|deira/i] },
  { id: "jvc", labelAr: "جي في سي", labelEn: "JVC", lat: 25.0565882, lng: 55.2079869, patterns: [/جي\s*في\s*سي|jvc|jumeirah village circle/i] },
  { id: "marina", labelAr: "مارينا", labelEn: "Marina", lat: 25.0786415, lng: 55.1352524, patterns: [/مارينا|marina|dubai marina/i] },
  { id: "al_falah", labelAr: "الفلاح", labelEn: "Al Falah", lat: 24.4371131, lng: 54.7118179, patterns: [/الفلاح|فلاح|al\s*falah/i], preferPoolId: "ics-al-falah" },
  { id: "khalifa_city", labelAr: "مدينة خليفة", labelEn: "Khalifa City", lat: 24.4201314, lng: 54.5749535, patterns: [/مدينة\s*خليفة|خليفة\s*سيتي|khalifa\s*city|\bkhalifa\b/i], preferPoolId: "ics-khalifa" },
  { id: "al_mushrif", labelAr: "المشرف", labelEn: "Al Mushrif", lat: 24.4410852, lng: 54.3842182, patterns: [/المشرف|مشرف|mushrif/i], preferPoolId: "ics-mushrif" },
  { id: "najda", labelAr: "النجدة", labelEn: "Najda", lat: 24.4870375, lng: 54.375390625, patterns: [/نجدة|النجدة|najda|al\s*danah|الدانة/i], preferPoolId: "najda-street" },
  { id: "al_khalidiya", labelAr: "الخالدية", labelEn: "Al Khalidiya", lat: 24.4693445, lng: 54.3488059, patterns: [/الخالدية|خالدية|khalidiya|khalidiyah/i] },
  { id: "al_reem", labelAr: "الريم", labelEn: "Al Reem Island", lat: 24.4953701, lng: 54.4052431, patterns: [/الريم|reem/i] },
  { id: "yas", labelAr: "ياس", labelEn: "Yas Island", lat: 24.486404, lng: 54.6090712, patterns: [/ياس|yas\s*island|\byas\b/i] },
  { id: "al_muroor", labelAr: "المرور", labelEn: "Al Muroor", lat: 24.4734475, lng: 54.3758677, patterns: [/المرور|muroor|al\s*ma'?amoor|المعمور/i] },
  { id: "electra", labelAr: "الكترو", labelEn: "Electra", lat: 24.4588998, lng: 54.3314368, patterns: [/electra|الكترو|الكتيرا/i] },
];

const LOCATION_INTENT_PATTERN =
  /(where|location|address|map|place|are you located|nearest|closest|near me|فين|وين|موقع|عنوان|مكان|الموقع|أقرب|اقرب|قريب|مسبح|pool)/i;

export function isLocationIntent(body) {
  return LOCATION_INTENT_PATTERN.test(body);
}

export function matchCustomerArea(body) {
  for (const area of CUSTOMER_AREA_ALIASES) {
    if (area.patterns.some((p) => p.test(body))) return area;
  }
  return null;
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * @returns {{ pool: Pool, method: 'prefer_pool'|'haversine', distanceKm: number|null } | null}
 */
export function findNearestPool(area) {
  if (!area) return null;
  if (area.preferPoolId) {
    const pool = RELAX_FIX_POOLS.find((p) => p.id === area.preferPoolId);
    if (pool) return { pool, method: "prefer_pool", distanceKm: 0 };
  }
  const withCoords = RELAX_FIX_POOLS.filter((p) => p.lat != null && p.lng != null);
  if (!withCoords.length || area.lat == null || area.lng == null) return null;

  let best = null;
  for (const pool of withCoords) {
    const distanceKm = haversineKm(area.lat, area.lng, pool.lat, pool.lng);
    if (!best || distanceKm < best.distanceKm) {
      best = { pool, method: "haversine", distanceKm };
    }
  }
  return best;
}

export function formatNearestPoolReply(language, area, match) {
  if (!match?.pool) {
    return language === "ar"
      ? "ما قدرت أحدد أقرب مسبح بثقة من اللي كتبته. قلّي منطقتك أو أقرب معلم معروف؟"
      : "I couldn't confidently pick the nearest pool from that. Which area or nearby landmark are you in?";
  }
  const pool = match.pool;
  const name = language === "ar" ? pool.nameAr : pool.name;
  const areaLabel = language === "ar" ? pool.areaAr : pool.area;
  const customerArea = language === "ar" ? area.labelAr : area.labelEn;
  if (language === "ar") {
    return `أقرب موقع تدريب لك حسب بياناتنا من ${customerArea}: ${name} (${areaLabel}، أبوظبي).\n${pool.mapUrl}`;
  }
  return `Nearest Relax Fix training location from ${customerArea}: ${name} (${areaLabel}, Abu Dhabi).\n${pool.mapUrl}`;
}

export function formatAskAreaReply(language) {
  return language === "ar"
    ? "أكيد — عشان أحدد أقرب مسبح، أنت في أي منطقة؟"
    : "Sure — which area are you in so I can pick the nearest pool?";
}

export { LOCATION_INTENT_PATTERN };
