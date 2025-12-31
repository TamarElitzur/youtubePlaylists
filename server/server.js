const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3000;

// ---------- Middleware ----------

// parse JSON bodies
app.use(express.json());

// serve static frontend from /public
app.use(express.static(path.join(__dirname, "..", "public")));

// simple CORS (לא חובה כי הכל באותו origin, אבל לא מזיק)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// health check קטן
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ---------- JSON file helpers ----------

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PLAYLISTS_FILE = path.join(DATA_DIR, "playlists.json");

function readJson(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    if (!raw.trim()) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading", filePath, err);
    return defaultValue;
  }
}

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing", filePath, err);
  }
}

// ---------- Auth API (REGISTER / LOGIN / LOGOUT) ----------

// POST /api/register
// body: { username, password, firstName, imageUrl }
app.post("/api/register", (req, res) => {
  const { username, password, firstName, imageUrl } = req.body || {};

  if (!username || !password || !firstName || !imageUrl) {
    return res.status(400).json({
      error: "All fields are required (username, password, firstName, imageUrl).",
    });
  }

  const users = readJson(USERS_FILE, []);
  const existing = users.find((u) => u.username === username);
  if (existing) {
    return res.status(409).json({ error: "Username already exists." });
  }

  const newUser = {
    username,
    password, // בעולם אמיתי כמובן לא ככה, אבל למטלה זה מספיק
    firstName,
    imageUrl,
  };

  users.push(newUser);
  writeJson(USERS_FILE, users);

  return res.status(201).json({
    message: "Registration successful",
    user: { username, firstName, imageUrl },
  });
});

// POST /api/login
// body: { username, password }
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Both username and password are required." });
  }

  const users = readJson(USERS_FILE, []);
  const user = users.find((u) => u.username === username);

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  if (user.password !== password) {
    return res.status(401).json({ error: "Incorrect password." });
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

// POST /api/logout
app.post("/api/logout", (req, res) => {
  // אין לנו סשן אמיתי בשרת, צד לקוח רק מוחק sessionStorage
  return res.json({ message: "Logged out" });
});

// ---------- Playlists API (שמור בקובץ playlists.json) ----------
//
// playlists.json מבנה:
// {
//   "username1": {
//      "Favorites": [ { videoId, title, thumbnail, rating?, type?, filePath? }, ... ],
//      "My Playlist": [ ... ]
//   },
//   "username2": { ... }
// }

function getAllPlaylists() {
  return readJson(PLAYLISTS_FILE, {});
}

function saveAllPlaylists(data) {
  writeJson(PLAYLISTS_FILE, data);
}

// GET /api/playlists/:username
app.get("/api/playlists/:username", (req, res) => {
  const { username } = req.params;
  if (!username) {
    return res.status(400).json({ error: "Username is required." });
  }

  const all = getAllPlaylists();
  let userPlaylists = all[username];

  if (!userPlaylists) {
    userPlaylists = {};
  }
  if (!userPlaylists.Favorites) {
    userPlaylists.Favorites = [];
  }

  all[username] = userPlaylists;
  saveAllPlaylists(all);

  return res.json(userPlaylists);
});

// POST /api/playlists/:username/add
// body: { playlistName, video: { videoId, title, thumbnail, rating?, type?, filePath? } }
app.post("/api/playlists/:username/add", (req, res) => {
  const { username } = req.params;
  const { playlistName, video } = req.body || {};

  if (!username || !playlistName || !video || !video.videoId) {
    return res
      .status(400)
      .json({ error: "Missing data (username, playlistName, video.videoId)." });
  }

  const all = getAllPlaylists();
  if (!all[username]) all[username] = {};
  if (!all[username][playlistName]) all[username][playlistName] = [];

  const list = all[username][playlistName];

  const exists = list.some((v) => v.videoId === video.videoId);
  if (exists) {
    return res.status(409).json({ error: "Video already in playlist." });
  }

  list.push({
    videoId: video.videoId,
    title: video.title || "",
    thumbnail: video.thumbnail || "",
    rating: video.rating || 0,
    type: video.type || "youtube",
    filePath: video.filePath || null,
  });

  all[username][playlistName] = list;
  saveAllPlaylists(all);

  return res
    .status(201)
    .json({ message: "Video added", playlist: playlistName, list });
});

// PUT /api/playlists/:username/rating
// body: { playlistName, videoId, rating }
app.put("/api/playlists/:username/rating", (req, res) => {
  const { username } = req.params;
  const { playlistName, videoId, rating } = req.body || {};

  if (!username || !playlistName || !videoId) {
    return res
      .status(400)
      .json({ error: "Missing data (username, playlistName, videoId)." });
  }

  const all = getAllPlaylists();
  const userPlaylists = all[username];
  if (!userPlaylists || !userPlaylists[playlistName]) {
    return res.status(404).json({ error: "Playlist not found" });
  }

  const list = userPlaylists[playlistName];
  const video = list.find((v) => v.videoId === videoId);
  if (!video) {
    return res.status(404).json({ error: "Video not found in playlist" });
  }

  video.rating = Number(rating) || 0;
  saveAllPlaylists(all);

  return res.json({ message: "Rating updated" });
});

// DELETE /api/playlists/:username/video
// body: { playlistName, videoId }
app.delete("/api/playlists/:username/video", (req, res) => {
  const { username } = req.params;
  const { playlistName, videoId } = req.body || {};

  if (!username || !playlistName || !videoId) {
    return res
      .status(400)
      .json({ error: "Missing data (username, playlistName, videoId)." });
  }

  const all = getAllPlaylists();
  const userPlaylists = all[username];
  if (!userPlaylists || !userPlaylists[playlistName]) {
    return res.status(404).json({ error: "Playlist not found" });
  }

  const list = userPlaylists[playlistName];
  const newList = list.filter((v) => v.videoId !== videoId);

  userPlaylists[playlistName] = newList;
  all[username] = userPlaylists;
  saveAllPlaylists(all);

  return res.json({ message: "Video removed" });
});

// ---------- MP3 upload API ----------

// יישמרו כאן קבצי ה-MP3
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const username = req.params.username || "unknown";
    const safeName = file.originalname.replace(/\s+/g, "_");
    const filename = `${username}-${Date.now()}-${safeName}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".mp3")) {
      return cb(new Error("Only .mp3 files are allowed"));
    }
    cb(null, true);
  },
});

// POST /api/upload-mp3/:username
// form-data: file=..., optional: playlistName, title
app.post("/api/upload-mp3/:username", upload.single("file"), (req, res) => {
  const { username } = req.params;
  const playlistName = req.body.playlistName || "Favorites";
  const title =
    req.body.title || (req.file ? req.file.originalname : "MP3 track");

  if (!username) {
    return res.status(400).json({ error: "Username is required." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "MP3 file is required." });
  }

  const all = getAllPlaylists();
  if (!all[username]) all[username] = {};
  if (!all[username][playlistName]) all[username][playlistName] = [];

  const list = all[username][playlistName];

  const videoId = `mp3-${Date.now()}-${req.file.filename}`;
  const filePath = `/uploads/${req.file.filename}`;

  const track = {
    videoId,
    title,
    thumbnail: "",
    rating: 0,
    type: "mp3",
    filePath,
  };

  list.push(track);
  all[username][playlistName] = list;
  saveAllPlaylists(all);

  return res.status(201).json({
    message: "MP3 uploaded and added to playlist",
    playlist: playlistName,
    track,
  });
});

// serve uploaded files statically
app.use("/uploads", express.static(UPLOADS_DIR));

// ---------- Start server ----------

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
