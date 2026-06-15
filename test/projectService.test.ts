import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProjectService } from "../src/services/ProjectService";
import { ProjectRepo, FileRepo } from "../src/db/repository";
import { Project, FileNode } from "../src/types";

// Mock the repository module
vi.mock("../src/db/repository", () => {
  let projects: Project[] = [];
  let files: FileNode[] = [];

  return {
    _resetMocks: () => {
      projects = [];
      files = [];
    },
    ProjectRepo: {
      getAll: vi.fn().mockImplementation(async () => projects),
      getById: vi
        .fn()
        .mockImplementation(async (id: string) =>
          projects.find((p) => p.id === id),
        ),
      save: vi.fn().mockImplementation(async (p: Project) => {
        projects = projects.filter((proj) => proj.id !== p.id);
        projects.push(p);
      }),
      delete: vi.fn().mockImplementation(async (id: string) => {
        projects = projects.filter((p) => p.id !== id);
      }),
    },
    FileRepo: {
      getByProjectId: vi
        .fn()
        .mockImplementation(async (id: string) =>
          files.filter((f) => f.projectId === id),
        ),
      save: vi.fn().mockImplementation(async (f: FileNode) => {
        files = files.filter((file) => file.id !== f.id);
        files.push(f);
      }),
    },
  };
});

// Import the _resetMocks
import * as RepoMock from "../src/db/repository";
const { _resetMocks } = RepoMock as any;

describe("ProjectService", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    if (_resetMocks) _resetMocks();
  });

  it("should get all projects sorted by update time", async () => {
    const time = Date.now();
    await ProjectRepo.save({
      id: "p1",
      name: "A",
      updatedAt: time - 1000,
    } as Project);
    await ProjectRepo.save({ id: "p2", name: "B", updatedAt: time } as Project);

    const projects = await ProjectService.getAllProjects();
    expect(projects.length).toBe(2);
    expect(projects[0].id).toBe("p2");
    expect(projects[1].id).toBe("p1");
  });

  it("should get projects with file stats", async () => {
    const time = Date.now();
    await ProjectRepo.save({ id: "p1", name: "A", updatedAt: time } as Project);

    await FileRepo.save({
      id: "f1",
      projectId: "p1",
      isDeleted: false,
    } as FileNode);
    await FileRepo.save({
      id: "f2",
      projectId: "p1",
      isDeleted: false,
    } as FileNode);
    await FileRepo.save({
      id: "f3",
      projectId: "p1",
      isDeleted: true,
    } as FileNode); // Soft deleted

    const projects = await ProjectService.getAllProjectsWithStats();
    expect(projects.length).toBe(1);
    expect(projects[0].fileCount).toBe(2); // Only counts non-deleted files
  });
});
