const REFEREE_ID = 1;

document.addEventListener("DOMContentLoaded", async () => {
    loadAvailableGames();
    loadEvents();
});

// AVAILABLE GAMES
async function loadAvailableGames() {
    const games = await apiGet("/games/");
    const container = document.getElementById("gamesList");

    container.innerHTML = games.map(g => `
        <div class="border rounded p-3 mb-2">
            <strong>${g.team_home?.name} vs ${g.team_away?.name}</strong><br>
            📅 ${g.date} - ⏰ ${g.time}<br>
            🏟 ${g.location_name}<br><br>

            <button class="btn btn-success" onclick="takeGame(${g.id})">
                Take Game
            </button>
        </div>
    `).join("");
}

async function takeGame(id) {
    await apiPost(`/games/${id}/take/`, { referee_id: REFEREE_ID });
    alert("Game Taken!");
    loadAvailableGames();
}

// EVENTS
async function loadEvents() {
    const events = await apiGet("/events/");
    const container = document.getElementById("eventsList");

    container.innerHTML = events.map(e => `
        <div class="border rounded p-3 mb-2">
            <strong>${e.event_name}</strong><br>
            📅 ${e.start_date} → ${e.end_date}<br>
            💰 €${e.payment_amount}
        </div>
    `).join("");
}
