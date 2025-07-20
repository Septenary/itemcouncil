import https from 'https';
import querystring from 'querystring';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Config
const {
  WCL_CLIENT_ID,
  WCL_CLIENT_SECRET,
} = process.env;

const TOKEN_HOST = 'www.warcraftlogs.com';
const TOKEN_PATH = '/oauth/token';
const API_HOST = 'www.warcraftlogs.com';
const API_PATH = '/api/v2/client';

// Cache setup
const CACHE_TTL = 60 * 60 * 1000;
const CACHE_DIR = path.join(__dirname, '.cache');

async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch {}
}

function cacheFilePath(key) {
  return path.join(CACHE_DIR, encodeURIComponent(key) + '.json');
}

async function setCache(key, value) {
  await ensureCacheDir();
  const data = { value, ts: Date.now() };
  await fs.writeFile(cacheFilePath(key), JSON.stringify(data), 'utf8');
}

async function getCache(key) {
  try {
    const file = await fs.readFile(cacheFilePath(key), 'utf8');
    const entry = JSON.parse(file);
    if (Date.now() - entry.ts < CACHE_TTL) return entry.value;
    await fs.unlink(cacheFilePath(key));
  } catch {}
  return null;
}

// HTTPS POST helper
function httpsPost(host, path, headers, body) {
  return new Promise((resolve, reject) => {
    const options = { method: 'POST', host, path, headers };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Auth token
async function getAccessToken() {
  const creds = Buffer.from(`${WCL_CLIENT_ID}:${WCL_CLIENT_SECRET}`).toString('base64');
  const body = querystring.stringify({ grant_type: 'client_credentials' });

  const headers = {
    'Authorization': `Basic ${creds}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
  };

  const res = await httpsPost(TOKEN_HOST, TOKEN_PATH, headers, body);
  return res.access_token;
}

export async function fetchData(zoneID) {
    const cacheKey = `zone-${zoneID}`;
    const token = await getAccessToken();
    const cached = await getCache(cacheKey);

    if (cached) return cached;

    const query = `{
        guildData {
            guild(id: 774625, serverSlug: "dreamscythe", serverRegion: "US") {
                members(limit: 56) {
                    data {
                        id
                        name
                        classID
                        zoneRankings(zoneID: ${zoneID}, partition: -1)
                    }
                }
            }
        }
    }`;

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    const body = JSON.stringify({ query });
    console.log(body);
    const response = await httpsPost(API_HOST, API_PATH, headers, body);
    const data = response?.data;
    const guildData = response?.data?.guildData;
    const guild = response?.data?.guildData?.guild;

    if (!response) {
        throw new Error('Guild not found or permission denied');
    }

    if (!guildData) {
        throw new Error('Guild data not found');
    }

    if (!guild) {
       throw new Error('Guild not found');
    }



    await setCache(cacheKey, response);
    return response;
}
