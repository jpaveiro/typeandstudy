// Servidor local: serve o index.html e repassa as chamadas ao Gemini usando a chave do .env,
// assim a API key nunca chega ao navegador. Sem dependências (Node 18+).
const http = require('http');
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([\w.]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const val = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}
loadEnv(path.join(__dirname, '.env'));

const KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const PORT = +process.env.PORT || 3000;

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      return send(res, 200, fs.readFileSync(path.join(__dirname, 'index.html')), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && req.url === '/api/config') {
      return send(res, 200, { hasKey: !!KEY, model: MODEL });
    }
    if (req.method === 'POST' && req.url === '/api/gemini') {
      if (!KEY) return send(res, 500, { error: { message: 'GEMINI_API_KEY não definida no .env' } });
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const { model, body } = JSON.parse(raw);
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || MODEL)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: JSON.stringify(body),
      });
      return send(res, r.status, await r.text());
    }
    send(res, 404, { error: { message: 'Não encontrado' } });
  } catch (e) {
    send(res, 500, { error: { message: e.message } });
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`DigitaEstudo em http://localhost:${PORT}` + (KEY ? '' : '  (aviso: GEMINI_API_KEY ausente no .env)'));
});
