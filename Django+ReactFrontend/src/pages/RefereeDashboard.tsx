import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardHero from "../components/DashboardHero";
import DashboardStats from "../components/DashboardStats";
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

type MonthlyEarningsSummary = {
  games_count: number;
  total_claim_amount: string;
  mileage_km_total: string;
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

export default function RefereeDashboard() {
  const { user } = useAuth();

  const [myGames, setMyGames] = useState<MyGame[]>([]);
  const [gamesError, setGamesError] = useState("");
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarningsSummary | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<"week" | "month" | "all">("all");

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setGamesError("");

        const token = getAccessToken();

        if (!token) {
          setMyGames([]);
          setMonthlyEarnings(null);
          return;
        }

        const [gamesResponse, earningsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/games/my-games/`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${API_BASE_URL}/expenses/earnings/?period=month`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (gamesResponse.status === 404) {
          setMyGames([]);
        } else {
          const gamesData = await gamesResponse.json();
          if (!gamesResponse.ok) {
            throw new Error(gamesData.detail || "Failed to load dashboard games.");
          }
          setMyGames(gamesData);
        }

        const earningsData = await earningsResponse.json();
        if (!earningsResponse.ok) {
          throw new Error(earningsData.detail || "Failed to load dashboard earnings.");
        }
        setMonthlyEarnings({
          games_count: earningsData.totals.games_count,
          total_claim_amount: earningsData.totals.total_claim_amount,
          mileage_km_total: earningsData.totals.mileage_km_total,
        });
      } catch (error) {
        setGamesError(
          error instanceof Error
            ? error.message
            : "Failed to load dashboard data."
        );
      }
    }

    loadDashboardData();
  }, []);

  const fullName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Referee";

  const displayGrade = user?.referee_profile?.grade?.replaceAll("_", " ") || "N/A";

  const allUpcomingGames = useMemo(() => {
    const now = new Date();

    const parseGameDate = (game: MyGame) => {
      const time = game.game_details.time || "00:00";
      const dateString = `${game.game_details.date}T${time}`;
      const parsedDate = new Date(dateString);
      if (isNaN(parsedDate.getTime())) {
        return null;
      }
      return parsedDate;
    };

    const validFutureGames = myGames
      .map((game) => ({
        game,
        gameDate: parseGameDate(game),
      }))
      .filter((item) => item.gameDate && item.gameDate >= now)
      .sort((a, b) => a.gameDate!.getTime() - b.gameDate!.getTime());

    return validFutureGames.map((item) => item.game);
  }, [myGames]);

  const filteredUpcomingGames = useMemo(() => {
    if (filterPeriod === "all") {
      return allUpcomingGames;
    }

    const now = new Date();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(now.getDate() + 7);
    weekFromNow.setHours(23, 59, 59, 999);

    const monthFromNow = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return allUpcomingGames.filter((game) => {
      const gameDate = new Date(`${game.game_details.date}T${game.game_details.time || "00:00"}`);
      if (isNaN(gameDate.getTime())) {
        return false;
      }

      if (filterPeriod === "week") {
        return gameDate >= now && gameDate <= weekFromNow;
      }

      if (filterPeriod === "month") {
        return gameDate >= now && gameDate <= monthFromNow;
      }

      return true;
    });
  }, [allUpcomingGames, filterPeriod]);

  const nextGame = allUpcomingGames.length > 0 ? allUpcomingGames[0] : null;
  const additionalUpcomingGames = useMemo(() => {
    if (!nextGame) {
      return filteredUpcomingGames.slice(0, 5);
    }

    return filteredUpcomingGames
      .filter((game) => game.id !== nextGame.id)
      .slice(0, 5);
  }, [filteredUpcomingGames, nextGame]);

  const stats = useMemo(
    () => [
      {
        label: "DOA Games This Month",
        value: String(monthlyEarnings?.games_count ?? 0),
      },
      {
        label: "This Month Claim",
        value: `EUR ${monthlyEarnings?.total_claim_amount ?? "0.00"}`,
      },
      {
        label: "Mileage This Month",
        value: `${monthlyEarnings?.mileage_km_total ?? "0.00"} km`,
      },
    ],
    [monthlyEarnings]
  );

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

      {allUpcomingGames.length > 0 ? (
        <div className="dashboard-upcoming-games">
          <div className="dashboard-games-header">
            <h2>Upcoming Games</h2>
            <div className="dashboard-filter-buttons">
              <button
                className={`filter-button ${filterPeriod === "all" ? "active" : ""}`}
                onClick={() => setFilterPeriod("all")}
              >
                All
              </button>
              <button
                className={`filter-button ${filterPeriod === "week" ? "active" : ""}`}
                onClick={() => setFilterPeriod("week")}
              >
                This Week
              </button>
              <button
                className={`filter-button ${filterPeriod === "month" ? "active" : ""}`}
                onClick={() => setFilterPeriod("month")}
              >
                This Month
              </button>
            </div>
          </div>
          {additionalUpcomingGames.length > 0 ? (
            <div className="dashboard-games-list">
              {additionalUpcomingGames.map((game, index) => {
                const home = game.game_details.home_team_name || "Home Team";
                const away = game.game_details.away_team_name || "Away Team";
                const isNext = !nextGame && index === 0;

                return (
                  <div key={game.id} className={`dashboard-game-card ${isNext ? "next-game" : ""}`}>
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
          ) : (
            <div className="dashboard-no-games-message">
              <p>No additional upcoming games for this period.</p>
            </div>
          )}
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
