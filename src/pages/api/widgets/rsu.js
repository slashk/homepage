import { getSettings } from "utils/config/config";
import createLogger from "utils/logger";
import { cachedRequest } from "utils/proxy/http";

const logger = createLogger("rsu");

export default async function handler(req, res) {
  const { symbol, shares, provider, cache } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol" });
  }

  if (!shares) {
    return res.status(400).json({ error: "Missing shares" });
  }

  const sharesNum = Number(shares);
  if (!Number.isFinite(sharesNum) || sharesNum <= 0) {
    return res.status(400).json({ error: "Invalid shares value" });
  }

  if (!provider) {
    return res.status(400).json({ error: "Missing provider" });
  }

  if (provider !== "finnhub") {
    return res.status(400).json({ error: "Invalid provider" });
  }

  const providersInConfig = getSettings()?.providers ?? {};
  const apiKey = providersInConfig[provider];

  if (!apiKey) {
    return res.status(400).json({ error: "Missing or invalid API Key for provider" });
  }

  const apiUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
  const { c } = await cachedRequest(apiUrl, cache || 1);
  logger.debug("Finnhub API response for %s: %o", symbol, { c });

  if (c === null) {
    return res.send({ symbol, totalValue: null });
  }

  return res.send({ symbol, totalValue: parseFloat((c * sharesNum).toFixed(2)) });
}
