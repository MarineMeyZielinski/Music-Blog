// theme-gothic.js - Simplifié: bascule directe sans popup
let currentTheme = "light";

function applySavedTheme() {
  const saved = localStorage.getItem("blogTheme");
  if (saved === "dark") {
    currentTheme = "dark";
    document.body.classList.remove("light");
    document.body.classList.add("dark", "bg-darkMode");
    const btn = document.getElementById("themeToggle");
    if (btn) btn.innerHTML = "☀️ Light";
  } else {
    currentTheme = "light";
    document.body.classList.remove("dark", "bg-darkMode");
    document.body.classList.add("light");
    const btn = document.getElementById("themeToggle");
    if (btn) btn.innerHTML = "🌙 Dark";
  }
}

function attemptThemeChange() {
  if (currentTheme === "light") {
    currentTheme = "dark";
    document.body.classList.remove("light");
    document.body.classList.add("dark", "bg-darkMode");
    localStorage.setItem("blogTheme", "dark");
    const btn = document.getElementById("themeToggle");
    if (btn) btn.innerHTML = "☀️ Light";
  } else {
    currentTheme = "light";
    document.body.classList.remove("dark", "bg-darkMode");
    document.body.classList.add("light");
    localStorage.setItem("blogTheme", "light");
    const btn = document.getElementById("themeToggle");
    if (btn) btn.innerHTML = "🌙 Dark";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applySavedTheme);
} else {
  applySavedTheme();
}

window.attemptThemeChange = attemptThemeChange;

window.declineDarkSide = declineDarkSide;
