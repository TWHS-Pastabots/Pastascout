import { Route, Routes } from "react-router-dom";
import { StatusBar } from "./components/StatusBar";
import { RequireRole } from "./components/RequireRole";
import { RoleGate } from "./routes/RoleGate";
import { Settings } from "./routes/Settings";
import { ScoutHome } from "./routes/ScoutHome";
import { MatchScoutingForm } from "./routes/MatchScoutingForm";
import { PitScoutingTeamPicker } from "./routes/PitScoutingTeamPicker";
import { PitScoutingForm } from "./routes/PitScoutingForm";
import { AnalystLayout } from "./routes/AnalystLayout";
import { AnalystDashboard } from "./routes/AnalystDashboard";
import { AnalystPickList } from "./routes/AnalystPickList";
import { AnalystImport } from "./routes/AnalystImport";
import { AnalystJoin } from "./routes/AnalystJoin";
import { AnalystQrReceive } from "./routes/AnalystQrReceive";
import { useBackgroundSync } from "./lib/sync";

export default function App() {
  useBackgroundSync();

  return (
    <div className="min-h-screen bg-slate-950">
      <StatusBar />
      <Routes>
        <Route path="/" element={<RoleGate />} />
        <Route path="/settings" element={<Settings />} />

        <Route
          path="/scout"
          element={
            <RequireRole role="scout">
              <ScoutHome />
            </RequireRole>
          }
        />
        <Route
          path="/scout/match/:matchId/:teamNumber/:alliance"
          element={
            <RequireRole role="scout">
              <MatchScoutingForm />
            </RequireRole>
          }
        />
        <Route
          path="/scout/pit"
          element={
            <RequireRole role="scout">
              <PitScoutingTeamPicker />
            </RequireRole>
          }
        />
        <Route
          path="/scout/pit/:teamNumber"
          element={
            <RequireRole role="scout">
              <PitScoutingForm />
            </RequireRole>
          }
        />

        <Route
          path="/analyst"
          element={
            <RequireRole role="analyst">
              <AnalystLayout />
            </RequireRole>
          }
        >
          <Route index element={<AnalystDashboard />} />
          <Route path="pick-list" element={<AnalystPickList />} />
          <Route path="import" element={<AnalystImport />} />
          <Route path="join" element={<AnalystJoin />} />
          <Route path="receive" element={<AnalystQrReceive />} />
        </Route>
      </Routes>
    </div>
  );
}
