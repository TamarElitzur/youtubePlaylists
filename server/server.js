// server/server.js

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Parse JSON bodies
app.use(express.json());

// Serve static files from ../public
app.use(express.static(path.join(__dirname, "..", "public")));

// ----- Data files (users + playlists) -----

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PLAYLISTS_FILE = path.join(DATA_DIR, "playlists.json");

// Make sure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Make sure users.json exists
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, "[]", "utf8");
}

// Make sure playlists.json exists
if (!fs.existsSync(PLAYLISTS_FILE)) {
  fs.writeFileSync(PLAYLISTS_FILE, "{}", "utf8");
}

// Helper to read JSON safely
function readJson(filePath, fallback) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    if (!text.trim()) return fallback;
    return JSON.parse(text);
  } catch (err) {
    console.error(`Error reading JSON from ${filePath}`, err);
    return fallback;
  }
}

// Helper to write JSON safely
function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error(`Error writing JSON to ${filePath}`, err);
  }
}

// ----- Playlists helpers -----

function readAllPlaylists() {
  // Structure in file:
  // {
  //   "username1": {
  //      "Favorites": [ { videoId, title, thumbnail, rating, type, filePath }, ... ],
  //      "Chill": [ ... ]
  //   },
  //   "username2": { ... }
  // }
  return readJson(PLAYLISTS_FILE, {});
}

function writeAllPlaylists(all) {
  writeJson(PLAYLISTS_FILE, all);
}

function getUserPlaylists(username) {
  const all = readAllPlaylists();
  const userPlaylists = all[username] || {};
  // Ensure "Favorites" playlist always exists
  if (!userPlaylists.Favorites) {
    userPlaylists.Favorites = [];
  }
  all[username] = userPlaylists;
  writeAllPlaylists(all);
  return userPlaylists;
}


// ----- Auth: Register -----

app.post("/api/register", (req, res) => {
  console.log("POST /api/register", req.body);

  const { username, password, firstName, imageUrl } = req.body || {};

  if (!username || !password || !firstName || !imageUrl) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  // Load existing users
  const users = readJson(USERS_FILE, []);

  // Check if username already exists
  const existing = users.find((u) => u.username === username);
  if (existing) {
    return res
      .status(409)
      .json({ error: "Username already exists. Please choose another one." });
  }

  const newUser = { username, password, firstName, imageUrl };
  users.push(newUser);
  writeJson(USERS_FILE, users);

  return res.status(201).json({
    message: "Registration successful",
    user: { username, firstName, imageUrl },
  });
});

// ----- Auth: Login -----

app.post("/api/login", (req, res) => {
  console.log("POST /api/login", req.body);

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password." });
  }

  const users = readJson(USERS_FILE, []);
  const user = users.find((u) => u.username === username);

  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  return res.json({
    message: "Login successful",
    user: {
      username: user.username,
      firstName: user.firstName,
      imageUrl: user.imageUrl,
    },
  });
});

// ----- Simple logout endpoint (optional) -----

app.post("/api/logout", (req, res) => {
  // No real server session, just respond OK
  return res.json({ message: "Logged out" });
});

// ----- Playlists API -----

// Get all playlists for a user
app.get("/api/playlists/:username", (req, res) => {
  const username = req.params.username;
  if (!username) {
    return res.status(400).json({ error: "Missing username in URL." });
  }

  const userPlaylists = getUserPlaylists(username);
  return res.json(userPlaylists);
});

// Add video to a specific playlist
app.post("/api/playlists/:username/add", (req, res) => {
  const username = req.params.username;
  const { playlistName, video } = req.body || {};

  if (!username || !playlistName || !video) {
    return res
      .status(400)
      .json({ error: "Missing username, playlistName or video in request." });
  }

  const all = readAllPlaylists();
  if (!all[username]) {
    all[username] = {};
  }
  if (!all[username][playlistName]) {
    all[username][playlistName] = [];
  }

  const list = all[username][playlistName];

  // Do not add duplicates by videoId
  const exists = list.some((v) => v.videoId === video.videoId);
  if (exists) {
    return res.status(409).json({ error: "Video already exists in this playlist." });
  }

  // Normalize video object
  const track = {
    videoId: video.videoId || null,
    title: video.title || "",
    thumbnail: video.thumbnail || "",
    rating: typeof video.rating === "number" ? video.rating : 0,
    type: video.type || "youtube",
    filePath: video.filePath || null
  };

  list.push(track);
  all[username][playlistName] = list;
  writeAllPlaylists(all);

  return res.status(201).json({ message: "Video added", playlistName, track });
});

// Update rating for a video in a playlist
app.put("/api/playlists/:username/rating", (req, res) => {
  const username = req.params.username;
  const { playlistName, videoId, rating } = req.body || {};

  if (!username || !playlistName || !videoId) {
    return res
      .status(400)
      .json({ error: "Missing username, playlistName or videoId." });
  }

  const all = readAllPlaylists();
  if (!all[username] || !all[username][playlistName]) {
    return res.status(404).json({ error: "Playlist or user not found." });
  }

  const list = all[username][playlistName];
  const track = list.find((v) => v.videoId === videoId);
  if (!track) {
    return res.status(404).json({ error: "Video not found in playlist." });
  }

  track.rating = typeof rating === "number" ? rating : 0;
  writeAllPlaylists(all);

  return res.json({ message: "Rating updated", playlistName, videoId, rating: track.rating });
});

// Remove video from playlist
app.delete("/api/playlists/:username/remove", (req, res) => {
  const username = req.params.username;
  const { playlistName, videoId } = req.body || {};

  if (!username || !playlistName || !videoId) {
    return res
      .status(400)
      .json({ error: "Missing username, playlistName or videoId." });
  }

  const all = readAllPlaylists();
  if (!all[username] || !all[username][playlistName]) {
    return res.status(404).json({ error: "Playlist or user not found." });
  }

  const list = all[username][playlistName];
  const newList = list.filter((v) => v.videoId !== videoId);

  all[username][playlistName] = newList;
  writeAllPlaylists(all);

  return res.json({ message: "Video removed", playlistName, videoId });
});


// ----- Start server -----

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
