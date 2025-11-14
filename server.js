import express from "express";
import WebSocket from "ws";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 10000;

// ====== КЭШ ======
const cache = {
  funding: {},
  openInterest: {},
  longShort: {},
  depth: {},
};

// ====== Binance API URLs ======
const URLS = {
  funding: "https://fapi.binance.com/fapi/v1/fundingRate",
  openInterest: "https://fapi.binance.com/futures/data/openInterestHist",
  longShort: "https://fapi.binance.com/futures/data/globalLongShortAccountRatio",
};

// ====== WebSocket DEPTH ======
const streamSymbol = "btcusdt";
let ws;

function startDepthWS() {
  ws = new WebSocket(`wss://fstream.binance.com/ws/${streamSymbol}@depth@100ms`);

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    cache.depth[streamSymbol.toUpperCase()] = data;
  });

  ws.on("close", () => {
    console.log("WS closed, reconnecting...");
    setTimeout(startDepthWS, 1000);
  });

  ws.on("error", () => {
    console.log("WS error → reconnect");
    ws.close();
  });
}

startDepthWS();

// ====== Функция запроса с кэшем ======
async function fetchWithCache(key, url, params) {
  const cacheKey = params.symbol;
  const now = Date.now();

  // 5 секунд кэша
  if (
    cache[key][cacheKey] &&
    now - cache[key][cacheKey].t < 5000
  ) {
    return cache[key][cacheKey].data;
  }

  const res = await axios.get(url, { params });

  cache[key][cacheKey] = {
    t: now,
    data: res.data,
  };

  return res.data;
}

// ====== ЭНДПОИНТЫ ======

// FUNDING
app.get("/funding", async (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) return res.json({ error: "symbol required" });

  const data = await fetchWithCache("funding", URLS.funding, {
    symbol,
    limit: 1,
  });

  res.json(data);
});

// OPEN INTEREST
app.get("/open-interest", async (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) return res.json({ error: "symbol required" });

  const data = await fetchWithCache("openInterest", URLS.openInterest, {
    symbol,
    period: "5m",
    limit: 1,
  });

  res.json(data);
});

// LONG / SHORT RATIO
app.get("/long-short", async (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) return res.json({ error: "symbol required" });

  const data = await fetchWithCache("longShort", URLS.longShort, {
    symbol,
    period: "5m",
    limit: 1,
  });

  res.json(data);
});

// DEPTH (из WebSocket)
app.get("/depth", (req, res) => {
  const sym = req.query.symbol?.toUpperCase();

  if (!sym) return res.json({ error: "symbol required" });

  res.json(cache.depth[sym] || {});
});

// FULL PACKAGE (все метрики сразу)
app.get("/full", async (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) return res.json({ error: "symbol required" });

  const [funding, oi, ls] = await Promise.all([
    fetchWithCache("funding", URLS.funding, { symbol, limit: 1 }),
    fetchWithCache("openInterest", URLS.openInterest, { symbol, period: "5m", limit: 1 }),
    fetchWithCache("longShort", URLS.longShort, { symbol, period: "5m", limit: 1 }),
  ]);

  const depth = cache.depth[symbol.toUpperCase()] || {};

  res.json({
    funding,
    openInterest: oi,
    longShort: ls,
    depth,
  });
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log("Server running on PORT:", PORT);
});
