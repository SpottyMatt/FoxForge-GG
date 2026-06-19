import { describe, it, expect } from "vitest";
import { pickDescription } from "../tips";

describe("pickDescription", () => {
  const d = {
    description: "Basic text",
    descriptionAdvanced: "Advanced text",
  };

  it("returns description when advanced mode is off", () => {
    expect(pickDescription(d, false)).toBe("Basic text");
  });

  it("returns descriptionAdvanced when advanced mode is on and present", () => {
    expect(pickDescription(d, true)).toBe("Advanced text");
  });

  it("falls back to description when advanced mode is on but descriptionAdvanced is absent", () => {
    expect(pickDescription({ description: "Basic only" }, true)).toBe("Basic only");
  });
});
