import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import JobsPage from "./components/JobsPage";
import ResumePage from "./components/ResumePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/resume" element={<ResumePage />} />
      <Route path="/jobs" element={<JobsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
