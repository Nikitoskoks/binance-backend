import express from "express";
import axios from "axios";
import WebSocket from "ws";

const app = express();
const PORT = process.env.PORT || 10000;

// 🔥 КЭШ (данные которые выдаём в n8n)
let funding = null;
let oi = null;
let lsr = null;
let depth = null;

// =========================
//   1. Depth via WebSocket
// =========================

function startDepthWS(symbol = "BTCUSDT") {
    const ws = new WebSocket(`wss://fstream.binance.com/ws/${symbol.toLowerCase()}@depth20@100ms`);

    ws.on("message", msg => {
        try {
            const json = JSON.parse(msg.toString());
            depth = json;
        } catch (e) {}
    });

    ws.on("close", () => {
        console.log("WS closed → reconnecting...");
        setTimeout(() => startDepthWS(symbol), 2000);
    });
}

startDepthWS();

// =========================
//   2. Funding Rate
// =========================

async function updateFunding() {
    try {
        const r = await axios.get(
            "https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1"
        );
        funding = r.data[0];
    } catch {}
}
setInterval(updateFunding, 8000);
updateFunding();

// =========================
//   3. Open Interest
// =========================

async function updateOI() {
    try {
        const r = await axios.get(
            "https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=5m&limit=1"
        );
        oi = r.data[0];
    } catch {}
}
setInterval(updateOI, 8000);
updateOI();

// =========================
//   4. Long/Short Ratio
// =========================

async function updateLSR() {
    try {
        const r = await axios.get(
            "https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=1"
        );
        lsr = r.data[0];
    } catch {}
}
setInterval(updateLSR, 8000);
updateLSR();

// =========================
//   API ENDPOINTS
// =========================

app.get("/funding", (req, res) => res.json(funding ?? {}));
app.get("/oi", (req, res) => res.json(oi ?? {}));
app.get("/lsr", (req, res) => res.json(lsr ?? {}));
app.get("/depth", (req, res) => res.json(depth ?? {}));

app.get("/", (req, res) => {
    res.send("Binance backend is running 🚀");
});

app.listen(PORT, () => {
    console.log("Server running on PORT:", PORT);
});
