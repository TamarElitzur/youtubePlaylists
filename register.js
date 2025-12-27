// נוודא שהקובץ נטען
console.log("register.js loaded");

// נאתר את הטופס ואת div השגיאות
const registerForm = document.getElementById("registerForm");
const errorDiv = document.getElementById("errorMessages");

// מאזין לשליחת הטופס
registerForm.addEventListener("submit", function (event) {
  // מונעים רענון דף
  event.preventDefault();

  console.log("register form submitted!");

  // מנקים שגיאות קודמות
  errorDiv.textContent = "";

  // בינתיים נציג הודעה לניסיון
  errorDiv.textContent = "Form submit handler is working 🙂";
});
