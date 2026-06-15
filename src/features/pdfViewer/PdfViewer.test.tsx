import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { PdfViewer } from "./PdfViewer";
import { useEditorStore } from "../../state/store";
import * as pdfjsLib from "pdfjs-dist";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("PdfViewer", () => {
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi
      .fn()
      .mockReturnValue(
        {},
      ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  function createMockTask() {
    const taskDeferred = createDeferred<pdfjsLib.PDFDocumentProxy>();
    const destroySpy = vi.fn().mockResolvedValue(true);
    const getPageSpy = vi.fn();
    const renderCancelSpy = vi.fn();

    return {
      task: {
        promise: taskDeferred.promise,
        destroy: destroySpy,
      } as unknown as pdfjsLib.PDFDocumentLoadingTask,
      taskDeferred,
      destroySpy,
      getPageSpy,
      renderCancelSpy,
      resolveDoc: (pages = 1) => {
        taskDeferred.resolve({
          numPages: pages,
          destroy: destroySpy,
          getPage: getPageSpy,
        } as unknown as pdfjsLib.PDFDocumentProxy);
      },
    };
  }

  function mockPdfjsGetDocument(task: unknown) {
    vi.mocked(pdfjsLib.getDocument).mockReturnValue(
      task as pdfjsLib.PDFDocumentLoadingTask,
    );
  }

  vi.mock("pdfjs-dist", async (importOriginal) => {
    const actual = await importOriginal<typeof import("pdfjs-dist")>();
    return {
      ...actual,
      getDocument: vi.fn(),
    };
  });

  it("handles fast PDF replacement (A -> B) by waiting for A to be destroyed", async () => {
    const taskA = createMockTask();
    const taskB = createMockTask();

    let getDocCallCount = 0;
    vi.mocked(pdfjsLib.getDocument).mockImplementation(() => {
      getDocCallCount++;
      return getDocCallCount === 1 ? taskA.task : taskB.task;
    });

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([1]),
        rawLog: "",
        errors: [],
        warnings: [],
        durationMs: 0,
      },
    });

    const { unmount } = render(<PdfViewer />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Switch to PDF B rapidly
    act(() => {
      useEditorStore.setState({
        compileResult: {
          success: true,
          pdfBytes: new Uint8Array([2]),
          rawLog: "",
          errors: [],
          warnings: [],
          durationMs: 0,
        },
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Task B shouldn't be started until Task A is destroyed
    expect(taskA.destroySpy).toHaveBeenCalledOnce();

    // Now trigger destruction resolution
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // getDocument should have been called twice now
    expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(2);

    unmount();
  });

  it("cleans up resources and respects unmount properly while loading", async () => {
    const mock = createMockTask();
    mockPdfjsGetDocument(mock.task);

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([1, 2, 3]),
        rawLog: "",
        errors: [],
        warnings: [],
        durationMs: 0,
      },
    });

    const { unmount } = render(<PdfViewer />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mock.destroySpy).toHaveBeenCalled();
  });

  it("handles render task cancellation if component unmounts mid-render", async () => {
    const mock = createMockTask();
    mockPdfjsGetDocument(mock.task);
    const renderDeferred = createDeferred<void>();

    mock.getPageSpy.mockImplementation(() => {
      return Promise.resolve({
        getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
        render: vi.fn().mockReturnValue({
          promise: renderDeferred.promise,
          cancel: mock.renderCancelSpy,
        }),
      });
    });

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([4, 5, 6]),
        rawLog: "",
        errors: [],
        warnings: [],
        durationMs: 0,
      },
    });

    const { unmount } = render(<PdfViewer />);

    mock.resolveDoc();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(mock.getPageSpy).toHaveBeenCalled();

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(mock.renderCancelSpy).toHaveBeenCalled();
  });

  it("destroys document from pending promise if unmounted early", async () => {
    const mock = createMockTask();
    mockPdfjsGetDocument(mock.task);

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([7, 8, 9]),
        rawLog: "",
        errors: [],
        warnings: [],
        durationMs: 0,
      },
    });

    const { unmount } = render(<PdfViewer />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    unmount();

    mock.resolveDoc();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mock.destroySpy).toHaveBeenCalled();
  });

  it("handles RenderingCancelledException cleanly", async () => {
    const mock = createMockTask();
    const renderDeferred = createDeferred<void>();
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mockPdfjsGetDocument(mock.task);

    mock.getPageSpy.mockImplementation(() => {
      return Promise.resolve({
        getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
        render: vi.fn().mockReturnValue({
          promise: renderDeferred.promise,
          cancel: mock.renderCancelSpy,
        }),
      });
    });

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([10, 11, 12]),
        rawLog: "",
        errors: [],
        warnings: [],
        durationMs: 0,
      },
    });

    const { unmount } = render(<PdfViewer />);

    mock.resolveDoc();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const cancelError = new Error("Render cancelled");
    cancelError.name = "RenderingCancelledException";
    renderDeferred.reject(cancelError);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();

    unmount();
  });

  it("visible error when render fails unexpectedly", async () => {
    const mock = createMockTask();
    const renderDeferred = createDeferred<void>();
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mockPdfjsGetDocument(mock.task);

    mock.getPageSpy.mockImplementation(() => {
      return Promise.resolve({
        getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
        render: vi.fn().mockReturnValue({
          promise: renderDeferred.promise,
          cancel: mock.renderCancelSpy,
        }),
      });
    });

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([13]),
        rawLog: "",
        errors: [],
        warnings: [],
        durationMs: 0,
      },
    });

    const { unmount } = render(<PdfViewer />);

    mock.resolveDoc();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const otherError = new Error("Something bad happened");
    renderDeferred.reject(otherError);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(consoleErrorSpy).toHaveBeenCalled();

    unmount();
  });
});
