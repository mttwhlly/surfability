# Surfability API

A robust REST API that provides real-time surf condition assessments for St. Augustine, Florida. The API combines data from NOAA buoys, marine weather forecasts, and wind conditions to determine if the surf is worth checking out.

## 🌊 Features

- **Real-time surf scoring** - Get a numerical score (0-100) indicating surf quality
- **Surfability rating** - Simple Excellent/Fun/Marginal rating system
- **Duration forecasts** - Find out how long good conditions will last
- **Multiple data sources** - Combines NOAA buoy data with weather APIs for accuracy
- **Robust fallbacks** - Always provides a response even if some data sources are unavailable
- **Data validation** - Filters out invalid buoy readings and impossible wave measurements
- **Consistent logic** - Current conditions and forecasts use the same evaluation criteria

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
git clone https://github.com/mttwhlly/surfability.git
cd surfability
npm install
```

### Development

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Production

```bash
npm run build
npm start
```

### Docker Deployment

```bash
# Build and run with Docker
docker build -t surfability-api .
docker run -p 3000:3000 surfability-api
```

## 📡 API Endpoints

### GET `/surfability`

Returns current surf conditions and forecast for St. Augustine, FL.

**Example Response:**
```json
{
  "location": "St. Augustine, FL",
  "timestamp": "2025-05-27T15:30:00.000Z",
  "surfable": true,
  "rating": "Fun",
  "score": 65,
  "goodSurfDuration": "Good surf for about 3 hours",
  "details": {
    "wave_height_ft": 3.2,
    "wave_period_sec": 9.5,
    "swell_direction_deg": 85,
    "wind_direction_deg": 270,
    "wind_speed_kts": 12.3,
    "tide_state": "Rising",
    "data_source": "NOAA Buoy + Weather API"
  }
}
```

### GET `/health`

Health check endpoint for monitoring and load balancers.

**Example Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-05-27T15:30:00.000Z"
}
```

## 🏄‍♂️ Surf Scoring System

The API evaluates surf conditions based on several factors:

| Factor | Ideal Conditions | Points | Notes |
|--------|------------------|---------|-------|
| **Wave Height** | 2-8 feet | 25 pts | Small but rideable waves get 15 pts |
| **Wave Period** | 10+ seconds | 25 pts | 7-9s gets 20 pts, 5-6s gets 10 pts |
| **Swell Direction** | East to Southeast (45-135°) | 20 pts | Perfect for Florida's Atlantic coast |
| **Wind** | Offshore (W-NW) or light (<10 kts) | 20 pts | Offshore winds clean up the waves |
| **Tide** | Mid, Rising, or Falling | 10 pts | Avoids extreme high/low tide issues |

### Rating Scale
- **Excellent** (75+ points) - Epic conditions, drop everything and surf! 🤙
- **Fun** (50-74 points) - Good waves worth surfing 🏄‍♂️
- **Marginal** (<50 points) - Might be surfable but not ideal 😐

### Surfability Threshold
- **Surfable**: Score ≥ 40 points
- **Not Surfable**: Score < 40 points

## 📊 Data Sources & Reliability

### Primary Data Sources
1. **NOAA Buoy 41117** - Real-time wave measurements (most accurate when available)
2. **Open-Meteo Marine API** - Wave height, period, and direction forecasts
3. **Open-Meteo Weather API** - Wind speed and direction data
4. **Simple Tide Calculator** - Basic tide state estimation

### Data Quality & Validation
- **Buoy data validation** - Rejects impossible readings (e.g., 0.1 second wave periods)
- **Range checking** - Wave periods must be 2-30 seconds, heights 0-20 meters
- **Fail-fast approach** - Returns error if no reliable wave data is available
- **No false data** - Won't return surf conditions without actual wave measurements

### Data Source Priority
```
1. NOAA Buoy (real-time, most accurate)
   ↓ (if unavailable or invalid)
2. Marine API (forecast data)
   ↓ (if unavailable)
3. Service unavailable error (honest about missing data)
```

### Expected Data Sources in Response
- `"NOAA Buoy + Weather API"` - Best case, real buoy data + wind
- `"Marine + Weather API"` - Marine forecast + wind data  
- **Service Error (503)** - When no reliable wave data is available

## ⚙️ Configuration

### Location Settings
The API is currently configured for St. Augustine, Florida:
- **Latitude**: 29.9°N
- **Longitude**: -81.3°W  
- **NOAA Buoy**: Station 41117
- **Timezone**: America/New_York

### Modifying for Different Locations
To adapt for another surf spot, update these values in `index.ts`:
```typescript
// Change coordinates and buoy station
const lat = 29.9;  // Your latitude
const lon = -81.3; // Your longitude
const buoyStation = '41117'; // Nearest NOAA buoy
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Environment (production/development) |

## 🐳 Docker Support

### Dockerfile Features
- **Multi-stage build** - Optimized for production
- **Health checks** - Built-in endpoint monitoring
- **Alpine Linux** - Small, secure base image
- **Curl included** - For health check functionality

### Docker Commands
```bash
# Build image
docker build -t surfability-api .

# Run container
docker run -p 3000:3000 surfability-api

# With environment variables
docker run -p 3000:3000 -e NODE_ENV=production surfability-api
```

## 🛠️ Development

### Project Structure

```
surfability/
├── index.ts          # Main API server and logic
├── package.json      # Dependencies and scripts
├── tsconfig.json     # TypeScript configuration
├── Dockerfile        # Container configuration
├── .dockerignore     # Docker build exclusions
├── .gitignore        # Git exclusions
└── README.md         # This file
```

### Available Scripts

- `npm run dev` - Start development server with hot reload (tsx)
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production server
- `npm run lint` - Run linting (if configured)

### Technologies Used

- **Node.js 18+** - Runtime environment
- **Express 5** - Web framework  
- **TypeScript** - Type safety and modern JavaScript
- **tsx** - Fast TypeScript execution and hot reload
- **Open-Meteo APIs** - Weather and marine forecast data
- **NOAA NDBC** - Real-time buoy measurements

## 🔧 Troubleshooting

### Common Issues

**Q: Why does the API sometimes return a 503 error?**
A: When neither NOAA buoy nor marine forecast data is available, the API returns a 503 "Service Unavailable" error rather than making up wave data. This ensures you get honest information about surf conditions.

**Q: What should I do when I get "Insufficient wave data"?**  
A: Try again in a few minutes, or check local surf reports and webcams. The API prioritizes accuracy over always being available.

**Q: Why not just use default wave values when real data isn't available?**
A: Surf conditions change rapidly and fake data could be dangerously misleading. It's better to admit when we don't know than to guess.

### Debug Logging

The API includes console logging for debugging data source issues:
```bash
# View logs in production
docker logs <container-name>

# View logs in development  
npm run dev
# Check console output for data source debugging
```

## 🚢 Deployment

### Recommended: Docker + Coolify

1. **Push to GitHub**
2. **Create Coolify Application**
   - Repository: `https://github.com/yourusername/surfability.git`
   - Build Pack: `Dockerfile`
   - Port: `3000`
   - Health Check: `/health`

3. **Environment Variables**
   - `NODE_ENV=production`
   - `PORT=3000`

### Alternative: Heroku, Railway, DigitalOcean

The API works on any platform supporting Node.js or Docker containers.

## 📈 Monitoring & Reliability

### Health Checks
- Built-in `/health` endpoint
- Docker health check every 30 seconds
- Graceful error handling for external API failures

### Rate Limits & Fair Use
- **Open-Meteo APIs**: Free for non-commercial use (up to 10,000 calls/day)
- **NOAA NDBC**: No official limits, but be respectful
- **Recommended**: Cache responses for 5-15 minutes to reduce API calls

### Error Handling
The API prioritizes **accuracy over availability**:
- External API failures → Return 503 error with explanation
- Invalid buoy data → Filter out and try marine API
- No wave data available → Honest error message
- Network timeouts → Clear error with retry suggestion
- Malformed requests → Helpful error messages

**Philosophy**: Better to admit we don't know than to provide potentially dangerous misinformation about surf conditions.

## 📄 License

MIT License - Feel free to use this for your own surf forecasting needs!

## 🤝 Contributing

This is a community-driven surf forecasting API. Contributions welcome!

### Ideas for Enhancement

- **🌍 Multi-location support** - Add more surf spots
- **🌊 Real tide integration** - Replace simple calculator with actual tide data
- **📱 Mobile app** - React Native or Flutter companion app
- **📧 Notifications** - Email/SMS alerts for good conditions
- **📸 Surf reports** - Integrate with local surf cams/reports
- **🤖 ML forecasting** - Improve predictions with historical data
- **⚡ Caching layer** - Redis for improved performance
- **📊 Analytics** - Track forecast accuracy over time

### Development Setup

```bash
# Fork the repo and clone
git clone https://github.com/yourusername/surfability.git
cd surfability

# Install dependencies
npm install

# Start development server
npm run dev

# Make changes and test
# Submit pull request
```

## ⚠️ Disclaimer

This API is for informational purposes only. Always check local conditions and use proper safety precautions when surfing. Wave and weather conditions can change rapidly and may differ from forecasts.

**Surf safe, have fun!** 🏄‍♂️🌊