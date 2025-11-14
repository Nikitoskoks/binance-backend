import express from "express";
import axios from "axios";
import WebSocket from "ws";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

// ---- ПРОКСИ ДЛЯ ОБХОДА БЛОКИРОВОК ----
const PROXY = "https://cors-proxy.fringe.zone/";

// ---- КЭШ ----
let cache = {
  funding: {},
  openInterest: {},
  longShort: {},
  depth: {}
};

// ---- ФУНКЦИЯ ПРОКСИ-ЗАПРОСА ----
async function proxiedGet(url) {
  try {
    const res = await axios.get(PROXY + url, { timeout: 5000 });
    return res.data;
  } catch (err) {
    return null;
  }
}

// ---- FUNDING ----
app.get("/funding", async (req, res) => {
  const symbol = req.query.symbol || "BTCUSDT";
  if (cache.funding[symbol]) return res.json(cache.funding[symbol]);

  const data = await proxiedGet(
    `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`
  );

  cache.funding[symbol] = data || {};
  res.json(data || {});
});

// ---- OPEN INTEREST ----
app.get("/open-interest", async (req, res) => {
  const symbol = req.query.symbol || "BTCUSDT";
  if (cache.openInterest[symbol]) return res.json(cache.openInterest[symbol]);

  const data = await proxiedGet(
    `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=1`
  );

  cache.openInterest[symbol] = data || {};
  res.json(data || {});
});

// ---- LONG/SHORT RATIO ----
app.get("/long-short", async (req, res) => {
  const symbol = req.query.symbol || "BTCUSDT";
  if (cache.longShort[symbol]) return res.json(cache.longShort[symbol]);

  const data = await proxiedGet(
    `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`
  );

  cache.longShort[symbol] = data || {};
  res.json(data || {});
});

// ---- DEPTH ----
app.get("/depth", async (req, res) => {
  const symbol = req.query.symbol || "BTCUSDT";

  const data = await proxiedGet(
    `https://fapi.binance.com/fapi/v1/depth?symbol=${symbol}&limit=500`
  );

  cache.depth[symbol] = data || {};
  res.json(data || {});
});

// ---- FULL PACKAGE ----
app.get("/full", async (req, res) => {
  const symbol = req.query.symbol || "BTCUSDT";

  const funding = await proxiedGet(
    `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`
  );

  const openInterest = await proxiedGet(
    `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=1`
  );

  const longShort = await proxiedGet(
    `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`
  );

  const depth = await proxiedGet(
    `https://fapi.binance.com/fapi/v1/depth?symbol=${symbol}&limit=500`
  );

  res.json({
    funding: funding || {},
    openInterest: openInterest || {},
    longShort: longShort || {},
    depth: depth || {}
  });
});

// ---- СТАРТ ----
app.listen(PORT, () => {
  console.log("🔥 Backend онлайн на порту:", PORT);
});
