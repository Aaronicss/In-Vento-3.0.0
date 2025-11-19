/**
 * WeatherAPI Service
 * Fetches temperature and humidity data from WeatherAPI.com
 */

const WEATHER_API_BASE_URL = 'https://api.weatherapi.com/v1';

export interface WeatherData {
  temperature: number; // in Celsius
  humidity: number; // percentage
}

/**
 * Fetches current weather data for a given city
 * @param city - City name (e.g., "Bacoor")
 * @param apiKey - WeatherAPI API key
 * @returns Promise with temperature and humidity data
 */
export async function fetchWeatherData(
  city: string,
  apiKey: string
): Promise<WeatherData> {
  try {
    const url = `${WEATHER_API_BASE_URL}/current.json?key=${apiKey}&q=${encodeURIComponent(city)}&aqi=no`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `Weather API error: ${response.status}`
      );
    }

    const data = await response.json();
    
    return {
      temperature: data.current.temp_c,
      humidity: data.current.humidity,
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw error;
  }
}

