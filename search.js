console.log("search.js loaded");

const YOUTUBE_API_KEY = "AIzaSyCzM8S4Q9h5vo-fyRIc55sdO1Xk3ikRYjI";
const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

// user info (Hello, name + image)
const currentUserJson = sessionStorage.getItem("currentUser");

if (!currentUserJson) {
  const returnUrl = encodeURIComponent(window.location.href);
  window.location.href = `login.html?returnUrl=${returnUrl}`;
} else {
  try {
    const currentUser = JSON.parse(currentUserJson);

    const welcomeText = document.getElementById("welcomeText");
    const userImage = document.getElementById("userImage");

    welcomeText.textContent = `Hello, ${currentUser.firstName}`;
    userImage.src = currentUser.imageUrl || "";
  } catch (e) {
    console.error("Error parsing currentUser from sessionStorage", e);
    window.location.href = "login.html";
  }
}


// elements for search & results
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const resultsContainer = document.getElementById("resultsContainer");

// call YouTube Data API to search videos
async function searchYouTube(query) {
  const url = `${YOUTUBE_SEARCH_URL}?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(
    query
  )}&key=${YOUTUBE_API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("YouTube API request failed");
  }

  const data = await response.json();
  return data.items; // array of videos
}

// render the videos as cards
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

  const h3 = document.createElement("h3");
  h3.textContent = title;
  h3.title = title; // tooltip

  // little V
  const favIndicator = document.createElement("span");
  favIndicator.className = "favorite-indicator";
  favIndicator.textContent = "✓";
  favIndicator.style.display = "none";
  h3.appendChild(favIndicator);

  const playBtn = document.createElement("button");
  playBtn.textContent = "Play";

  const favBtn = document.createElement("button");
  favBtn.textContent = "Add to favorites";

  // check if already in favorites
  const alreadyFavorite = isVideoInFavorites(videoId);
  if (alreadyFavorite) {
    favBtn.textContent = "In favorites ✓";
    favBtn.disabled = true;
    favBtn.classList.add("in-favorites");
    favIndicator.style.display = "inline";
  }

  favBtn.addEventListener("click", () => {
    addToFavorites({
      videoId,
      title,
      thumbnail,
    });

    // after we tried to add - if now it's in favorites, we will lock the button
    if (isVideoInFavorites(videoId)) {
      favBtn.textContent = "In favorites ✓";
      favBtn.disabled = true;
      favBtn.classList.add("in-favorites");
      favIndicator.style.display = "inline";
    }
  });


    // all of these open the modal
    img.addEventListener("click", () => openModal(videoId, title));
    h3.addEventListener("click", () => openModal(videoId, title));
    playBtn.addEventListener("click", () => openModal(videoId, title));

    card.appendChild(img);
    card.appendChild(h3);
    card.appendChild(playBtn);
    card.appendChild(favBtn);

    resultsContainer.appendChild(card);
  });
}


// query string helpers
function setSearchQueryParam(query) {
  const url = new URL(window.location.href);

  if (query) {
    url.searchParams.set("q", query);
  } else {
    url.searchParams.delete("q");
  }

  // not reload the page, but only update the URL
  window.history.replaceState({}, "", url.toString());
}

function getSearchQueryParam() {
  const url = new URL(window.location.href);
  return url.searchParams.get("q") || "";
}

// search and display results
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

// ---------- FAVORITES STORAGE ----------

// read favorites object from localStorage
function getFavorites() {
  const json = localStorage.getItem("favorites");
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

// save favorites object to localStorage
function saveFavorites(favs) {
  localStorage.setItem("favorites", JSON.stringify(favs));
}

// add video to current user's favorites
function addToFavorites(video) {
  const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
  if (!currentUser) return;

  const username = currentUser.username;

  const favorites = getFavorites();

  // if user has no list yet → create it
  if (!favorites[username]) {
    favorites[username] = [];
  }

  // avoid duplicates
  const exists = favorites[username].some(v => v.videoId === video.videoId);
  if (exists) {
    alert("This video is already in your favorites 🙂");
    return;
  }

  favorites[username].push(video);

  saveFavorites(favorites);

  alert("Added to favorites!");
}

// check if a video is already in user's favorites
function isVideoInFavorites(videoId) {
  const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
  if (!currentUser) return false;

  const username = currentUser.username;
  const favorites = getFavorites();
  const list = favorites[username] || [];

  return list.some((v) => v.videoId === videoId);
}


// search box logic
if (searchInput && searchButton && resultsContainer) {
  // search bottom
  searchButton.addEventListener("click", async function () {
    const query = searchInput.value.trim();

    if (!query) {
      alert("Please enter search text.");
      return;
    }

    // update the query string
    setSearchQueryParam(query);

    // doing search
    await performSearch(query);
  });

  // search also with Enter
  searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      searchButton.click();
    }
  });

  // initial charge according to query string
  const initialQuery = getSearchQueryParam();
  if (initialQuery) {
    searchInput.value = initialQuery;
    performSearch(initialQuery);
  }
} else {
  console.error("Search elements not found in the DOM");
}

// modal elements
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
  modalPlayer.src = ""; // stop the play
}

if (modalCloseBtn && modal) {
  modalCloseBtn.addEventListener("click", closeModal);

  // close with tap out the content
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  // closing with ESC
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
}
