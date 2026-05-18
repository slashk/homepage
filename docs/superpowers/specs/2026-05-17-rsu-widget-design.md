# RSU Widget Design

**Date:** 2026-05-17
**Status:** Approved

## Overview

A new `rsu` widget that takes a stock symbol and number of RSU shares, fetches the current price via the Finnhub provider, and displays the total value (price × shares) in USD. One widget instance = one stock symbol.

## Widget Configuration

In `widgets.yaml`:

```yaml
- type: rsu
  options:
    symbol: AAPL
    shares: 150
    provider: finnhub
```

| Option     | Type   | Required | Description                                              |
| ---------- | ------ | -------- | -------------------------------------------------------- |
| `symbol`   | string | yes      | Stock market symbol (e.g. `AAPL`, `GOOGL`)               |
| `shares`   | number | yes      | Number of RSU shares held                                |
| `provider` | string | yes      | Must be `finnhub`                                        |
| `cache`    | number | no       | Cache TTL in seconds (default: 1, same as stocks widget) |

The Finnhub API key is read from `settings.yaml` under `providers.finnhub`, same as the existing stocks widget.

## Architecture

Three new files, two modifications:

| Action | Path                                 | Purpose                            |
| ------ | ------------------------------------ | ---------------------------------- |
| Create | `src/widgets/rsu/widget.js`          | Widget API definition              |
| Create | `src/pages/api/widgets/rsu.js`       | API route (backend)                |
| Create | `src/components/widgets/rsu/rsu.jsx` | Dashboard component (frontend)     |
| Modify | `src/widgets/components.js`          | Register widget in master registry |
| Modify | `src/skeleton/widgets.yaml`          | Add commented example config       |

## Data Flow

1. Frontend component calls `/api/widgets/rsu?symbol=AAPL&shares=150&provider=finnhub`
2. API route validates `symbol`, `shares`, and `provider` are present; `provider` must be `finnhub`
3. API route reads Finnhub API key from `getSettings().providers.finnhub`
4. API route calls `https://finnhub.io/api/v1/quote?symbol=AAPL&token=<key>` via `cachedRequest`
5. If Finnhub returns a null price, API returns `{ symbol, totalValue: null }`
6. Otherwise multiplies `currentPrice × shares` server-side and returns `{ symbol, totalValue: 27843.50 }`
7. Frontend formats `totalValue` as USD currency using `t("common.number", { style: "currency", currency: "USD" })`

## Display

Single-line widget:

```
📈  AAPL   $27,843.50
```

- `FaChartLine` icon (same as stocks widget)
- Symbol label
- Total value formatted as USD
- Loading state: icon + "Loading..." text while SWR is pending
- Error state: standard `<Error />` component on API failure or null price

No color coding, no interactivity, no toggle.

## Error Handling

| Condition                                 | Behavior                                                    |
| ----------------------------------------- | ----------------------------------------------------------- |
| Missing `symbol`, `shares`, or `provider` | 400 with descriptive error message                          |
| `provider` is not `finnhub`               | 400 `"Invalid provider"`                                    |
| Finnhub API key not in `settings.yaml`    | 400 `"Missing or invalid API Key for provider"`             |
| Finnhub returns null price                | `{ symbol, totalValue: null }` → frontend shows error state |
| `shares` is not a positive number         | 400 `"Invalid shares value"`                                |

## Out of Scope

- Multiple symbols per widget instance (one widget = one symbol)
- Currency other than USD
- Gain/loss indicators or color coding
- Vest price / cost basis tracking
