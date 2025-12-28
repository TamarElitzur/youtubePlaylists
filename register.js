
console.log("register.js loaded");

const registerForm = document.getElementById("registerForm");
const errorDiv = document.getElementById("errorMessages");

// localStorage- return the users list
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

// save the users list in the localStorage
function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

// checks if password is legal
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
    errors.push("Password must contain at least one special character (non-alphanumeric).");
  }

  return errors;
}


registerForm.addEventListener("submit", function (event) {
  // not load
  event.preventDefault();

  // clean previous error msg
  errorDiv.innerHTML = "";

  // reading values from fields
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const firstName = document.getElementById("firstName").value.trim();
  const imageUrl = document.getElementById("imageUrl").value.trim();

  const errors = [];

  // must fields
  if (!username || !password || !confirmPassword || !firstName || !imageUrl) {
    errors.push("All fields are required.");
  }

  // checks if user name exsist
  const users = getUsers();
  const existingUser = users.find((u) => u.username === username);
  if (existingUser) {
    errors.push("Username already exists. Please choose another one.");
  }

  // checks password rules
  const passwordErrors = validatePassword(password);
  errors.push(...passwordErrors);

  // valid same password
  if (password !== confirmPassword) {
    errors.push("Passwords do not match.");
  }

  // if there are errors- display list and go back
  if (errors.length > 0) {
    const ul = document.createElement("ul");
    errors.forEach((msg) => {
      const li = document.createElement("li");
      li.textContent = msg;
      ul.appendChild(li);
    });
    errorDiv.appendChild(ul);
    return;
  }

  // if everything ok, create user object
  const newUser = {
    username: username,
    password: password,
    firstName: firstName,
    imageUrl: imageUrl,
  };

  // add to users list and save
  users.push(newUser);
  saveUsers(users);

  // msg to user and go to login page
  alert("Registration successful! Redirecting to login page...");
  window.location.href = "login.html";
});
