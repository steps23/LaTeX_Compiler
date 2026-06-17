import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor, screen } from "@testing-library/react";
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
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  function createMockTask() {
    const taskDeferred = createDeferred<pdfjsLib.PDFDocumentProxy>();
    const destroyDeferred = createDeferred<void>();
    const destroySpy = vi.fn().mockReturnValue(destroyDeferred.promise);
    const getPageSpy = vi.fn();
    const renderCancelSpy = vi.fn();

    return {
      task: {
        promise: taskDeferred.promise,
        destroy: destroySpy,
      } as unknown as pdfjsLib.PDFDocumentLoadingTask,
      taskDeferred,
      destroyDeferred,
      destroySpy,
      getPageSpy,
      renderCancelSpy,
      resolveDoc: (pages = 1) => {
        taskDeferred.resolve({
          numPages: pages,
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
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1));

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

    await waitFor(() => expect(taskA.destroySpy).toHaveBeenCalledTimes(1));
    expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1); // B is waiting

    // Resolve A destroy
    taskA.destroyDeferred.resolve();

    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(2));

    unmount();
  });

  it("skips intermediate loading if A -> B -> C happens before A destroy resolves", async () => {
    const taskA = createMockTask();
    const taskB = createMockTask();
    const taskC = createMockTask();

    let getDocCallCount = 0;
    vi.mocked(pdfjsLib.getDocument).mockImplementation(() => {
      getDocCallCount++;
      if (getDocCallCount === 1) return taskA.task;
      if (getDocCallCount === 2) return taskB.task;
      return taskC.task;
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
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1));

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

    await waitFor(() => expect(taskA.destroySpy).toHaveBeenCalledTimes(1));

    act(() => {
      useEditorStore.setState({
        compileResult: {
          success: true,
          pdfBytes: new Uint8Array([3]),
          rawLog: "",
          errors: [],
          warnings: [],
          durationMs: 0,
        },
      });
    });

    // Resolve A destroy
    taskA.destroyDeferred.resolve();

    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(2)); // C is called, B is skipped

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
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1));
    unmount();

    await waitFor(() => expect(mock.destroySpy).toHaveBeenCalledTimes(1));
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

    await waitFor(() => expect(mock.getPageSpy).toHaveBeenCalledTimes(1));

    unmount();

    await waitFor(() => expect(mock.renderCancelSpy).toHaveBeenCalledTimes(1));
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
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1));
    unmount();

    mock.resolveDoc();
    await waitFor(() => expect(mock.destroySpy).toHaveBeenCalledTimes(1));
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

    await waitFor(() => expect(mock.getPageSpy).toHaveBeenCalledTimes(1));

    const cancelError = new Error("Render cancelled");
    cancelError.name = "RenderingCancelledException";
    renderDeferred.reject(cancelError);

    // Give it a tick to process catch
    await new Promise((r) => setTimeout(r, 10));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    unmount();
  });

  it("shows visible error when render fails unexpectedly", async () => {
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

    await waitFor(() => expect(mock.getPageSpy).toHaveBeenCalledTimes(1));

    const otherError = new Error("Something bad happened during render");
    renderDeferred.reject(otherError);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Error rendering PDF: Something bad happened during render/i,
        ),
      ).toBeTruthy();
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    unmount();
  });

  function mockPdfPageAndRender(
    mockTask: ReturnType<typeof createMockTask>,
    renderPromise: Promise<void> = Promise.resolve(),
  ) {
    mockTask.getPageSpy.mockImplementation(() => {
      return Promise.resolve({
        getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
        render: vi.fn().mockReturnValue({
          promise: renderPromise,
          cancel: mockTask.renderCancelSpy,
        }),
      });
    });
  }

  it("shows visible error when document load fails unexpectedly", async () => {
    const mock = createMockTask();
    mockPdfjsGetDocument(mock.task);

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([14]),
        rawLog: "",
        errors: [],
        warnings: [],
        durationMs: 0,
      },
    });

    const { unmount } = render(<PdfViewer />);
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1));

    act(() => mock.taskDeferred.reject(new Error("Document corrupted")));

    await waitFor(() => {
      expect(
        screen.getByText(/Error rendering PDF: Document corrupted/i),
      ).toBeTruthy();
    });

    unmount();
  });

  it("A -> B -> C: final loading receives exactly C, and B (completing later) does not overwrite C", async () => {
    const taskA = createMockTask();
    const taskB = createMockTask();
    const taskC = createMockTask();

    const getDocCalls: Array<{ data: Uint8Array }> = [];
    vi.mocked(pdfjsLib.getDocument).mockImplementation((params) => {
      getDocCalls.push(params);
      if (getDocCalls.length === 1) return taskA.task;
      if (getDocCalls.length === 2) return taskB.task;
      return taskC.task;
    });

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([100]), // A
        rawLog: "",
        errors: [],
        warnings: [],
        durationMs: 0,
      },
    });

    const { unmount } = render(<PdfViewer />);
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1));
    expect(getDocCalls[0]).toEqual({ data: new Uint8Array([100]) });

    // Transition A -> B -> C. A's destroy is pending
    act(() => {
      useEditorStore.setState({
        compileResult: {
          success: true,
          pdfBytes: new Uint8Array([101]), // B
          rawLog: "",
          errors: [],
          warnings: [],
          durationMs: 0,
        },
      });
    });

    // Make sure destroy was called on A
    await waitFor(() => expect(taskA.destroySpy).toHaveBeenCalledTimes(1));

    // Instantly queue C
    act(() => {
      useEditorStore.setState({
        compileResult: {
          success: true,
          pdfBytes: new Uint8Array([102]), // C
          rawLog: "",
          errors: [],
          warnings: [],
          durationMs: 0,
        },
      });
    });

    // Now resolve A's destroy so the queue can proceed
    taskA.destroyDeferred.resolve();

    // The second getDocument should be called for C (since B was bypassed)
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(2));

    // C's bytes are exactly the ones used
    expect(getDocCalls[1]).toEqual({ data: new Uint8Array([102]) });

    // Ensure we resolve everything cleanly inside the test
    taskB.taskDeferred.resolve({} as unknown as pdfjsLib.PDFDocumentProxy);
    taskC.taskDeferred.resolve({} as unknown as pdfjsLib.PDFDocumentProxy);
    taskB.destroyDeferred.resolve();
    taskC.destroyDeferred.resolve();

    unmount();
  });

  it("immediately invalidates visible state when bytes change, before teardown or loader resolves", async () => {
    const taskA = createMockTask();
    const taskB = createMockTask();

    let getDocCallsCount = 0;
    vi.mocked(pdfjsLib.getDocument).mockImplementation(() => {
      getDocCallsCount++;
      return getDocCallsCount === 1 ? taskA.task : taskB.task;
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
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1));

    // Resolve A
    mockPdfPageAndRender(taskA);
    act(() => taskA.resolveDoc(5));

    // Validate we can interact/see pages
    await waitFor(() => expect(screen.getByText(/Page 1 of 5/i)).toBeTruthy());

    // Switch to B - which is slow because taskA.destroy is pending
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

    // Immediately (synchronously), getPage, scale, page controls must be disabled/hidden because pdfDoc is null,
    // even though taskA is still in teardown (destroy is not resolved yet)
    expect(screen.queryByText(/Page 1 of 5/i)).toBeNull();

    // Back & forward buttons should show disabled state synchronously
    const backBtn = screen.getByRole("button", { name: "←" });
    expect((backBtn as HTMLButtonElement).disabled).toBe(true);

    // Resolve destroy & B to clean up
    taskA.destroyDeferred.resolve();
    taskB.taskDeferred.resolve({} as unknown as pdfjsLib.PDFDocumentProxy);
    taskB.destroyDeferred.resolve();

    unmount();
  });

  it("handles synchronous getDocument failures and normalizes them safely", async () => {
    vi.mocked(pdfjsLib.getDocument).mockImplementation(() => {
      throw new Error("Synch load error");
    });

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([99]),
        rawLog: "",
        errors: [],
        warnings: [],
        durationMs: 0,
      },
    });

    const { unmount } = render(<PdfViewer />);
    await waitFor(() => {
      expect(
        screen.getByText(/Error rendering PDF: Synch load error/i),
      ).toBeTruthy();
    });
    unmount();
  });

  it("normalizes rejection with custom types (string, null, non-Error objects)", async () => {
    const mock1 = createMockTask();
    const mock2 = createMockTask();
    const mock3 = createMockTask();

    let callCount = 0;
    vi.mocked(pdfjsLib.getDocument).mockImplementation(() => {
      callCount++;
      return callCount === 1
        ? mock1.task
        : callCount === 2
          ? mock2.task
          : mock3.task;
    });

    // 1. Rejection with string
    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([50]),
        rawLog: "",
        errors: [],
        warnings: [],
        durationMs: 0,
      },
    });
    const { unmount } = render(<PdfViewer />);
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1));
    act(() => mock1.taskDeferred.reject("Fail with custom string"));
    await waitFor(() => {
      expect(
        screen.getByText(/Error rendering PDF: Fail with custom string/i),
      ).toBeTruthy();
    });

    // 2. Rejection with null
    act(() => {
      useEditorStore.setState({
        compileResult: {
          success: true,
          pdfBytes: new Uint8Array([51]),
          rawLog: "",
          errors: [],
          warnings: [],
          durationMs: 0,
        },
      });
    });
    mock1.destroyDeferred.resolve();
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(2));
    act(() => mock2.taskDeferred.reject(null));
    await waitFor(() => {
      expect(
        screen.getByText(/Error rendering PDF: Unknown loading error/i),
      ).toBeTruthy();
    });

    // 3. Rejection with non-Error object
    act(() => {
      useEditorStore.setState({
        compileResult: {
          success: true,
          pdfBytes: new Uint8Array([52]),
          rawLog: "",
          errors: [],
          warnings: [],
          durationMs: 0,
        },
      });
    });
    mock2.destroyDeferred.resolve();
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(3));
    act(() => mock3.taskDeferred.reject({ reason: "custom_reason_obj" }));
    await waitFor(() => {
      expect(
        screen.getByText(/Error rendering PDF: \[object Object\]/i),
      ).toBeTruthy();
    });

    // Resolve deferreds
    mock3.destroyDeferred.resolve();
    unmount();
  });

  it("handles failure of loadingTask.destroy synchronously/asynchronously and log it without crashing", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const mock = createMockTask();
    mockPdfjsGetDocument(mock.task);

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
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1));

    mock.destroySpy.mockRejectedValueOnce(new Error("Destroy failed"));

    unmount();
    await new Promise((r) => setTimeout(r, 10)); // let promises settle
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "PDF load task destruction error",
      expect.any(Error),
    );
  });
});
