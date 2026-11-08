import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
try {
  writeFileSync(new URL('../.env', import.meta.url), `POSTGRES_USER=marketplace\nPOSTGRES_DB=marketplace\nPOSTGRES_PASSWORD=${randomBytes(24).toString('hex')}\nPORT=3001\nJAEGER_PORT=16687\nAPP_ENV=development\nCATALOG_CACHE_ENABLED=true\nCACHE_TTL_MS=5000\nPAYMENT_PROCESSING_ENABLED=true\nWORKER_INTERVAL_MS=100\nLOG_LEVEL=info\n`, { flag: 'wx', mode: 0o600 });
  console.log('.env local criado com senha aleatória; conteúdo não exibido.');
} catch (error) { if (error.code === 'EEXIST') console.log('.env existente preservado.'); else throw error; }
