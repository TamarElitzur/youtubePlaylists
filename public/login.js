console.log("login.js loaded");

const loginForm = document.getElementById("loginForm");
const loginErrorDiv = document.getElementById("loginErrorMessages");

/**
 * Show a single error message in the login error div.
 */
function showLoginError(msg) {
  if (!loginErrorDiv) {
    console.error("loginErrorMessages element not found in DOM");
    return;
  }
  loginErrorDiv.textContent = msg || "";
}

if (!loginForm) {
  console.error("loginForm not found in DOM");
} else {
  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    showLoginError("");

    const username = document
      .getElementById("loginUsername")
      .value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!username || !password) {
      showLoginError("Both username and password are required.");
      return;
    }

    try {
      console.log("Sending /api/login request...");
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const serverError =
          data && data.error
            ? data.error
            : "Login failed. Please try again.";
        showLoginError(serverError);
        return;
      }

      // Login success – save the user in sessionStorage
      const user = data.user || {};
      const currentUser = {
        username: user.username,
        firstName: user.firstName,
        imageUrl: user.imageUrl,
      };

      sessionStorage.setItem("currentUser", JSON.stringify(currentUser));

      // Check if we came here with returnUrl in query string
      const url = new URL(window.location.href);
      const returnUrl = url.searchParams.get("returnUrl");

      alert("Login successful! Redirecting...");

      if (returnUrl) {
        window.location.href = decodeURIComponent(returnUrl);
      } else {
        window.location.href = "search.html";
      }
    } catch (err) {
      console.error("Error calling /api/login", err);
      showLoginError("Network error. Please try again later.");
    }
  });
}
