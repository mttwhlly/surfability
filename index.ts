import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: [
    'https://localhost:8444',
    'http://localhost:8444',
    'https://localhost:3000',
    'http://localhost:3000',
    'https://127.0.0.1:8444',
    'http://127.0.0.1:8444',
    'https://yso00ok0wsgg4o80k4o0s0o0.mttwhlly.cc', // Your frontend
    'https://c0cgocok00o40c48c40k8g04.mttwhlly.cc', // Your API
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Accept',
    'Authorization',
    'X-Requested-With',
    'Origin',
    'Cache-Control',
    'Pragma',
    'Expires'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  exposedHeaders: ['X-SW-Source'],
  maxAge: 86400 // Cache preflight for 24 hours
};

app.use(cors(corsOptions));

app.options('*', (req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Requested-With, Origin, Cache-Control, Pragma, Expires');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.use(express.json());

// Optional: Add logging for debugging
app.use((req: Request, res: Response, next) => {
  console.log(`📡 ${req.method} ${req.path} from: ${req.headers.origin || 'no-origin'}`);
  next();
});

interface SurfData {
  waveHeight: number;
  wavePeriod: number;
  swellDirection: number;
  windDirection: number;
  windSpeed: number;
  tide: string;
  tideHeight?: number;
}

interface WeatherData {
  airTemperature: number;
  waterTemperature: number;
  weatherCode: number;
  weatherDescription: string;
}

interface TideData {
  currentHeight: number;
  state: string;
  nextHigh: { time: string; height: number } | null;
  nextLow: { time: string; height: number } | null;
  previousHigh: { time: string; height: number } | null;
  previousLow: { time: string; height: number } | null;
}

interface SurfabilityResult {
  score: number;
  surfable: boolean;
  rating: string;
  funRating: string;
}

interface HourlyForecast {
  time: string;
  wave_height: number;
  wave_period: number;
  swell_direction: number;
  wind_speed: number;
  wind_direction: number;
}

// Fun surf rating phrases with some attitude
const surfRatings = {
  excellent: [
    "Epic",
    "Firing",
    "Going Off",
    "Pumping",
    "Primo",
    "Cranking",
    "Nuking"
  ],
  good: [
    "Fun",
    "Solid",
    "Decent",
    "Surfable",
    "Worth It",
    "Not Bad",
    "Rideable"
  ],
  marginal: [
    "Marginal", 
    "Questionable",
    "Sketchy",
    "Iffy",
    "Meh",
    "Barely",
    "Struggling"
  ],
  poor: [
    "Flat",
    "Blown Out",
    "Junk",
    "Trash",
    "Hopeless",
    "Closed Out",
    "Victory at Sea",
    "Ankle Biters",
    "Lake Mode",
    "Check the Cam",
    "Stay Home",
    "Netflix Day"
  ]
};

// Weather code descriptions based on WMO codes
const weatherDescriptions: { [key: number]: string } = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy", 
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail"
};

function getRandomRating(category: keyof typeof surfRatings): string {
  const options = surfRatings[category];
  return options[Math.floor(Math.random() * options.length)];
}

function getWeatherDescription(code: number): string {
  return weatherDescriptions[code] || "Unknown conditions";
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
  
  // Tide scoring - enhanced with actual tide data
  if (data.tide === 'Mid' || data.tide === 'Rising' || data.tide === 'Falling') {
    score += 10;
  }
  
  // Bonus points for optimal tide height (mid-range)
  if (data.tideHeight !== undefined) {
    if (data.tideHeight >= 0.5 && data.tideHeight <= 2.5) {
      score += 5; // Optimal tide height for surfing
    }
  }

  let rating: string;
  let funRating: string;
  
  if (score >= 80) {
    rating = 'Excellent';
    funRating = getRandomRating('excellent');
  } else if (score >= 65) {
    rating = 'Good';
    funRating = getRandomRating('good');
  } else if (score >= 45) {
    rating = 'Marginal';
    funRating = getRandomRating('marginal');
  } else {
    rating = 'Poor';
    funRating = getRandomRating('poor');
  }

  return {
    score,
    surfable: score >= 45,
    rating,
    funRating,
  };
}

function parseBuoyData(buoyText: string): { waveHeight: number; swellDirection: number; wavePeriod: number } | null {
  try {
    const lines = buoyText.trim().split('\n');
    if (lines.length < 3) return null;
    
    console.log('Buoy raw text sample:', buoyText.slice(0, 500));
    
    // Find the header line to understand column positions
    const headerLine = lines.find(line => line.includes('WVHT') && (line.includes('SwP') || line.includes('APD')));
    if (!headerLine) {
      console.log('Could not find header line with WVHT and SwP/APD');
      return null;
    }
    
    console.log('Header line found:', headerLine);
    
    // Skip header lines and get the most recent data
    const dataLine = lines.find(line => 
      line.trim() && 
      !line.startsWith('#') && 
      !line.includes('YY') && 
      !line.includes('MM') &&
      !line.includes('WVHT') &&
      !line.includes('yr  mo dy hr mn') // Skip the units line too
    );
    
    if (!dataLine) {
      console.log('Could not find valid data line');
      return null;
    }
    
    console.log('Data line found:', dataLine);
    const parts = dataLine.trim().split(/\s+/);
    console.log('Buoy data parts:', parts);
    
    if (parts.length < 8) {
      console.log('Not enough data columns:', parts.length);
      return null;
    }
    
    // NDBC format: YY MM DD hh mm WVHT SwH SwP WWH WWP SwD WWD STEEPNESS APD MWD
    const waveHeightMeters = parseFloat(parts[5]); // WVHT (significant wave height in meters)
    const swellPeriod = parseFloat(parts[7]);      // SwP (swell wave period in seconds)  
    const swellDirection = parseFloat(parts[14]);  // MWD (mean wave direction in degrees)
    
    // If swell period is not available or invalid, try using APD (average period)
    let wavePeriod = swellPeriod;
    if (isNaN(swellPeriod) || swellPeriod < 2 || swellPeriod > 30) {
      wavePeriod = parseFloat(parts[13]); // APD (average wave period)
      console.log('Using APD instead of SwP:', wavePeriod);
    }
    
    // Validate the data makes sense
    if (isNaN(waveHeightMeters) || isNaN(wavePeriod) || isNaN(swellDirection)) {
      console.log('Invalid numeric data:', { waveHeightMeters, wavePeriod, swellDirection });
      return null;
    }
    
    if (wavePeriod < 2 || wavePeriod > 30) {
      console.log('Wave period out of reasonable range:', wavePeriod);
      return null;
    }
    
    if (waveHeightMeters < 0 || waveHeightMeters > 20) {
      console.log('Wave height out of reasonable range:', waveHeightMeters);
      return null;
    }
    
    const waveHeight = waveHeightMeters * 3.28084; // Convert meters to feet
    
    console.log('Successfully parsed buoy data:', { 
      waveHeight: waveHeight.toFixed(1) + ' ft', 
      wavePeriod: wavePeriod.toFixed(1) + ' sec', 
      swellDirection: swellDirection.toFixed(0) + '°' 
    });
    
    return { waveHeight, swellDirection, wavePeriod };
  } catch (error) {
    console.error('Error parsing buoy data:', error);
    return null;
  }
}

async function fetchTideData(): Promise<TideData> {
  try {
    // St. Augustine Beach, FL station (closer to surf spot)
    const stationId = '8720587';
    
    // First try to get current water level (latest observation)
    const currentUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=${stationId}&product=water_level&datum=MLLW&time_zone=lst_ldt&units=english&application=SurfLab&format=json`;
    
    // Get high/low predictions for yesterday, today and tomorrow to find previous tides
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };
    
    // Extended date range to capture previous tides
    const predictionsUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${formatDate(yesterday)}&end_date=${formatDate(tomorrow)}&station=${stationId}&product=predictions&datum=MLLW&time_zone=lst_ldt&interval=hilo&units=english&application=SurfLab&format=json`;
    
    // Also get 6-minute predictions for current interpolation
    const currentPredictionsUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=today&station=${stationId}&product=predictions&datum=MLLW&time_zone=lst_ldt&units=english&application=SurfLab&format=json`;
    
    console.log('🌊 Fetching enhanced tide data from URLs:');
    console.log('📍 Current level URL:', currentUrl);
    console.log('📅 High/Low predictions URL (yesterday-tomorrow):', predictionsUrl);
    console.log('📊 Current predictions URL:', currentPredictionsUrl);
    
    // Fetch all three endpoints
    const [currentRes, predictionsRes, currentPredictionsRes] = await Promise.all([
      fetch(currentUrl, { signal: AbortSignal.timeout(8000) }),
      fetch(predictionsUrl, { signal: AbortSignal.timeout(8000) }),
      fetch(currentPredictionsUrl, { signal: AbortSignal.timeout(8000) })
    ]);
    
    let currentHeight = 0;
    let nextHigh: { time: string; height: number } | null = null;
    let nextLow: { time: string; height: number } | null = null;
    let previousHigh: { time: string; height: number } | null = null;
    let previousLow: { time: string; height: number } | null = null;
    
    // Try to get current water level from observations first
    console.log('📊 Current water level response status:', currentRes.status);
    if (currentRes.ok) {
      const currentData = await currentRes.json();
      console.log('📊 Current water level response keys:', Object.keys(currentData));
      
      if (currentData.data && currentData.data.length > 0) {
        const rawValue = currentData.data[0].v;
        currentHeight = parseFloat(rawValue);
        console.log('📊 ✅ Got current height from observations:', currentHeight);
      } else if (currentData.error) {
        console.log('📊 ❌ Current water level API error:', currentData.error);
      } else {
        console.log('📊 ❌ No current water level data available');
      }
    } else {
      console.log('📊 ❌ Current water level request failed:', currentRes.status);
    }
    
    // If we didn't get current height from observations, interpolate from predictions
    if (currentHeight === 0 && currentPredictionsRes.ok) {
      console.log('📊 🔄 Trying to get current height from predictions...');
      const currentPredictionsData = await currentPredictionsRes.json();
      
      if (currentPredictionsData.predictions && currentPredictionsData.predictions.length > 0) {
        const now = new Date();
        
        // Find the prediction closest to current time
        let closestPrediction = null;
        let smallestTimeDiff = Infinity;
        
        for (const prediction of currentPredictionsData.predictions) {
          const predictionTime = new Date(prediction.t);
          const timeDiff = Math.abs(now.getTime() - predictionTime.getTime());
          
          if (timeDiff < smallestTimeDiff) {
            smallestTimeDiff = timeDiff;
            closestPrediction = prediction;
          }
        }
        
        if (closestPrediction) {
          currentHeight = parseFloat(closestPrediction.v);
          const timeDiffMinutes = Math.round(smallestTimeDiff / (1000 * 60));
          console.log(`📊 ✅ Using prediction for current height: ${currentHeight} ft (${timeDiffMinutes} min old)`);
        }
      }
    }
    
    // Parse high/low tide predictions for past and future - FIXED LOGIC
    console.log('📈 Tide predictions response status:', predictionsRes.status);
    if (predictionsRes.ok) {
      const predictionsData = await predictionsRes.json();
      
      if (predictionsData.predictions && predictionsData.predictions.length > 0) {
        const now = new Date();
        console.log('🕐 Current time for tide classification:', now.toISOString());
        
        // FIXED: Classify tides based on actual current time, not arbitrary date boundaries
        const allPredictions = predictionsData.predictions.map((p: any) => ({
          ...p,
          time: new Date(p.t),
          parsedHeight: parseFloat(p.v)
        }));
        
        // Separate ACTUAL past and future based on current time
        const pastPredictions = allPredictions.filter((p: any) => p.time < now);
        const futurePredictions = allPredictions.filter((p: any) => p.time >= now);
        
        console.log(`📊 Found ${pastPredictions.length} past tides and ${futurePredictions.length} future tides`);
        
        // Find most recent previous high and low from ACTUAL past events
        for (let i = pastPredictions.length - 1; i >= 0; i--) {
          const prediction = pastPredictions[i];
          
          if (prediction.type === 'H' && !previousHigh) {
            previousHigh = {
              time: prediction.t,
              height: prediction.parsedHeight
            };
            console.log('📈 Found previous high:', prediction.t, prediction.parsedHeight + ' ft');
          } else if (prediction.type === 'L' && !previousLow) {
            previousLow = {
              time: prediction.t,
              height: prediction.parsedHeight
            };
            console.log('📈 Found previous low:', prediction.t, prediction.parsedHeight + ' ft');
          }
          
          if (previousHigh && previousLow) break;
        }
        
        // FIXED: Find ACTUAL next high and low from future events only
        for (const prediction of futurePredictions) {
          if (prediction.type === 'H' && !nextHigh) {
            nextHigh = {
              time: prediction.t,
              height: prediction.parsedHeight
            };
            console.log('📈 Found next high:', prediction.t, prediction.parsedHeight + ' ft');
          } else if (prediction.type === 'L' && !nextLow) {
            nextLow = {
              time: prediction.t,
              height: prediction.parsedHeight
            };
            console.log('📈 Found next low:', prediction.t, prediction.parsedHeight + ' ft');
          }
          
          if (nextHigh && nextLow) break;
        }
        
        // Log the results for debugging
        console.log('🔍 CORRECTED tide classification:');
        if (previousHigh) {
          const timeDiff = Math.round((now.getTime() - new Date(previousHigh.time).getTime()) / (1000 * 60));
          console.log(`   Previous High: ${previousHigh.time} (${timeDiff} minutes ago)`);
        }
        if (previousLow) {
          const timeDiff = Math.round((now.getTime() - new Date(previousLow.time).getTime()) / (1000 * 60));
          console.log(`   Previous Low: ${previousLow.time} (${timeDiff} minutes ago)`);
        }
        if (nextHigh) {
          const timeDiff = Math.round((new Date(nextHigh.time).getTime() - now.getTime()) / (1000 * 60));
          console.log(`   Next High: ${nextHigh.time} (in ${timeDiff} minutes)`);
        }
        if (nextLow) {
          const timeDiff = Math.round((new Date(nextLow.time).getTime() - now.getTime()) / (1000 * 60));
          console.log(`   Next Low: ${nextLow.time} (in ${timeDiff} minutes)`);
        }
      }
    }
    
    // Determine tide state using corrected logic
    let state = 'Unknown';
    const now = new Date();
    
    if (nextHigh && nextLow) {
      const timeToHigh = new Date(nextHigh.time).getTime() - now.getTime();
      const timeToLow = new Date(nextLow.time).getTime() - now.getTime();
      
      if (timeToHigh < timeToLow) {
        // Next event is high tide
        state = currentHeight > 1.5 ? 'High Rising' : 'Rising';
      } else {
        // Next event is low tide
        state = currentHeight < 1.0 ? 'Low Falling' : 'Falling';
      }
      
      // Determine if we're at mid-tide
      const range = Math.abs(nextHigh.height - nextLow.height);
      const midPoint = (nextHigh.height + nextLow.height) / 2;
      
      if (Math.abs(currentHeight - midPoint) < range * 0.25) {
        state = 'Mid';
      }
      
      console.log(`🌊 Tide state determined: ${state} (next high in ${Math.round(timeToHigh/(1000*60))} min, next low in ${Math.round(timeToLow/(1000*60))} min)`);
    }
    
    // Final fallback if we still don't have current height
    if (currentHeight === 0) {
      console.log('📊 🔄 Using fallback current height calculation');
      if (nextHigh && nextLow) {
        currentHeight = (nextHigh.height + nextLow.height) / 2;
        console.log(`📊 ✅ Estimated current height: ${currentHeight} ft`);
      } else {
        currentHeight = 1.5;
        console.log('📊 ⚠️ Using absolute fallback height: 1.5 ft');
      }
    }
    
    const finalTideData = {
      currentHeight,
      state,
      nextHigh,
      nextLow,
      previousHigh,
      previousLow
    };
    
    console.log('🌊 Final CORRECTED tide data being returned:', finalTideData);
    return finalTideData;
    
  } catch (error) {
    console.error('❌ Error fetching tide data:', error);
    
    // Return fallback data
    const fallbackData = {
      currentHeight: 1.5,
      state: 'Mid',
      nextHigh: null,
      nextLow: null,
      previousHigh: null,
      previousLow: null
    };
    console.log('🔄 Returning fallback tide data:', fallbackData);
    return fallbackData;
  }
}

function getConditionsDuration(hourlyForecasts: HourlyForecast[], tide: string): string {
  if (!hourlyForecasts || hourlyForecasts.length === 0) {
    return 'No forecast data available.';
  }

  const now = new Date();
  const futureForecasts = hourlyForecasts.filter(f => {
    const forecastTime = new Date(f.time);
    return forecastTime >= now;
  }).slice(0, 24); // Only look at next 24 hours

  // Track different quality streaks
  let goodStreaks: number[] = [];
  let marginalStreaks: number[] = [];
  let currentGoodStreak = 0;
  let currentMarginalStreak = 0;
  let totalSurfableHours = 0;

  for (let i = 0; i < futureForecasts.length; i++) {
    const hourData = futureForecasts[i];
    const surfData: SurfData = {
      waveHeight: hourData.wave_height * 3.28084, // Convert to feet if needed
      wavePeriod: hourData.wave_period,
      swellDirection: hourData.swell_direction,
      windDirection: hourData.wind_direction,
      windSpeed: hourData.wind_speed * 0.539957, // Convert m/s to knots
      tide,
    };
    
    const result = calculateSurfability(surfData);

    if (result.score >= 65) { // Good conditions
      currentGoodStreak++;
      if (currentMarginalStreak > 0) {
        marginalStreaks.push(currentMarginalStreak);
        currentMarginalStreak = 0;
      }
      totalSurfableHours++;
    } else if (result.score >= 45) { // Marginal but surfable
      currentMarginalStreak++;
      if (currentGoodStreak > 0) {
        goodStreaks.push(currentGoodStreak);
        currentGoodStreak = 0;
      }
      totalSurfableHours++;
    } else { // Poor conditions
      if (currentGoodStreak > 0) {
        goodStreaks.push(currentGoodStreak);
        currentGoodStreak = 0;
      }
      if (currentMarginalStreak > 0) {
        marginalStreaks.push(currentMarginalStreak);
        currentMarginalStreak = 0;
      }
    }
  }

  // Add final streaks
  if (currentGoodStreak > 0) goodStreaks.push(currentGoodStreak);
  if (currentMarginalStreak > 0) marginalStreaks.push(currentMarginalStreak);

  const maxGoodStreak = goodStreaks.length > 0 ? Math.max(...goodStreaks) : 0;
  const maxMarginalStreak = marginalStreaks.length > 0 ? Math.max(...marginalStreaks) : 0;

  // Generate fun, condition-appropriate messages
  if (maxGoodStreak >= 8) {
    return 'Good surf for most of the day!';
  } else if (maxGoodStreak >= 6) {
    return `Good surf for ${maxGoodStreak} solid hours!`;
  } else if (maxGoodStreak >= 3) {
    return `Good surf for about ${maxGoodStreak} hours`;
  } else if (maxGoodStreak >= 1) {
    return `Brief good surf window (~${maxGoodStreak}hr)`;
  } else if (maxMarginalStreak >= 8) {
    return 'Marginal conditions for most of the day';
  } else if (maxMarginalStreak >= 4) {
    return `Marginal conditions for ${maxMarginalStreak} hours`;
  } else if (maxMarginalStreak >= 2) {
    return `Sketchy conditions for ${maxMarginalStreak} hours`;
  } else if (totalSurfableHours >= 1) {
    return 'Brief surfable windows expected';
  } else {
    // Brutally honest messages for flat/poor conditions
    const flatMessages = [
      'Flat spell continues...',
      'Time to practice your pop-ups on land',
      'Great day for a beach walk',
      'Maybe check the bay?',
      'Longboard day if you\'re desperate',
      'Netflix has some good surf movies',
      'Perfect time to wax your board'
    ];
    return flatMessages[Math.floor(Math.random() * flatMessages.length)];
  }
}

app.get('/surfability', async (req: Request, res: Response) => {
  try {
    console.log('Surfability request from:', req.headers.origin);
    
    // Fetch real tide data
    const tideData = await fetchTideData();
    console.log('Tide data fetched:', tideData);
    
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
      // Try marine API first for wave data AND water temperature
      const marineRes = await fetch(
        'https://api.open-meteo.com/v1/marine?latitude=29.9&longitude=-81.3&hourly=wave_height,wave_period,swell_wave_direction,sea_surface_temperature&current=sea_surface_temperature',
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

    // Get regular weather data (wind + air temperature + weather conditions)
    const weatherRes = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=29.9&longitude=-81.3&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&hourly=wind_speed_10m,wind_direction_10m&timezone=America/New_York&forecast_days=2',
      {
        signal: AbortSignal.timeout(10000)
      }
    );
    
    if (!weatherRes.ok) {
      throw new Error(`Weather API returned ${weatherRes.status}`);
    }

    interface MarineResponse {
      current?: {
        sea_surface_temperature: number;
      };
      hourly?: {
        time: string[];
        wave_height: number[];
        wave_period: number[];
        swell_wave_direction: number[];
        sea_surface_temperature: number[];
      };
    }

    interface WeatherResponse {
      current: {
        temperature_2m: number;
        weather_code: number;
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
                       (marineJson?.hourly?.wave_height?.[0] ? marineJson.hourly.wave_height[0] * 3.28084 : 1.5);
    const wavePeriod = buoyData?.wavePeriod ?? 
                       marineJson?.hourly?.wave_period?.[0] ?? 6;
    const swellDirection = buoyData?.swellDirection ?? 
                          marineJson?.hourly?.swell_wave_direction?.[0] ?? 90;

    // Extract weather data
    const airTemperature = weatherJson.current.temperature_2m;
    const weatherCode = weatherJson.current.weather_code;
    const weatherDescription = getWeatherDescription(weatherCode);
    
    // Water temperature from marine API or fallback
    const waterTemperature = marineJson?.current?.sea_surface_temperature ?? 
                            marineJson?.hourly?.sea_surface_temperature?.[0] ?? 
                            22; // Fallback to ~72°F in Celsius

    // Debug logging
    console.log('Current conditions source:', {
      buoyData: !!buoyData,
      marineData: !!marineJson?.hourly,
      tideData: tideData.state,
      waveHeight,
      wavePeriod,
      swellDirection,
      airTemperature,
      waterTemperature,
      weatherCode,
      weatherDescription
    });

    const windSpeed = weatherJson.current.wind_speed_10m * 0.539957; // Convert to knots
    const windDirection = weatherJson.current.wind_direction_10m;

    // Current surf conditions with real tide data
    const currentSurfData: SurfData = {
      waveHeight,
      wavePeriod,
      swellDirection,
      windDirection,
      windSpeed,
      tide: tideData.state,
      tideHeight: tideData.currentHeight,
    };

    const { score, surfable, rating, funRating } = calculateSurfability(currentSurfData);

    // Parse hourly forecast - combine available data
    const hourlyForecasts: HourlyForecast[] = weatherJson.hourly.time.map((timeStr: string, i: number) => ({
      time: timeStr,
      wave_height: marineJson?.hourly?.wave_height?.[i] ?? 1.5,
      wave_period: marineJson?.hourly?.wave_period?.[i] ?? 6,
      swell_direction: marineJson?.hourly?.swell_wave_direction?.[i] ?? 90,
      wind_speed: weatherJson.hourly.wind_speed_10m[i],
      wind_direction: weatherJson.hourly.wind_direction_10m[i],
    }));

    const conditionsDuration = getConditionsDuration(hourlyForecasts, tideData.state);

    // Format next tide times for human readability
    const formatTideTime = (tideEvent: { time: string; height: number } | null) => {
      if (!tideEvent) return null;
      
      const time = new Date(tideEvent.time);
      const timeStr = time.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      return {
        time: timeStr,
        height: Math.round(tideEvent.height * 10) / 10,
        timestamp: tideEvent.time // Include full timestamp for chart plotting
      };
    };

    // Response with real tide data
    res.json({
      location: 'St. Augustine, FL',
      timestamp: new Date().toISOString(),
      surfable,
      rating: funRating,
      score,
      goodSurfDuration: conditionsDuration,
      details: {
        wave_height_ft: Math.round(currentSurfData.waveHeight * 10) / 10,
        wave_period_sec: Math.round(currentSurfData.wavePeriod * 10) / 10,
        swell_direction_deg: Math.round(currentSurfData.swellDirection),
        wind_direction_deg: Math.round(currentSurfData.windDirection),
        wind_speed_kts: Math.round(currentSurfData.windSpeed * 10) / 10,
        tide_state: tideData.state,
        tide_height_ft: Math.round(tideData.currentHeight * 10) / 10,
        data_source: buoyData ? 'NOAA Buoy + NOAA Tides + Weather API' : (marineJson?.hourly ? 'Marine + NOAA Tides + Weather API' : 'Weather API + NOAA Tides + defaults'),
        traditional_rating: rating // Keep the traditional rating for reference
      },
      weather: {
        air_temperature_c: Math.round(airTemperature * 10) / 10,
        air_temperature_f: Math.round((airTemperature * 9/5 + 32) * 10) / 10,
        water_temperature_c: Math.round(waterTemperature * 10) / 10,
        water_temperature_f: Math.round((waterTemperature * 9/5 + 32) * 10) / 10,
        weather_code: weatherCode,
        weather_description: weatherDescription
      },
      tides: {
        current_height_ft: Math.round(tideData.currentHeight * 10) / 10,
        state: tideData.state,
        next_high: formatTideTime(tideData.nextHigh),
        next_low: formatTideTime(tideData.nextLow),
        previous_high: formatTideTime(tideData.previousHigh),
        previous_low: formatTideTime(tideData.previousLow),
        station: 'NOAA 8720587 (St. Augustine Beach, FL)',
        // Optional: Add tide range and cycle info
        cycle_info: {
          range_ft: tideData.nextHigh && tideData.nextLow ? 
            Math.round((tideData.nextHigh.height - tideData.nextLow.height) * 10) / 10 : null,
          cycle_duration_hours: tideData.previousHigh && tideData.nextHigh ? 
            Math.round(((new Date(tideData.nextHigh.time).getTime() - new Date(tideData.previousHigh.time).getTime()) / (1000 * 60 * 60)) * 10) / 10 : null
        }
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

app.listen(PORT, () => {
  console.log(`Surfability API running on port ${PORT}`);
  console.log('CORS enabled for local development');
  console.log('Real NOAA tide data integration enabled');
});