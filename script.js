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
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentEditingArticle = null;
let isAdmin = false;
let commentsClickListenerAttached = false;

function openModal(id) {
  document.getElementById(id).style.display = "block";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}
// Rendre accessibles pour les attributs onclick des boutons Annuler dans le HTML
// (le script est en module, donc on exporte vers window)
window.openModal = openModal;
window.closeModal = closeModal;

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

      // Rendre le bouton "Nouvel Article" disponible à tout utilisateur connecté
      document.getElementById("adminPanel").style.display = "block";
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
  const articleForm = document.getElementById("articleForm");
  if (articleForm) {
    articleForm.addEventListener("submit", handleArticleSubmit);
  }
});

// ------------------------------------------------------------------------------
async function searchArticles(searchTerm) {
  const q = query(
    collection(db, "articles"),
    where("published", "in", [true, "true"]) // fallback booléen ou chaîne
  );
  const snapshot = await getDocs(q);

  const results = [];
  snapshot.forEach((d) => {
    const article = d.data();
    if (
      article.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.content?.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      results.push({ id: d.id, data: article });
    }
  });

  if (typeof displaySearchResults === "function") {
    displaySearchResults(results);
  }
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
  const container = document.getElementById("articlesContainer");
  container.innerHTML = "";

  try {
    let baseConstraints = [
      where("published", "in", [true, "true"]),
      orderBy("createdAt", "desc"),
      limit(articlesPerPage),
    ];

    if (isNext && lastVisible) {
      baseConstraints = [
        where("published", "in", [true, "true"]),
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        limit(articlesPerPage),
      ];
    }

    const qBase = query(collection(db, "articles"), ...baseConstraints);
    const snapshot = await getDocs(qBase);

    if (!snapshot.empty) {
      lastVisible = snapshot.docs[snapshot.docs.length - 1];

      snapshot.forEach((docSnap) => {
        const article = docSnap.data();
        const articleId = docSnap.id;

        const createdAtText = article.createdAt?.toDate
          ? article.createdAt.toDate().toLocaleString()
          : "";

        container.innerHTML += `
          <div class="article" data-article-id="${articleId}">
            <h2>${article.title || "(Sans titre)"}</h2>
            <div class="meta">${createdAtText}</div>
            <p>${article.content || ""}</p>

            <div class="comments" id="comments-${articleId}">
              <div class="comments-list" id="comments-list-${articleId}"></div>
              <div class="comment-form">
                <input type="text" id="comment-input-${articleId}" placeholder="Votre commentaire..." />
                <button class="comment-submit" data-article-id="${articleId}">Commenter</button>
              </div>
            </div>
          </div>`;

        // Charger les commentaires de l'article
        loadComments(articleId).catch(() => {});
      });

      // Délégation d'événements pour les formulaires de commentaires (une seule fois)
      if (!commentsClickListenerAttached) {
        container.addEventListener("click", async (e) => {
          const target = e.target;
          if (target && target.classList.contains("comment-submit")) {
            const articleId = target.getAttribute("data-article-id");
            const input = document.getElementById(`comment-input-${articleId}`);
            const text = (input?.value || "").trim();
            if (!text) return;
            await addComment(articleId, text);
            input.value = "";
            await loadComments(articleId);
          }
        });
        commentsClickListenerAttached = true;
      }
    } else {
      container.innerHTML = "<p>Aucun article à afficher.</p>";
    }
  } catch (error) {
    console.error("Erreur chargement articles:", error);
    // Fallback sans index composite: on trie par createdAt uniquement et on filtre côté client
    try {
      const qFallback = query(
        collection(db, "articles"),
        orderBy("createdAt", "desc"),
        limit(articlesPerPage)
      );
      const snap = await getDocs(qFallback);
      if (snap.empty) {
        container.innerHTML = "<p>Aucun article à afficher.</p>";
        return;
      }
      snap.forEach((docSnap) => {
        const a = docSnap.data();
        const isPublished = a.published === true || a.published === "true";
        if (!isPublished) return;
        const createdAtText = a.createdAt?.toDate
          ? a.createdAt.toDate().toLocaleString()
          : "";
        container.innerHTML += `
          <div class="article" data-article-id="${docSnap.id}">
            <h2>${a.title || "(Sans titre)"}</h2>
            <div class="meta">${createdAtText}</div>
            <p>${a.content || ""}</p>
            <div class="comments" id="comments-${docSnap.id}">
              <div class="comments-list" id="comments-list-${docSnap.id}"></div>
              <div class="comment-form">
                <input type="text" id="comment-input-${
                  docSnap.id
                }" placeholder="Votre commentaire..." />
                <button class="comment-submit" data-article-id="${
                  docSnap.id
                }">Commenter</button>
              </div>
            </div>
          </div>`;
        loadComments(docSnap.id).catch(() => {});
      });
      if (!commentsClickListenerAttached) {
        container.addEventListener("click", async (e) => {
          const target = e.target;
          if (target && target.classList.contains("comment-submit")) {
            const articleId = target.getAttribute("data-article-id");
            const input = document.getElementById(`comment-input-${articleId}`);
            const text = (input?.value || "").trim();
            if (!text) return;
            await addComment(articleId, text);
            input.value = "";
            await loadComments(articleId);
          }
        });
        commentsClickListenerAttached = true;
      }
      // Indiquer à l'utilisateur qu'un index peut être nécessaire
      container.innerHTML += `<div class="info">Astuce: si les articles n'apparaissent pas tous, crée l'index Firestore suggéré dans la console.</div>`;
    } catch (fallbackError) {
      console.error("Erreur fallback articles:", fallbackError);
      container.innerHTML = `<p>Erreur lors du chargement des articles. ${fallbackError.message}</p>`;
    }
  }
}

async function loadComments(articleId) {
  const commentsContainer = document.getElementById(
    `comments-list-${articleId}`
  );
  if (!commentsContainer) return;
  commentsContainer.innerHTML = "";

  try {
    const qComments = query(
      collection(db, "articles", articleId, "comments"),
      orderBy("createdAt", "asc")
    );
    const snap = await getDocs(qComments);
    if (snap.empty) {
      commentsContainer.innerHTML =
        '<div class="comment-empty">Aucun commentaire</div>';
      return;
    }
    snap.forEach((d) => {
      const c = d.data();
      const when = c.createdAt?.toDate
        ? c.createdAt.toDate().toLocaleString()
        : "";
      commentsContainer.innerHTML += `
        <div class="comment">
          <div class="comment-meta">${c.authorName || "Anonyme"} - ${when}</div>
          <div class="comment-text">${c.text || ""}</div>
        </div>`;
    });
  } catch (err) {
    console.error("Erreur chargement commentaires:", err);
    commentsContainer.innerHTML = `<div class="comment-error">Impossible de charger les commentaires: ${err.message}</div>`;
  }
}

async function addComment(articleId, text) {
  if (!auth.currentUser) {
    alert("Vous devez être connecté pour commenter.");
    return;
  }
  const user = auth.currentUser;
  const authorName = user.displayName || user.email || "Utilisateur";
  try {
    await addDoc(collection(db, "articles", articleId, "comments"), {
      text,
      userId: user.uid,
      authorName,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("Erreur création commentaire:", e);
    alert(`Échec de la création du commentaire: ${e.message}`);
  }
}

async function handleArticleSubmit(event) {
  event.preventDefault();
  if (!auth.currentUser) {
    alert("Vous devez être connecté pour publier un article.");
    return;
  }

  const title = document.getElementById("articleTitle").value.trim();
  const content = document.getElementById("articleContent").value.trim();
  const published = document.getElementById("articlePublished").checked;

  if (!title || !content) {
    alert("Titre et contenu sont requis.");
    return;
  }

  const user = auth.currentUser;
  const authorName = user?.displayName || user?.email || "Admin";

  try {
    await addDoc(collection(db, "articles"), {
      title,
      content,
      published,
      authorId: user?.uid || null,
      authorName,
      createdAt: serverTimestamp(),
    });
    closeModal("articleModal");
    // Réinitialiser la pagination pour voir le nouvel article en haut
    lastVisible = null;
    await loadArticlesWithPagination(false);
  } catch (e) {
    console.error("Erreur création article:", e);
    alert(`Échec de la création de l'article: ${e.message}`);
  }
}

// Upload d'images (à adapter au SDK modulaire si utilisé)
// import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";
// const storage = getStorage(app);
// async function uploadImage(file) {
//   const imageRef = ref(storage, `images/${Date.now()}_${file.name}`);
//   const snapshot = await uploadBytes(imageRef, file);
//   const downloadURL = await getDownloadURL(snapshot.ref);
//   return downloadURL;
// }

// // Dans votre formulaire d'article
// document.getElementById("imageInput").addEventListener("change", async (e) => {
//   const file = e.target.files[0];
//   if (file) {
//     const imageUrl = await uploadImage(file);
//     // Insérer l'URL dans le contenu de l'article
//   }
// });
