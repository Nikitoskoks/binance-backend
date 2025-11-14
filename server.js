import express from "express";
import axios from "axios";
import cors from "cors";
import WebSocket from "ws";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

// ████████████████████████████████████
// КЭШ
// ████████████████████████████████████

const cache = {
    funding: {},       
    openInterest: {},  
    longShort: {},     
    depth: {}          
};

// ████████████████████████████████████
// Вебсокет Binance — подключение + авто-реконнект
// ████████████████████████████████████

function startDepthSocket(symbol = "BTCUSDT") {
    const ws = new WebSocket(
        `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@depth@100ms`
    );

    ws.on("open", () => console.log("WS CONNECTED:", symbol));

    ws.on("message", (msg) => {
        try {
            cache.depth[symbol] = JSON.parse(msg);
        } catch (e) {}
    });

    ws.on("close", () => {
        console.log("WS CLOSED. RECONNECTING…");
        setTimeout(() => startDepthSocket(symbol), 2000);
    });

    ws.on("error", () => {
        console.log("WS ERROR. RECONNECTING…");
        ws.close();
    });
}

startDepthSocket("BTCUSDT");

// ████████████████████████████████████
// ЭНДПОИНТЫ
// ████████████████████████████████████

// Funding
app.get("/funding", async (req, res) => {
    const symbol = req.query.symbol || "BTCUSDT";
    try {
        const r = await axios.get(
            `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`
        );
        cache.funding[symbol] = r.data[0] || {};
        res.json(cache.funding[symbol]);
    } catch (err) {
        res.json(cache.funding[symbol] || {});
    }
});

// Open Interest
app.get("/open-interest", async (req, res) => {
    const symbol = req.query.symbol || "BTCUSDT";
    try {
        const r = await axios.get(
            `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`
        );
        cache.openInterest[symbol] = r.data || {};
        res.json(r.data);
    } catch (err) {
        res.json(cache.openInterest[symbol] || {});
    }
});

// Long/Short Ratio
app.get("/long-short", async (req, res) => {
    const symbol = req.query.symbol || "BTCUSDT";
    try {
        const r = await axios.get(
            `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`
        );
        cache.longShort[symbol] = r.data[0] || {};
        res.json(cache.longShort[symbol]);
    } catch (err) {
        res.json(cache.longShort[symbol] || {});
    }
});

// Depth (WS)
app.get("/depth", (req, res) => {
    const symbol = req.query.symbol || "BTCUSDT";
    res.json(cache.depth[symbol] || {});
});

// Full packet
app.get("/full", async (req, res) => {
    const symbol = req.query.symbol || "BTCUSDT";
    res.json({
        funding: cache.funding[symbol] || {},
        openInterest: cache.openInterest[symbol] || {},
        longShort: cache.longShort[symbol] || {},
        depth: cache.depth[symbol] || {}
    });
});

// ████████████████████████████████████
// START SERVER
// ████████████████████████████████████

app.listen(PORT, () =>
    console.log("Server running on port", PORT)
);
