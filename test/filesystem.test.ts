import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "../src/state/store";
import { importProjectZip } from "../src/utils/projects";
import JSZip from "jszip";

describe("File System Operations", () => {
  beforeEach(async () => {
    // Clear the fake indexedDb by clearing DB
    const req = window.indexedDB.deleteDatabase("texforge");
    await new Promise((resolve) => {
      req.onsuccess = resolve;
      req.onerror = resolve;
    });

    useEditorStore.setState({
      currentProject: null,
      projects: [],
      files: [],
      openFiles: [],
      activeFileId: null,
    });
  });

  it("should create folders and files hierarchically", async () => {
    const store = useEditorStore.getState();
    const projectId = await store.createEmptyProject(
      "Test Project",
      "empty",
      "main.tex",
    );
    await store.openProject(projectId);

    // Initial files
    expect(useEditorStore.getState().files.length).toBe(1); // main.tex

    // Create a folder
    await useEditorStore.getState().createFile("src", true, "");
    expect(
      useEditorStore
        .getState()
        .files.find((f) => f.path === "src" && f.isFolder),
    ).toBeDefined();

    // Create a file inside folder
    await useEditorStore
      .getState()
      .createFile("data.txt", false, "src", "dummy");
    expect(
      useEditorStore.getState().files.find((f) => f.path === "src/data.txt"),
    ).toBeDefined();
  });

  it("should prevent duplicate files in the same location", async () => {
    const store = useEditorStore.getState();
    const projectId = await store.createEmptyProject(
      "Test Project",
      "empty",
      "main.tex",
    );
    await store.openProject(projectId);

    await useEditorStore.getState().createFile("main.tex", false, "");
    expect(
      useEditorStore.getState().files.filter((f) => f.path === "main.tex")
        .length,
    ).toBe(1);
  });

  it("should rename file correctly without affecting others", async () => {
    const store = useEditorStore.getState();
    const projectId = await store.createEmptyProject(
      "Test Project",
      "empty",
      "main.tex",
    );
    await store.openProject(projectId);

    const mainFile = useEditorStore.getState().files[0];
    await useEditorStore.getState().renameFileNode(mainFile.id, "newmain.tex");

    expect(useEditorStore.getState().files[0].path).toBe("newmain.tex");
    expect(useEditorStore.getState().currentProject?.mainFilePath).toBe(
      "newmain.tex",
    );
  });

  it("should recursively delete a folder and all its contents", async () => {
    const store = useEditorStore.getState();
    const projectId = await store.createEmptyProject(
      "Test P",
      "empty",
      "main.tex",
    );
    await store.openProject(projectId);

    await useEditorStore.getState().createFile("assets", true, "");
    await useEditorStore.getState().createFile("logo.png", false, "assets");
    await useEditorStore.getState().createFile("sub", true, "assets");
    await useEditorStore.getState().createFile("text.txt", false, "assets/sub");

    expect(useEditorStore.getState().files.length).toBe(5); // main.tex, assets, logo.png, sub, text.txt

    const folder = useEditorStore
      .getState()
      .files.find((f) => f.path === "assets");
    await useEditorStore.getState().deleteFile(folder!.id);

    expect(useEditorStore.getState().files.length).toBe(1);
    expect(useEditorStore.getState().files[0].path).toBe("main.tex");
  });

  it("should move a file or folder into another folder", async () => {
    const store = useEditorStore.getState();
    const projectId = await store.createEmptyProject(
      "Test P",
      "empty",
      "main.tex",
    );
    await store.openProject(projectId);

    await useEditorStore.getState().createFile("folder1", true, "");
    await useEditorStore.getState().createFile("file1.tex", false, "folder1");
    await useEditorStore.getState().createFile("folder2", true, "");

    const file1 = useEditorStore
      .getState()
      .files.find((f) => f.name === "file1.tex");
    await useEditorStore.getState().moveFileNode(file1!.id, "folder2");

    expect(
      useEditorStore.getState().files.find((f) => f.id === file1!.id)!.path,
    ).toBe("folder2/file1.tex");
  });

  it("should handle ZIP import correctly", async () => {
    const zip = new JSZip();
    zip.file("main.tex", "hello world");
    zip.file("folder/sub.tex", "sub content");

    const blob = await zip.generateAsync({ type: "blob" });
    const file = new File([blob], "testproj.zip", { type: "application/zip" });

    const projectId = await importProjectZip(file);
    await useEditorStore.getState().openProject(projectId);

    const files = useEditorStore.getState().files;
    expect(files.some((f) => f.path === "main.tex" && !f.isFolder)).toBe(true);
    // Project import dynamically creates folders
    expect(files.some((f) => f.path === "folder" && f.isFolder)).toBe(true);
    expect(files.some((f) => f.path === "folder/sub.tex" && !f.isFolder)).toBe(
      true,
    );
  });
});
