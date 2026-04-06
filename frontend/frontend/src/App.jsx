import { useState, useEffect } from "react";

import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import Footer from "./components/Footer";
import { useAuth } from "./context/AuthContext";

import DashboardPage from "./pages/DashboardPage";
import ProjectsPage from "./pages/projects";
import CreateProjectPage from "./pages/CreateProjectPage";
import ProjectPage from "./pages/ProjectPage";
import CreateEpisodePage from "./pages/CreateEpisodePage";
import EpisodeWorkspace from "./pages/EpisodeWorkspace";
import SingleSentencePage from "./pages/SingleSentencePage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import LoginPage from "./pages/LoginPage";
import Reports from "./components/Reports";
import CharactersPage from "./pages/Characters";
import TrashPage from "./pages/TrashPage";

/** CreateProject returns a full project object; Open passes a numeric id. */
function projectIdFromOpenPayload(payload) {
  if (payload == null) return null;
  if (typeof payload === "number" && Number.isFinite(payload)) return payload;
  if (typeof payload === "object" && payload.id != null) {
    const n = Number(payload.id);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(payload);
  return Number.isFinite(n) ? n : null;
}

function App() {
  const { user, loading, logout } = useAuth();
  const [activeMenu, setActiveMenu] = useState("projects");
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeEpisodeId, setActiveEpisodeId] = useState(null);
  const [headerSearchQuery, setHeaderSearchQuery] = useState("");

  const searchInScope = ["projects", "project", "episode"].includes(activeMenu);

  useEffect(() => {
    if (!["projects", "project", "episode"].includes(activeMenu)) {
      setHeaderSearchQuery("");
    }
  }, [activeMenu]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F4F7FA",
          color: "#64748B",
          fontSize: "0.95rem",
        }}
      >
        Loading workspace…
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (

    <div
      style={{
        height: "100vh",
        minHeight: "100vh",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "#F4F7FA",
      }}
    >

      <Header
        onOpenProfile={() => setActiveMenu("profile")}
        onOpenSettings={() => setActiveMenu("settings")}
        onLogout={logout}
        searchQuery={headerSearchQuery}
        onSearchChange={setHeaderSearchQuery}
        searchPlaceholder={
          activeMenu === "projects"
            ? "Search projects by name, language, category…"
            : activeMenu === "project"
              ? "Search episodes by title or number…"
              : activeMenu === "episode"
                ? "Search lines (character, Turkish, Arabic)…"
                : "Search is available on Projects, a project, or an episode workspace"
        }
        searchDisabled={!searchInScope}
      />

      <div
        style={{
          display: "flex",
          flex: 1,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
          background: "#F4F7FA",
        }}
      >

        <Sidebar
          active={activeMenu}
          onSelectMenu={(menu) => {
            if (menu === "projects" || menu === "trash") {
              setActiveEpisodeId(null);
            }
            setActiveMenu(menu);
          }}
        />

        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            padding: "32px",
            background: "#F4F7FA",
            maxWidth: "100%",
            boxSizing: "border-box",
            overflowX: "hidden",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >

          <div
            style={{
              maxWidth: "1600px",
              width: "100%",
              margin: "0 auto",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >

            {/* DASHBOARD */}

            {activeMenu==="dashboard" && (

              <DashboardPage
                onCreateProject={()=>setActiveMenu("projects")}
                onOpenProjects={()=>setActiveMenu("projects")}
                onTranslateSingle={()=>setActiveMenu("single")}
              />

            )}

            {/* PROJECT LIST */}

            {activeMenu==="projects" && (

              <ProjectsPage
                headerSearchQuery={headerSearchQuery}
                onOpenProject={(rawId) => {
                  const id = projectIdFromOpenPayload(rawId);
                  if (id == null) return;
                  setActiveEpisodeId(null);
                  setActiveProjectId(id);
                  setActiveMenu("project");
                }}
              />

            )}

            {/* CREATE PROJECT */}

            {activeMenu==="create-project" && (

              <CreateProjectPage
                onDone={(projectId)=>{

                  setActiveProjectId(projectId);
                  setActiveMenu("project");

                }}
              />

            )}

            {/* PROJECT PAGE */}

            {activeMenu==="project" && activeProjectId && (

              <ProjectPage
                projectId={activeProjectId}
                headerSearchQuery={headerSearchQuery}
                onBackToProjects={() => {
                  setActiveEpisodeId(null);
                  setActiveMenu("projects");
                }}
                onOpenCharacters={()=>{

                  setActiveMenu("characters");

                }}

                onOpenEpisode={(episodeId)=>{

                  setActiveEpisodeId(episodeId);
                  setActiveMenu("episode");

                }}

                onCreateEpisode={()=>{

                  setActiveMenu("create-episode");

                }}

              />

            )}

            {/* CHARACTERS */}

            {activeMenu==="characters" && activeProjectId && (

              <CharactersPage
                projectId={activeProjectId}
                onBack={() => setActiveMenu("project")}
                onNext={()=>{

                  setActiveMenu("project");

                }}

              />

            )}

            {/* CREATE EPISODE */}

            {activeMenu==="create-episode" && activeProjectId && (

              <CreateEpisodePage
                projectId={activeProjectId}

                onCreate={(episode)=>{

                  setActiveEpisodeId(episode.id);
                  setActiveMenu("episode");

                }}

                onCancel={()=>{

                  setActiveMenu("project");

                }}

              />

            )}

            {/* EPISODE WORKSPACE */}

            {activeMenu==="episode" && activeEpisodeId && (

              <EpisodeWorkspace
                projectId={activeProjectId}
                episodeId={activeEpisodeId}
                episodeName="Episode 12"
                headerSearchQuery={headerSearchQuery}

                onBack={()=>{

                  setActiveMenu("project");

                }}

              />

            )}

            {/* SINGLE SENTENCE */}

            {activeMenu==="single" && (

              <SingleSentencePage />

            )}

            {/* REPORTS */}

            {activeMenu==="reports" && (

              <Reports />

            )}

            {/* SETTINGS */}

            {activeMenu==="settings" && (

              <SettingsPage />

            )}

            {/* TRASH */}

            {activeMenu === "trash" && (
              <TrashPage onOpenProjects={() => setActiveMenu("projects")} />
            )}

            {/* PROFILE */}

            {activeMenu === "profile" && <ProfilePage />}

          </div>

        </main>

      </div>

      <Footer />

    </div>

  );

}

export default App;