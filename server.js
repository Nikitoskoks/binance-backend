import express from 'express';
import axios from 'axios';
import WebSocket from 'ws';

const app = express();
const PORT = process.env.PORT || 10000;

// === ПРОКСИ ===
const PROXY = "https://corsproxy.io/?";

// === КЭШ ===
let depthCache = {};
let fundingCache = {};
let oiCache = {};
let lsCache = {};

let ws;

// === ФУНКЦИЯ ЧЕРЕЗ ПРОКСИ ===
async function binanceGET(url) {
  const full = PROXY + encodeURIComponent(url);
  const res = await axios.get(full);
  return res.data;
}

// === WS DEPTH ===
function startDepthWS(symbol = "BTCUSDT") {
  const endpoint = `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@depth`;
  ws = new WebSocket(endpoint);

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    depthCache[symbol] = data;
  });

  ws.on("close", () => {
    console.log("WS closed → reconnecting...");
    setTimeout(() => startDepthWS(symbol), 2000);
  });

  ws.on("error", () => {
    console.log("WS error → reconnecting...");
    ws.close();
  });
}

startDepthWS();

// === ENDPOINTS ===

// Funding
app.get("/funding", async (req, res) => {
  try {
    const symbol = req.query.symbol || "BTCUSDT";
    const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`;
    const data = await binanceGET(url);

    fundingCache[symbol] = data;
    res.json(data);
  } catch (err) {
    res.json(fundingCache);
  }
});

// Open Interest
app.get("/open-interest", async (req, res) => {
  try {
    const symbol = req.query.symbol || "BTCUSDT";
    const url = `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=1`;
    const data = await binanceGET(url);

    oiCache[symbol] = data;
    res.json(data);
  } catch (err) {
    res.json(oiCache);
  }
});

// Long/Short Ratio
app.get("/long-short", async (req, res) => {
  try {
    const symbol = req.query.symbol || "BTCUSDT";
    const url = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`;
    const data = await binanceGET(url);

    lsCache[symbol] = data;
    res.json(data);
  } catch (err) {
    res.json(lsCache);
  }
});

// Depth (WS)
app.get("/depth", (req, res) => {
  const symbol = req.query.symbol || "BTCUSDT";
  res.json(depthCache[symbol] || {});
});

// Full combined endpoint
app.get("/full", async (req, res) => {
  const symbol = req.query.symbol || "BTCUSDT";

  try {
    const [funding, oi, ls] = await Promise.all([
      binanceGET(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`),
      binanceGET(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=1`),
      binanceGET(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`)
    ]);

    res.json({
      funding,
      openInterest: oi,
      longShort: ls,
      depth: depthCache[symbol] || {}
    });

  } catch (err) {
    res.json({
      funding: fundingCache[symbol] || {},
      openInterest: oiCache[symbol] || {},
      longShort: lsCache[symbol] || {},
      depth: depthCache[symbol] || {}
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running on PORT:", PORT);
});
