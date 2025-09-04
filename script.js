// script.js
import { firebaseConfig } from './config.js';
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
  getDoc,
  setDoc,
  collection,
  serverTimestamp,
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
  const container = document.getElementById('articlesContainer');
  container.innerHTML = "<p>Chargement des articles...</p>";
  // TODO: fetch articles from Firestore and display them
}

async function logout() {
  await signOut(auth);
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeModal('loginModal');
  } catch (error) {
    alert("Erreur connexion : " + error.message);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const displayName = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value.trim();

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName });

    // Création du profil utilisateur en base
    const userRef = doc(db, 'users', userCredential.user.uid);
    await setDoc(userRef, {
      email,
      displayName,
      role: 'user',
      createdAt: serverTimestamp(),
    });

    closeModal('registerModal');
  } catch (error) {
    alert("Erreur inscription : " + error.message);
  }
}

// Observer d'authentification
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (user) {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        isAdmin = userData.role === 'admin';
        document.getElementById('userInfo').textContent = `Bonjour, ${userData.displayName || user.email}`;
      } else {
        // Créer profil si inexistant
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          role: 'user',
          createdAt: serverTimestamp(),
        });
        isAdmin = false;
        document.getElementById('userInfo').textContent = `Bonjour, ${user.displayName || user.email.split('@')[0]}`;
      }

      document.getElementById('loginBtn').style.display = 'none';
      document.getElementById('registerBtn').style.display = 'none';
      document.getElementById('logoutBtn').style.display = 'block';

      document.getElementById('adminPanel').style.display = isAdmin ? 'block' : 'none';

    } catch (error) {
      console.error('Erreur récupération profil :', error);
    }
  } else {
    document.getElementById('userInfo').textContent = '';
    document.getElementById('loginBtn').style.display = 'block';
    document.getElementById('registerBtn').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'none';
    isAdmin = false;
  }

  loadArticles();
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn').addEventListener('click', () => openModal('loginModal'));
  document.getElementById('registerBtn').addEventListener('click', () => openModal('registerModal'));
  document.getElementById('logoutBtn').addEventListener('click', logout);

  const newArticleBtn = document.getElementById('newArticleBtn');
  if (newArticleBtn) {
    newArticleBtn.addEventListener('click', () => {
      currentEditingArticle = null;
      document.getElementById('articleModalTitle').textContent = 'Nouvel Article';
      document.getElementById('articleForm').reset();
      openModal('articleModal');
    });
  }

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
  // TODO: Ajouter la fonction handleArticleSubmit et lier le formulaire articleForm
});
