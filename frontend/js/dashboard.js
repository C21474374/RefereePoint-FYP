const REFEREE_ID = 1;

document.addEventListener("DOMContentLoaded", () => {
    loadProfile();
    loadUpcomingGames();
    loadPastGames();
    loadCoverRequests();
    loadEvents();
    loadDropdowns();
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
    const allEvents = await apiGet(`/events/`);
    if (!allEvents) return;

    const mine = allEvents.filter(event =>
        event.participants?.some(p => p.referee?.id === REFEREE_ID)
    );

    renderEventList(mine);
}

async function loadDropdowns() {
    const teams = await apiGet("/shared/teams/");
    const categories = await apiGet("/shared/game_categories/");
    const competitions = await apiGet("/shared/competitions/");

    const homeSelect = document.getElementById("teamHome");
    const awaySelect = document.getElementById("teamAway");
    const categorySelect = document.getElementById("category");
    const competitionSelect = document.getElementById("competition");

    teams?.forEach(team => {
        homeSelect.innerHTML += `<option value="${team.id}">${team.name}</option>`;
        awaySelect.innerHTML += `<option value="${team.id}">${team.name}</option>`;
    });

    categories?.forEach(c => {
        if (!c.can_ref_cancel) return; // ⛔ hide categories where refs can't cancel
        categorySelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });

    competitions?.forEach(comp => {
        competitionSelect.innerHTML += `<option value="${comp.id}">${comp.name}</option>`;
    });
}


async function cancelGame(gameId) {
    const res = await apiPost(`/games/${gameId}/cancel_referee/`, {
        referee_id: REFEREE_ID
    });

    if (res.error) {
        alert(res.error);
    } else {
        alert("You have cancelled this game.");
    }

    // Refresh dashboard lists after cancellation
    loadUpcomingGames();
    loadPastGames();
}



function renderGameList(id, games) {
    const container = document.getElementById(id);

    if (!games || !games.length) {
        container.innerHTML = "No games.";
        return;
    }

    container.innerHTML = games.map(g => {
        let role = null;

        if (g.crew_chief?.id === REFEREE_ID) role = "Crew Chief";
        if (g.umpire1?.id === REFEREE_ID) role = "Umpire 1";
        if (g.umpire2?.id === REFEREE_ID) role = "Umpire 2";

        // Check cancellation rules
        const canCancel = g.category?.can_ref_cancel === true && role !== null;

        return `
        <div class="border rounded p-2 mb-2">
            <strong>${g.team_home?.name} vs ${g.team_away?.name}</strong><br>
            📅 ${g.date}, ${g.time}<br>
            🏟 ${g.location_name}<br>
            <span class="badge bg-primary mt-2">${role ?? "Not Assigned"}</span><br>

            ${canCancel ? `
                <button class="btn btn-danger btn-sm mt-2" onclick="cancelGame(${g.id})">
                    Cancel Game
                </button>
            ` : ``}
        </div>
        `;
    }).join("");
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

async function submitGame() {
    const data = {
        referee_id: REFEREE_ID,
        team_home: document.getElementById("teamHome").value,
        team_away: document.getElementById("teamAway").value,
        category: document.getElementById("category").value,
        competition: document.getElementById("competition").value,
        location_name: document.getElementById("locationName").value,
        date: document.getElementById("gameDate").value,
        time: document.getElementById("gameTime").value
    };

    // Basic validation
    for (const key in data) {
        if (!data[key]) {
            alert(`Missing field: ${key}`);
            return;
        }
    }

    const res = await apiPost("/games/upload/", data);

    if (res.error) {
        alert("Error: " + res.error);
        return;
    }

    alert("Game uploaded successfully!");

    // Refresh dashboards after upload
    loadUpcomingGames();
    loadPastGames();
}


