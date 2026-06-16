import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { waitFor, render, act } from "@testing-library/react";
import { MonacoEditorRenderer } from "./MonacoEditor";
import { useEditorStore } from "../../state/store";

import * as monaco from "monaco-editor";

let mockEditorInstance: Record<string, ReturnType<typeof vi.fn>>;
let pathChangeCallback: (() => void) | null = null;
let currentPath: string | undefined;

function createMockViewState(id: string): monaco.editor.ICodeEditorViewState {
  return {
    cursorState: [],
    viewState: {
      firstPosition: { lineNumber: 1, column: 1 },
      firstPositionDeltaTop: 0,
      scrollLeft: 0,
    },
    contributionsState: { id },
  };
}

const mockDisposeOnChangeModel = vi.fn();
const mockDisposeCursor = vi.fn();
const mockDisposeScroll = vi.fn();

// Mock Monaco
vi.mock("@monaco-editor/react", async () => {
  const React = await import("react");

  const loader = {
    config: vi.fn(),
  };

  const Editor = ({
    onMount,
    path,
  }: {
    onMount?: (editor: unknown) => void;
    path: string;
    value?: string;
  }) => {
    // Simulate model changes when path prop changes
    React.useEffect(() => {
      if (path !== currentPath) {
        currentPath = path;
        if (pathChangeCallback) {
          pathChangeCallback();
        }
      }
    }, [path]);

    React.useEffect(() => {
      mockEditorInstance = {
        saveViewState: vi.fn().mockReturnValue(null), // Default
        restoreViewState: vi.fn(),
        revealLineInCenter: vi.fn(),
        setPosition: vi.fn(),
        setScrollTop: vi.fn(),
        focus: vi.fn(),
        onDidChangeModel: vi.fn().mockImplementation((cb) => {
          pathChangeCallback = cb;
          return { dispose: mockDisposeOnChangeModel };
        }),
        onDidChangeCursorPosition: vi
          .fn()
          .mockReturnValue({ dispose: mockDisposeCursor }),
        onDidScrollChange: vi
          .fn()
          .mockReturnValue({ dispose: mockDisposeScroll }),
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
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

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
    mockDisposeOnChangeModel.mockClear();
    mockDisposeCursor.mockClear();
    mockDisposeScroll.mockClear();
    pathChangeCallback = null;
    currentPath = undefined;

    originalCreateObjectURL = global.URL.createObjectURL;
    originalRevokeObjectURL = global.URL.revokeObjectURL;
  });

  afterEach(() => {
    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it("should test f1 -> f2 -> f1 view state restoration", () => {
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
      editorViewStates: {},
    });

    const { unmount } = render(<MonacoEditorRenderer />);

    const stateF1 = createMockViewState("stateF1");
    mockEditorInstance.saveViewState.mockReturnValue(stateF1);

    act(() => {
      useEditorStore.setState({ activeFileId: "f2" });
    });

    expect(useEditorStore.getState().editorViewStates.f1).toEqual(stateF1);

    const stateF2 = createMockViewState("stateF2");
    mockEditorInstance.saveViewState.mockReturnValue(stateF2);

    act(() => {
      useEditorStore.setState({ activeFileId: "f1" });
    });

    expect(useEditorStore.getState().editorViewStates.f2).toEqual(stateF2);
    expect(mockEditorInstance.restoreViewState).toHaveBeenCalledWith(stateF1);

    // Prepare state F1 to be saved again before traversing to F2
    mockEditorInstance.saveViewState.mockReturnValue(stateF1);

    act(() => {
      useEditorStore.setState({ activeFileId: "f2" });
    });

    expect(mockEditorInstance.restoreViewState).toHaveBeenCalledWith(stateF2);

    // Verify exactly what is left
    expect(useEditorStore.getState().editorViewStates.f1).toEqual(stateF1);
    expect(useEditorStore.getState().editorViewStates.f2).toEqual(stateF2);

    unmount();
  });

  it("should clean up Object URLs exactly once when files switch or unmount", async () => {
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
        {
          id: "text1",
          name: "1.tex",
          projectId: "p1",
          path: "1.tex",
          isFolder: false,
          updatedAt: 0,
          content: "text",
        },
      ],
      openFiles: ["f1", "text1"],
      activeFileId: "f1",
    });

    const { unmount, rerender } = render(<MonacoEditorRenderer />);

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledOnce();
    });

    // Rerender non-related should not trigger object url creation
    rerender(<MonacoEditorRenderer />);
    expect(createObjectURL).toHaveBeenCalledOnce();

    // Switch to text
    act(() => {
      useEditorStore.setState({ activeFileId: "text1" });
    });

    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:fakeurl");
      expect(revokeObjectURL).toHaveBeenCalledOnce();
    });

    // Switch back to blob
    act(() => {
      useEditorStore.setState({ activeFileId: "f1" });
    });

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledTimes(2);
    });

    unmount();

    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    });
  });

  it("should call dispose on listeners exactly once when unmounting", () => {
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

    unmount();

    expect(mockDisposeOnChangeModel).toHaveBeenCalledOnce();
    expect(mockDisposeCursor).toHaveBeenCalledOnce();
    expect(mockDisposeScroll).toHaveBeenCalledOnce();
  });
});
