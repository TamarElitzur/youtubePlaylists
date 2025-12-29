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

// toast elements
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastLink = document.getElementById("toastLink");
let toastTimeoutId = null;

function showToast(message) {
  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;

  toast.classList.remove("hidden");
  toast.classList.add("show");

  // hide after 4 seconds
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
  }

  toastTimeoutId = setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hidden");
  }, 4000);
}


// call YouTube Data API to search videos
// helper
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

// helper - display views number
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

// call YouTube Data API to search videos + bring duration and views
async function searchYouTube(query) {
  // bring only basic search - snippet
  const searchUrl = `${YOUTUBE_SEARCH_URL}?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(
    query
  )}&key=${YOUTUBE_API_KEY}`;

  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) {
    throw new Error("YouTube API search request failed");
  }

  const searchData = await searchResponse.json();
  const items = searchData.items || [];

  if (items.length === 0) {
    return [];
  }

  // collect all the videoId for bring another details
  const videoIds = items
    .map((item) => item.id && item.id.videoId)
    .filter(Boolean);

  const detailsUrl =
    "https://www.googleapis.com/youtube/v3/videos" +
    `?part=contentDetails,statistics&id=${videoIds.join(",")}` +
    `&key=${YOUTUBE_API_KEY}`;

  const detailsResponse = await fetch(detailsUrl);
  if (!detailsResponse.ok) {
    // if fail - return only the basic data
    console.warn("Failed to load video details", detailsResponse.status);
    return items;
  }

  const detailsData = await detailsResponse.json();
  const detailsItems = detailsData.items || [];

  // build map from videoId → details
  const detailsMap = {};
  detailsItems.forEach((d) => {
    detailsMap[d.id] = d;
  });

  // connect the data to original videos
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

    // all the data text
    const infoDiv = document.createElement("div");
    infoDiv.className = "video-info";

    const h3 = document.createElement("h3");
    h3.textContent = title;
    h3.title = title; // tooltip

    // V duration + views
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

    // little V if already in favorites
    const favIndicator = document.createElement("span");
    favIndicator.className = "favorite-indicator";
    favIndicator.textContent = "✓";
    favIndicator.style.display = "none";
    h3.appendChild(favIndicator);

    // V buttons
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "video-actions";

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

      // after the adding - lock the button if now in favorites
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

    // connecting all together
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

  showToast("Video added to your favorites playlist.");
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
