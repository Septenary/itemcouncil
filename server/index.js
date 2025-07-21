import 'dotenv/config';
import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { fetchData } from './wcl.js';
import { parse } from 'csv-parse';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(join(__dirname, '../frontend')));
app.get('/', (req, res) => res.sendFile(join(__dirname, '../frontend/ranks.html')));
app.get('/api/status', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

app.get('/api/rankings', async (req, res) => {
  const zoneID = parseInt(req.query.zoneID) || 1028;

  try {
    const data = await fetchData(zoneID);

    if (!data || !data.data || !data.data.guildData || !data.data.guildData.guild) {
      return res.status(404).json({ error: 'No guild data found for this zone.' });
    }

    // Just return the raw data as is
    res.json(data);
  } catch (err) {
    console.error('Error fetching unified rankings:', err.stack || err);
    res.status(500).json({ error: 'Failed to fetch rankings', details: err.message || err });
  }
});

app.get('/api/allstars', async (req, res) => {
  const zoneIDs = [1028, 1034, 1035];

  try {
    const allStarsResults = [];

for (const zoneID of zoneIDs) {
  const response = await fetchData(zoneID);
  const members = response?.data?.guildData?.guild?.members?.data || [];

  members.forEach(member => {
    const rankings = member.zoneRankings;

    // If zoneRankings contains an allStars array
    if (rankings?.allStars && Array.isArray(rankings.allStars)) {
      // Optionally pick the best partition or the one with highest points
      const best = rankings.allStars.reduce((max, entry) =>
        entry.points > (max?.points || 0) ? entry : max, null
      );

      if (best) {
        allStarsResults.push({
          name: member.name,
          zone: zoneID,
          allStars: {
            partition: best.partition,
            points: best.points,
            rank: best.rank,
            rankPercent: best.rankPercent,
            outOf: best.total,
            serverRank: best.serverRank,
          }
        });
      }
    }
  });
}


    res.json({ data: allStarsResults });

  } catch (err) {
    console.error('Failed to fetch allStars:', err);
    res.status(500).json({ error: 'Failed to fetch allStars data', details: err.message });
  }
});


app.get('/api/attendance', async (req, res) => {
//Fetches attendance from postgres csv  

})

app.get('/api/grm', async (req, res) => {
//Fetches guild roster manager data from postgres csv
  const filePath = path.join(__dirname, '../db', 'grm.csv');

  const records = [];
  fs.createReadStream(filePath)
    .pipe(parse({ columns: true, trim: true, delimiter: ';' }))
    .on('data', (row) => {
      records.push(row);
    })
    .on('end', () => {
      res.json({ data: records });
    })
    .on('error', (err) => {
      console.error('CSV parse error:', err);
      res.status(500).json({ error: 'Failed to read CSV file' });
    });
})

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
