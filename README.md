# Surfability API

A simple REST API that provides real-time surf condition assessments for St. Augustine, Florida. The API combines data from NOAA buoys, marine weather forecasts, and wind conditions to determine if the surf is worth checking out.

## Features

- **Real-time surf scoring** - Get a numerical score (0-100) indicating surf quality
- **Surfability rating** - Simple Excellent/Fun/Marginal rating system
- **Duration forecasts** - Find out how long good conditions will last
- **Multiple data sources** - Combines NOAA buoy data with weather APIs for accuracy
- **Robust fallbacks** - Always provides a response even if some data sources are unavailable

## Quick Start

### Installation

```bash
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

## API Endpoints

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

Simple health check endpoint.

**Example Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-05-27T15:30:00.000Z"
}
```

## Surf Scoring System

The API evaluates surf conditions based on several factors:

| Factor | Ideal Conditions | Points |
|--------|------------------|---------|
| **Wave Height** | 2-8 feet | 25 pts |
| **Wave Period** | 10+ seconds | 25 pts |
| **Swell Direction** | East to Southeast (45-135°) | 20 pts |
| **Wind** | Offshore (W-NW) or light (<10 kts) | 20 pts |
| **Tide** | Mid, Rising, or Falling | 10 pts |

### Rating Scale
- **Excellent** (75+ points) - Epic conditions, drop everything and surf
- **Fun** (50-74 points) - Good waves worth surfing
- **Marginal** (<50 points) - Might be surfable but not ideal

## Data Sources

1. **NOAA Buoy 41117** - Real-time wave measurements (most accurate)
2. **Open-Meteo Marine API** - Wave height, period, and direction forecasts
3. **Open-Meteo Weather API** - Wind speed and direction
4. **Simple Tide Calculator** - Basic tide state estimation

## Configuration

The API is currently configured for St. Augustine, Florida coordinates:
- Latitude: 29.9°N
- Longitude: -81.3°W
- NOAA Buoy: Station 41117

To modify for a different location, update the coordinates and buoy station in `index.ts`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |

## Development

### Project Structure

```
surfability/
├── index.ts          # Main API server
├── package.json      # Dependencies and scripts
├── tsconfig.json     # TypeScript configuration
└── README.md         # This file
```

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production server
- `npm run lint` - Run linting (if configured)

### Technologies Used

- **Node.js** - Runtime environment
- **Express** - Web framework
- **TypeScript** - Type safety
- **tsx** - TypeScript execution and hot reload
- **Open-Meteo APIs** - Weather and marine data
- **NOAA NDBC** - Real-time buoy data

## API Reliability

The API is designed to be highly reliable with multiple fallback strategies:

1. If NOAA buoy data fails → Use marine API data
2. If marine API fails → Use reasonable defaults
3. If all external APIs fail → Return error with helpful message

This ensures the API always provides a response, even during external service outages.

## Rate Limits

- Open-Meteo APIs: Free for non-commercial use (up to 10,000 calls/day)
- NOAA NDBC: No official rate limits, but be respectful

## License

MIT License - feel free to use this for your own surf forecasting needs!

## Contributing

This is a simple surf forecasting API. Feel free to fork and modify for your local surf spot. Pull requests welcome for improvements!

### Ideas for Enhancement

- Add more surf spots
- Integrate real tide data
- Add swell forecasting
- Include surf reports/photos
- Add email/SMS notifications for good conditions
- Mobile app integration

## Disclaimer

This API is for informational purposes only. Always check local conditions and use proper safety precautions when surfing. Wave and weather conditions can change rapidly and may differ from forecasts.