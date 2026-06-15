import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor, render } from "@testing-library/react";
import { PdfViewer } from "./PdfViewer";
import { useEditorStore } from "../../state/store";
import { act } from "react";

const { mockGetDoc, mockDestroy, mockCancel, getPageRequested } =
  vi.hoisted(() => {
    const destroy = vi.fn().mockResolvedValue(true);
    let pageRequested = false;
    const cancel = vi.fn();
    let renderResolve: any = null;
    return {
      mockDestroy: destroy,
      mockCancel: cancel,
      getPageRequested: () => pageRequested,
      mockRenderTaskPromise: new Promise((resolve) => {
        renderResolve = resolve;
      }),
      resolveRender: () => renderResolve?.(),
      mockGetDoc: vi.fn().mockReturnValue({
        promise: Promise.resolve({
          numPages: 1,
          destroy: destroy,
          getPage: vi.fn().mockImplementation(() => {
            pageRequested = true;
            return Promise.resolve({
              getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
              render: vi.fn().mockReturnValue({
                promise: new Promise((r) => setTimeout(r, 1000)),
                cancel: cancel,
              }),
            });
          }),
        }),
        destroy: destroy,
      }),
    };
  });

vi.mock("pdfjs-dist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pdfjs-dist")>();
  return {
    ...actual,
    getDocument: mockGetDoc,
  };
});

describe("PdfViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({});
  });

  it("cleans up resources and respects unmount properly", async () => {
    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([1, 2, 3]),
      },
    });

    const { unmount } = render(<PdfViewer />);
    unmount();

    await waitFor(() => {
      expect(mockDestroy).toHaveBeenCalled();
    });
  });

  it("handles render task cancellation if component unmounts mid-render", async () => {
    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([4, 5, 6]),
      },
    });

    const { unmount } = render(<PdfViewer />);

    // Wait until document is loaded and getPage is requested
    await waitFor(() => {
      expect(getPageRequested()).toBe(true);
    });

    // Unmount before rendering completes
    unmount();

    await waitFor(() => {
      // When it unmounts during the process, it should attempt to cancel the render
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  it("destroys document from pending promise if unmounted early", async () => {
     let resolvePromise: any;
     const slowPromise = new Promise(resolve => {
        resolvePromise = resolve;
     });

     const slowGetDoc = vi.fn().mockReturnValue({
       promise: slowPromise,
       destroy: mockDestroy
     });

     mockGetDoc.mockImplementationOnce(slowGetDoc);

     useEditorStore.setState({
       compileResult: {
         success: true,
         pdfBytes: new Uint8Array([7, 8, 9]),
       },
     });

     const { unmount } = render(<PdfViewer />);
     
     // Unmount before promise resolves
     unmount();
     
     // Resolve late
     resolvePromise({
        numPages: 1,
        destroy: mockDestroy,
     });

     await waitFor(() => {
        expect(mockDestroy).toHaveBeenCalled(); // The doc.destroy() branch inside .then() should be hit
     });
  });
});
