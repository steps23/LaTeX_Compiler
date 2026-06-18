/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Dashboard } from "./features/dashboard/Dashboard";
import { Layout } from "./components/Layout";

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<Dashboard />} />
          <Route path="/projects/:projectId" element={<Layout />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
