import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardHero from "../components/DashboardHero";
import DashboardStats from "../components/DashboardStats";
import DashboardSectionCard from "../components/DashboardSectionCard";
import DashboardQuickActions from "../components/DashboardQuickActions";
import { getAccessToken } from "../services/auth";
import "../pages_css/RefereeDashboard.css";

type MyGame = {
  id: number;
  role: string;
  role_display: string;
  status: string;
  status_display: string;
  claimed_at: string | null;
  game_details: {
    id: number;
    game_type: string;
    game_type_display: string;
    date: string;
    time: string;
    venue_name: string | null;
    home_team_name: string | null;
    away_team_name: string | null;
    payment_type_display: string | null;
    division_name: string | null;
  };
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

export default function RefereeDashboard() {
  const { user } = useAuth();

  const [myGames, setMyGames] = useState<MyGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [gamesError, setGamesError] = useState("");

  useEffect(() => {
    async function loadMyGames() {
      try {
        setLoadingGames(true);
        setGamesError("");

        const token = getAccessToken();

        if (!token) {
          setMyGames([]);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/games/my-games/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 404) {
          setMyGames([]);
          setGamesError("");
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Failed to load dashboard games.");
        }

        setMyGames(data);
      } catch (error) {
        setGamesError(
          error instanceof Error
            ? error.message
            : "Failed to load dashboard games."
        );
      } finally {
        setLoadingGames(false);
      }
    }

    loadMyGames();
  }, []);

  const fullName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Referee";

  const displayGrade = user?.referee_profile?.grade?.replaceAll("_", " ") || "N/A";

  const upcomingGames = useMemo(() => {
    return [...myGames].sort((a, b) => {
      const aDate = new Date(`${a.game_details.date}T${a.game_details.time}`);
      const bDate = new Date(`${b.game_details.date}T${b.game_details.time}`);
      return aDate.getTime() - bDate.getTime();
    });
  }, [myGames]);

  const stats = useMemo(
    () => [
      {
        label: "My Games",
        value: String(myGames.length),
      },
      {
        label: "Current Grade",
        value: displayGrade,
      },
      {
        label: "Open Opportunities",
        value: "View Games",
      },
      {
        label: "This Month",
        value: "€0",
      },
    ],
    [myGames.length, displayGrade]
  );

  const recentActivity = useMemo(() => {
    if (myGames.length === 0) return [];
    return myGames.slice(0, 3).map((slot) => {
      const home = slot.game_details.home_team_name || "Home Team";
      const away = slot.game_details.away_team_name || "Away Team";
      return `You claimed ${slot.role_display} for ${home} vs ${away}.`;
    });
  }, [myGames]);

  return (
    <div className="dashboard-page">
      <DashboardHero
        name={fullName}
        grade={displayGrade}
        email={user?.email || ""}
      />

      <DashboardStats stats={stats} />

      <div className="dashboard-grid">
        <DashboardSectionCard
          title="Upcoming Games"
          emptyMessage={
            loadingGames
              ? "Loading your games..."
              : "No claimed games yet."
          }
        >
          {!loadingGames && !gamesError && upcomingGames.length > 0 ? (
            <div className="dashboard-list">
              {upcomingGames.map((slot) => {
                const home = slot.game_details.home_team_name || "Home Team";
                const away = slot.game_details.away_team_name || "Away Team";

                return (
                  <div key={slot.id} className="dashboard-list-item">
                    <div className="dashboard-list-item-main">
                      <h4>{home} vs {away}</h4>
                      <p>
                        {slot.game_details.date} • {slot.game_details.time} •{" "}
                        {slot.game_details.venue_name || "Venue TBC"}
                      </p>
                    </div>

                    <div className="dashboard-list-item-side">
                      <span className="dashboard-badge">
                        {slot.role_display}
                      </span>
                      {slot.game_details.game_type_display && (
                        <span className="dashboard-status">
                          {slot.game_details.game_type_display}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </DashboardSectionCard>

        <DashboardSectionCard
          title="Recent Activity"
          emptyMessage="No recent activity yet."
        >
          {recentActivity.length > 0 ? (
            <div className="dashboard-activity-list">
              {recentActivity.map((item, index) => (
                <div key={index} className="dashboard-activity-item">
                  {item}
                </div>
              ))}
            </div>
          ) : null}
        </DashboardSectionCard>
      </div>

      {gamesError && <p className="dashboard-error-message">{gamesError}</p>}

      <DashboardQuickActions />
    </div>
  );
}