import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Link } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

vi.mock("./features/dashboard/Dashboard", () => ({
  Dashboard: () => (
    <main>
      <h1>Projects</h1>
      <Link to="/projects/direct-project">Open editor</Link>
    </main>
  ),
}));

vi.mock("./components/Layout", () => ({
  Layout: () => (
    <main>
      <h1>Editor</h1>
      <Link to="/projects">Back to projects</Link>
    </main>
  ),
}));

describe("desktop hash routing", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/#/projects");
  });

  test("opens and refreshes a direct editor hash route", async () => {
    window.location.hash = "#/projects/direct-project";

    const view = render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Editor" }),
    ).toBeVisible();

    view.unmount();
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Editor" }),
    ).toBeVisible();
  });

  test("redirects an unknown route to the dashboard", async () => {
    window.location.hash = "#/not-a-route";
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Projects" }),
    ).toBeVisible();
    expect(window.location.hash).toBe("#/projects");
  });

  test("preserves back and forward navigation", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("link", { name: "Open editor" }));
    expect(
      await screen.findByRole("heading", { name: "Editor" }),
    ).toBeVisible();

    act(() => window.history.back());
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Projects" })).toBeVisible(),
    );

    act(() => window.history.forward());
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Editor" })).toBeVisible(),
    );
  });
});
