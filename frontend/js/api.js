// Chatgpt Prompts used to assist the creation of this file:
// Prompt1: Create a simple JavaScript API module to handle GET and POST requests to a REST API.
// Prompt2: Use Fetch API for making requests and handle JSON responses.
// Prompt3: Implement error handling for network requests.


const API_BASE = "http://127.0.0.1:8000/api";

async function apiGet(endpoint) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        return await res.json();
    } catch (err) {
        console.error("GET error:", err);
        return null;
    }
}

async function apiPost(endpoint, data) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (err) {
        console.error("POST error:", err);
        return null;
    }
}
