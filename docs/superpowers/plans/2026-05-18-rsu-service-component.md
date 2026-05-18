# RSU Service Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a service tile component for the `rsu` widget type so it can appear on service cards, displaying the total USD value of RSU shares.

**Architecture:** Three new files (`widget.js` definition, `component.jsx` service tile, `component.test.jsx`) plus small modifications to the credentialed proxy handler (add `rsu` auth alongside `stocks`), the service widget registry, and the i18n file. The existing dashboard widget and API route are untouched.

**Tech Stack:** Next.js, React, Vitest, `@testing-library/react`, `useWidgetAPI` SWR hook, `credentialedProxyHandler`

---

## File Map

| Action | Path                                          | Responsibility                                |
| ------ | --------------------------------------------- | --------------------------------------------- |
| Create | `src/widgets/rsu/widget.js`                   | Proxy definition — Finnhub quote endpoint     |
| Create | `src/widgets/rsu/widget.test.js`              | Validates widget config shape                 |
| Create | `src/widgets/rsu/component.jsx`               | Service tile component                        |
| Create | `src/widgets/rsu/component.test.jsx`          | Component tests                               |
| Modify | `src/utils/proxy/handlers/credentialed.js:40` | Add `rsu` auth alongside `stocks`             |
| Modify | `src/widgets/components.js:125`               | Register `rsu` between `romm` and `rutorrent` |
| Modify | `public/locales/en/common.json`               | Add `rsu.totalValue` key                      |

---

### Task 1: Widget definition

**Files:**

- Create: `src/widgets/rsu/widget.js`
- Create: `src/widgets/rsu/widget.test.js`

- [ ] **Step 1: Create `src/widgets/rsu/widget.js`**

```js
import credentialedProxyHandler from "utils/proxy/handlers/credentialed";

const widget = {
  api: `https://finnhub.io/api/{endpoint}`,
  proxyHandler: credentialedProxyHandler,
  mappings: {
    quote: {
      // https://finnhub.io/docs/api/quote
      endpoint: "v1/quote",
      params: ["symbol"],
    },
  },
};

export default widget;
```

- [ ] **Step 2: Write the widget config test**

Create `src/widgets/rsu/widget.test.js`:

```js
import { describe, it } from "vitest";

import { expectWidgetConfigShape } from "test-utils/widget-config";

import widget from "./widget";

describe("rsu widget config", () => {
  it("exports a valid widget config", () => {
    expectWidgetConfigShape(widget);
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

```bash
npx vitest run src/widgets/rsu/widget.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/widgets/rsu/widget.js src/widgets/rsu/widget.test.js
git commit -m "feat(rsu): add widget definition for service proxy"
```

---

### Task 2: Proxy auth + service component (TDD)

**Files:**

- Modify: `src/utils/proxy/handlers/credentialed.js:40`
- Create: `src/widgets/rsu/component.test.jsx`
- Create: `src/widgets/rsu/component.jsx`

- [ ] **Step 1: Update `credentialedProxyHandler` to authenticate RSU requests**

In `src/utils/proxy/handlers/credentialed.js`, line 40 currently reads:

```js
if (widget.type === "stocks") {
```

Change it to:

```js
if (widget.type === "stocks" || widget.type === "rsu") {
```

The full block after the change (lines 40–45):

```js
if (widget.type === "stocks" || widget.type === "rsu") {
  const { providers } = getSettings();
  if (widget.provider === "finnhub" && providers?.finnhub) {
    headers["X-Finnhub-Token"] = `${providers?.finnhub}`;
  }
} else if (widget.type === "coinmarketcap") {
```

- [ ] **Step 2: Write the failing component tests**

Create `src/widgets/rsu/component.test.jsx`:

```jsx
// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/rsu/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state while data is pending", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });

    renderWithProviders(
      <Component service={{ widget: { type: "rsu", symbol: "AAPL", shares: "150", provider: "finnhub" } }} />,
      { settings: { hideErrors: false } },
    );

    expect(screen.getByText("rsu.loading")).toBeInTheDocument();
  });

  it("renders error state on API failure", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: new Error("network error") });

    renderWithProviders(
      <Component service={{ widget: { type: "rsu", symbol: "AAPL", shares: "150", provider: "finnhub" } }} />,
      { settings: { hideErrors: false } },
    );

    expect(screen.getByText("widget.api_error")).toBeInTheDocument();
  });

  it("renders total value on success", () => {
    useWidgetAPI.mockReturnValue({ data: { c: 150.25, dp: 1.5 }, error: undefined });

    renderWithProviders(
      <Component service={{ widget: { type: "rsu", symbol: "AAPL", shares: "100", provider: "finnhub" } }} />,
      { settings: { hideErrors: false } },
    );

    expect(screen.getByText("rsu.totalValue")).toBeInTheDocument();
    expect(screen.getByText(/15025/)).toBeInTheDocument();
  });

  it("renders error state when price is null", () => {
    useWidgetAPI.mockReturnValue({ data: { c: null, dp: null }, error: undefined });

    renderWithProviders(
      <Component service={{ widget: { type: "rsu", symbol: "AAPL", shares: "150", provider: "finnhub" } }} />,
      { settings: { hideErrors: false } },
    );

    expect(screen.getByText("widget.api_error")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/widgets/rsu/component.test.jsx
```

Expected: FAIL with "Cannot find module './component'"

- [ ] **Step 4: Implement `src/widgets/rsu/component.jsx`**

```jsx
import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next";

import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const { data, error } = useWidgetAPI(widget, "quote", { symbol: widget.symbol });

  if (error || data?.error) {
    return <Container service={service} error={error} />;
  }

  if (!data) {
    return (
      <Container service={service}>
        <Block label={t("rsu.loading")} />
      </Container>
    );
  }

  if (data.c === null) {
    return <Container service={service} error="Price unavailable" />;
  }

  const totalValue = data.c * Number(widget.shares);

  return (
    <Container service={service}>
      <Block
        label={t("rsu.totalValue")}
        value={t("common.number", { value: totalValue, style: "currency", currency: "USD" })}
      />
    </Container>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/widgets/rsu/component.test.jsx
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/utils/proxy/handlers/credentialed.js src/widgets/rsu/component.jsx src/widgets/rsu/component.test.jsx
git commit -m "feat(rsu): add service component and Finnhub proxy auth"
```

---

### Task 3: Register and add i18n key

**Files:**

- Modify: `src/widgets/components.js:125`
- Modify: `public/locales/en/common.json`

- [ ] **Step 1: Register `rsu` in `src/widgets/components.js`**

Line 125 currently reads:

```js
  romm: dynamic(() => import("./romm/component")),
  rutorrent: dynamic(() => import("./rutorrent/component")),
```

Insert `rsu` between them:

```js
  romm: dynamic(() => import("./romm/component")),
  rsu: dynamic(() => import("./rsu/component")),
  rutorrent: dynamic(() => import("./rutorrent/component")),
```

- [ ] **Step 2: Add `rsu.totalValue` i18n key**

In `public/locales/en/common.json`, find the existing `"rsu"` block:

```json
"rsu": {
    "loading": "Loading"
},
```

Add the `totalValue` key:

```json
"rsu": {
    "loading": "Loading",
    "totalValue": "Total Value"
},
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests PASS (no regressions)

- [ ] **Step 4: Commit**

```bash
git add src/widgets/components.js public/locales/en/common.json
git commit -m "feat(rsu): register service widget and add totalValue i18n key"
```
