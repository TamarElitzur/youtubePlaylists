console.log("playlists.js loaded");

// ---------- current user from sessionStorage ----------

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

// ---------- playlists data from server ----------

let userPlaylists = {}; // object: { playlistName: [tracks...] }
let currentPlaylistName = "Favorites";
let searchTerm = "";
let sortMode = "none"; // "none" | "title" | "rating"

// DOM elements
const playlistVideosContainer = document.getElementById(
  "playlistVideosContainer"
);
const playlistSearchInput = document.getElementById("playlistSearchInput");
const playlistSearchButton = document.getElementById("playlistSearchButton");
const clearSearchButton = document.getElementById("clearSearchButton");
const sortByTitleButton = document.getElementById("sortByTitleButton");
const sortByRatingButton = document.getElementById("sortByRatingButton");
const currentPlaylistTitle = document.getElementById("currentPlaylistTitle");
const newPlaylistBtn = document.getElementById("newPlaylistBtn");
const playlistsList = document.getElementById("playlistsList");

const uploadMp3Form = document.getElementById("uploadMp3Form");
const mp3FileInput = document.getElementById("mp3FileInput");

// Modal elements (YouTube videos only)
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

// ---------- API helpers ----------

async function loadUserPlaylists() {
  if (!currentUser) return;

  try 
  {
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

async function updateVideoRatingOnServer(videoId, newRating) {
  if (!currentUser) return;

  try {
    const res = await fetch(
      `/api/playlists/${encodeURIComponent(currentUser.username)}/rating`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistName: currentPlaylistName,
          videoId,
          rating: newRating,
        }),
      }
    );

    if (!res.ok) {
      console.error("Failed to update rating", res.status);
    }
  } catch (err) {
    console.error("Error updating rating", err);
  }
}

async function removeVideoOnServer(videoId) {
  if (!currentUser) return;

  try {
    const res = await fetch(
      `/api/playlists/${encodeURIComponent(currentUser.username)}/video`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistName: currentPlaylistName,
          videoId,
        }),
      }
    );

    if (!res.ok) {
      console.error("Failed to remove video", res.status);
    }
  } catch (err) {
    console.error("Error removing video", err);
  }
}

// ---------- Render sidebar ----------

function renderSidebarPlaylists() {
  if (!playlistsList) return;

  playlistsList.innerHTML = "";

  const names = Object.keys(userPlaylists);
  if (names.length === 0) {
    names.push("Favorites");
  }

  names.forEach((name) => {
    const li = document.createElement("li");
    li.className = "playlist-item";
    if (name === currentPlaylistName) {
      li.classList.add("active");
    }
    li.textContent = name;
    li.dataset.playlistName = name;

    li.addEventListener("click", () => {
      currentPlaylistName = name;
      currentPlaylistTitle.textContent = name;
      renderSidebarPlaylists();
      renderPlaylist();
    });

    playlistsList.appendChild(li);
  });
}

// ---------- Update rating & remove video (client + server) ----------

async function updateVideoRating(videoId, newRating) {
  if (!currentUser) return;

  const list = userPlaylists[currentPlaylistName] || [];
  const video = list.find((v) => v.videoId === videoId);
  if (video) {
    video.rating = newRating;
  }

  await updateVideoRatingOnServer(videoId, newRating);
  renderPlaylist();
}

async function removeVideo(videoId) {
  if (!currentUser) return;

  let list = userPlaylists[currentPlaylistName] || [];
  list = list.filter((v) => v.videoId !== videoId);
  userPlaylists[currentPlaylistName] = list;

  await removeVideoOnServer(videoId);
  renderPlaylist();
}

// ---------- Render playlist ----------

function renderPlaylist() {
  if (!playlistVideosContainer) return;

  const baseVideos = userPlaylists[currentPlaylistName] || [];
  let videos = [...baseVideos];

  // filter
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
    videos.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  playlistVideosContainer.innerHTML = "";

  if (videos.length === 0) {
    playlistVideosContainer.textContent = "No videos in this playlist yet.";
    return;
  }

  videos.forEach((video) => {
    const isMp3 = video.type === "mp3";

    const card = document.createElement("div");
    card.className = "playlist-video-card";

    // For YouTube videos – show thumbnail
    if (!isMp3) {
      const img = document.createElement("img");
      img.src = video.thumbnail || "";
      img.alt = video.title || "";
      img.addEventListener("click", () =>
        openModal(video.videoId, video.title || "")
      );
      card.appendChild(img);
    }

    const infoDiv = document.createElement("div");
    infoDiv.className = "video-info";

    const titleEl = document.createElement("h3");
    titleEl.textContent = video.title || "";
    titleEl.title = video.title || "";

    if (!isMp3) {
      titleEl.addEventListener("click", () =>
        openModal(video.videoId, video.title || "")
      );
    }

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "video-actions";

    const playBtn = document.createElement("button");
    playBtn.textContent = isMp3 ? "Play (audio below)" : "Play";

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";

    if (!isMp3) {
      playBtn.addEventListener("click", () =>
        openModal(video.videoId, video.title || "")
      );
    }

    removeBtn.addEventListener("click", () => removeVideo(video.videoId));

    actionsDiv.appendChild(playBtn);
    actionsDiv.appendChild(removeBtn);

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

    ratingSelect.addEventListener("change", () => {
      updateVideoRating(video.videoId, Number(ratingSelect.value));
    });

    ratingDiv.appendChild(ratingLabel);
    ratingDiv.appendChild(ratingSelect);

    infoDiv.appendChild(titleEl);
    infoDiv.appendChild(actionsDiv);
    infoDiv.appendChild(ratingDiv);

    card.appendChild(infoDiv);

    // For MP3 tracks – add <audio> player
    if (isMp3 && video.filePath) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = video.filePath;
      audio.style.marginTop = "8px";
      card.appendChild(audio);
    }

    playlistVideosContainer.appendChild(card);
  });
}

// ---------- Controls events ----------

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
    alert(
      "Multiple playlists UI is limited – for now Favorites is the main one.\n(Backend supports multiple playlists though 🙂)"
    );
  });
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    // אופציונלי לקרוא גם לשרת:
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (e) {
      console.warn("Logout request failed (ignored).");
    }
    sessionStorage.removeItem("currentUser");
    window.location.href = "login.html";
  });
}

// ---------- MP3 upload handling ----------

if (uploadMp3Form && mp3FileInput) {
  uploadMp3Form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const file = mp3FileInput.files[0];
    if (!file) {
      alert("Please choose an MP3 file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("playlistName", currentPlaylistName);
    formData.append("title", file.name);

    try {
      const res = await fetch(
        `/api/upload-mp3/${encodeURIComponent(currentUser.username)}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg =
          data && data.error
            ? data.error
            : "Error uploading MP3. Please try again.";
        alert(errMsg);
        return;
      }

      const track = data.track;
      if (!userPlaylists[currentPlaylistName]) {
        userPlaylists[currentPlaylistName] = [];
      }
      userPlaylists[currentPlaylistName].push(track);

      mp3FileInput.value = "";
      renderPlaylist();
      alert("MP3 uploaded and added to playlist!");
    } catch (err) {
      console.error("Error uploading MP3", err);
      alert("Network error during MP3 upload.");
    }
  });
}

// ---------- init ----------

(async function init() {
  currentPlaylistTitle.textContent = currentPlaylistName;
  await loadUserPlaylists();
  renderSidebarPlaylists();
  renderPlaylist();
})();
