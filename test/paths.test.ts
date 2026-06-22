import { describe, it, expect } from "vitest";
import {
  normalizePath,
  isValidProjectFilePath,
  getParentPath,
} from "../src/utils/paths";

describe("Paths Utilities", () => {
  it("should normalize paths correctly", () => {
    expect(normalizePath("a/b/../c")).toBe("a/c");
    expect(normalizePath("a/./b")).toBe("a/b");
    expect(normalizePath("a//b")).toBe("a/b");
    expect(normalizePath("a/b/c/..")).toBe("a/b");
    expect(normalizePath("a\\b")).toBe("a/b");
  });

  it("should validate project paths", () => {
    expect(isValidProjectFilePath("a/b/c.tex")).toBe(true);
    expect(isValidProjectFilePath("../outside.tex")).toBe(false);
    expect(isValidProjectFilePath("/absolute.tex")).toBe(false);
    expect(isValidProjectFilePath("a\0b")).toBe(false);
  });

  it("should get parent path", () => {
    expect(getParentPath("a/b/c.tex")).toBe("a/b");
    expect(getParentPath("a.tex")).toBeUndefined();
  });
});
