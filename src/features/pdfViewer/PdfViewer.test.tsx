import { describe, it, expect, vi } from "vitest";
import { waitFor, render } from "@testing-library/react";
import { PdfViewer } from "./PdfViewer";
import { useEditorStore } from "../../state/store";

const { mockGetDoc, mockDestroy } = vi.hoisted(() => {
  const destroy = vi.fn().mockResolvedValue(true);
  return {
    mockDestroy: destroy,
    mockGetDoc: vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        destroy: destroy,
        getPage: vi.fn(),
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
  it("cleans up resources and respects unmount properly", async () => {
    useEditorStore.setState({
      compileResult: {
        success: true,
        pdfBytes: new Uint8Array([1, 2, 3]),
      },
    });

    const { unmount } = render(<PdfViewer />);
    unmount();

    // Since we unmounted immediately, loadingTask.destroy should have been called
    await waitFor(() => {
      expect(mockDestroy).toHaveBeenCalled();
    });
  });
});
