console.log("search.js loaded");

const YOUTUBE_API_KEY = "AIzaSyCzM8S4Q9h5vo-fyRIc55sdO1Xk3ikRYjI";
const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

// ---------- current user (Hello, name + image) ----------

const currentUserJson = sessionStorage.getItem("currentUser");
let currentUser = null;

if (!currentUserJson) {
  const returnUrl = encodeURIComponent(window.location.href);
  window.location.href = `login.html?returnUrl=${returnUrl}`;
} else {
  try {
    currentUser = JSON.parse(currentUserJson);

    const welcomeText = document.getElementById("welcomeText");
    const userImage = document.getElementById("userImage");

    if (welcomeText) {
      welcomeText.textContent = `Hello, ${currentUser.firstName}`;
    }
    if (userImage) {
      userImage.src = currentUser.imageUrl || "";
    }
  } catch (e) {
    console.error("Error parsing currentUser from sessionStorage", e);
    window.location.href = "login.html";
  }
}

// ---------- DOM elements ----------

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const resultsContainer = document.getElementById("resultsContainer");

// toast
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastLink = document.getElementById("toastLink");
let toastTimeoutId = null;

// playlist chooser modal
const playlistChooser = document.getElementById("playlistChooser");
const playlistChooserList = document.getElementById("playlistChooserList");
const playlistChooserNewName = document.getElementById("newPlaylistName");
const playlistChooserCreateBtn = document.getElementById("createPlaylistBtn");
const playlistChooserCloseBtn = document.getElementById("chooserClose");

let videoToAdd = null; // הסרטון שנוסיף כרגע

// video modal (play)
const modal = document.getElementById("videoModal");
const modalTitle = document.getElementById("modalVideoTitle");
const modalPlayer = document.getElementById("modalPlayer");
const modalCloseBtn = document.querySelector(".modal-close");

// ---------- Toast ----------

function showToast(message, playlistName) {
  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;

  if (toastLink) {
    if (playlistName) {
      toastLink.href = `playlists.html?id=${encodeURIComponent(playlistName)}`;
    } else {
      toastLink.href = "playlists.html";
    }
  }

  toast.classList.remove("hidden");
  toast.classList.add("show");

  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
  }

  toastTimeoutId = setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hidden");
  }, 4000);
}

// ---------- YouTube helpers ----------

function formatDuration(isoDuration) {
  if (!isoDuration) return "";
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  const pad = (n) => String(n).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

function formatViews(countStr) {
  const count = Number(countStr || 0);
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M views";
  }
  if (count >= 1_000) {
    return (count / 1_000).toFixed(1).replace(/\.0$/, "") + "K views";
  }
  return count + " views";
}

async function searchYouTube(query) {
  const searchUrl = `${YOUTUBE_SEARCH_URL}?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(
    query
  )}&key=${YOUTUBE_API_KEY}`;

  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) {
    throw new Error("YouTube API search request failed");
  }

  const searchData = await searchResponse.json();
  const items = searchData.items || [];
  if (items.length === 0) return [];

  const videoIds = items
    .map((item) => item.id && item.id.videoId)
    .filter(Boolean);

  const detailsUrl =
    "https://www.googleapis.com/youtube/v3/videos" +
    `?part=contentDetails,statistics&id=${videoIds.join(",")}` +
    `&key=${YOUTUBE_API_KEY}`;

  const detailsResponse = await fetch(detailsUrl);
  if (!detailsResponse.ok) {
    console.warn("Failed to load video details", detailsResponse.status);
    return items;
  }

  const detailsData = await detailsResponse.json();
  const detailsItems = detailsData.items || [];

  const detailsMap = {};
  detailsItems.forEach((d) => {
    detailsMap[d.id] = d;
  });

  items.forEach((item) => {
    const vid = item.id && item.id.videoId;
    const d = detailsMap[vid];
    if (d) {
      const durationIso = d.contentDetails && d.contentDetails.duration;
      const views = d.statistics && d.statistics.viewCount;

      item.durationText = formatDuration(durationIso);
      item.viewsText = formatViews(views);
    }
  });

  return items;
}

// ---------- Playlists (from server, not localStorage) ----------
//
// מבנה בצד שרת:
// {
//   "username": {
//      "Favorites": [ { videoId, title, thumbnail, rating, type, filePath }, ... ],
//      "My Playlist": [ ... ]
//   }
// }

let userPlaylists = {}; // { playlistName: [tracks...] }

// טוען את הפלייליסטים מהשרת
async function loadUserPlaylists() {
  if (!currentUser) return;

  try {
    const res = await fetch(
      `/api/playlists/${encodeURIComponent(currentUser.username)}`
    );
    if (!res.ok) {
      console.error("Failed to load playlists from server", res.status);
      userPlaylists = { Favorites: [] };
      return;
    }

    const data = await res.json();
    userPlaylists = data || {};
    if (!userPlaylists.Favorites) {
      userPlaylists.Favorites = [];
    }
  } catch (err) {
    console.error("Error fetching playlists", err);
    userPlaylists = { Favorites: [] };
  }
}

// האם הסרטון קיים באחד הפלייליסטים של המשתמש (בזיכרון)
function isVideoInAnyPlaylist(videoId) {
  if (!currentUser) return false;

  const names = Object.keys(userPlaylists || {});
  for (const name of names) {
    const list = userPlaylists[name] || [];
    if (list.some((v) => v.videoId === videoId)) {
      return true;
    }
  }
  return false;
}

// מוסיף סרטון לפלייליסט (שרת + עדכון זיכרון + UI)
async function addVideoToPlaylist(playlistName, video) {
  if (!currentUser) return;

  const username = currentUser.username;

  try {
    const res = await fetch(
      `/api/playlists/${encodeURIComponent(username)}/add`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistName,
          video: {
            videoId: video.videoId,
            title: video.title,
            thumbnail: video.thumbnail,
            rating: 0,
            type: "youtube",
          },
        }),
      }
    );

    const data = await res.json().catch(() => ({}));

    if (res.status === 409) {
      // already exists
      showToast("Video already exists in this playlist 🙂", playlistName);
    } else if (!res.ok) {
      const errMsg =
        data && data.error
          ? data.error
          : "Error adding video to playlist. Please try again.";
      alert(errMsg);
      return;
    } else {
      // success – נעדכן גם את הזיכרון
      if (!userPlaylists[playlistName]) {
        userPlaylists[playlistName] = [];
      }

      const track = {
        videoId: video.videoId,
        title: video.title,
        thumbnail: video.thumbnail,
        rating: 0,
        type: "youtube",
      };

      userPlaylists[playlistName].push(track);

      showToast(`Video added to "${playlistName}" playlist.`, playlistName);
    }

    // עדכון הכפתור וה-V
    if (video.favBtn && video.favIndicator) {
      video.favBtn.textContent = "In playlists ✓";
      video.favBtn.disabled = true;
      video.favBtn.classList.add("in-favorites");
      video.favIndicator.style.display = "inline";
    }
  } catch (err) {
    console.error("Error adding video to playlist", err);
    alert("Network error. Please try again.");
  }
}

// ---------- Playlist chooser modal ----------

function openPlaylistChooser(video) {
  if (!playlistChooser) return;
  videoToAdd = video;

  fillPlaylistChooserList();
  playlistChooser.style.display = "flex";
}

function closePlaylistChooser() {
  if (!playlistChooser) return;
  playlistChooser.style.display = "none";
  videoToAdd = null;
}

function fillPlaylistChooserList() {
  if (!playlistChooserList) return;
  playlistChooserList.innerHTML = "";

  const names = Object.keys(userPlaylists || {});
  if (names.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No playlists yet. Create a new one below.";
    playlistChooserList.appendChild(p);
    return;
  }

  names.forEach((name) => {
    const btn = document.createElement("button");
    btn.textContent = name;
    btn.addEventListener("click", () => {
      if (!videoToAdd) return;
      addVideoToPlaylist(name, videoToAdd);
      closePlaylistChooser();
    });
    playlistChooserList.appendChild(btn);
  });
}

if (playlistChooserCloseBtn && playlistChooser) {
  playlistChooserCloseBtn.addEventListener("click", closePlaylistChooser);

  playlistChooser.addEventListener("click", (e) => {
    if (e.target === playlistChooser) {
      closePlaylistChooser();
    }
  });
}

if (playlistChooserCreateBtn && playlistChooserNewName) {
  playlistChooserCreateBtn.addEventListener("click", () => {
    const name = playlistChooserNewName.value.trim();
    if (!name) return;

    // יוצרים פלייליסט בזיכרון (יופיע ברשימה).
    // הוא יישמר בשרת ברגע שנוסיף אליו שיר.
    if (!userPlaylists[name]) {
      userPlaylists[name] = [];
    }

    playlistChooserNewName.value = "";
    fillPlaylistChooserList();
  });

  playlistChooserNewName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      playlistChooserCreateBtn.click();
    }
  });
}

// ---------- Video modal ----------

function openModal(videoId, title) {
  if (!modal) return;
  modalTitle.textContent = title;
  modalPlayer.src = `https://www.youtube.com/embed/${videoId}`;
  modal.style.display = "flex";
}

function closeModal() {
  if (!modal) return;
  modal.style.display = "none";
  modalPlayer.src = "";
}

if (modalCloseBtn && modal) {
  modalCloseBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
}

// ---------- Render search results ----------

function renderResults(items) {
  resultsContainer.innerHTML = "";

  if (!items || items.length === 0) {
    resultsContainer.textContent = "No results found.";
    return;
  }

  items.forEach((item) => {
    const videoId = item.id.videoId;
    const title = item.snippet.title;
    const thumbnail = item.snippet.thumbnails.medium.url;

    const card = document.createElement("div");
    card.className = "video-card";

    const img = document.createElement("img");
    img.src = thumbnail;
    img.alt = title;

    const infoDiv = document.createElement("div");
    infoDiv.className = "video-info";

    const h3 = document.createElement("h3");
    h3.textContent = title;
    h3.title = title;

    const meta = document.createElement("div");
    meta.className = "video-meta";

    let metaText = "";
    if (item.durationText) {
      metaText += item.durationText;
    }
    if (item.viewsText) {
      metaText += metaText ? " • " + item.viewsText : item.viewsText;
    }
    meta.textContent = metaText;

    const favIndicator = document.createElement("span");
    favIndicator.className = "favorite-indicator";
    favIndicator.textContent = "✓";
    favIndicator.style.display = "none";
    h3.appendChild(favIndicator);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "video-actions";

    const playBtn = document.createElement("button");
    playBtn.textContent = "Play";

    const favBtn = document.createElement("button");
    favBtn.textContent = "Add to playlist";

    // check if already in one of the playlists
    const alreadyIn = isVideoInAnyPlaylist(videoId);
    if (alreadyIn) {
      favBtn.textContent = "In playlists ✓";
      favBtn.disabled = true;
      favBtn.classList.add("in-favorites");
      favIndicator.style.display = "inline";
    }

    favBtn.addEventListener("click", () => {
      openPlaylistChooser({
        videoId,
        title,
        thumbnail,
        favBtn,
        favIndicator,
      });
    });

    img.addEventListener("click", () => openModal(videoId, title));
    h3.addEventListener("click", () => openModal(videoId, title));
    playBtn.addEventListener("click", () => openModal(videoId, title));

    actionsDiv.appendChild(playBtn);
    actionsDiv.appendChild(favBtn);

    infoDiv.appendChild(h3);
    infoDiv.appendChild(meta);
    infoDiv.appendChild(actionsDiv);

    card.appendChild(img);
    card.appendChild(infoDiv);

    resultsContainer.appendChild(card);
  });
}

// ---------- Query string helpers ----------

function setSearchQueryParam(query) {
  const url = new URL(window.location.href);

  if (query) {
    url.searchParams.set("q", query);
  } else {
    url.searchParams.delete("q");
  }

  window.history.replaceState({}, "", url.toString());
}

function getSearchQueryParam() {
  const url = new URL(window.location.href);
  return url.searchParams.get("q") || "";
}

// ---------- Search flow ----------

async function performSearch(query) {
  resultsContainer.textContent = "Loading...";

  try {
    const items = await searchYouTube(query);
    renderResults(items);
  } catch (err) {
    console.error(err);
    resultsContainer.textContent = "Error searching YouTube.";
  }
}

if (searchInput && searchButton && resultsContainer) {
  searchButton.addEventListener("click", async function () {
    const query = searchInput.value.trim();

    if (!query) {
      alert("Please enter search text.");
      return;
    }

    setSearchQueryParam(query);
    await performSearch(query);
  });

  searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      searchButton.click();
    }
  });

  const initialQuery = getSearchQueryParam();
  if (initialQuery) {
    searchInput.value = initialQuery;
    performSearch(initialQuery);
  }
} else {
  console.error("Search elements not found in the DOM");
}

// ---------- Logout ----------

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (e) {
      console.warn("Logout request failed (ignored).");
    }
    sessionStorage.removeItem("currentUser");
    window.location.href = "login.html";
  });
}

// ---------- Init: load playlists once for the "already in playlist" check ----------

(async function init() {
  if (currentUser) {
    await loadUserPlaylists();
  }
})();
