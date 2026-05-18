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
    expect(screen.getByText(/15[,.]?025/)).toBeInTheDocument();
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
