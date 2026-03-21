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
  const [filterPeriod, setFilterPeriod] = useState<'week' | 'month' | 'all'>('all');

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

  const allUpcomingGames = useMemo(() => {
    const now = new Date();

    const parseGameDate = (game: MyGame) => {
      const time = game.game_details.time || "00:00";
      const dateString = `${game.game_details.date}T${time}`;
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      return date;
    };

    const validFutureGames = myGames
      .map((game) => ({
        game,
        gameDate: parseGameDate(game),
      }))
      .filter((item) => item.gameDate && item.gameDate >= now)
      .sort((a, b) => (a.gameDate!.getTime() - b.gameDate!.getTime()));

    return validFutureGames.map((item) => item.game);
  }, [myGames]);

  const filteredUpcomingGames = useMemo(() => {
    if (filterPeriod === 'all') return allUpcomingGames;

    const now = new Date();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(now.getDate() + 7);
    weekFromNow.setHours(23, 59, 59, 999);

    const monthFromNow = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return allUpcomingGames.filter((game) => {
      const time = game.game_details.time || "00:00";
      const gameDate = new Date(`${game.game_details.date}T${time}`);
      if (isNaN(gameDate.getTime())) return false;

      if (filterPeriod === 'week') {
        return gameDate >= now && gameDate <= weekFromNow;
      }

      if (filterPeriod === 'month') {
        return gameDate >= now && gameDate <= monthFromNow;
      }

      return true;
    });
  }, [allUpcomingGames, filterPeriod]);

  const allNextGame = allUpcomingGames.length > 0 ? allUpcomingGames[0] : null;
  const nextGame = allNextGame || (filteredUpcomingGames.length > 0 ? filteredUpcomingGames[0] : null);

  const stats = useMemo(
    () => [
      {
        label: "Games This Month",
        value: String(myGames.length),
      },
      {
        label: "This Month Earnings",
        value: "€0",
      },
    ],
    [myGames.length]
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

      {nextGame && (
        <section className="dashboard-upcoming-games">
          <h2>Next Game</h2>
          <div className="dashboard-games-list">
            <div className="dashboard-game-card">
              <div className="dashboard-game-main">
                <div className="dashboard-game-header">
                  <h3>{nextGame.game_details.home_team_name || "Home Team"} vs {nextGame.game_details.away_team_name || "Away Team"}</h3>
                </div>
                <div className="dashboard-game-details">
                  <div className="dashboard-game-info">
                    <span className="dashboard-game-date">{nextGame.game_details.date}</span>
                    <span className="dashboard-game-time">{nextGame.game_details.time}</span>
                  </div>
                  <div className="dashboard-game-meta">
                    <span className="dashboard-game-venue">{nextGame.game_details.venue_name || "Venue TBC"}</span>
                    <span className="dashboard-game-type">{nextGame.game_details.game_type_display || "Game"}</span>
                    {nextGame.game_details.division_name && <span className="dashboard-game-division">{nextGame.game_details.division_name}</span>}
                  </div>
                </div>
              </div>
              <div className="dashboard-game-side">
                <span className="dashboard-role-badge">{nextGame.role_display}</span>
                {nextGame.game_details.payment_type_display && <span className="dashboard-payment-badge">{nextGame.game_details.payment_type_display}</span>}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Upcoming Games */}
      {filteredUpcomingGames.length > 0 ? (
        <div className="dashboard-upcoming-games">
          <div className="dashboard-games-header">
            <h2>Upcoming Games</h2>
            <div className="dashboard-filter-buttons">
              <button
                className={`filter-button ${filterPeriod === 'all' ? 'active' : ''}`}
                onClick={() => setFilterPeriod('all')}
              >
                All
              </button>
              <button
                className={`filter-button ${filterPeriod === 'week' ? 'active' : ''}`}
                onClick={() => setFilterPeriod('week')}
              >
                This Week
              </button>
              <button
                className={`filter-button ${filterPeriod === 'month' ? 'active' : ''}`}
                onClick={() => setFilterPeriod('month')}
              >
                This Month
              </button>
            </div>
          </div>
          <div className="dashboard-games-list">
            {filteredUpcomingGames.slice(0, 5).map((game, index) => {
              const home = game.game_details.home_team_name || "Home Team";
              const away = game.game_details.away_team_name || "Away Team";
              const isNext = index === 0;

              return (
                <div key={game.id} className={`dashboard-game-card ${isNext ? 'next-game' : ''}`}>
                  <div className="dashboard-game-main">
                    <div className="dashboard-game-header">
                      <h3>{home} vs {away}</h3>
                      {isNext && <span className="next-badge">Next Game</span>}
                    </div>
                    <div className="dashboard-game-details">
                      <div className="dashboard-game-info">
                        <span className="dashboard-game-date">
                          {game.game_details.date}
                        </span>
                        <span className="dashboard-game-time">
                          {game.game_details.time}
                        </span>
                      </div>
                      <div className="dashboard-game-meta">
                        <span className="dashboard-game-venue">
                          {game.game_details.venue_name || "Venue TBC"}
                        </span>
                        <span className="dashboard-game-type">
                          {game.game_details.game_type_display || "Game"}
                        </span>
                        {game.game_details.division_name && (
                          <span className="dashboard-game-division">
                            {game.game_details.division_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="dashboard-game-side">
                    <span className="dashboard-role-badge">
                      {game.role_display}
                    </span>
                    {game.game_details.payment_type_display && (
                      <span className="dashboard-payment-badge">
                        {game.game_details.payment_type_display}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="dashboard-no-games-message">
          <p>No upcoming games found for the selected period.</p>
        </div>
      )}

      <DashboardQuickActions />

      {gamesError && <p className="dashboard-error-message">{gamesError}</p>}
    </div>
  );
}