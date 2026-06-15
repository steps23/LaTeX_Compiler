import { render, screen, act } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

test("App renders correctly via Layout without crashing", async () => {
  await act(async () => {
    render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>,
    );
  });

  // App starts with NO project loaded, Dashboard is shown
  expect(
    await screen.findByRole("heading", { name: "Projects" }),
  ).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText(/Search projects.../i),
  ).toBeInTheDocument();
});
