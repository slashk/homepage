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
