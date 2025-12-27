console.log("login.js loaded");

// take the file and errors div
const loginForm = document.getElementById("loginForm");
const loginErrorDiv = document.getElementById("loginErrorMessages");

// return the users list from localStorage
function getUsers() {
  const usersJson = localStorage.getItem("users");
  if (!usersJson) {
    return [];
  }

  try {
    return JSON.parse(usersJson);
  } catch (e) {
    console.error("Error parsing users from localStorage", e);
    return [];
  }
}

loginForm.addEventListener("submit", function (event) {
  event.preventDefault();

  // clean previous msg
  loginErrorDiv.textContent = "";

  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) {
    loginErrorDiv.textContent = "Both username and password are required.";
    return;
  }

  const users = getUsers();
  const existingUser = users.find((u) => u.username === username);

  if (!existingUser) {
    loginErrorDiv.textContent = "User not found. Please register first.";
    return;
  }

  if (existingUser.password !== password) {
    loginErrorDiv.textContent = "Incorrect password.";
    return;
  }

  // if we get here- the login is succeed
  // save the connected user in sessionStorage
  const currentUser = {
    username: existingUser.username,
    firstName: existingUser.firstName,
    imageUrl: existingUser.imageUrl,
  };

  sessionStorage.setItem("currentUser", JSON.stringify(currentUser));

  alert("Login successful! Redirecting to search page...");
  window.location.href = "search.html";
});
