# RSU Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `rsu` dashboard information widget that takes a stock symbol and share count, fetches the current price via Finnhub, and displays the total USD value.

**Architecture:** Two new files (API route + React component) plus small modifications to the dashboard widget registry, i18n translations, and skeleton config. The API route calls Finnhub directly via `cachedRequest` (same pattern as the existing `stocks` API route) — no proxy indirection needed. The dashboard component uses SWR to fetch from the route and formats the result. Dashboard widgets are registered in `src/components/widgets/widget.jsx`, which is separate from `src/widgets/components.js` (the service-tile registry, not needed here).

**Tech Stack:** Next.js API routes, SWR, React, Tailwind CSS, Vitest, `@testing-library/react`

---

## File Map

| Action | Path                                          | Responsibility                                            |
| ------ | --------------------------------------------- | --------------------------------------------------------- |
| Create | `src/pages/api/widgets/rsu.js`                | API route — validate, fetch price, multiply, return total |
| Create | `src/components/widgets/rsu/rsu.jsx`          | Dashboard UI component                                    |
| Create | `src/__tests__/pages/api/widgets/rsu.test.js` | API route tests                                           |
| Create | `src/components/widgets/rsu/rsu.test.jsx`     | Component tests                                           |
| Modify | `src/components/widgets/widget.jsx`           | Register `rsu` in dashboard widget map                    |
| Modify | `public/locales/en/common.json`               | Add `rsu` i18n keys                                       |
| Modify | `src/skeleton/widgets.yaml`                   | Add commented example config                              |

---

### Task 1: API route with tests (TDD)

**Files:**

- Create: `src/__tests__/pages/api/widgets/rsu.test.js`
- Create: `src/pages/api/widgets/rsu.js`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/pages/api/widgets/rsu.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { getSettings, cachedRequest, logger } = vi.hoisted(() => ({
  getSettings: vi.fn(),
  cachedRequest: vi.fn(),
  logger: { debug: vi.fn() },
}));

vi.mock("utils/config/config", () => ({
  getSettings,
}));

vi.mock("utils/proxy/http", () => ({
  cachedRequest,
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

import handler from "pages/api/widgets/rsu";

describe("pages/api/widgets/rsu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when symbol is missing", async () => {
    const res = createMockRes();
    await handler({ query: { shares: "100", provider: "finnhub" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("symbol");
  });

  it("returns 400 when shares is missing", async () => {
    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", provider: "finnhub" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("shares");
  });

  it("returns 400 when provider is missing", async () => {
    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", shares: "100" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("provider");
  });

  it("returns 400 for invalid provider", async () => {
    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", shares: "100", provider: "nope" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Invalid provider");
  });

  it("returns 400 for non-positive shares", async () => {
    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", shares: "0", provider: "finnhub" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Invalid shares");
  });

  it("returns 400 when API key is not configured", async () => {
    getSettings.mockReturnValueOnce({ providers: {} });
    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", shares: "100", provider: "finnhub" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("API Key");
  });

  it("tolerates missing providers config", async () => {
    getSettings.mockReturnValueOnce({});
    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", shares: "100", provider: "finnhub" } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("API Key");
  });

  it("returns totalValue as price multiplied by shares", async () => {
    getSettings.mockReturnValueOnce({ providers: { finnhub: "testkey" } });
    cachedRequest.mockResolvedValueOnce({ c: 150.25, dp: 1.5 });

    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", shares: "100", provider: "finnhub", cache: "1" } }, res);

    expect(cachedRequest).toHaveBeenCalledWith("https://finnhub.io/api/v1/quote?symbol=AAPL&token=testkey", "1");
    expect(res.body).toEqual({ symbol: "AAPL", totalValue: 15025 });
  });

  it("returns totalValue null when Finnhub returns null price", async () => {
    getSettings.mockReturnValueOnce({ providers: { finnhub: "testkey" } });
    cachedRequest.mockResolvedValueOnce({ c: null, dp: null });

    const res = createMockRes();
    await handler({ query: { symbol: "AAPL", shares: "50", provider: "finnhub" } }, res);

    expect(res.body).toEqual({ symbol: "AAPL", totalValue: null });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/pages/api/widgets/rsu.test.js
```

Expected: multiple FAIL with "Cannot find module 'pages/api/widgets/rsu'"

- [ ] **Step 3: Implement `src/pages/api/widgets/rsu.js`**

```js
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

  if (typeof apiKey === "undefined") {
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/pages/api/widgets/rsu.test.js
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/pages/api/widgets/rsu.test.js src/pages/api/widgets/rsu.js
git commit -m "feat(rsu): add API route with validation and Finnhub price fetch"
```

---

### Task 2: React dashboard component with tests (TDD)

**Files:**

- Create: `src/components/widgets/rsu/rsu.test.jsx`
- Create: `src/components/widgets/rsu/rsu.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/widgets/rsu/rsu.test.jsx`:

```jsx
// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useSWR } = vi.hoisted(() => ({ useSWR: vi.fn() }));
vi.mock("swr", () => ({ default: useSWR }));

import RSU from "./rsu";

describe("components/widgets/rsu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an error widget when the api call fails", () => {
    useSWR.mockReturnValue({ data: undefined, error: new Error("nope") });

    renderWithProviders(<RSU options={{}} />, { settings: { target: "_self" } });

    expect(screen.getByText("widget.api_error")).toBeInTheDocument();
  });

  it("renders a loading state while waiting for data", () => {
    useSWR.mockReturnValue({ data: undefined, error: undefined });

    renderWithProviders(<RSU options={{}} />, { settings: { target: "_self" } });

    expect(screen.getByText(/rsu\.loading/)).toBeInTheDocument();
  });

  it("renders the symbol and total value", () => {
    useSWR.mockReturnValue({
      data: { symbol: "AAPL", totalValue: 15025.5 },
      error: undefined,
    });

    renderWithProviders(<RSU options={{ symbol: "AAPL" }} />, { settings: { target: "_self" } });

    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("15,025.50")).toBeInTheDocument();
  });

  it("renders error when totalValue is null", () => {
    useSWR.mockReturnValue({
      data: { symbol: "AAPL", totalValue: null },
      error: undefined,
    });

    renderWithProviders(<RSU options={{ symbol: "AAPL" }} />, { settings: { target: "_self" } });

    expect(screen.getByText("widget.api_error")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/widgets/rsu/rsu.test.jsx
```

Expected: FAIL with "Cannot find module './rsu'"

- [ ] **Step 3: Implement `src/components/widgets/rsu/rsu.jsx`**

```jsx
import { useTranslation } from "next-i18next";
import { FaChartLine } from "react-icons/fa6";
import useSWR from "swr";

import Container from "../widget/container";
import Error from "../widget/error";
import PrimaryText from "../widget/primary_text";
import Raw from "../widget/raw";
import WidgetIcon from "../widget/widget_icon";

export default function Widget({ options }) {
  const { t, i18n } = useTranslation();

  const { data, error } = useSWR(
    `/api/widgets/rsu?${new URLSearchParams({ lang: i18n.language, ...options }).toString()}`,
  );

  if (error || data?.error) {
    return <Error options={options} />;
  }

  if (!data) {
    return (
      <Container>
        <WidgetIcon icon={FaChartLine} />
        <PrimaryText>{t("rsu.loading")}...</PrimaryText>
      </Container>
    );
  }

  if (data.totalValue === null) {
    return <Error options={options} />;
  }

  return (
    <Container options={options} additionalClassNames="information-widget-rsu">
      <Raw>
        <div className="flex items-center w-full h-full">
          <FaChartLine className="flex-none w-5 h-5 text-theme-800 dark:text-theme-200 mr-2" />
          <span className="text-theme-800 dark:text-theme-200 text-sm mr-2">{data.symbol}</span>
          <span className="text-theme-800/70 dark:text-theme-200/70 text-sm">
            {t("common.number", {
              value: data.totalValue,
              style: "currency",
              currency: "USD",
            })}
          </span>
        </div>
      </Raw>
    </Container>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/widgets/rsu/rsu.test.jsx
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/widgets/rsu/rsu.test.jsx src/components/widgets/rsu/rsu.jsx
git commit -m "feat(rsu): add dashboard component"
```

---

### Task 3: Register widget and add i18n + example config

**Files:**

- Modify: `src/components/widgets/widget.jsx` (line 17 — after `stocks`, alphabetically this is fine since there's no strict ordering required in this small map)
- Modify: `public/locales/en/common.json`
- Modify: `src/skeleton/widgets.yaml`

- [ ] **Step 1: Register widget in `src/components/widgets/widget.jsx`**

Current file (lines 4–18):

```js
const widgetMappings = {
  weatherapi: dynamic(() => import("components/widgets/weather/weather")),
  openweathermap: dynamic(() => import("components/widgets/openweathermap/weather")),
  resources: dynamic(() => import("components/widgets/resources/resources")),
  search: dynamic(() => import("components/widgets/search/search")),
  greeting: dynamic(() => import("components/widgets/greeting/greeting")),
  datetime: dynamic(() => import("components/widgets/datetime/datetime")),
  logo: dynamic(() => import("components/widgets/logo/logo"), { ssr: false }),
  unifi_console: dynamic(() => import("components/widgets/unifi_console/unifi_console")),
  glances: dynamic(() => import("components/widgets/glances/glances")),
  openmeteo: dynamic(() => import("components/widgets/openmeteo/openmeteo")),
  longhorn: dynamic(() => import("components/widgets/longhorn/longhorn")),
  kubernetes: dynamic(() => import("components/widgets/kubernetes/kubernetes")),
  stocks: dynamic(() => import("components/widgets/stocks/stocks")),
};
```

Add the `rsu` entry after `stocks`:

```js
const widgetMappings = {
  weatherapi: dynamic(() => import("components/widgets/weather/weather")),
  openweathermap: dynamic(() => import("components/widgets/openweathermap/weather")),
  resources: dynamic(() => import("components/widgets/resources/resources")),
  search: dynamic(() => import("components/widgets/search/search")),
  greeting: dynamic(() => import("components/widgets/greeting/greeting")),
  datetime: dynamic(() => import("components/widgets/datetime/datetime")),
  logo: dynamic(() => import("components/widgets/logo/logo"), { ssr: false }),
  unifi_console: dynamic(() => import("components/widgets/unifi_console/unifi_console")),
  glances: dynamic(() => import("components/widgets/glances/glances")),
  openmeteo: dynamic(() => import("components/widgets/openmeteo/openmeteo")),
  longhorn: dynamic(() => import("components/widgets/longhorn/longhorn")),
  kubernetes: dynamic(() => import("components/widgets/kubernetes/kubernetes")),
  stocks: dynamic(() => import("components/widgets/stocks/stocks")),
  rsu: dynamic(() => import("components/widgets/rsu/rsu")),
};
```

- [ ] **Step 2: Add i18n keys to `public/locales/en/common.json`**

Find the `"stocks"` block in `public/locales/en/common.json`:

```json
"stocks": {
    "stocks": "Stocks",
    "loading": "Loading",
    "open": "Open - US Market",
    "closed": "Closed - US Market",
    "invalidConfiguration": "Invalid Configuration"
},
```

Add an `"rsu"` block directly after the closing `},` of `"stocks"`:

```json
"rsu": {
    "loading": "Loading"
},
```

- [ ] **Step 3: Add example config to `src/skeleton/widgets.yaml`**

Append to the end of the file:

```yaml
# - rsu:
#     symbol: AAPL
#     shares: 150
#     provider: finnhub
```

- [ ] **Step 4: Run full test suite to confirm nothing is broken**

```bash
npm test
```

Expected: all tests PASS (no regressions)

- [ ] **Step 5: Commit**

```bash
git add src/components/widgets/widget.jsx public/locales/en/common.json src/skeleton/widgets.yaml
git commit -m "feat(rsu): register widget, add i18n keys and skeleton config"
```
