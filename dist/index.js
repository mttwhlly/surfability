// surfability-api/index.ts
import express from 'express';
import fetch from 'node-fetch';
const app = express();
const PORT = process.env.PORT || 3000;
function calculateSurfability(data) {
    let score = 0;
    if (data.waveHeight >= 2 && data.waveHeight <= 5)
        score += 25;
    if (data.wavePeriod >= 7)
        score += 20;
    if (data.swellDirection >= 70 && data.swellDirection <= 130)
        score += 15;
    if ((data.windDirection >= 225 && data.windDirection <= 315) || data.windSpeed < 8)
        score += 25;
    if (data.tide === 'Mid')
        score += 15;
    let rating = 'Marginal';
    if (score >= 80)
        rating = 'Excellent';
    else if (score >= 60)
        rating = 'Fun';
    return {
        score,
        surfable: score >= 60,
        rating
    };
}
app.get('/surfability', async (_req, res) => {
    try {
        const buoyRes = await fetch('https://www.ndbc.noaa.gov/data/realtime2/41117.spec');
        const lines = (await buoyRes.text()).split('\n').slice(2);
        const [, waveHeight, , swellDir, wavePeriod] = lines[0].trim().split(/\s+/);
        const weatherRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=29.9&longitude=-81.3&current=wind_speed_10m,wind_direction_10m');
        const weather = (await weatherRes.json());
        const windSpeed = weather.current.wind_speed_10m;
        const windDirection = weather.current.wind_direction_10m;
        const tide = 'Mid'; // Placeholder for actual tide logic
        const data = {
            waveHeight: parseFloat(waveHeight),
            wavePeriod: parseFloat(wavePeriod),
            swellDirection: parseFloat(swellDir),
            windDirection,
            windSpeed,
            tide
        };
        const { score, surfable, rating } = calculateSurfability(data);
        res.json({
            location: 'St. Augustine, FL',
            surfable,
            rating,
            score,
            details: {
                wave_height_ft: data.waveHeight,
                wave_period_sec: data.wavePeriod,
                swell_direction_deg: data.swellDirection,
                wind_direction_deg: data.windDirection,
                wind_speed_kts: data.windSpeed,
                tide_state: data.tide
            }
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching surf data' });
    }
});
app.listen(PORT, () => console.log(`Surfability API running on port ${PORT}`));
