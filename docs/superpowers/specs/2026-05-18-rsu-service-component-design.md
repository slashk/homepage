# RSU Service Component Design

**Date:** 2026-05-18
**Status:** Approved

## Overview

Add a service tile component for the existing `rsu` widget type so it can be attached to a service in `services.yaml`. The existing dashboard information widget (`src/components/widgets/rsu/rsu.jsx`) is unchanged.

## Service Configuration

In `services.yaml`:

```yaml
- name: My AAPL RSUs
  widget:
    type: rsu
    symbol: AAPL
    shares: 150
    provider: finnhub
```

| Option     | Type   | Required | Description                       |
| ---------- | ------ | -------- | --------------------------------- |
| `symbol`   | string | yes      | Stock market symbol (e.g. `AAPL`) |
| `shares`   | number | yes      | Number of RSU shares held         |
| `provider` | string | yes      | Must be `finnhub`                 |

The Finnhub API key is read from `settings.yaml` under `providers.finnhub`.

## Architecture

Four files touched, two new:

| Action | Path                                       | Purpose                                           |
| ------ | ------------------------------------------ | ------------------------------------------------- |
| Create | `src/widgets/rsu/widget.js`                | Proxy definition — Finnhub quote endpoint mapping |
| Create | `src/widgets/rsu/component.jsx`            | Service tile component                            |
| Modify | `src/utils/proxy/handlers/credentialed.js` | Add `rsu` auth alongside `stocks`                 |
| Modify | `src/widgets/components.js`                | Register `rsu` in the service widget registry     |

No changes to `src/components/widgets/rsu/rsu.jsx`, `src/pages/api/widgets/rsu.js`, or any existing tests.

## Data Flow

1. Service tile renders `component.jsx`, which calls `useWidgetAPI(widget, "quote", { symbol: widget.symbol })`
2. The proxy handler routes to `credentialedProxyHandler`
3. `credentialedProxyHandler` sees `widget.type === "rsu"` and adds `X-Finnhub-Token` header from `providers.finnhub`
4. Proxy fetches `https://finnhub.io/api/v1/quote?symbol=<symbol>` and returns raw Finnhub response `{ c, dp, ... }`
5. Component multiplies `c * Number(widget.shares)` to get total value, formats as USD currency (`widget.shares` is a string from YAML config)

## Display

Single `<Block>` using the standard service widget primitives:

| State   | Render                                                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Loading | `<Block label={t("rsu.loading")} />`                                                                                          |
| Error   | `<Container service={service} error={error} />`                                                                               |
| Success | `<Block label={t("rsu.totalValue")} value={t("common.number", { value: c * shares, style: "currency", currency: "USD" })} />` |

## i18n

One new key added to `public/locales/en/common.json` in the existing `rsu` block:

```json
"rsu": {
    "loading": "Loading",
    "totalValue": "Total Value"
}
```

## `widget.js` Definition

```js
import credentialedProxyHandler from "utils/proxy/handlers/credentialed";

const widget = {
  api: `https://finnhub.io/api/{endpoint}`,
  proxyHandler: credentialedProxyHandler,
  mappings: {
    quote: {
      endpoint: "v1/quote",
      params: ["symbol"],
    },
  },
};

export default widget;
```

Identical to `src/widgets/stocks/widget.js` minus the `status` mapping (not needed for RSU).

## `credentialedProxyHandler` Change

Add `rsu` condition alongside the existing `stocks` condition. Current code:

```js
if (widget.type === "stocks") {
  const { providers } = getSettings();
  if (widget.provider === "finnhub" && providers?.finnhub) {
    headers["X-Finnhub-Token"] = `${providers?.finnhub}`;
  }
}
```

Updated:

```js
if (widget.type === "stocks" || widget.type === "rsu") {
  const { providers } = getSettings();
  if (widget.provider === "finnhub" && providers?.finnhub) {
    headers["X-Finnhub-Token"] = `${providers?.finnhub}`;
  }
}
```

## Out of Scope

- Changes to the existing dashboard widget
- Displaying price per share or percent change on the tile
- Multiple RSU grants per service tile
