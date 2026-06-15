import { ProjectRepo, FileRepo } from "../db/repository";
import { Project } from "../types";
import { sortProjectsByRecent } from "../utils/projects";

export type ProjectWithStats = Project & { fileCount: number };

export const ProjectService = {
  async getAllProjects(): Promise<Project[]> {
    const projects = await ProjectRepo.getAll();
    return sortProjectsByRecent(projects);
  },

  async getAllProjectsWithStats(): Promise<ProjectWithStats[]> {
    const projects = await ProjectRepo.getAll();
    const sorted = sortProjectsByRecent(projects);
    const withStats = await Promise.all(
      sorted.map(async (p) => {
        const files = await FileRepo.getByProjectId(p.id);
        return { ...p, fileCount: files.filter((f) => !f.isDeleted).length };
      }),
    );
    return withStats;
  },

  async getProject(id: string): Promise<Project | undefined> {
    return await ProjectRepo.getById(id);
  },

  async saveProject(project: Project): Promise<void> {
    project.updatedAt = Date.now();
    await ProjectRepo.save(project);
  },

  async deleteProject(id: string): Promise<void> {
    await ProjectRepo.delete(id);
  },

  async touchProject(id: string): Promise<void> {
    const p = await ProjectRepo.getById(id);
    if (p) {
      p.updatedAt = Date.now();
      await ProjectRepo.save(p);
    }
  },
};
