/**
 * Freshness Service
 * Orchestrates the freshness prediction flow:
 * 1. Fetches weather data (temperature, humidity)
 * 2. Calculates time in refrigerator
 * 3. Calls Flask API for prediction
 */

import {
  calculateTimeInRefrigerator,
  FreshnessPredictionResponse,
  predictFreshness,
} from './freshnessApi';
import { fetchWeatherData } from './weatherApi';

export interface FreshnessPredictionInput {
  ingredientType: string;
  addedAt: Date;
  city: string;
  weatherApiKey: string;
}

export interface FreshnessResult extends FreshnessPredictionResponse {
  temperature: number;
  humidity: number;
  timeInRefrigerator: number;
}

/**
 * Gets freshness prediction for an ingredient
 * @param input - Input data for prediction
 * @returns Promise with freshness prediction and associated data
 */
export async function getFreshnessPrediction(
  input: FreshnessPredictionInput
): Promise<FreshnessResult> {
  try {
    // Step 1: Fetch weather data
    const weatherData = await fetchWeatherData(input.city, input.weatherApiKey);

    // Step 2: Calculate time in refrigerator
    const timeInRefrigerator = calculateTimeInRefrigerator(input.addedAt);

    // Step 3: Call Flask API for prediction
    const prediction = await predictFreshness({
      temperature: weatherData.temperature,
      humidity: weatherData.humidity,
      time_in_refrigerator: timeInRefrigerator,
      ingredient_type: input.ingredientType,
    });

    return {
      ...prediction,
      temperature: weatherData.temperature,
      humidity: weatherData.humidity,
      timeInRefrigerator,
    };
  } catch (error) {
    console.error('Error in getFreshnessPrediction:', error);
    throw error;
  }
}

/**
 * Batch prediction for multiple ingredients
 * @param inputs - Array of prediction inputs
 * @returns Promise with array of freshness results
 */
export async function getBatchFreshnessPredictions(
  inputs: FreshnessPredictionInput[]
): Promise<FreshnessResult[]> {
  try {
    // Fetch weather data once (assuming all ingredients are in the same location)
    if (inputs.length === 0) {
      return [];
    }

    const firstInput = inputs[0];
    const weatherData = await fetchWeatherData(
      firstInput.city,
      firstInput.weatherApiKey
    );

    // Process all predictions
    const predictions = await Promise.all(
      inputs.map(async (input) => {
        const timeInRefrigerator = calculateTimeInRefrigerator(input.addedAt);

        const prediction = await predictFreshness({
          temperature: weatherData.temperature,
          humidity: weatherData.humidity,
          time_in_refrigerator: timeInRefrigerator,
          ingredient_type: input.ingredientType,
        });

        return {
          ...prediction,
          temperature: weatherData.temperature,
          humidity: weatherData.humidity,
          timeInRefrigerator,
        };
      })
    );

    return predictions;
  } catch (error) {
    console.error('Error in getBatchFreshnessPredictions:', error);
    throw error;
  }
}

