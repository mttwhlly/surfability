import express, { Request, Response } from ‘express’;
import cors from ‘cors’;

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - this is the key fix!
const corsOptions = {
origin: [
‘https://localhost:8444’,  // Your local development
‘http://localhost:8444’,
‘https://localhost:3000’,
‘http://localhost:3000’,
‘https://127.0.0.1:8444’,
‘http://127.0.0.1:8444’,
// Add your production domain when you deploy
// ‘https://your-domain.com’
],
methods: [‘GET’, ‘POST’, ‘OPTIONS’],
allowedHeaders: [‘Content-Type’, ‘Accept’],
credentials: true
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options(’*’, cors(corsOptions));

app.use(express.json());

// Add additional CORS headers for extra compatibility
app.use((req: Request, res: Response, next) => {
res.header(‘Access-Control-Allow-Origin’, req.headers.origin || ‘*’);
res.header(‘Access-Control-Allow-Methods’, ‘GET, POST, PUT, DELETE, OPTIONS’);
res.header(‘Access-Control-Allow-Headers’, ‘Origin, X-Requested-With, Content-Type, Accept, Authorization’);
res.header(‘Access-Control-Allow-Credentials’, ‘true’);

if (req.method === ‘OPTIONS’) {
res.sendStatus(200);
} else {
next();
}
});

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
“Epic”,
“Firing”,
“Going Off”,
“Pumping”,
“Primo”,
“Cranking”,
“Nuking”
],
good: [
“Fun”,
“Solid”,
“Decent”,
“Surfable”,
“Worth It”,
“Not Bad”,
“Rideable”
],
marginal: [
“Marginal”,
“Questionable”,
“Sketchy”,
“Iffy”,
“Meh”,
“Barely”,
“Struggling”
],
poor: [
“Flat”,
“Blown Out”,
“Junk”,
“Trash”,
“Hopeless”,
“Closed Out”,
“Victory at Sea”,
“Ankle Biters”,
“Lake Mode”,
“Check the Cam”,
“Stay Home”,
“Netflix Day”
]
};

function getRandomRating(category: keyof typeof surfRatings): string {
const options = surfRatings[category];
return options[Math.floor(Math.random() * options.length)];
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
if (data.tide === ‘Mid’ || data.tide === ‘Rising’ || data.tide === ‘Falling’) {
score += 10;
}

let rating: string;
let funRating: string;

if (score >= 80) {
rating = ‘Excellent’;
funRating = getRandomRating(‘excellent’);
} else if (score >= 65) {
rating = ‘Good’;
funRating = getRandomRating(‘good’);
} else if (score >= 45) {
rating = ‘Marginal’;
funRating = getRandomRating(‘marginal’);
} else {
rating = ‘Poor’;
funRating = getRandomRating(‘poor’);
}

return {
score,
surfable: score >= 45, // Raised threshold - only call it surfable if it’s actually decent
rating,
funRating,
};
}

function parseBuoyData(buoyText: string): { waveHeight: number; swellDirection: number; wavePeriod: number } | null {
try {
const lines = buoyText.trim().split(’\n’);
if (lines.length < 3) return null;

```
// Find the header line to understand column positions
const headerLine = lines.find(line => line.includes('WVHT') && line.includes('APD') && line.includes('MWD'));
if (!headerLine) {
  console.log('Could not find header line with WVHT, APD, and MWD');
  return null;
}

// Skip header lines and get the most recent data
const dataLine = lines.find(line => 
  line.trim() && 
  !line.startsWith('#') && 
  !line.includes('YY') && 
  !line.includes('MM') &&
  !line.includes('WVHT')
);

if (!dataLine) {
  console.log('Could not find valid data line');
  return null;
}

const parts = dataLine.trim().split(/\s+/);
console.log('Buoy data parts:', parts);

if (parts.length < 15) {
  console.log('Not enough data columns:', parts.length);
  return null;
}

// Current NDBC format: YY MM DD hh mm WVHT  SwH  SwP  WWH  WWP SwD WWD  STEEPNESS  APD MWD
// Indices:              0  1  2  3  4  5     6    7    8    9   10  11   12         13  14
const waveHeightMeters = parseFloat(parts[5]); // WVHT (significant wave height in meters)
const wavePeriod = parseFloat(parts[13]);      // APD (average wave period in seconds)  
const swellDirection = parseFloat(parts[14]);  // MWD (mean wave direction in degrees)

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

console.log('Parsed buoy data:', { waveHeight, wavePeriod, swellDirection });

return { waveHeight, swellDirection, wavePeriod };
```

} catch (error) {
console.error(‘Error parsing buoy data:’, error);
return null;
}
}

function getSimpleTideState(): string {
// Simple tide calculation based on time of day
// This is a placeholder - ideally you’d use a real tide API
const hour = new Date().getHours();
const tidePhase = hour % 12;

if (tidePhase < 2 || tidePhase > 10) return ‘Low’;
else if (tidePhase >= 5 && tidePhase <= 7) return ‘High’;
else if (tidePhase < 5) return ‘Rising’;
else return ‘Falling’;
}

function getConditionsDuration(hourlyForecasts: HourlyForecast[], tide: string): string {
if (!hourlyForecasts || hourlyForecasts.length === 0) {
return ‘No forecast data available.’;
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

```
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
```

}

// Add final streaks
if (currentGoodStreak > 0) goodStreaks.push(currentGoodStreak);
if (currentMarginalStreak > 0) marginalStreaks.push(currentMarginalStreak);

const maxGoodStreak = goodStreaks.length > 0 ? Math.max(…goodStreaks) : 0;
const maxMarginalStreak = marginalStreaks.length > 0 ? Math.max(…marginalStreaks) : 0;

// Generate fun, condition-appropriate messages
if (maxGoodStreak >= 8) {
return ‘Good surf for most of the day! 🤙’;
} else if (maxGoodStreak >= 6) {
return `Good surf for ${maxGoodStreak} solid hours!`;
} else if (maxGoodStreak >= 3) {
return `Good surf for about ${maxGoodStreak} hours`;
} else if (maxGoodStreak >= 1) {
return `Brief good surf window (~${maxGoodStreak}hr)`;
} else if (maxMarginalStreak >= 8) {
return ‘Marginal conditions for most of the day’;
} else if (maxMarginalStreak >= 4) {
return `Marginal conditions for ${maxMarginalStreak} hours`;
} else if (maxMarginalStreak >= 2) {
return `Sketchy conditions for ${maxMarginalStreak} hours`;
} else if (totalSurfableHours >= 1) {
return ‘Brief surfable windows expected’;
} else {
// Brutally honest messages for flat/poor conditions
const flatMessages = [
‘Flat spell continues…’,
‘Time to practice your pop-ups on land’,
‘Great day for a beach walk’,
‘Maybe check the bay?’,
‘Longboard day if you're desperate’,
‘Netflix has some good surf movies’,
‘Perfect time to wax your board’
];
return flatMessages[Math.floor(Math.random() * flatMessages.length)];
}
}

app.get(’/surfability’, async (req: Request, res: Response) => {
try {
console.log(‘Surfability request from:’, req.headers.origin);

```
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
                   (marineJson?.hourly?.wave_height?.[0] ? marineJson.hourly.wave_height[0] * 3.28084 : 1.5);
const wavePeriod = buoyData?.wavePeriod ?? 
                   marineJson?.hourly?.wave_period?.[0] ?? 6;
const swellDirection = buoyData?.swellDirection ?? 
                      marineJson?.hourly?.swell_wave_direction?.[0] ?? 90;

// Debug logging
console.log('Current conditions source:', {
  buoyData: !!buoyData,
  marineData: !!marineJson?.hourly,
  waveHeight,
  wavePeriod,
  swellDirection
});

const windSpeed = weatherJson.current.wind_speed_10m * 0.539957; // Convert to knots
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

const { score, surfable, rating, funRating } = calculateSurfability(currentSurfData);

// Parse hourly forecast - combine available data
const hourlyForecasts: HourlyForecast[] = weatherJson.hourly.time.map((timeStr: string, i: number) => ({
  time: timeStr,
  wave_height: marineJson?.hourly?.wave_height?.[i] ?? 1.5, // Use more realistic default
  wave_period: marineJson?.hourly?.wave_period?.[i] ?? 6,   // Use more realistic default  
  swell_direction: marineJson?.hourly?.swell_wave_direction?.[i] ?? 90, // Default East
  wind_speed: weatherJson.hourly.wind_speed_10m[i],
  wind_direction: weatherJson.hourly.wind_direction_10m[i],
}));

const conditionsDuration = getConditionsDuration(hourlyForecasts, tide);

// Response
res.json({
  location: 'St. Augustine, FL',
  timestamp: new Date().toISOString(),
  surfable,
  rating: funRating, // Use the fun rating as the main rating
  score,
  goodSurfDuration: conditionsDuration, // Renamed to be more accurate
  details: {
    wave_height_ft: Math.round(currentSurfData.waveHeight * 10) / 10,
    wave_period_sec: Math.round(currentSurfData.wavePeriod * 10) / 10,
    swell_direction_deg: Math.round(currentSurfData.swellDirection),
    wind_direction_deg: Math.round(currentSurfData.windDirection),
    wind_speed_kts: Math.round(currentSurfData.windSpeed * 10) / 10,
    tide_state: tide,
    data_source: buoyData ? 'NOAA Buoy + Weather API' : (marineJson?.hourly ? 'Marine + Weather API' : 'Weather API + defaults'),
    traditional_rating: rating // Keep the traditional rating for reference
  },
});
```

} catch (err) {
console.error(‘API Error:’, err);
res.status(500).json({
error: ‘Error fetching surf data’,
message: err instanceof Error ? err.message : ‘Unknown error’
});
}
});

// Health check endpoint
app.get(’/health’, (_req: Request, res: Response) => {
res.json({ status: ‘ok’, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
console.log(`Surfability API running on port ${PORT}`);
console.log(‘CORS enabled for local development’);
});