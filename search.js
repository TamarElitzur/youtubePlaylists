console.log("search.js loaded");

// try to read the connected user's name from the sessionStorage
const currentUserJson = sessionStorage.getItem("currentUser");

if (!currentUserJson) {
  // if there is not connected user, return to login page
  alert("You must be logged in to use the search page.");
  window.location.href = "login.html";
} else {
  try {
    const currentUser = JSON.parse(currentUserJson);

    const welcomeText = document.getElementById("welcomeText");
    const userImage = document.getElementById("userImage");

    // display hello msg + private name
    welcomeText.textContent = `Hello, ${currentUser.firstName}`;

    // display picture
    userImage.src = currentUser.imageUrl || "";
  } catch (e) {
    console.error("Error parsing currentUser from sessionStorage", e);
    window.location.href = "login.html";
  }
}
