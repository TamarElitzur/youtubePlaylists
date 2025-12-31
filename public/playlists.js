console.log("playlists.js loaded");

// ----- Current user (from sessionStorage) -----

const currentUserJson = sessionStorage.getItem("currentUser");
let currentUser = null;

if (!currentUserJson) {
  // If no logged in user, redirect to login with returnUrl
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

// ----- In-memory playlists state -----

// Structure: { "Favorites": [ { videoId, title, thumbnail, rating, type, filePath }, ... ], ... }
let userPlaylists = {};
let currentPlaylistName = "Favorites";

// ----- DOM elements -----

const playlistVideosContainer = document.getElementById("playlistVideosContainer");
const playlistSearchInput = document.getElementById("playlistSearchInput");
const playlistSearchButton = document.getElementById("playlistSearchButton");
const clearSearchButton = document.getElementById("clearSearchButton");
const sortByTitleButton = document.getElementById("sortByTitleButton");
const sortByRatingButton = document.getElementById("sortByRatingButton");
const currentPlaylistTitle = document.getElementById("currentPlaylistTitle");
const newPlaylistBtn = document.getElementById("newPlaylistBtn");
const playlistsList = document.getElementById("playlistsList");

// Internal UI state
let searchTerm = "";
let sortMode = "none"; // "none" | "title" | "rating"

// ----- Helpers for playlists -----

function ensureFavoritesExists() {
  if (!userPlaylists.Favorites) {
    userPlaylists.Favorites = [];
  }
}

/**
 * Load all playlists for the current user from the server.
 */
async function loadUserPlaylistsFromServer() {
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
    ensureFavoritesExists();
  } catch (err) {
    console.error("Error fetching playlists", err);
    userPlaylists = { Favorites: [] };
  }
}

/**
 * Update rating in server (and then in memory).
 */
async function updateVideoRatingOnServer(playlistName, videoId, newRating) {
  if (!currentUser) return;

  try {
    const res = await fetch(
      `/api/playlists/${encodeURIComponent(currentUser.username)}/rating`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistName,
          videoId,
          rating: newRating,
        }),
      }
    );

    if (!res.ok) {
      console.error("Failed to update rating", res.status);
      return;
    }

    // Update in-memory state
    const list = userPlaylists[playlistName] || [];
    const track = list.find((v) => v.videoId === videoId);
    if (track) {
      track.rating = newRating;
    }
  } catch (err) {
    console.error("Error updating rating", err);
  }
}

/**
 * Remove video from playlist in server (and then locally).
 */
async function removeVideoFromServer(playlistName, videoId) {
  if (!currentUser) return;

  try {
    const res = await fetch(
      `/api/playlists/${encodeURIComponent(currentUser.username)}/remove`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistName,
          videoId,
        }),
      }
    );

    if (!res.ok) {
      console.error("Failed to remove video", res.status);
      return;
    }

    // Update in-memory state
    const list = userPlaylists[playlistName] || [];
    userPlaylists[playlistName] = list.filter((v) => v.videoId !== videoId);
  } catch (err) {
    console.error("Error removing video", err);
  }
}

// ----- Rendering -----

function renderSidebarPlaylists() {
  if (!playlistsList) return;

  playlistsList.innerHTML = "";

  const names = Object.keys(userPlaylists);
  names.forEach((name) => {
    const li = document.createElement("li");
    li.className = "playlist-item";
    if (name === currentPlaylistName) {
      li.classList.add("active");
    }
    li.textContent = name;
    li.dataset.id = name;

    li.addEventListener("click", () => {
      currentPlaylistName = name;
      currentPlaylistTitle.textContent = name;
      renderSidebarPlaylists();
      renderPlaylist();
    });

    playlistsList.appendChild(li);
  });
}

/**
 * Render the current playlist according to search + sort.
 */
function renderPlaylist() {
  if (!playlistVideosContainer) return;

  ensureFavoritesExists();

  const baseList = userPlaylists[currentPlaylistName] || [];
  let videos = [...baseList];

  // Filter by search term
  if (searchTerm) {
    const lower = searchTerm.toLowerCase();
    videos = videos.filter((v) =>
      (v.title || "").toLowerCase().includes(lower)
    );
  }

  // Sort
  if (sortMode === "title") {
    videos.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else if (sortMode === "rating") {
    videos.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  playlistVideosContainer.innerHTML = "";

  if (videos.length === 0) {
    playlistVideosContainer.textContent = "No videos in this playlist yet.";
    return;
  }

  videos.forEach((video) => {
    const card = document.createElement("div");
    card.className = "playlist-video-card";

    // For now, we treat both YouTube and MP3 entries similarly in UI.
    // Later we can show <audio> for MP3 if needed.
    const img = document.createElement("img");
    img.src = video.thumbnail || "";
    img.alt = video.title || "";

    const infoDiv = document.createElement("div");
    infoDiv.className = "video-info";

    const titleEl = document.createElement("h3");
    titleEl.textContent = video.title || "";
    titleEl.title = video.title || "";

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "video-actions";

    const playBtn = document.createElement("button");
    playBtn.textContent = "Play";

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";

    const ratingDiv = document.createElement("div");
    ratingDiv.className = "video-rating";

    const ratingLabel = document.createElement("span");
    ratingLabel.textContent = "Rating: ";

    const ratingSelect = document.createElement("select");
    const currentRating = video.rating || 0;

    for (let r = 0; r <= 5; r++) {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = String(r);
      if (r === currentRating) {
        opt.selected = true;
      }
      ratingSelect.appendChild(opt);
    }

    ratingSelect.addEventListener("change", async () => {
      const newRating = Number(ratingSelect.value);
      await updateVideoRatingOnServer(currentPlaylistName, video.videoId, newRating);
      renderPlaylist();
    });

    // Play button currently opens YouTube modal for YouTube entries.
    // For MP3 we will later support audio element.
    playBtn.addEventListener("click", () => {
      if (video.type === "youtube" && video.videoId) {
        openModal(video.videoId, video.title || "");
      } else {
        alert("Play for MP3 will be implemented later.");
      }
    });

    removeBtn.addEventListener("click", async () => {
      await removeVideoFromServer(currentPlaylistName, video.videoId);
      renderPlaylist();
    });

    actionsDiv.appendChild(playBtn);
    actionsDiv.appendChild(removeBtn);

    ratingDiv.appendChild(ratingLabel);
    ratingDiv.appendChild(ratingSelect);

    infoDiv.appendChild(titleEl);
    infoDiv.appendChild(actionsDiv);
    infoDiv.appendChild(ratingDiv);

    card.appendChild(img);
    card.appendChild(infoDiv);

    playlistVideosContainer.appendChild(card);
  });
}

// ----- Modal for YouTube playback (same as search.js) -----

const modal = document.getElementById("videoModal");
const modalTitle = document.getElementById("modalVideoTitle");
const modalPlayer = document.getElementById("modalPlayer");
const modalCloseBtn = document.querySelector(".modal-close");

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

// ----- Controls events -----

if (playlistSearchButton && playlistSearchInput) {
  playlistSearchButton.addEventListener("click", () => {
    searchTerm = playlistSearchInput.value.trim();
    renderPlaylist();
  });

  playlistSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      searchTerm = playlistSearchInput.value.trim();
      renderPlaylist();
    }
  });
}

if (clearSearchButton) {
  clearSearchButton.addEventListener("click", () => {
    searchTerm = "";
    if (playlistSearchInput) {
      playlistSearchInput.value = "";
    }
    renderPlaylist();
  });
}

if (sortByTitleButton) {
  sortByTitleButton.addEventListener("click", () => {
    sortMode = "title";
    renderPlaylist();
  });
}

if (sortByRatingButton) {
  sortByRatingButton.addEventListener("click", () => {
    sortMode = "rating";
    renderPlaylist();
  });
}

if (newPlaylistBtn) {
  newPlaylistBtn.addEventListener("click", () => {
    const name = prompt("Enter new playlist name:");
    if (!name) return;

    if (!userPlaylists[name]) {
      userPlaylists[name] = [];
      currentPlaylistName = name;
      currentPlaylistTitle.textContent = name;
      renderSidebarPlaylists();
      renderPlaylist();
    } else {
      alert("A playlist with this name already exists.");
    }
  });
}

// ----- Logout button -----

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

// ----- Initialization -----

(async function init() {
  if (!currentUser) return;

  await loadUserPlaylistsFromServer();
  ensureFavoritesExists();

  currentPlaylistTitle.textContent = currentPlaylistName;
  renderSidebarPlaylists();
  renderPlaylist();
})();
