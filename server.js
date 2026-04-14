/**
 * JinYu Frontend Server
 *
 * 环境变量（创建 frontend/.env 文件或通过系统环境注入）：
 *   PORT          前台监听端口，默认 3011
 *   ADMIN_HOST    后台服务 hostname，默认 127.0.0.1
 *   ADMIN_PORT    后台服务端口，默认 3020
 *   ADMIN_PROTOCOL http | https，默认 http
 *
 * 本地开发：无需任何配置，直接 node server.js 即可
 * VPS 生产：创建 frontend/.env，填写实际值
 */

// ── 加载 .env（如果存在）──────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 1) return;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) process.env[key] = val;
    });
}

const http = require('http');
const https = require('https');
const url = require('url');

const PORT          = parseInt(process.env.PORT)          || 3011;
const ADMIN_HOST    = process.env.ADMIN_HOST              || '127.0.0.1';
const ADMIN_PORT    = parseInt(process.env.ADMIN_PORT)    || 3002;
const ADMIN_PROTO   = process.env.ADMIN_PROTOCOL          || 'http';  // http | https

// 浏览量数据文件（写到 admin/data/ 供后台读取）
// 生产环境若前后台不在同一机器，此功能自动跳过
const PAGEVIEWS_FILE = path.join(__dirname, '../admin/data/pageviews.json');
// 新闻浏览量数据文件（按 slug 统计每篇文章的访问量）
const NEWS_VIEWS_FILE = path.join(__dirname, '../admin/data/news-views.json');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
};

// ── 浏览量记录 ──────────────────────────────────────────────────
function readPageviews() {
  if (!fs.existsSync(PAGEVIEWS_FILE)) return { daily: {}, monthly: {} };
  try { return JSON.parse(fs.readFileSync(PAGEVIEWS_FILE, 'utf8')); }
  catch { return { daily: {}, monthly: {} }; }
}

// ── 新闻浏览量记录（按 slug 统计）────────────────────────────────
function readNewsViews() {
  if (!fs.existsSync(NEWS_VIEWS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(NEWS_VIEWS_FILE, 'utf8')); }
  catch { return {}; }
}

function recordNewsView(slug) {
  if (!slug || typeof slug !== 'string') return;
  try {
    const data = readNewsViews();
    data[slug] = (data[slug] || 0) + 1;
    fs.writeFileSync(NEWS_VIEWS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch { /* 写入失败不影响访问 */ }
}

function recordPageview(pathname, slug) {
  const ext = path.extname(pathname).toLowerCase();
  const STATIC_EXTS = ['.js','.css','.json','.png','.jpg','.jpeg','.gif','.svg','.ico','.webp','.woff','.woff2','.ttf','.eot','.map'];
  if (STATIC_EXTS.includes(ext)) return;
  if (ext && ext !== '.html') return;
  if (pathname.startsWith('/images/')) return;

  const now      = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const monthKey = now.toISOString().slice(0, 7);

  try {
    const data = readPageviews();
    data.daily[todayKey]   = (data.daily[todayKey]   || 0) + 1;
    data.monthly[monthKey] = (data.monthly[monthKey] || 0) + 1;

    const dayKeys = Object.keys(data.daily).sort();
    if (dayKeys.length > 90) dayKeys.slice(0, dayKeys.length - 90).forEach(k => delete data.daily[k]);
    const monthKeys = Object.keys(data.monthly).sort();
    if (monthKeys.length > 12) monthKeys.slice(0, monthKeys.length - 12).forEach(k => delete data.monthly[k]);

    fs.writeFileSync(PAGEVIEWS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch { /* 写入失败不影响访问 */ }

  // 如果是新闻详情页，记录该文章的浏览量
  if (slug) {
    recordNewsView(slug);
  }
}

// ── 反向代理（将 /api/* /images/* /uploads/* 转发到后台）─────────
function proxyToAdmin(req, res) {
  const transport = ADMIN_PROTO === 'https' ? https : http;

  const options = {
    hostname: ADMIN_HOST,
    port:     ADMIN_PORT,
    path:     req.url,
    method:   req.method,
    headers: {
      ...req.headers,
      host: `${ADMIN_HOST}:${ADMIN_PORT}`,
    },
  };

  const proxyReq = transport.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('[proxy error]', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Admin service unavailable' }));
  });

  req.pipe(proxyReq, { end: true });
}

// ── 产品详情API：从产品列表中查找单个产品 ───────────────────────
function handleProductDetail(req, res, productId) {
  const urlStr = `http://${ADMIN_HOST}:${ADMIN_PORT}/api/products`;
  
  http.get(urlStr, (apiRes) => {
    let body = '';
    apiRes.on('data', d => { body += d; });
    apiRes.on('end', () => {
      try {
        const products = JSON.parse(body);
        const prodArray = Array.isArray(products) ? products : (products.value || products.data || []);
        // 兼容ID为数字或字符串的情况
        const product = prodArray.find(p => String(p.id) === String(productId));
        
        if (product) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, data: product }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Product not found' }));
        }
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Failed to fetch products' }));
      }
    });
  }).on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Admin service unavailable' }));
  });
}

// ── 翻译代理（国内可访问，服务端转发）──────────────────────────
// GET /api/translate?text=...&from=zh&to=en
// 主接口：有道翻译（无需Key，国内稳定）— 适用于 zh/en/vi
// 菲律宾语(tl)专用：微软 Edge Translate（有道不支持 tl）
// 兜底接口：MyMemory（全球可用）
function handleTranslate(req, res) {
  const parsedQ = url.parse(req.url, true);
  const { text, from, to } = parsedQ.query;
  if (!text || !to) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ success: false, result: text || '' }));
  }

  // ── 菲律宾语(tl)：走微软 Edge Translate（有道不支持 tl）──
  if (to === 'tl' || to === 'fil' || to === 'ph') {
    return handleMsTranslate(req, res, text, from, to);
  }

  // 语言代码映射（有道格式）
  const YOUDAO_LANG = { zh: 'zh-CHS', en: 'en', vi: 'vi', auto: 'auto' };
  const fromCode = YOUDAO_LANG[from] || 'auto';
  const toCode   = YOUDAO_LANG[to]   || 'en';

  // 有道免费接口
  const youdaoPath = '/translate?doctype=json&type=' + fromCode + '2' + toCode
    + '&i=' + encodeURIComponent(text);

  const youdaoOpt = {
    hostname: 'fanyi.youdao.com',
    path: youdaoPath,
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://fanyi.youdao.com/' }
  };

  function fallbackMyMemory(originalText) {
    // MyMemory 免费接口（备用）
    const mmLang = { zh: 'zh-CN', en: 'en', vi: 'vi', tl: 'tl' };
    const langPair = (mmLang[from] || 'en') + '|' + (mmLang[to] || 'en');
    const mmPath = '/get?q=' + encodeURIComponent(originalText) + '&langpair=' + encodeURIComponent(langPair);
    const mmOpt = {
      hostname: 'api.mymemory.translated.net',
      path: mmPath,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    };
    let body = '';
    const mmReq = https.request(mmOpt, mmRes => {
      mmRes.on('data', d => { body += d; });
      mmRes.on('end', () => {
        try {
          const j = JSON.parse(body);
          const translated = j.responseData && j.responseData.translatedText;
          if (translated && translated !== 'QUERY LENGTH LIMIT EXCEEDED') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ success: true, result: translated }));
          }
        } catch(e) {}
        // 全部失败，返回原文
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, result: originalText }));
      });
    });
    mmReq.on('error', () => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, result: originalText }));
    });
    mmReq.end();
  }

  let body = '';
  const ydReq = https.request(youdaoOpt, ydRes => {
    ydRes.on('data', d => { body += d; });
    ydRes.on('end', () => {
      try {
        const j = JSON.parse(body);
        // 有道返回格式：{ translateResult: [[{tgt:"..."}]], errorCode: "0" }
        const tgt = j.translateResult && j.translateResult[0] && j.translateResult[0][0] && j.translateResult[0][0].tgt;
        if (j.errorCode === '0' && tgt) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: true, result: tgt }));
        }
      } catch(e) {}
      // 有道失败，走备用 MyMemory
      fallbackMyMemory(text);
    });
  });
  ydReq.on('error', () => fallbackMyMemory(text));
  ydReq.end();
}

// ── 微软 Edge 翻译（用于菲律宾语等有道不支持的语言）──
let _msToken = null;
let _msTokenExpiry = 0;

function getMsToken(cb) {
  if (_msToken && Date.now() < _msTokenExpiry) return cb(null, _msToken);
  const req = https.request('https://edge.microsoft.com/translate/auth', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    timeout: 8000
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      _msToken = d.trim();
      _msTokenExpiry = Date.now() + 9 * 60 * 1000;
      cb(null, _msToken);
    });
  });
  req.on('error', cb);
  req.on('timeout', () => { req.destroy(); cb(new Error('timeout')); });
  req.end();
}

function handleMsTranslate(req, res, text, from, to) {
  getMsToken(function(err, token) {
    if (err || !token) {
      // 微软失败，fallback 到 MyMemory
      return fallbackMyMemoryForTl(text, from, to, res);
    }

    const msLangMap = { 'en': 'en', 'zh': 'zh-Hans', 'vi': 'vi', 'tl': 'fil', 'fil': 'fil', 'ph': 'fil' };
    const msFrom = msLangMap[from] || 'auto';
    const msTo   = msLangMap[to]   || 'fil';
    
    const msUrlObj = new URL('https://api-edge.cognitive.microsofttranslator.com/translate?from=' + msFrom + '&to=' + msTo + '&api-version=3.0&textType=plain');
    
    const msBody = JSON.stringify([{ Text: text }]);
    const msReq = https.request({
      hostname: msUrlObj.hostname,
      path: msUrlObj.pathname + msUrlObj.search,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 10000
    }, msRes => {
      let msBody = '';
      msRes.on('data', d => msBody += d);
      msRes.on('end', () => {
        try {
          const j = JSON.parse(msBody);
          const result = j?.[0]?.translations?.[0]?.text;
          if (result && result.trim()) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ success: true, result: result.trim() }));
          }
        } catch(e) {}
        fallbackMyMemoryForTl(text, from, to, res);
      });
    });
    msReq.on('error', () => fallbackMyMemoryForTl(text, from, to, res));
    msReq.on('timeout', () => { msRes.destroy(); fallbackMyMemoryForTl(text, from, to, res); });
    msReq.write(msBody);
    msReq.end();
  });
}

function fallbackMyMemoryForTl(originalText, from, to, res) {
  const mmLang = { zh: 'zh-CN', en: 'en', vi: 'vi', tl: 'tl' };
  const langPair = (mmLang[from] || 'en') + '|' + (mmLang[to] || 'tl');
  const mmPath = '/get?q=' + encodeURIComponent(originalText) + '&langpair=' + encodeURIComponent(langPair);
  const mmOpt = {
    hostname: 'api.mymemory.translated.net',
    path: mmPath,
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  };
  let body = '';
  const mmReq = https.request(mmOpt, mmRes => {
    mmRes.on('data', d => { body += d; });
    mmRes.on('end', () => {
      try {
        const j = JSON.parse(body);
        const translated = j.responseData && j.responseData.translatedText;
        if (translated && !translated.includes('MYMEMORY WARNING')) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: true, result: translated }));
        }
      } catch(e) {}
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, result: originalText }));
    });
  });
  mmReq.on('error', () => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: false, result: originalText }));
  });
  mmReq.end();
}

// ── HTTP 服务器 ─────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;

  // 翻译代理（国内可访问）
  if (pathname === '/api/translate' && req.method === 'GET') return handleTranslate(req, res);

  // 新闻浏览量 API：GET /api/news-views/[slug]
  const newsViewsMatch = pathname.match(/^\/api\/news-views\/(.+)$/);
  if (newsViewsMatch) {
    const slug = decodeURIComponent(newsViewsMatch[1]);
    const views = readNewsViews();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, slug, views: views[slug] || 0 }));
    return;
  }

  // 所有新闻浏览量 API：GET /api/news-views (返回所有)
  if (pathname === '/api/news-views' && req.method === 'GET') {
    const views = readNewsViews();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, data: views }));
    return;
  }

  // 产品 by-slug API：代理到后台（不走 handleProductDetail）
  if (pathname.startsWith('/api/products/by-slug/')) return proxyToAdmin(req, res);

  // 产品详情API：/api/products/{id} → 从产品列表中查找
  const productDetailMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productDetailMatch) return handleProductDetail(req, res, productDetailMatch[1]);

  // /api/applications → /api/scenarios（别名路由，转换数据格式）
  if (pathname === '/api/applications') {
    const scenariosUrl = `http://${ADMIN_HOST}:${ADMIN_PORT}/api/scenarios`;
    http.get(scenariosUrl, (apiRes) => {
      let body = '';
      apiRes.on('data', d => { body += d; });
      apiRes.on('end', () => {
        try {
          // 后台存 nested {descriptionsByLang:{en,zh,vi,ph}} → 转为前台 flat {_en,_zh,_vi,_tl}
          const raw = JSON.parse(body);
          // 兼容两种格式：{success,data} 或 直接数组
          const scenariosData = raw.data || raw;
          const flat = (Array.isArray(scenariosData) ? scenariosData : []).map(s => ({
            id: s.id,
            slug: s.slug || '',
            image: s.image || '',
            images: s.images || [],
            name_en: s.name_en || s.name || '',
            name_zh: s.name_zh || '',
            name_vi: s.name_vi || '',
            name_tl: s.name_tl || '',
            description_en: s.description_en || '',
            description_zh: s.description_zh || '',
            description_vi: s.description_vi || '',
            description_tl: s.description_tl || '',
            // 推荐材料（后台已扁平化）
            materials: Array.isArray(s.materials) ? s.materials.map(m => ({
              id: m.id,
              name: m.name || m.name_en || '',
              name_en:  m.name_en  || '',
              name_zh:  m.name_zh  || '',
              name_vi:  m.name_vi  || '',
              name_tl:  m.name_tl  || '',
              desc: m.desc || m.description_en || '',
              description_en:  m.description_en  || '',
              description_zh:  m.description_zh  || '',
              description_vi:  m.description_vi  || '',
              description_tl:  m.description_tl  || '',
            })) : []
          }));
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, data: flat }));
        } catch(e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Parse error' }));
        }
      });
    }).on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Admin unavailable' }));
    });
    return;
  }

  // /api/* → 代理到后台
  if (pathname.startsWith('/api/')) return proxyToAdmin(req, res);

  // 图片/上传目录 → 代理到后台（后台上传的图片可在前台访问）
  if (pathname.startsWith('/uploads/')
   || pathname.startsWith('/admin-images/')
   || pathname.startsWith('/about-uploads/')
   || pathname.startsWith('/homepage-uploads/')
   || pathname.startsWith('/case-uploads/')) {
    return proxyToAdmin(req, res);
  }

  // 根路径 → index.html
  if (pathname === '/') pathname = '/index.html';

  // ── 干净 URL 路由（Clean URL rewrite）────────────────────────────
  // /products              → products.html
  // /products/:catSlug     → products.html（由页面 JS 读 pathname）
  // /products/:catSlug/:productSlug → product-detail.html（由页面 JS 读 pathname）
  // /about                 → about.html
  // /contact               → contact.html
  // /applications          → applications.html
  // /case-studies          → case-studies.html
  // /news                  → news.html
  // /news/:slug            → news-detail.html（由页面 JS 读 pathname）
  if (pathname === '/products') {
    pathname = '/products.html';
  } else if (pathname.startsWith('/products/')) {
    // 两段：/products/:catSlug → products.html
    // 三段：/products/:catSlug/:productSlug → product-detail.html
    const parts = pathname.replace(/^\/products\//, '').split('/').filter(Boolean);
    if (parts.length >= 2) {
      pathname = '/product-detail.html';
    } else {
      pathname = '/products.html';
    }
  } else if (pathname === '/about') {
    pathname = '/about.html';
  } else if (pathname === '/contact') {
    pathname = '/contact.html';
  } else if (pathname === '/applications') {
    pathname = '/applications.html';
  } else if (pathname === '/case-studies' || pathname === '/cases') {
    pathname = '/case-studies.html';
  } else if (pathname === '/news') {
    pathname = '/news.html';
  } else if (pathname.startsWith('/news/')) {
    pathname = '/news-detail.html';
  }

  // 浏览量统计（仅统计真实访客，排除本地 IP）
  if (req.method === 'GET') {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const isLocal  = ['127.0.0.1','::1','::ffff:127.0.0.1'].some(ip => clientIp.startsWith(ip));
    if (!isLocal) {
      // 如果是新闻详情页，从路径中获取 slug
      let slug = null;
      const origPathname = parsedUrl.pathname;
      if (origPathname.startsWith('/news/')) {
        slug = origPathname.replace('/news/', '').split('/')[0] || null;
      } else if (origPathname === '/news-detail.html') {
        const query = parsedUrl.query || '';
        const params = new URLSearchParams(query);
        slug = params.get('slug') || null;
      }
      recordPageview(pathname, slug);
    }
  }

  // 静态文件服务
  const filePath    = path.join(__dirname, pathname);
  const ext         = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1>');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const adminUrl = `${ADMIN_PROTO}://${ADMIN_HOST}:${ADMIN_PORT}`;
  console.log(`✅ JinYu 前台已启动: http://localhost:${PORT}/`);
  console.log(`   后台代理目标: ${adminUrl}`);
});
