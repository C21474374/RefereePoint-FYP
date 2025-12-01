// Chatgpt Prompts used to assist the creation of this file:
// Prompt1: Create a simple JavaScript file to handle the referee dashboard functionalities.
// Prompt2: Use Fetch API to interact with a REST API for games, events, and referee profile.

// logged in referee ID for testing purposes
// In production, this should be dynamically set based on the logged-in user
// For now, we use a hardcoded value for testing
const REFEREE_ID = 5;

document.addEventListener("DOMContentLoaded", () => {
    loadProfile();
    loadUpcomingGames();
    loadPastGames();
    loadCoverRequests();
    loadEvents();
    loadDropdowns();
});

async function loadProfile() {
    const referee = await apiGet(`/shared/referees/${REFEREE_ID}/`);


    document.getElementById("profileCard").innerHTML = `
        <p><strong>Name:</strong> ${referee.user.first_name} ${referee.user.last_name}</p>
        <p><strong>Email:</strong> ${referee.user.email}</p>
        <p><strong>Grade:</strong> ${referee.grade}</p>
    `;
}

async function loadUpcomingGames() {
    const games = await apiGet(`/games/my_upcoming/?referee_id=${REFEREE_ID}`);
    renderGameList("upcomingGames", games);
}

async function loadPastGames() {
    const games = await apiGet(`/games/my_past/?referee_id=${REFEREE_ID}`);
    renderPastGameList("pastGames", games);
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

        const canCancel = g.category?.can_ref_cancel === true && role !== null;

        return `
        <div class="border rounded p-2 mb-2">
            <strong>Team:</strong> ${g.team_home?.name} vs ${g.team_away?.name}<br>
            <strong>Date/Time:</strong> ${g.date}, ${g.time}<br>
            <strong>Venue:</strong> ${g.location_name}<br>

            <br><strong>Referees:</strong><br>
            <strong>Crew Chief:</strong> ${g.crew_chief?.user?.first_name || "(empty)"} ${g.crew_chief?.user?.last_name || ""}<br>
            <strong>Umpire 1:</strong> ${g.umpire1?.user?.first_name || "(empty)"} ${g.umpire1?.user?.last_name || ""}<br>
            <strong>Umpire 2:</strong> ${g.umpire2?.user?.first_name || "(empty)"} ${g.umpire2?.user?.last_name || ""}<br><br>
            <button class="btn btn-primary btn-sm mt-2">
                    View more (Coming Soon)
            </button>
            ${canCancel ? `
                <button class="btn btn-danger btn-sm mt-2" onclick="cancelGame(${g.id})">
                    Cancel Game
                </button>
            ` : ``}
        </div>
        `;
    }).join("");
}

function renderPastGameList(id, games) {
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

        const canCancel = g.category?.can_ref_cancel === true && role !== null;

        return `
        <div class="border rounded p-2 mb-2">
            <strong>Team:</strong> ${g.team_home?.name} vs ${g.team_away?.name}<br>
            <strong>Date/Time:</strong> ${g.date}, ${g.time}<br>
            <strong>Venue:</strong> ${g.location_name}<br>

            <br><strong>Referees:</strong><br>
            <strong>Crew Chief:</strong> ${g.crew_chief?.user?.first_name || "(empty)"} ${g.crew_chief?.user?.last_name || ""}<br>
            <strong>Umpire 1:</strong> ${g.umpire1?.user?.first_name || "(empty)"} ${g.umpire1?.user?.last_name || ""}<br>
            <strong>Umpire 2:</strong> ${g.umpire2?.user?.first_name || "(empty)"} ${g.umpire2?.user?.last_name || ""}<br><br>
            <button class="btn btn-primary btn-sm mt-2">
                    View more (Coming Soon)
            </button>
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
            
            <strong>Name: </strong>${e.event_name}<br>
            <strong>Date: </strong> ${e.start_date} until ${e.end_date}<br>
            <strong>Payment: </strong> €${e.payment_amount}
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


