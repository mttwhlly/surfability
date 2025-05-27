import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

interface SurfData {
  waveHeight: number;
  wavePeriod: number;
  swellDirection: number;
  windDirection: number;
  windSpeed: number;
  tide: string;
}

interface SurfabilityResult {
  score: number;
  surfable: boolean;
  rating: 'Excellent' | 'Fun' | 'Marginal';
}

interface HourlyForecast {
  time: string;
  wave_height: number;
  wave_period: number;
  swell_direction: number;
  wind_speed: number;
  wind_direction: number;
}

function calculateSurfability(data: SurfData): SurfabilityResult {
  let score = 0;
  
  // Wave height scoring (2-8 feet is good range)
  if (data.waveHeight >= 2 && data.waveHeight <= 8) {
    score += 25;
  } else if (data.waveHeight >= 1.5 && data.waveHeight < 2) {
    score += 15; // Small but rideable
  }
  
  // Wave period scoring (longer periods are better)
  if (data.wavePeriod >= 10) {
    score += 25;
  } else if (data.wavePeriod >= 7) {
    score += 20;
  } else if (data.wavePeriod >= 5) {
    score += 10;
  }
  
  // Swell direction scoring (East to Southeast is ideal for FL Atlantic coast)
  if (data.swellDirection >= 45 && data.swellDirection <= 135) {
    score += 20;
  } else if (data.swellDirection >= 30 && data.swellDirection <= 150) {
    score += 10;
  }
  
  // Wind scoring (offshore winds are best, light winds are good)
  if (data.windSpeed < 5) {
    score += 15; // Very light wind
  } else if (data.windDirection >= 225 && data.windDirection <= 315) {
    // Offshore winds (W to NW for east coast)
    if (data.windSpeed <= 15) score += 20;
    else score += 10;
  } else if (data.windSpeed < 10) {
    score += 10; // Light onshore wind
  }
  
  // Tide scoring
  if (data.tide === 'Mid' || data.tide === 'Rising' || data.tide === 'Falling') {
    score += 10;
  }

  let rating: 'Excellent' | 'Fun' | 'Marginal' = 'Marginal';
  if (score >= 75) rating = 'Excellent';
  else if (score >= 50) rating = 'Fun';

  return {
    score,
    surfable: score >= 40, // Lower threshold for surfability
    rating,
  };
}

function parseBuoyData(buoyText: string): { waveHeight: number; swellDirection: number; wavePeriod: number } | null {
  try {
    const lines = buoyText.trim().split('\n');
    if (lines.length < 3) return null;
    
    // Skip header lines and get the most recent data
    const dataLine = lines.find(line => 
      line.trim() && 
      !line.startsWith('#') && 
      !line.includes('YY') && 
      !line.includes('MM')
    );
    
    if (!dataLine) return null;
    
    const parts = dataLine.trim().split(/\s+/);
    if (parts.length < 8) return null;
    
    // NDBC format: YY MM DD hh mm WVHT DPD APD MWD
    // Wave height is typically in column 5 (index 5), period in 6, direction in 8
    const waveHeight = parseFloat(parts[5]) * 3.28084; // Convert meters to feet
    const wavePeriod = parseFloat(parts[6]); // Dominant wave period
    const swellDirection = parseFloat(parts[8]); // Mean wave direction
    
    if (isNaN(waveHeight) || isNaN(wavePeriod) || isNaN(swellDirection)) {
      return null;
    }
    
    return { waveHeight, swellDirection, wavePeriod };
  } catch (error) {
    console.error('Error parsing buoy data:', error);
    return null;
  }
}

function getSimpleTideState(): string {
  // Simple tide calculation based on time of day
  // This is a placeholder - ideally you'd use a real tide API
  const hour = new Date().getHours();
  const tidePhase = hour % 12;
  
  if (tidePhase < 2 || tidePhase > 10) return 'Low';
  else if (tidePhase >= 5 && tidePhase <= 7) return 'High';
  else if (tidePhase < 5) return 'Rising';
  else return 'Falling';
}

function getGoodSurfDuration(hourlyForecasts: HourlyForecast[], tide: string): string {
  if (!hourlyForecasts || hourlyForecasts.length === 0) {
    return 'No forecast data available.';
  }

  const now = new Date();
  const futureForecasts = hourlyForecasts.filter(f => {
    const forecastTime = new Date(f.time);
    return forecastTime >= now;
  }).slice(0, 24); // Only look at next 24 hours

  let maxDurationHours = 0;
  let currentStreak = 0;

  for (let i = 0; i < futureForecasts.length; i++) {
    const hourData = futureForecasts[i];
    const surfData: SurfData = {
      waveHeight: hourData.wave_height * 3.28084, // Convert to feet if needed
      wavePeriod: hourData.wave_period,
      swellDirection: hourData.swell_direction,
      windDirection: hourData.wind_direction,
      windSpeed: hourData.wind_speed * 1.94384, // Convert m/s to knots
      tide,
    };
    
    const result = calculateSurfability(surfData);

    if (result.surfable) {
      currentStreak++;
    } else {
      if (currentStreak > maxDurationHours) {
        maxDurationHours = currentStreak;
      }
      currentStreak = 0;
    }
  }

  // Check final streak
  if (currentStreak > maxDurationHours) {
    maxDurationHours = currentStreak;
  }

  if (maxDurationHours === 0) return 'No good surf expected in next 24 hours';
  else if (maxDurationHours === 1) return 'Good surf for about 1 hour';
  else if (maxDurationHours <= 3) return `Good surf for about ${maxDurationHours} hours`;
  else if (maxDurationHours <= 6) return `Good surf for ${maxDurationHours} hours`;
  else return 'Good surf for most of the day!';
}

app.use(express.json());

app.get('/surfability', async (_req: Request, res: Response) => {
  try {
    // Fetch buoy data with error handling
    let buoyData = null;
    try {
      const buoyRes = await fetch('https://www.ndbc.noaa.gov/data/realtime2/41117.spec', {
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (!buoyRes.ok) {
        throw new Error(`Buoy API returned ${buoyRes.status}`);
      }
      
      const buoyText = await buoyRes.text();
      buoyData = parseBuoyData(buoyText);
    } catch (error) {
      console.warn('Failed to fetch buoy data:', error);
    }

    // Try marine weather data first, then fall back to regular forecast API
    let marineData = null;
    let weatherJson = null;

    try {
      // Try marine API first for wave data
      const marineRes = await fetch(
        'https://api.open-meteo.com/v1/marine?latitude=29.9&longitude=-81.3&hourly=wave_height,wave_period,swell_wave_direction',
        {
          signal: AbortSignal.timeout(8000)
        }
      );
      
      if (marineRes.ok) {
        marineData = await marineRes.json();
      } else {
        console.warn(`Marine API returned ${marineRes.status}, falling back to forecast API`);
      }
    } catch (error) {
      console.warn('Marine API failed, falling back to forecast API:', error);
    }

    // Get regular weather data (wind + backup wave data)
    const weatherRes = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=29.9&longitude=-81.3&current=wind_speed_10m,wind_direction_10m&hourly=wind_speed_10m,wind_direction_10m&timezone=America/New_York&forecast_days=2',
      {
        signal: AbortSignal.timeout(10000)
      }
    );
    
    if (!weatherRes.ok) {
      throw new Error(`Weather API returned ${weatherRes.status}`);
    }

    interface MarineResponse {
      hourly?: {
        time: string[];
        wave_height: number[];
        wave_period: number[];
        swell_wave_direction: number[];
      };
    }

    interface WeatherResponse {
      current: {
        wind_speed_10m: number;
        wind_direction_10m: number;
      };
      hourly: {
        time: string[];
        wind_speed_10m: number[];
        wind_direction_10m: number[];
      };
    }

    const marineJson = marineData as MarineResponse;
    weatherJson = (await weatherRes.json()) as WeatherResponse;

    // Use buoy data if available, otherwise try marine API, then use fallback values
    const waveHeight = buoyData?.waveHeight ?? 
                       (marineJson?.hourly?.wave_height?.[0] ? marineJson.hourly.wave_height[0] * 3.28084 : 2.5);
    const wavePeriod = buoyData?.wavePeriod ?? 
                       marineJson?.hourly?.wave_period?.[0] ?? 8;
    const swellDirection = buoyData?.swellDirection ?? 
                          marineJson?.hourly?.swell_wave_direction?.[0] ?? 90;

    const windSpeed = weatherJson.current.wind_speed_10m * 1.94384; // Convert m/s to knots
    const windDirection = weatherJson.current.wind_direction_10m;

    const tide = getSimpleTideState();

    // Current surf conditions
    const currentSurfData: SurfData = {
      waveHeight,
      wavePeriod,
      swellDirection,
      windDirection,
      windSpeed,
      tide,
    };

    const { score, surfable, rating } = calculateSurfability(currentSurfData);

    // Parse hourly forecast - combine available data
    const hourlyForecasts: HourlyForecast[] = weatherJson.hourly.time.map((timeStr: string, i: number) => ({
      time: timeStr,
      wave_height: marineJson?.hourly?.wave_height?.[i] ?? 2.5, // Default 2.5ft waves
      wave_period: marineJson?.hourly?.wave_period?.[i] ?? 8,   // Default 8 second period
      swell_direction: marineJson?.hourly?.swell_wave_direction?.[i] ?? 90, // Default East
      wind_speed: weatherJson.hourly.wind_speed_10m[i],
      wind_direction: weatherJson.hourly.wind_direction_10m[i],
    }));

    const goodSurfDuration = getGoodSurfDuration(hourlyForecasts, tide);

    // Response
    res.json({
      location: 'St. Augustine, FL',
      timestamp: new Date().toISOString(),
      surfable,
      rating,
      score,
      goodSurfDuration,
      details: {
        wave_height_ft: Math.round(currentSurfData.waveHeight * 10) / 10,
        wave_period_sec: Math.round(currentSurfData.wavePeriod * 10) / 10,
        swell_direction_deg: Math.round(currentSurfData.swellDirection),
        wind_direction_deg: Math.round(currentSurfData.windDirection),
        wind_speed_kts: Math.round(currentSurfData.windSpeed * 10) / 10,
        tide_state: tide,
        data_source: buoyData ? 'NOAA Buoy + Weather API' : (marineJson?.hourly ? 'Marine + Weather API' : 'Weather API + defaults')
      },
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ 
      error: 'Error fetching surf data',
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => console.log(`Surfability API running on port ${PORT}`));