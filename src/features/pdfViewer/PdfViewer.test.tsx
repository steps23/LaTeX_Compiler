import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { PdfViewer } from "./PdfViewer";
import { useEditorStore } from "../../state/store";

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

const loadingTaskDestroySpy = vi.fn().mockResolvedValue(true);
const docDestroySpy = vi.fn().mockResolvedValue(true);
const renderCancelSpy = vi.fn();
let pageRequested = false;

vi.mock("pdfjs-dist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pdfjs-dist")>();
  return {
    ...actual,
    getDocument: vi.fn(),
  };
});

import * as pdfjsLib from "pdfjs-dist";

describe("PdfViewer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    loadingTaskDestroySpy.mockClear();
    docDestroySpy.mockClear();
    renderCancelSpy.mockClear();
    pageRequested = false;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cleans up resources and respects unmount properly", async () => {
    const docDeferred = createDeferred<pdfjsLib.PDFDocumentProxy>();
    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: docDeferred.promise,
      destroy: loadingTaskDestroySpy,
    } as unknown as pdfjsLib.PDFDocumentLoadingTask);

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([1, 2, 3]),
        rawLog: "", errors: [], warnings: [], durationMs: 0
      },
    });

    const { unmount } = render(<PdfViewer />);
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(loadingTaskDestroySpy).toHaveBeenCalled();
  });

  it("handles render task cancellation if component unmounts mid-render", async () => {
    const renderDeferred = createDeferred<void>();
    const docDeferred = createDeferred<pdfjsLib.PDFDocumentProxy>();

    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: docDeferred.promise,
      destroy: loadingTaskDestroySpy,
    } as unknown as pdfjsLib.PDFDocumentLoadingTask);

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([4, 5, 6]),
        rawLog: "", errors: [], warnings: [], durationMs: 0
      },
    });

    const { unmount } = render(<PdfViewer />);

    docDeferred.resolve({
      numPages: 1,
      destroy: docDestroySpy,
      getPage: vi.fn().mockImplementation(() => {
        pageRequested = true;
        return Promise.resolve({
          getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
          render: vi.fn().mockReturnValue({
            promise: renderDeferred.promise,
            cancel: renderCancelSpy,
          }),
        });
      }),
    } as unknown as pdfjsLib.PDFDocumentProxy);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(pageRequested).toBe(true);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(renderCancelSpy).toHaveBeenCalled();
  });

  it("destroys document from pending promise if unmounted early", async () => {
    const docDeferred = createDeferred<pdfjsLib.PDFDocumentProxy>();

    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: docDeferred.promise,
      destroy: loadingTaskDestroySpy,
    } as unknown as pdfjsLib.PDFDocumentLoadingTask);

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([7, 8, 9]),
        rawLog: "", errors: [], warnings: [], durationMs: 0
      },
    });

    const { unmount } = render(<PdfViewer />);

    unmount();

    docDeferred.resolve({
      numPages: 1,
      destroy: docDestroySpy,
    } as unknown as pdfjsLib.PDFDocumentProxy);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(docDestroySpy).toHaveBeenCalled();
  });

  it("handles RenderingCancelledException cleanly", async () => {
    const renderDeferred = createDeferred<void>();
    const docDeferred = createDeferred<pdfjsLib.PDFDocumentProxy>();
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: docDeferred.promise,
      destroy: loadingTaskDestroySpy,
    } as unknown as pdfjsLib.PDFDocumentLoadingTask);

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([10, 11, 12]),
        rawLog: "", errors: [], warnings: [], durationMs: 0
      },
    });

    const { unmount } = render(<PdfViewer />);

    docDeferred.resolve({
      numPages: 1,
      destroy: docDestroySpy,
      getPage: vi.fn().mockImplementation(() => {
        pageRequested = true;
        return Promise.resolve({
          getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
          render: vi.fn().mockReturnValue({
            promise: renderDeferred.promise,
            cancel: renderCancelSpy,
          }),
        });
      }),
    } as unknown as pdfjsLib.PDFDocumentProxy);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(pageRequested).toBe(true);

    const cancelError = new Error("Render cancelled");
    cancelError.name = "RenderingCancelledException";
    renderDeferred.reject(cancelError);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    unmount();
  });
});
