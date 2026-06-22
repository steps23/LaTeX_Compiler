import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { getRuntimeInfo } from "../utils/runtime";
import { RuntimeBadge } from "./RuntimeBadge";

vi.mock("../utils/runtime", () => ({
  getRuntimeInfo: vi.fn(),
}));

const getRuntimeInfoMock = vi.mocked(getRuntimeInfo);

beforeEach(() => getRuntimeInfoMock.mockReset());

test("shows the runtime returned by the shared adapter", async () => {
  getRuntimeInfoMock.mockResolvedValue({
    contractVersion: 1,
    runtime: "tauri",
    appVersion: "0.1.0",
    os: "macos",
    arch: "aarch64",
    targetFamily: "unix",
  });

  render(<RuntimeBadge />);

  expect(await screen.findByText("Desktop")).toBeVisible();
  expect(getRuntimeInfoMock).toHaveBeenCalledOnce();
});

test("does not claim desktop mode before runtime IPC succeeds", async () => {
  let resolveRuntime!: (
    info: Awaited<ReturnType<typeof getRuntimeInfo>>,
  ) => void;
  getRuntimeInfoMock.mockReturnValue(
    new Promise((resolve) => {
      resolveRuntime = resolve;
    }),
  );

  render(<RuntimeBadge />);

  expect(screen.getByText("Browser")).toBeVisible();
  expect(getRuntimeInfoMock).toHaveBeenCalledOnce();

  resolveRuntime({
    contractVersion: 1,
    runtime: "tauri",
    appVersion: "0.1.0",
    os: "macos",
    arch: "aarch64",
    targetFamily: "unix",
  });
  expect(await screen.findByText("Desktop")).toBeVisible();
});
