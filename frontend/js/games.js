// Chatgpt Prompts used to assist the creation of this file:
// Prompt1: Create a simple JavaScript file to handle the referee dashboard functionalities.
// Prompt2: Use Fetch API to interact with a REST API for games, events, and referee profile.

// logged in referee ID for testing purposes
// In production, this should be dynamically set based on the logged-in user
// For now, we use a hardcoded value for testing
const REFEREE_ID = 5;

document.addEventListener("DOMContentLoaded", async () => {
    loadAvailableGames();
    loadEvents();
});


// ----------------------------------------
// AVAILABLE GAMES
// ----------------------------------------
async function loadAvailableGames() {
    const games = await apiGet("/games/");
    const container = document.getElementById("gamesList");

    if (!games || !games.length) {
        container.innerHTML = "<p>No available games right now.</p>";
        return;
    }

    // FINAL RULE:
    // ✔ Show only games where Umpire 1 is NOT assigned
    const available = games.filter(g => g.umpire1 === null);

    if (!available.length) {
        container.innerHTML = "<p>No available games right now.</p>";
        return;
    }

    container.innerHTML = available.map(g => `
        <div class="border rounded p-3 mb-2">
            <strong>Team:</strong> ${g.team_home?.name} vs ${g.team_away?.name}<br>
            <strong>Date/Time:</strong> ${g.date}, ${g.time}<br>
            <strong>Venue:</strong> ${g.location_name}<br>

            <br><strong>Referees:</strong><br>
            <strong>Crew Chief:</strong> ${g.crew_chief?.user?.first_name || "(empty)"} ${g.crew_chief?.user?.last_name || ""}<br>
            <strong>Umpire 1:</strong> ${g.umpire1?.user?.first_name || "(empty)"} ${g.umpire1?.user?.last_name || ""}<br>
            <strong>Umpire 2:</strong> ${g.umpire2?.user?.first_name || "(empty)"} ${g.umpire2?.user?.last_name || ""}<br><br>

            <button class="btn btn-success" onclick="takeGame(${g.id})">
                Take Game
            </button>
        </div>
    `).join("");

}



async function takeGame(id) {
    const res = await apiPost(`/games/${id}/take/`, { referee_id: REFEREE_ID });

    if (res.error) {
        alert(res.error);
        return;
    }

    alert("Game Taken!");
    loadAvailableGames();
}



// ----------------------------------------
// EVENTS
// ----------------------------------------
async function loadEvents() {
    const events = await apiGet("/events/");
    const container = document.getElementById("eventsList");

    if (!events.length) {
        container.innerHTML = "<p>No events available right now.</p>";
        return;
    }

    container.innerHTML = events.map(e => {

        const participants = e.participants || [];
        const confirmed = participants.filter(p => p.status === "confirmed");
        const waitlist = participants.filter(p => p.status === "waitlist");

        const isConfirmed = confirmed.some(p => p.referee?.id === REFEREE_ID);
        const isWaitlisted = waitlist.some(p => p.referee?.id === REFEREE_ID);

        const spotsLeft = e.referees_required - confirmed.length;

        return `
            <div class="border rounded p-3 mb-3">

                
                <strong>Name: </strong>${e.event_name}<br>
                <strong>Date: </strong> ${e.start_date} until ${e.end_date}<br>
                <strong>Payment: </strong> €${e.payment_amount}<br><br>

                <p><strong>Referees needed:</strong> ${e.referees_required}</p>
                <p><strong>Confirmed:</strong> ${confirmed.length}</p>
                <p><strong>Waitlist:</strong> ${waitlist.length}</p>
                <p><strong>Spots left:</strong> ${spotsLeft}</p>

                ${isConfirmed ? `
                    <p><strong>You are confirmed for this event.</strong></p>
                    <button class="btn btn-danger mt-2" onclick="leaveEvent(${e.id})">
                        Leave Event
                    </button>
                ` : isWaitlisted ? `
                    <button class="btn btn-danger mt-2" onclick="leaveEvent(${e.id})">
                        Leave Waitlist
                    </button>
                ` : `
                    <button class="btn btn-primary mt-2" onclick="joinEvent(${e.id})">
                        Join Event
                    </button>
                `}
            </div>
        `;
    }).join("");
}



// ----------------------------------------
// JOIN EVENT
// ----------------------------------------
async function joinEvent(eventId) {
    const res = await apiPost(`/events/${eventId}/join/`, {
        referee_id: REFEREE_ID
    });

    if (res.error) {
        alert(res.error);
    } else if (res.message) {
        alert(res.message);
    }

    loadEvents();
}



// ----------------------------------------
// LEAVE EVENT (ALSO AUTO-PROMOTES WAITLIST)
// ----------------------------------------
async function leaveEvent(eventId) {
    const res = await apiPost(`/events/${eventId}/leave/`, {
        referee_id: REFEREE_ID
    });

    if (res.error) {
        alert(res.error);
    } else if (res.message) {
        alert(res.message);
    }

    loadEvents();
}
