import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor, screen } from "@testing-library/react";
import { PdfViewer } from "./PdfViewer";
import { useEditorStore } from "../../state/store";
import * as pdfjsLib from "pdfjs-dist";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  settled: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeDeferreds: Array<Deferred<any>> = [];

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const deferred: Partial<Deferred<T>> = { settled: false };
  const promise = new Promise<T>((res, rej) => {
    resolve = (val) => {
      deferred.settled = true;
      res(val);
    };
    reject = (reason) => {
      deferred.settled = true;
      rej(reason);
    };
  });
  deferred.promise = promise;
  deferred.resolve = resolve;
  deferred.reject = reject;
  activeDeferreds.push(deferred as Deferred<T>);
  return deferred as Deferred<T>;
}

describe("PdfViewer", () => {
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    vi.clearAllMocks();
    activeDeferreds = [];
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi
      .fn()
      .mockReturnValue(
        {},
      ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(async () => {
    const promises = activeDeferreds.map((d) => d.promise.catch(() => {}));
    await Promise.allSettled(promises);

    const unsettled = activeDeferreds.filter((d) => !d.settled);
    activeDeferreds = [];
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.restoreAllMocks();

    if (unsettled.length > 0) {
      throw new Error(
        `Test failed: ${unsettled.length} Deferred objects remained unsettled.`,
      );
    }
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
    await waitFor(() => expect(mock.destroySpy).toHaveBeenCalledTimes(2));
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

  it("A -> B -> C Scenario 1: B is skipped completely before getDocument is called", async () => {
    const taskA = createMockTask();
    const taskB = createMockTask();
    const taskC = createMockTask();

    const getDocCalls: Array<{ data: Uint8Array }> = [];
    vi.mocked(pdfjsLib.getDocument).mockImplementation((params: unknown) => {
      getDocCalls.push(params as { data: Uint8Array });
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

    // Transition A -> B. A's destroy starts and is pending
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

    // Instantly queue C before A's destroy finishes
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

    // Resolve A's destroy so the serialization chain can progress
    taskA.destroyDeferred.resolve();

    // The second getDocument should be called for exactly C, and B must be completely skipped
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(2));

    // The bytes are C's bytes (102) rather than B's bytes
    expect(getDocCalls[1]).toEqual({ data: new Uint8Array([102]) });

    unmount();
  });

  it("A -> B -> C Scenario 2: B is initiated but completes after C, and B does not overwrite C", async () => {
    const taskA = createMockTask();
    const taskB = createMockTask();
    const taskC = createMockTask();

    const getDocCalls: Array<{ data: Uint8Array }> = [];
    vi.mocked(pdfjsLib.getDocument).mockImplementation((params: unknown) => {
      getDocCalls.push(params as { data: Uint8Array });
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

    // Resolve A
    mockPdfPageAndRender(taskA);
    act(() => taskA.resolveDoc(5));
    await waitFor(() => expect(screen.getByText(/Page 1 of 5/i)).toBeTruthy());

    // 1. Move A -> B
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

    // Resolve A's destroy to let loadDoc progress for B and call getDocument
    await waitFor(() => expect(taskA.destroySpy).toHaveBeenCalledTimes(1));
    taskA.destroyDeferred.resolve();

    // Verify task B has started loading
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(2));
    expect(getDocCalls[1]).toEqual({ data: new Uint8Array([101]) });

    // 2. Move B -> C before B's document loading resolves
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

    // Verify B's loading task is requested to destroy
    await waitFor(() => expect(taskB.destroySpy).toHaveBeenCalledTimes(1));
    taskB.destroyDeferred.resolve();

    // Verify C starts loading
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(3));
    expect(getDocCalls[2]).toEqual({ data: new Uint8Array([102]) });

    // 3. Resolve C first
    mockPdfPageAndRender(taskC);
    act(() => {
      taskC.resolveDoc(10);
    });

    // Check that C's page details are shown
    await waitFor(() => expect(screen.getByText(/Page 1 of 10/i)).toBeTruthy());

    // 4. Resolve B slow document load after C is already fully complete & shown
    const mockObsoleteDoc = {
      numPages: 77,
    };
    act(() => {
      taskB.taskDeferred.resolve(
        mockObsoleteDoc as unknown as pdfjsLib.PDFDocumentProxy,
      );
    });

    // Wait a tick to resolve microtasks
    await new Promise((r) => setTimeout(r, 10));

    // 5. Verify B's completion did NOT overwrite C's visible state attributes
    expect(screen.getByText(/Page 1 of 10/i)).toBeTruthy();
    expect(screen.queryByText(/Page 1 of 77/i)).toBeNull();

    // 6. Verify obsolete B task was requested to destroy
    // It was destroyed once when B->C happened, and then again when B resolves?
    // Actually, in PdfViewer.tsx, on B->C change, the cleanup function runs and calls currentResource?.loadingTask.destroy().
    // Wait, B was not activeResourceRef yet because it hadn't resolved!
    // NO. activeResourceRef is set *after* `await loadingTask.promise`.
    // So on B->C change, activeResourceRef is STILL A !
    expect(taskB.destroySpy).toHaveBeenCalledTimes(1);

    // 7. Unmount and verify exact destruction counts
    unmount();

    taskC.destroyDeferred.resolve();

    await waitFor(() => expect(taskC.destroySpy).toHaveBeenCalledTimes(1));
    expect(taskB.destroySpy).toHaveBeenCalledTimes(1);
    expect(taskA.destroySpy).toHaveBeenCalledTimes(1);
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

    // Immediately (synchronously), visible state derived values are hidden because pdfDoc is nullified
    expect(screen.queryByText(/Page 1 of 5/i)).toBeNull();

    // Back & forward buttons should show disabled state synchronously
    const backBtn = screen.getByRole("button", { name: "←" });
    expect((backBtn as HTMLButtonElement).disabled).toBe(true);

    // Resolve destroy & B to clean up
    taskA.destroyDeferred.resolve();
    taskB.taskDeferred.resolve({
      destroy: vi.fn().mockResolvedValue(undefined),
    } as unknown as pdfjsLib.PDFDocumentProxy);
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

  it("normalizes rejection with custom types (string, null, non-Error objects, circular objects)", async () => {
    const mock1 = createMockTask();
    const mock2 = createMockTask();
    const mock3 = createMockTask();
    const mock4 = createMockTask();

    let callCount = 0;
    vi.mocked(pdfjsLib.getDocument).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mock1.task;
      if (callCount === 2) return mock2.task;
      if (callCount === 3) return mock3.task;
      return mock4.task;
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
        screen.getByText(
          /Error rendering PDF: {"reason":"custom_reason_obj"}/i,
        ),
      ).toBeTruthy();
    });

    // 4. Rejection with circular structure
    act(() => {
      useEditorStore.setState({
        compileResult: {
          success: true,
          pdfBytes: new Uint8Array([53]),
          rawLog: "",
          errors: [],
          warnings: [],
          durationMs: 0,
        },
      });
    });
    mock3.destroyDeferred.resolve();
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(4));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const circ: any = {};
    circ.self = circ;
    act(() => mock4.taskDeferred.reject(circ));
    await waitFor(() => {
      expect(
        screen.getByText(/Error rendering PDF: Unknown loading error/i),
      ).toBeTruthy();
    });

    mock4.destroyDeferred.resolve();
    unmount();
  });

  it("handles failure of loadingTask.destroy synchronously/asynchronously and logs it without crashing", async () => {
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

  it("handles PDFDocumentProxy.destroy rejection safely without throwing", async () => {
    const mock = createMockTask();
    mockPdfjsGetDocument(mock.task);

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([200]),
        rawLog: "",
        errors: [],
        warnings: [],
        durationMs: 0,
      },
    });

    const { unmount } = render(<PdfViewer />);
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1));

    const mockDoc = {
      numPages: 1,
      getPage: vi.fn(),
      destroy: vi.fn().mockRejectedValue(new Error("Document destroy failed")),
    };
    act(() =>
      mock.taskDeferred.resolve(
        mockDoc as unknown as pdfjsLib.PDFDocumentProxy,
      ),
    );

    unmount();
    await waitFor(() => expect(mockDoc.destroy).toHaveBeenCalledTimes(1));
  });

  it("ensures an obsolete or unmounted document is destroyed exactly once", async () => {
    const mock = createMockTask();
    mockPdfjsGetDocument(mock.task);

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([201]),
        rawLog: "",
        errors: [],
        warnings: [],
        durationMs: 0,
      },
    });

    const { unmount } = render(<PdfViewer />);
    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1));

    const mockDoc = {
      numPages: 1,
      getPage: vi.fn(),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    unmount();
    act(() =>
      mock.taskDeferred.resolve(
        mockDoc as unknown as pdfjsLib.PDFDocumentProxy,
      ),
    );

    await waitFor(() => expect(mockDoc.destroy).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 10));
    expect(mockDoc.destroy).toHaveBeenCalledTimes(1);
  });

  it("handles renderTask.cancel throwing or promise rejecting during unmount safely", async () => {
    const mock = createMockTask();
    mockPdfjsGetDocument(mock.task);

    const renderCancelSpy = vi.fn().mockImplementation(() => {
      throw new Error("Cancel thrown synchronously");
    });
    // Ensure rejected promise is handled in catch block
    const renderPromise = Promise.reject(
      new Error("Promise rejected after cancel"),
    );
    renderPromise.catch(() => {});

    mock.getPageSpy.mockImplementation(() => {
      return Promise.resolve({
        getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
        render: vi.fn().mockReturnValue({
          promise: renderPromise,
          cancel: renderCancelSpy,
        }),
      });
    });

    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([202]),
        rawLog: "",
        errors: [],
        warnings: [],
        durationMs: 0,
      },
    });

    const { unmount } = render(<PdfViewer />);
    act(() => mock.resolveDoc());
    await waitFor(() => expect(mock.getPageSpy).toHaveBeenCalledTimes(1));

    unmount();

    await waitFor(() => expect(renderCancelSpy).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 10));
  });

  it("prevents concurrent renders on canvas & handles byte change with ongoing render safely", async () => {
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

    const renderPromA = createDeferred<void>();
    const renderCancelA = vi.fn();
    taskA.getPageSpy.mockImplementation(() => {
      return Promise.resolve({
        getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
        render: vi.fn().mockReturnValue({
          promise: renderPromA.promise,
          cancel: renderCancelA,
        }),
      });
    });

    act(() => taskA.resolveDoc(3));
    await waitFor(() => expect(taskA.getPageSpy).toHaveBeenCalledTimes(1));

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

    await waitFor(() => expect(renderCancelA).toHaveBeenCalledTimes(1));

    renderPromA.resolve();
    taskA.destroyDeferred.resolve();

    await waitFor(() => expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(2));

    unmount();
  });
});
