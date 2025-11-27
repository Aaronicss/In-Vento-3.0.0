/**
 * Freshness Prediction API Service
 * Sends ingredient data to Flask API for freshness classification
 */

const FRESHNESS_API_URL = 'https://freshnessapi3.onrender.com/predict';
const SHELF_LIFE_API_URL = 'https://freshnessapi3.onrender.com/shelf-life';

// Enable detailed request/response logging when running in development
const DEBUG_FRESHNESS_API = typeof __DEV__ !== 'undefined' ? !!__DEV__ : false;

export interface FreshnessPredictionRequest {
  temperature: number;
  humidity: number;
  time_in_refrigerator: number; // hours
  ingredient_type: string;
  // class name describing storage environment. Allowed values: 'FREEZER', 'REFRIGERATOR', 'PANTRY'
  storage_type: StorageType;
}

// Allowed storage environment class names accepted by the ML model
export type StorageType = 'FREEZER' | 'REFRIGERATOR' | 'PANTRY';

function normalizeStorageType(value?: string): StorageType {
  if (!value) return 'REFRIGERATOR';
  const asUpper = value.toUpperCase();
  if (asUpper === 'FREEZER' || asUpper === 'REFRIGERATOR' || asUpper === 'PANTRY') {
    return asUpper as StorageType;
  }
  return 'REFRIGERATOR';
}

export interface FreshnessPredictionResponse {
  classification: 'Fresh' | 'Stale' | 'Expired';
  confidence?: number; // optional confidence score
}

export interface ShelfLifeRequest {
  ingredient_type: string;
}

// Updated to match ML endpoint which returns hours until expiry
export interface ShelfLifeResponse {
  ingredient_type?: string;
  hours_until_expiry?: number; // hours until expiry
  classification?: 'Fresh' | 'Stale' | 'Expired';
  confidence?: number;
}
/**
 * Predicts freshness of an ingredient based on environmental factors
 * @param request - Prediction request with temperature, humidity, time, and ingredient type
 * @returns Promise with freshness classification
 */
export async function predictFreshness(
  request: FreshnessPredictionRequest
): Promise<FreshnessPredictionResponse> {
  try {
    const bodyPayload = { ...request, storage_type: normalizeStorageType(request.storage_type) };
    if (DEBUG_FRESHNESS_API) console.debug('[FreshnessAPI] POST', FRESHNESS_API_URL, JSON.stringify(bodyPayload));

    const response = await fetch(FRESHNESS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Freshness API error: ${response.status}`
      );
    }

    let data: any = null;
    try {
      data = await response.json();
    } catch (err) {
      if (DEBUG_FRESHNESS_API) console.warn('[FreshnessAPI] response JSON parse failed', err);
      throw err;
    }

    if (DEBUG_FRESHNESS_API) console.debug('[FreshnessAPI] response', response.status, data);

    return {
      classification: data.classification || data.prediction || 'Fresh',
      confidence: data.confidence,
    };
  } catch (error) {
    console.error('Error predicting freshness:', error);
    // Return a default classification on error
    throw error;
  }
}

/**
 * Calculates time in refrigerator in hours
 * @param addedAt - Timestamp when ingredient was added
 * @returns Number of hours since added
 */
export function calculateTimeInRefrigerator(addedAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - addedAt.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.max(0, Math.round(diffHours * 100) / 100); // Round to 2 decimal places
}

/**
 * Gets predicted shelf life for an ingredient from Flask API
 * @param ingredientType - Type of ingredient (e.g., "LETTUCE", "BEEF")
 * @returns Promise with predicted shelf life in days
 */
export async function getShelfLifePrediction(
  ingredientType: string,
  temperature: number = 5,
  humidity: number = 50,
  timeInRefrigerator: number = 0,
  storageType: StorageType = 'REFRIGERATOR'
): Promise<number> {
  try {
    // The ML endpoint returns hours_until_expiry; we call the predict endpoint
    const bodyPayload = {
      temperature,
      humidity,
      time_in_refrigerator: timeInRefrigerator,
      ingredient_type: ingredientType,
      storage_type: normalizeStorageType(storageType),
    };
    if (DEBUG_FRESHNESS_API) console.debug('[FreshnessAPI] POST', FRESHNESS_API_URL, JSON.stringify(bodyPayload));

    const response = await fetch(FRESHNESS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Shelf Life API error: ${response.status}`
      );
    }

    let data: ShelfLifeResponse | any = null;
    try {
      data = await response.json();
    } catch (err) {
      if (DEBUG_FRESHNESS_API) console.warn('[FreshnessAPI] shelf-life response JSON parse failed', err);
      throw err;
    }
    if (DEBUG_FRESHNESS_API) console.debug('[FreshnessAPI] shelf-life response', response.status, data);

    // Prefer hours_until_expiry; fall back to converting days if provided
    if (data.hours_until_expiry !== undefined && data.hours_until_expiry !== null) {
      return data.hours_until_expiry;
    }
    // If API returns days, convert to hours
    if ((data as any).predicted_shelf_life_days !== undefined) {
      return (data as any).predicted_shelf_life_days * 24;
    }
    return 24 * 7; // default to 7 days in hours
  } catch (error) {
    console.error('Error fetching shelf life prediction:', error);
    // Return default shelf life (7 days in hours) on error
    return 24 * 7;
  }
}

