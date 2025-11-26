const REFEREE_ID = 1;

document.addEventListener("DOMContentLoaded", () => {
    loadProfile();
    loadUpcomingGames();
    loadPastGames();
    loadCoverRequests();
    loadEvents();
});

function loadProfile() {
    document.getElementById("profileCard").innerHTML = `
        <p><strong>Referee ID:</strong> ${REFEREE_ID}</p>
        <p>Profile features coming in next iteration.</p>
    `;
}

async function loadUpcomingGames() {
    const games = await apiGet(`/games/my_upcoming/?referee_id=${REFEREE_ID}`);
    renderGameList("upcomingGames", games);
}

async function loadPastGames() {
    const games = await apiGet(`/games/my_past/?referee_id=${REFEREE_ID}`);
    renderGameList("pastGames", games);
}

async function loadCoverRequests() {
    const data = await apiGet(`/cover_requests/`);
    const mine = data?.filter(r => r?.referee?.id === REFEREE_ID) || [];
    renderCoverList(mine);
}

async function loadEvents() {
    const events = await apiGet(`/events/`);
    renderEventList(events || []);
}

function renderGameList(id, games) {
    const container = document.getElementById(id);
    if (!games || !games.length) {
        container.innerHTML = "No games.";
        return;
    }
    container.innerHTML = games.map(g => `
        <div class="border rounded p-2 mb-2">
            <strong>${g.team_home?.name} vs ${g.team_away?.name}</strong><br>
            📅 ${g.date}, ${g.time}<br>
            🏟 ${g.location_name}
        </div>
    `).join("");
}

function renderCoverList(list) {
    const container = document.getElementById("coverRequests");
    if (!list || !list.length) {
        container.innerHTML = "No cover requests.";
        return;
    }
    container.innerHTML = list.map(c => `
        <div class="border rounded p-2 mb-2">
            Game ID: ${c.game}<br>
            Status: ${c.status}
        </div>
    `).join("");
}

function renderEventList(events) {
    const container = document.getElementById("eventsList");
    if (!events || !events.length) {
        container.innerHTML = "No events available.";
        return;
    }
    container.innerHTML = events.map(e => `
        <div class="border rounded p-2 mb-2">
            <strong>${e.event_name}</strong><br>
            📅 ${e.start_date} → ${e.end_date}<br>
            💰 €${e.payment_amount}
        </div>
    `).join("");
}
