// Sample data used by both the Next.js UI and the traffic simulator.
// Values are shaped to look plausible in Discover queries and dashboard
// breakdowns for a generic C2C marketplace.

export const PLATFORMS = ['web', 'ios', 'android'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const USER_SEGMENTS = ['buyer', 'seller', 'both', 'staff', 'guest'] as const;
export type UserSegment = (typeof USER_SEGMENTS)[number];

export const PAYMENT_METHODS = [
  'card',
  'apple_pay',
  'google_pay',
  'zip_bnpl',
  'paypal',
  'merpay',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CARRIERS = ['usps', 'ups', 'fedex', 'marketplace_ship'] as const;
export type Carrier = (typeof CARRIERS)[number];

export const NETWORK_TYPES = [
  'wifi',
  'cellular_5g',
  'cellular_4g',
  'cellular_3g',
] as const;

export const CATEGORIES: Array<{ l1: string; l2: string }> = [
  { l1: 'Electronics', l2: 'Phones & Accessories' },
  { l1: 'Electronics', l2: 'Laptops' },
  { l1: 'Electronics', l2: 'Gaming Consoles' },
  { l1: "Women's", l2: 'Handbags' },
  { l1: "Women's", l2: 'Shoes' },
  { l1: "Men's", l2: 'Sneakers' },
  { l1: 'Home', l2: 'Kitchen' },
  { l1: 'Toys & Games', l2: 'Collectibles' },
  { l1: 'Beauty', l2: 'Skincare' },
];

export const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'] as const;

export const RETURN_REASONS = [
  'not_as_described',
  'damaged',
  'wrong_item',
  'changed_mind',
] as const;

export const LISTING_SOURCES = [
  'search',
  'home_feed',
  'recommendations',
  'push',
  'deep_link',
] as const;

export const EXPERIMENT_VARIANTS = [
  'checkout-v3:control',
  'checkout-v3:treatment',
  'search-rerank-v2:control',
  'search-rerank-v2:treatment',
];

// Decline reasons follow Stripe convention — useful for payment dashboards.
export const DECLINE_REASONS = [
  'insufficient_funds',
  'do_not_honor',
  'incorrect_cvc',
  'expired_card',
  'card_velocity_exceeded',
  'fraudulent',
];
