import { describe, it } from "vitest";

import { expectWidgetConfigShape } from "test-utils/widget-config";

import widget from "./widget";

describe("rsu widget config", () => {
  it("exports a valid widget config", () => {
    expectWidgetConfigShape(widget);
  });
});
