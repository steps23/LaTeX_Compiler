import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  schedule,
  flushProject,
  flushFile,
  flushAll,
} from "../src/services/FileDebouncer";
import { FileService } from "../src/services/FileService";
import { FileNode } from "../src/types";

vi.mock("../src/services/FileService", () => ({
  FileService: {
    saveFile: vi.fn(),
  },
}));

describe("FileDebouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("should debounce file saves", async () => {
    const file: FileNode = {
      id: "1",
      projectId: "p1",
      name: "test.tex",
      path: "test.tex",
      isFolder: false,
      updatedAt: 0,
    };

    schedule(file, 1000);
    schedule({ ...file, content: "abc" }, 1000);

    // Fast-forward not enough time
    vi.advanceTimersByTime(500);
    expect(FileService.saveFile).not.toHaveBeenCalled();

    // Fast-forward rest of the time
    vi.advanceTimersByTime(500);
    // Timer completes but it awaits in async so we need to flush promises manually or await
    // Actually vitest generic promise flush
    await vi.runAllTimersAsync();

    expect(FileService.saveFile).toHaveBeenCalledTimes(1);
    expect(FileService.saveFile).toHaveBeenCalledWith({
      ...file,
      content: "abc",
    });
  });

  it("should flush saves immediately", async () => {
    const file: FileNode = {
      id: "2",
      projectId: "p1",
      name: "t.tex",
      path: "t.tex",
      isFolder: false,
      updatedAt: 0,
    };
    schedule(file, 1000);

    await flushAll();
    expect(FileService.saveFile).toHaveBeenCalledTimes(1);
    expect(FileService.saveFile).toHaveBeenCalledWith(file);

    // ensure timers are cleared
    await vi.runAllTimersAsync();
    expect(FileService.saveFile).toHaveBeenCalledTimes(1);
  });

  it("should flush specific file", async () => {
    const file1: FileNode = {
      id: "f1",
      projectId: "p1",
      name: "1.tex",
      path: "1.tex",
      isFolder: false,
      updatedAt: 0,
    };
    const file2: FileNode = {
      id: "f2",
      projectId: "p1",
      name: "2.tex",
      path: "2.tex",
      isFolder: false,
      updatedAt: 0,
    };

    schedule(file1, 1000);
    schedule(file2, 1000);

    await flushFile("f1");

    expect(FileService.saveFile).toHaveBeenCalledTimes(1);
    expect(FileService.saveFile).toHaveBeenCalledWith(file1);

    await flushAll();
    expect(FileService.saveFile).toHaveBeenCalledTimes(2);
    expect(FileService.saveFile).toHaveBeenCalledWith(file2);
  });
});
