// script.js
import { firebaseConfig } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDocs,
  getDoc,
  setDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentEditingArticle = null;
let isAdmin = false;

function openModal(id) {
  document.getElementById(id).style.display = "block";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

async function loadArticles() {
  // Implémenter la récupération et l'affichage des articles ici
  // Placeholder, à compléter selon ta logique
  const container = document.getElementById("articlesContainer");
  container.innerHTML = "<p>Chargement des articles...</p>";
  // toggleDarkMode();
  await loadArticlesWithPagination();
  // TODO: fetch articles from Firestore and display them
}

async function logout() {
  await signOut(auth);
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeModal("loginModal");
  } catch (error) {
    alert("Erreur connexion : " + error.message);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const displayName = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    await updateProfile(userCredential.user, { displayName });

    // Création du profil utilisateur en base
    const userRef = doc(db, "users", userCredential.user.uid);
    await setDoc(userRef, {
      email,
      displayName,
      role: "user",
      createdAt: serverTimestamp(),
    });

    closeModal("registerModal");
  } catch (error) {
    alert("Erreur inscription : " + error.message);
  }
}

// Observer d'authentification
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (user) {
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        isAdmin = userData.role === "admin";
        document.getElementById("userInfo").textContent = `Bonjour, ${
          userData.displayName || user.email
        }`;
      } else {
        // Créer profil si inexistant
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName || user.email.split("@")[0],
          role: "user",
          createdAt: serverTimestamp(),
        });
        isAdmin = false;
        document.getElementById("userInfo").textContent = `Bonjour, ${
          user.displayName || user.email.split("@")[0]
        }`;
      }

      document.getElementById("loginBtn").style.display = "none";
      document.getElementById("registerBtn").style.display = "none";
      document.getElementById("logoutBtn").style.display = "block";

      document.getElementById("adminPanel").style.display = isAdmin
        ? "block"
        : "none";
    } catch (error) {
      console.error("Erreur récupération profil :", error);
    }
  } else {
    document.getElementById("userInfo").textContent = "";
    document.getElementById("loginBtn").style.display = "block";
    document.getElementById("registerBtn").style.display = "block";
    document.getElementById("logoutBtn").style.display = "none";
    document.getElementById("adminPanel").style.display = "none";
    isAdmin = false;
  }

  loadArticles();
});

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("loginBtn")
    .addEventListener("click", () => openModal("loginModal"));
  document
    .getElementById("registerBtn")
    .addEventListener("click", () => openModal("registerModal"));
  document.getElementById("logoutBtn").addEventListener("click", logout);

  const newArticleBtn = document.getElementById("newArticleBtn");
  if (newArticleBtn) {
    newArticleBtn.addEventListener("click", () => {
      currentEditingArticle = null;
      document.getElementById("articleModalTitle").textContent =
        "Nouvel Article";
      document.getElementById("articleForm").reset();
      openModal("articleModal");
    });
  }

  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document
    .getElementById("registerForm")
    .addEventListener("submit", handleRegister);
  // TODO: Ajouter la fonction handleArticleSubmit et lier le formulaire articleForm
});

// ------------------------------------------------------------------------------
async function searchArticles(searchTerm) {
  const snapshot = await db
    .collection("articles")
    .where("published", "==", true)
    .get();

  const results = [];
  snapshot.forEach((doc) => {
    const article = doc.data();
    if (
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.content.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      results.push({ id: doc.id, data: article });
    }
  });

  displaySearchResults(results);
}

/* // JavaScript pour le toggle */
function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem(
    "darkMode",
    document.body.classList.contains("dark-mode")
  );
}

/* // Au chargement */
if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark-mode");
}

// Pagination des articles
let lastVisible = null;
const articlesPerPage = 10;

// -------------------------------------------------------------------------
async function loadArticlesWithPagination(isNext = true) {
  let queryArticles = collection(db, "articles");
  const listArticles = query(
    queryArticles,
    where(
      "published",
      "==",
      "true",
      orderBy("createdAt", "desc"),
      limit(articlesPerPage)
    )
  );

  //ancienne version avec l'ancienne syntaxe
  // db.collection("articles")
  //   .where("published", "==", true)
  //   .orderBy("createdAt", "desc")
  //   .limit(articlesPerPage);

  if (isNext && lastVisible) {
    queryArticles = q.startAfter(lastVisible);
  }

  const snapshot = await getDocs(listArticles);

  if (!snapshot.empty) {
    lastVisible = snapshot.docs[snapshot.docs.length - 1];
    snapshot.forEach((doc) => {
      const article = doc.data();
      const container = document.getElementById("articlesContainer");
      container.innerHTML += `<div class="article">
        <h2>${article.title}</h2>
      </div>`;
    });
  }
}

// Upload d'images
async function uploadImage(file) {
  const storageRef = firebase.storage().ref();
  const imageRef = storageRef.child("images/" + Date.now() + "_" + file.name);

  const snapshot = await imageRef.put(file);
  const downloadURL = await snapshot.ref.getDownloadURL();

  return downloadURL;
}

// // Dans votre formulaire d'article
// document.getElementById("imageInput").addEventListener("change", async (e) => {
//   const file = e.target.files[0];
//   if (file) {
//     const imageUrl = await uploadImage(file);
//     // Insérer l'URL dans le contenu de l'article
//   }
// });
