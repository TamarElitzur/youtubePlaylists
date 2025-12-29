console.log("playlists.js loaded");

// user info (Hello, name + image)
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

    welcomeText.textContent = `Hello, ${currentUser.firstName}`;
    userImage.src = currentUser.imageUrl || "";
  } catch (e) {
    console.error("Error parsing currentUser from sessionStorage", e);
    window.location.href = "login.html";
  }
}

// Playlists / Favorites storage helpers

function getPlaylists() {
  const json = localStorage.getItem("playlists");
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function savePlaylists(playlists) {
  localStorage.setItem("playlists", JSON.stringify(playlists));
}

function ensureUserFavorites(username) {
  const all = getPlaylists();

  if (!all[username]) {
    all[username] = {};
  }
  if (!all[username].Favorites) {
    all[username].Favorites = [];
  }

  savePlaylists(all);
}

function getUserFavorites() {
  if (!currentUser) return [];

  // make sure that the user always has favorites playlist
  ensureUserFavorites(currentUser.username);

  const all = getPlaylists();
  const userPlaylists = all[currentUser.username];
  if (!userPlaylists || !userPlaylists.Favorites) return [];

  return userPlaylists.Favorites;
}


// DOM elements
const playlistVideosContainer = document.getElementById("playlistVideosContainer");
const playlistSearchInput = document.getElementById("playlistSearchInput");
const playlistSearchButton = document.getElementById("playlistSearchButton");
const clearSearchButton = document.getElementById("clearSearchButton");
const sortByTitleButton = document.getElementById("sortByTitleButton");
const sortByRatingButton = document.getElementById("sortByRatingButton");
const currentPlaylistTitle = document.getElementById("currentPlaylistTitle");
const newPlaylistBtn = document.getElementById("newPlaylistBtn");


currentPlaylistTitle.textContent = "Favorites";

// inner situation
let baseVideos = getUserFavorites();
let searchTerm = "";
let sortMode = "none"; // "none" | "title" | "rating"

// Modal elements (like in- search.js)
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

// Update rating & remove video
function updateVideoRating(videoId, newRating) {
  if (!currentUser) return;

  const username = currentUser.username;
  const all = getPlaylists();
  const userPlaylists = all[username];
  if (!userPlaylists || !userPlaylists.Favorites) return;

  const list = userPlaylists.Favorites;
  const video = list.find((v) => v.videoId === videoId);
  if (video) {
    video.rating = newRating;
    all[username].Favorites = list;
    savePlaylists(all);

    baseVideos = getUserFavorites();
    renderPlaylist();
  }
}

function removeVideo(videoId) {
  if (!currentUser) return;

  const username = currentUser.username;
  const all = getPlaylists();
  const userPlaylists = all[username];
  if (!userPlaylists || !userPlaylists.Favorites) return;

  let list = userPlaylists.Favorites;
  list = list.filter((v) => v.videoId !== videoId);
  all[username].Favorites = list;
  savePlaylists(all);

  baseVideos = getUserFavorites();
  renderPlaylist();
}

// Render playlist
function renderPlaylist() {
  baseVideos = getUserFavorites();

  let videos = [...baseVideos];

  // filter according inner search
  if (searchTerm) {
    const lower = searchTerm.toLowerCase();
    videos = videos.filter((v) =>
      (v.title || "").toLowerCase().includes(lower)
    );
  }

  // sort
  if (sortMode === "title") {
    videos.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else if (sortMode === "rating") {
    videos.sort(
      (a, b) => (b.rating || 0) - (a.rating || 0)
    );
  }

  playlistVideosContainer.innerHTML = "";

  if (videos.length === 0) {
    playlistVideosContainer.textContent =
      "No videos in this playlist yet.";
    return;
  }

  videos.forEach((video) => {
    const card = document.createElement("div");
    card.className = "playlist-video-card";

    const img = document.createElement("img");
    img.src = video.thumbnail;
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
      opt.textContent = r === 0 ? "0" : String(r);
      if (r === currentRating) {
        opt.selected = true;
      }
      ratingSelect.appendChild(opt);
    }

    ratingSelect.addEventListener("change", () => {
      updateVideoRating(video.videoId, Number(ratingSelect.value));
    });

    // Events
    img.addEventListener("click", () =>
      openModal(video.videoId, video.title || "")
    );
    titleEl.addEventListener("click", () =>
      openModal(video.videoId, video.title || "")
    );
    playBtn.addEventListener("click", () =>
      openModal(video.videoId, video.title || "")
    );
    removeBtn.addEventListener("click", () =>
      removeVideo(video.videoId)
    );

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

// Event listeners for controls
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
    playlistSearchInput.value = "";
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
    alert("In the next step we will support multiple playlists 🙂\nFor now you have a single Favorites playlist.");
  });
}

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("currentUser");
    window.location.href = "login.html";
  });
}


// initial charge
renderPlaylist();
