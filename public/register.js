console.log("register.js loaded");

const registerForm = document.getElementById("registerForm");
// HTML id is: registerErrorMessages
const errorDiv = document.getElementById("registerErrorMessages");

/**
 * Validate password rules on the client side only.
 */
function validatePassword(password) {
  const errors = [];

  if (password.length < 6) {
    errors.push("Password must be at least 6 characters long.");
  }
  if (!/[A-Za-z]/.test(password)) {
    errors.push("Password must contain at least one letter.");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one digit.");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push(
      "Password must contain at least one special character (non-alphanumeric)."
    );
  }

  return errors;
}

/**
 * Render an array of error messages into the error div.
 */
function showErrors(errors) {
  if (!errorDiv) {
    console.error("registerErrorMessages element not found in DOM");
    return;
  }

  errorDiv.innerHTML = "";
  if (!errors || errors.length === 0) return;

  const ul = document.createElement("ul");
  errors.forEach((msg) => {
    const li = document.createElement("li");
    li.textContent = msg;
    ul.appendChild(li);
  });
  errorDiv.appendChild(ul);
}

if (!registerForm) {
  console.error("registerForm not found in DOM");
} else {
  registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (errorDiv) {
      errorDiv.innerHTML = "";
    }

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword =
      document.getElementById("confirmPassword").value;
    const firstName = document.getElementById("firstName").value.trim();
    const imageUrl = document.getElementById("imageUrl").value.trim();

    const errors = [];

    // Required fields
    if (!username || !password || !confirmPassword || !firstName || !imageUrl) {
      errors.push("All fields are required.");
    }

    // Password rules
    const passwordErrors = validatePassword(password);
    errors.push(...passwordErrors);

    // Passwords match
    if (password !== confirmPassword) {
      errors.push("Passwords do not match.");
    }

    if (errors.length > 0) {
      showErrors(errors);
      return;
    }

    // Call backend API /api/register
    try {
      console.log("Sending /api/register request...");
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          firstName,
          imageUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const serverError =
          data && data.error
            ? data.error
            : "Registration failed. Please try again.";
        showErrors([serverError]);
        return;
      }

      alert("Registration successful! Redirecting to login page...");
      window.location.href = "login.html";
    } catch (err) {
      console.error("Error calling /api/register", err);
      showErrors(["Network error. Please try again later."]);
    }
  });
}
