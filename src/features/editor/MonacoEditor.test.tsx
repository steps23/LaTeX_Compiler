import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor, render, act } from "@testing-library/react";
import { MonacoEditorRenderer } from "./MonacoEditor";
import { useEditorStore } from "../../state/store";

import * as monaco from "monaco-editor";

let mockEditorInstance: Record<string, ReturnType<typeof vi.fn>>;

function createMockViewState(): monaco.editor.ICodeEditorViewState {
  return {
    cursorState: [],
    viewState: {
      firstPosition: { lineNumber: 1, column: 1 },
      firstPositionDeltaTop: 0,
      scrollLeft: 0,
    },
    contributionsState: {},
  };
}

// Mock Monaco
vi.mock("@monaco-editor/react", async () => {
  const React = await import("react");

  const loader = {
    config: vi.fn(),
  };

  const Editor = ({
    onMount,
  }: {
    onMount?: (editor: unknown) => void;
    path: string;
    value?: string;
  }) => {
    // Monaco editor persists across file (path) changes
    React.useEffect(() => {
      mockEditorInstance = {
        saveViewState: vi.fn().mockReturnValue(null),
        restoreViewState: vi.fn(),
        revealLineInCenter: vi.fn(),
        setPosition: vi.fn(),
        setScrollTop: vi.fn(),
        focus: vi.fn(),
        onDidChangeModel: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onDidChangeCursorPosition: vi
          .fn()
          .mockReturnValue({ dispose: vi.fn() }),
        onDidScrollChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      };

      if (onMount) {
        onMount(mockEditorInstance);
      }
    }, [onMount]);

    return <div data-testid="mock-editor">Mock Editor</div>;
  };

  return { default: Editor, loader };
});

describe("MonacoEditorRenderer", () => {
  beforeEach(() => {
    useEditorStore.setState({
      files: [],
      openFiles: [],
      activeFileId: null,
      editorViewStates: {},
      activeLine: null,
      isCompiling: false,
      compileResult: null,
    });
    vi.clearAllMocks();
  });

  it("should clean up Object URLs when files switch or unmount", async () => {
    const revokeObjectURL = vi.fn();
    const createObjectURL = vi.fn().mockReturnValue("blob:fakeurl");
    global.URL.revokeObjectURL = revokeObjectURL;
    global.URL.createObjectURL = createObjectURL;

    useEditorStore.setState({
      files: [
        {
          id: "f1",
          name: "test.png",
          projectId: "p1",
          path: "test.png",
          isFolder: false,
          updatedAt: 0,
          blob: new Blob(["test"], { type: "image/png" }),
        },
      ],
      openFiles: ["f1"],
      activeFileId: "f1",
    });

    const { unmount } = render(<MonacoEditorRenderer />);
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalled();
    });

    act(() => {
      useEditorStore.setState({ activeFileId: null });
    });

    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:fakeurl");
    });

    unmount();
  });

  it("should associate and switch view states safely between files even if null", () => {
    useEditorStore.setState({
      files: [
        {
          id: "f1",
          name: "1.tex",
          projectId: "p",
          path: "1.tex",
          isFolder: false,
          updatedAt: 0,
          content: "",
        },
        {
          id: "f2",
          name: "2.tex",
          projectId: "p",
          path: "2.tex",
          isFolder: false,
          updatedAt: 0,
          content: "",
        },
      ],
      openFiles: ["f1", "f2"],
      activeFileId: "f1",
      editorViewStates: {
        f1: createMockViewState(),
      },
    });

    render(<MonacoEditorRenderer />);

    // f1 should have been restored
    expect(mockEditorInstance.restoreViewState).toHaveBeenCalled();
    const restoreCallArg = mockEditorInstance.restoreViewState.mock.calls[0][0];
    expect(restoreCallArg).toBeTruthy();

    const cursorListener =
      mockEditorInstance.onDidChangeCursorPosition.mock.calls[0][0];

    // Simulate save logic that returns null
    mockEditorInstance.saveViewState.mockReturnValue(null);
    act(() => {
      cursorListener();
    });

    // File switch
    act(() => {
      useEditorStore.setState({ activeFileId: "f2" });
    });

    expect(useEditorStore.getState().editorViewStates.f1).toBeNull();
  });

  it("should call dispose on listeners when unmounting", () => {
    useEditorStore.setState({
      files: [
        {
          id: "f1",
          name: "1.tex",
          projectId: "p",
          path: "1.tex",
          isFolder: false,
          updatedAt: 0,
          content: "",
        },
      ],
      openFiles: ["f1"],
      activeFileId: "f1",
    });

    const { unmount } = render(<MonacoEditorRenderer />);

    const cursorDispose =
      mockEditorInstance.onDidChangeCursorPosition.mock.results[0].value
        .dispose;
    const scrollDispose =
      mockEditorInstance.onDidScrollChange.mock.results[0].value.dispose;

    unmount();

    expect(cursorDispose).toHaveBeenCalled();
    expect(scrollDispose).toHaveBeenCalled();
  });
});
