import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NativeFileRepo, NativeProjectRepo } from "./nativeRepository";
import type { FileNode, Project } from "../types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

const project: Project = {
  id: "project-1",
  name: "Native Project",
  createdAt: 1,
  updatedAt: 2,
  mainFilePath: "main.tex",
  storageMode: "local",
  syncStatus: "local-only",
  settings: {
    compiler: "http-fallback",
    autoCompile: false,
    autoCompileDelayMs: 2000,
    fontSize: 14,
  },
};

describe("native repository adapter", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  test("maps project repository calls to versioned Tauri commands", async () => {
    invokeMock.mockResolvedValueOnce([project]);
    await expect(NativeProjectRepo.getAll()).resolves.toEqual([project]);
    expect(invokeMock).toHaveBeenCalledWith("get_all_projects");

    invokeMock.mockResolvedValueOnce(project);
    await expect(NativeProjectRepo.getById(project.id)).resolves.toEqual(
      project,
    );
    expect(invokeMock).toHaveBeenCalledWith("get_project", { id: project.id });

    await NativeProjectRepo.save(project);
    expect(invokeMock).toHaveBeenCalledWith("save_project", { project });

    await NativeProjectRepo.delete(project.id);
    expect(invokeMock).toHaveBeenCalledWith("delete_project", {
      id: project.id,
    });
  });

  test("serializes binary blobs for native file storage", async () => {
    const file: FileNode = {
      id: "file-1",
      projectId: project.id,
      path: "assets/logo.bin",
      name: "logo.bin",
      isFolder: false,
      blob: new Blob([new Uint8Array([1, 2, 3])]),
      updatedAt: 1,
      isDeleted: false,
      syncStatus: "local-only",
    };

    await NativeFileRepo.save(file);
    expect(invokeMock).toHaveBeenCalledWith("save_file", {
      file: expect.objectContaining({
        id: "file-1",
        binaryBytes: [1, 2, 3],
      }),
    });
  });

  test("hydrates native binary payloads back to blobs", async () => {
    invokeMock.mockResolvedValueOnce([
      {
        id: "file-1",
        projectId: project.id,
        path: "assets/logo.bin",
        name: "logo.bin",
        isFolder: false,
        binaryBytes: [1, 2, 3],
        updatedAt: 1,
        isDeleted: false,
        syncStatus: "local-only",
      },
    ]);

    const files = await NativeFileRepo.getByProjectId(project.id);
    expect(files[0].blob).toBeInstanceOf(Blob);
    await expect(files[0].blob?.arrayBuffer()).resolves.toEqual(
      new Uint8Array([1, 2, 3]).buffer,
    );
  });
});
