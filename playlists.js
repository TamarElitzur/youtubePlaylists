console.log("playlists.js loaded");

// --------- user info (Hello, name + image) ---------
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

// --------- Favorites storage helpers (אותו פורמט כמו ב-search.js) ---------
function getFavorites() {
  const json = localStorage.getItem("favorites");
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function saveFavorites(favs) {
  localStorage.setItem("favorites", JSON.stringify(favs));
}

function getUserFavorites() {
  const favorites = getFavorites();
  if (!currentUser) return [];
  return favorites[currentUser.username] || [];
}

// --------- DOM elements ---------
const playlistVideosContainer = document.getElementById("playlistVideosContainer");
const playlistSearchInput = document.getElementById("playlistSearchInput");
const playlistSearchButton = document.getElementById("playlistSearchButton");
const clearSearchButton = document.getElementById("clearSearchButton");
const sortByTitleButton = document.getElementById("sortByTitleButton");
const sortByRatingButton = document.getElementById("sortByRatingButton");
const currentPlaylistTitle = document.getElementById("currentPlaylistTitle");
const newPlaylistBtn = document.getElementById("newPlaylistBtn");

// כרגע יש רק Favorites
currentPlaylistTitle.textContent = "Favorites";

// מצב פנימי
let baseVideos = getUserFavorites();
let searchTerm = "";
let sortMode = "none"; // "none" | "title" | "rating"

// --------- Modal elements (כמו ב-search.js) ---------
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
  const favorites = getFavorites();
  if (!currentUser) return;
  const username = currentUser.username;
  const list = favorites[username] || [];
  const video = list.find((v) => v.videoId === videoId);
  if (video) {
    video.rating = newRating;
    favorites[username] = list;
    saveFavorites(favorites);
  }
}


function removeVideo(videoId) {
  const favorites = getFavorites();
  if (!currentUser) return;
  const username = currentUser.username;
  let list = favorites[username] || [];
  list = list.filter((v) => v.videoId !== videoId);
  favorites[username] = list;
  saveFavorites(favorites);
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

    // events
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

// initial charge
renderPlaylist();
