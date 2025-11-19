/**
 * Freshness Prediction API Service
 * Sends ingredient data to Flask API for freshness classification
 */

const FRESHNESS_API_URL = 'https://freshnessapi2.onrender.com/predict';
const SHELF_LIFE_API_URL = 'https://freshnessapi2.onrender.com/shelf-life';

export interface FreshnessPredictionRequest {
  temperature: number;
  humidity: number;
  time_in_refrigerator: number; // hours
  ingredient_type: string;
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
    const response = await fetch(FRESHNESS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Freshness API error: ${response.status}`
      );
    }

    const data = await response.json();
    
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
  timeInRefrigerator: number = 0
): Promise<number> {
  try {
    // The ML endpoint returns hours_until_expiry; we call the predict endpoint
    const response = await fetch(FRESHNESS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        temperature,
        humidity,
        time_in_refrigerator: timeInRefrigerator,
        ingredient_type: ingredientType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Shelf Life API error: ${response.status}`
      );
    }

    const data: ShelfLifeResponse = await response.json();
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

