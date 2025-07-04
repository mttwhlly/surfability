import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import { z } from 'zod';

// Types and Interfaces
interface SurfData {
  waveHeight: number;
  wavePeriod: number;
  swellDirection: number;
  windDirection: number;
  windSpeed: number;
  tide: string;
  tideHeight?: number;
}

interface SurfabilityResponse {
  location: string;
  timestamp: string;
  surfable: boolean;
  rating: string;
  score: number;
  goodSurfDuration: string;
  details: {
    wave_height_ft: number;
    wave_period_sec: number;
    swell_direction_deg: number;
    wind_direction_deg: number;
    wind_speed_kts: number;
    tide_state: string;
    tide_height_ft: number;
    data_source: string;
  };
  weather: {
    air_temperature_f: number;
    water_temperature_f: number;
    weather_code: number;
    weather_description: string;
  };
  tides: any;
}

// Configuration
const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  allowedOrigins: [
    'https://localhost:8444',
    'http://localhost:8444',
    'https://yso00ok0wsgg4o80k4o0s0o0.mttwhlly.cc',
    'https://c0cgocok00o40c48c40k8g04.mttwhlly.cc',
    ...(process.env.ADDITIONAL_ORIGINS?.split(',') || [])
  ],
  cache: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 100
  }
};

// Simple in-memory cache
class SimpleCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number, ttl: number) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key: string, data: any): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Services
class WeatherService {
  private cache = new SimpleCache(50, config.cache.ttl);

  async getMarineData() {
    const cacheKey = 'marine-data';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        'https://api.open-meteo.com/v1/marine?latitude=29.9&longitude=-81.3&hourly=wave_height,wave_period,swell_wave_direction,sea_surface_temperature&current=sea_surface_temperature',
        { signal: AbortSignal.timeout(8000) }
      );
      
      if (!response.ok) throw new Error(`Marine API: ${response.status}`);
      
      const data = await response.json();
      this.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.warn('Marine API failed:', error);
      return null;
    }
  }

  async getWeatherData() {
    const cacheKey = 'weather-data';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=29.9&longitude=-81.3&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&hourly=wind_speed_10m,wind_direction_10m&timezone=America/New_York&forecast_days=2',
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (!response.ok) throw new Error(`Weather API: ${response.status}`);
      
      const data = await response.json();
      this.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Weather API failed:', error);
      throw error;
    }
  }
}

class BuoyService {
  private cache = new SimpleCache(10, config.cache.ttl);

  async getBuoyData() {
    const cacheKey = 'buoy-data';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        'https://www.ndbc.noaa.gov/data/realtime2/41117.spec',
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (!response.ok) throw new Error(`Buoy API: ${response.status}`);
      
      const text = await response.text();
      const parsed = this.parseBuoyData(text);
      
      if (parsed) {
        this.cache.set(cacheKey, parsed);
      }
      
      return parsed;
    } catch (error) {
      console.warn('Buoy data fetch failed:', error);
      return null;
    }
  }

  private parseBuoyData(buoyText: string) {
    // Your existing parseBuoyData logic here
    // ... (same as before)
    return null; // Placeholder
  }
}

class TideService {
  private cache = new SimpleCache(10, config.cache.ttl);

  async getTideData() {
    const cacheKey = 'tide-data';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      // Your existing fetchTideData logic here
      const tideData = await this.fetchTideData();
      this.cache.set(cacheKey, tideData);
      return tideData;
    } catch (error) {
      console.error('Tide data fetch failed:', error);
      throw error;
    }
  }

  private async fetchTideData() {
    // Your existing fetchTideData implementation
    return {
      currentHeight: 2.0,
      state: 'Mid',
      nextHigh: null,
      nextLow: null
    };
  }
}

class SurfCalculatorService {
  calculateSurfability(data: SurfData) {
    // Your existing calculateSurfability logic
    return {
      score: 50,
      surfable: true,
      rating: 'Marginal',
      funRating: 'Meh'
    };
  }

  getConditionsDuration(forecasts: any[], tide: string): string {
    // Your existing getConditionsDuration logic
    return 'Good surf for 3 hours';
  }
}

// Middleware
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const corsOptions = {
  origin: config.allowedOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Error handling middleware
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err);
  
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong'
  });
};

// Request validation
const querySchema = z.object({
  format: z.enum(['json', 'xml']).optional().default('json'),
  units: z.enum(['metric', 'imperial']).optional().default('imperial'),
  includeRaw: z.boolean().optional().default(false)
});

// Controllers
class SurfController {
  constructor(
    private weatherService: WeatherService,
    private buoyService: BuoyService,
    private tideService: TideService,
    private calculatorService: SurfCalculatorService
  ) {}

  async getSurfability(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate query parameters
      const query = querySchema.parse(req.query);
      
      console.log('🌊 Surfability request from:', req.headers.origin);
      
      // Fetch all data in parallel
      const [marineData, weatherData, buoyData, tideData] = await Promise.allSettled([
        this.weatherService.getMarineData(),
        this.weatherService.getWeatherData(),
        this.buoyService.getBuoyData(),
        this.tideService.getTideData()
      ]);
      
      // Process and combine data
      const response = await this.buildSurfabilityResponse({
        marineData: marineData.status === 'fulfilled' ? marineData.value : null,
        weatherData: weatherData.status === 'fulfilled' ? weatherData.value : null,
        buoyData: buoyData.status === 'fulfilled' ? buoyData.value : null,
        tideData: tideData.status === 'fulfilled' ? tideData.value : null,
        options: query
      });
      
      // Set caching headers
      res.set({
        'Cache-Control': 'public, max-age=300', // 5 minutes
        'ETag': `"${Buffer.from(JSON.stringify(response)).toString('base64').slice(0, 32)}"`
      });
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  private async buildSurfabilityResponse(data: any): Promise<SurfabilityResponse> {
    // Your existing response building logic
    return {
      location: 'St. Augustine, FL',
      timestamp: new Date().toISOString(),
      surfable: true,
      rating: 'Fun',
      score: 65,
      goodSurfDuration: 'Good surf for 3 hours',
      details: {
        wave_height_ft: 3.2,
        wave_period_sec: 8.5,
        swell_direction_deg: 90,
        wind_direction_deg: 180,
        wind_speed_kts: 12,
        tide_state: 'Mid',
        tide_height_ft: 2.1,
        data_source: 'Enhanced API'
      },
      weather: {
        air_temperature_f: 75,
        water_temperature_f: 72,
        weather_code: 1,
        weather_description: 'Partly cloudy'
      },
      tides: {}
    };
  }
}

// App setup
const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(compression());
app.use(rateLimiter);
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Routes
const weatherService = new WeatherService();
const buoyService = new BuoyService();
const tideService = new TideService();
const calculatorService = new SurfCalculatorService();
const surfController = new SurfController(weatherService, buoyService, tideService, calculatorService);

app.get('/surfability', (req, res, next) => surfController.getSurfability(req, res, next));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

export default app;

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`🌊 Enhanced Surfability API running on port ${config.port}`);
    console.log(`📊 Environment: ${config.nodeEnv}`);
    console.log(`🔒 CORS enabled for: ${config.allowedOrigins.join(', ')}`);
  });
}