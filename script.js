// script.js - Logique principale du blog
import { firebaseConfig } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {
  getFirestore, doc, addDoc, getDocs, getDoc, setDoc, collection,
  serverTimestamp, query, where, orderBy, limit, startAfter
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// =====================
// FIREBASE INITIALIZATION
// =====================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =====================
// STATE MANAGEMENT
// =====================
class BlogState {
  constructor() {
    this.currentUser = null;
    this.isAdmin = false;
    this.lastVisible = null;
    this.articlesPerPage = 10;
    this.commentsListenerAttached = false;
  }

  setUser(user, isAdmin = false) {
    this.currentUser = user;
    this.isAdmin = isAdmin;
  }

  reset() {
    this.currentUser = null;
    this.isAdmin = false;
    this.lastVisible = null;
  }
}

const state = new BlogState();

// =====================
// THEME MANAGEMENT
// =====================
class ThemeManager {
  constructor() {
    this.currentTheme = 'light';
    this.init();
  }

  init() {
    this.applySavedTheme();
    document.getElementById('themeToggle').addEventListener('click', () => this.toggle());
  }

  applySavedTheme() {
    const saved = localStorage.getItem('blogTheme');
    if (saved === 'dark') {
      this.setDark();
    } else {
      this.setLight();
    }
  }

  toggle() {
    if (this.currentTheme === 'light') {
      this.setDark();
    } else {
      this.setLight();
    }
  }

  setDark() {
    this.currentTheme = 'dark';
    document.body.classList.remove('light');
    document.body.classList.add('dark', 'bg-darkMode');
    localStorage.setItem('blogTheme', 'dark');
    document.getElementById('themeToggle').innerHTML = 'Light';
  }

  setLight() {
    this.currentTheme = 'light';
    document.body.classList.remove('dark', 'bg-darkMode');
    document.body.classList.add('light');
    localStorage.setItem('blogTheme', 'light');
    document.getElementById('themeToggle').innerHTML = 'Dark';
  }
}

// =====================
// MODAL MANAGEMENT
// =====================
class ModalManager {
  constructor() {
    this.init();
  }

  init() {
    // Event delegation pour les boutons de fermeture
    document.addEventListener('click', (e) => {
      if (e.target.dataset.close) {
        this.close(e.target.dataset.close);
      }
    });

    // Fermeture par clic en dehors
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.close(e.target.id);
      }
    });

    // Fermeture par Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
          this.close(modal.id);
        });
      }
    });
  }

  open(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
    }
  }

  close(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
    }
  }
}

// =====================
// AUTH MANAGEMENT
// =====================
class AuthManager {
  constructor(modalManager) {
    this.modalManager = modalManager;
    this.init();
  }

  init() {
    document.getElementById('loginBtn').addEventListener('click', () => 
      this.modalManager.open('loginModal'));
    document.getElementById('registerBtn').addEventListener('click', () => 
      this.modalManager.open('registerModal'));
    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

    document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));

    // Observer d'authentification
    onAuthStateChanged(auth, (user) => this.handleAuthChange(user));
  }

  async handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      this.modalManager.close('loginModal');
      this.showMessage('Connexion réussie !', 'success');
      // Réinitialiser le formulaire
      document.getElementById('loginForm').reset();
    } catch (error) {
      console.error('Erreur connexion:', error);
      this.showMessage('Erreur de connexion : ' + this.getErrorMessage(error), 'error');
    }
  }

  async handleRegister(event) {
    event.preventDefault();
    const displayName = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();

    if (password.length < 6) {
      this.showMessage('Le mot de passe doit contenir au moins 6 caractères', 'error');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName });

      const userRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userRef, {
        email,
        displayName,
        role: 'user',
        createdAt: serverTimestamp(),
      });

      this.modalManager.close('registerModal');
      this.showMessage('Inscription réussie !', 'success');
      // Réinitialiser le formulaire
      document.getElementById('registerForm').reset();
    } catch (error) {
      console.error('Erreur inscription:', error);
      this.showMessage('Erreur d\'inscription : ' + this.getErrorMessage(error), 'error');
    }
  }

  async handleAuthChange(user) {
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        let userData;
        if (userSnap.exists()) {
          userData = userSnap.data();
        } else {
          userData = {
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            role: 'user',
          };
          await setDoc(userRef, { ...userData, createdAt: serverTimestamp() });
        }

        state.setUser(user, userData.role === 'admin');
        this.updateUI(userData.displayName || user.email);
        await window.articleManager.loadArticles();
      } catch (error) {
        console.error('Erreur récupération profil :', error);
        this.showMessage('Erreur lors de la récupération du profil', 'error');
      }
    } else {
      state.reset();
      this.updateUI(null);
      await window.articleManager.loadArticles();
    }
  }

  updateUI(displayName) {
    const userInfo = document.getElementById('userInfo');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminPanel = document.getElementById('adminPanel');

    if (displayName) {
      userInfo.textContent = `Bonjour, ${displayName}`;
      loginBtn.style.display = 'none';
      registerBtn.style.display = 'none';
      logoutBtn.style.display = 'block';
      adminPanel.style.display = 'block';
    } else {
      userInfo.textContent = '';
      loginBtn.style.display = 'block';
      registerBtn.style.display = 'block';
      logoutBtn.style.display = 'none';
      adminPanel.style.display = 'none';
    }
  }

  async logout() {
    try {
      await signOut(auth);
      this.showMessage('Déconnexion réussie', 'success');
    } catch (error) {
      console.error('Erreur déconnexion:', error);
      this.showMessage('Erreur de déconnexion', 'error');
    }
  }

  getErrorMessage(error) {
    const errorMessages = {
      'auth/user-not-found': 'Utilisateur non trouvé',
      'auth/wrong-password': 'Mot de passe incorrect',
      'auth/email-already-in-use': 'Cette adresse email est déjà utilisée',
      'auth/invalid-email': 'Adresse email invalide',
      'auth/weak-password': 'Mot de passe trop faible',
      'auth/too-many-requests': 'Trop de tentatives, veuillez réessayer plus tard',
      'auth/network-request-failed': 'Erreur de connexion réseau'
    };
    return errorMessages[error.code] || error.message;
  }

  showMessage(message, type = 'info') {
    const container = document.getElementById('messageContainer');
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    
    container.appendChild(messageEl);
    setTimeout(() => messageEl.remove(), 4000);
  }
}

// =====================
// ARTICLE MANAGEMENT
// =====================
class ArticleManager {
  constructor(modalManager) {
    this.modalManager = modalManager;
    this.init();
  }

  init() {
    const newArticleBtn = document.getElementById('newArticleBtn');
    if (newArticleBtn) {
      newArticleBtn.addEventListener('click', () => this.openArticleForm());
    }

    const articleForm = document.getElementById('articleForm');
    if (articleForm) {
      articleForm.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  }

  openArticleForm() {
    document.getElementById('articleModalTitle').textContent = 'Nouvel Article';
    document.getElementById('articleForm').reset();
    this.modalManager.open('articleModal');
  }

  async handleSubmit(event) {
    event.preventDefault();

    if (!state.currentUser) {
      alert('Vous devez être connecté pour publier un article.');
      return;
    }

    const title = document.getElementById('articleTitle').value.trim();
    const content = document.getElementById('articleContent').value.trim();
    const published = document.getElementById('articlePublished').checked;

    if (!title || !content) {
      alert('Titre et contenu sont requis.');
      return;
    }

    try {
      await addDoc(collection(db, 'articles'), {
        title,
        content,
        published,
        authorId: state.currentUser.uid,
        authorName: state.currentUser.displayName || state.currentUser.email,
        createdAt: serverTimestamp(),
      });

      this.modalManager.close('articleModal');
      state.lastVisible = null;
      await this.loadArticles();
      
      // Afficher message de succès
      const authManager = window.authManager;
      if (authManager) {
        authManager.showMessage('Article créé avec succès !', 'success');
      }
    } catch (error) {
      console.error('Erreur création article:', error);
      alert(`Échec de la création de l'article: ${error.message}`);
    }
  }

  async loadArticles() {
    const container = document.getElementById('articlesContainer');
    container.innerHTML = '<div class="loading"><div class="spinner"></div>Chargement des articles...</div>';

    try {
      const q = query(
        collection(db, 'articles'),
        where('published', 'in', [true, 'true']),
        orderBy('createdAt', 'desc'),
        limit(state.articlesPerPage)
      );

      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        container.innerHTML = '';
        snapshot.forEach((docSnap) => this.renderArticle(docSnap));
        this.attachCommentListeners();
      } else {
        container.innerHTML = '<p>Aucun article à afficher.</p>';
      }
    } catch (error) {
      console.error('Erreur chargement articles:', error);
      // Fallback sans les contraintes de requête complexes
      await this.loadArticlesFallback();
    }
  }

  async loadArticlesFallback() {
    const container = document.getElementById('articlesContainer');
    
    try {
      const q = query(
        collection(db, 'articles'),
        orderBy('createdAt', 'desc'),
        limit(state.articlesPerPage)
      );

      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        container.innerHTML = '';
        snapshot.forEach((docSnap) => {
          const article = docSnap.data();
          // Filtrer côté client les articles publiés
          const isPublished = article.published === true || article.published === 'true';
          if (isPublished) {
            this.renderArticle(docSnap);
          }
        });
        this.attachCommentListeners();
        
        // Message informatif
        const infoEl = document.createElement('div');
        infoEl.className = 'info';
        infoEl.style.cssText = 'padding: 10px; margin: 20px 0; background: rgba(53, 82, 237, 0.1); border-radius: 5px; font-size: 0.9em;';
        infoEl.textContent = 'Info: Pour optimiser les performances, configurez les index Firestore selon les suggestions de la console.';
        container.appendChild(infoEl);
      } else {
        container.innerHTML = '<p>Aucun article à afficher.</p>';
      }
    } catch (error) {
      console.error('Erreur fallback articles:', error);
      container.innerHTML = `<p>Erreur lors du chargement des articles: ${error.message}</p>`;
    }
  }

  renderArticle(docSnap) {
    const article = docSnap.data();
    const articleId = docSnap.id;
    const createdAt = article.createdAt?.toDate?.() ? 
      article.createdAt.toDate().toLocaleString() : '';

    const container = document.getElementById('articlesContainer');
    const articleEl = document.createElement('div');
    articleEl.className = 'article';
    articleEl.dataset.articleId = articleId;
    articleEl.innerHTML = `
      <h2>${this.escapeHtml(article.title || '(Sans titre)')}</h2>
      <div class="meta">${createdAt}</div>
      <p>${this.escapeHtml(article.content || '')}</p>
      <div class="comments" id="comments-${articleId}">
        <div class="comments-list" id="comments-list-${articleId}"></div>
        ${state.currentUser ? `
          <div class="comment-form">
            <input type="text" id="comment-input-${articleId}" placeholder="Votre commentaire..." />
            <button class="comment-submit" data-article-id="${articleId}">Commenter</button>
          </div>
        ` : '<p style="font-size: 0.9em; color: var(--text-muted);">Connectez-vous pour commenter</p>'}
      </div>
    `;

    container.appendChild(articleEl);
    this.loadComments(articleId);
  }

  attachCommentListeners() {
    if (state.commentsListenerAttached) return;

    document.getElementById('articlesContainer').addEventListener('click', async (e) => {
      if (e.target.classList.contains('comment-submit')) {
        const articleId = e.target.dataset.articleId;
        const input = document.getElementById(`comment-input-${articleId}`);
        const text = input?.value?.trim();
        
        if (!text) return;
        
        await this.addComment(articleId, text);
        input.value = '';
        await this.loadComments(articleId);
      }
    });

    // Event listener pour Enter dans les champs de commentaire
    document.getElementById('articlesContainer').addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && e.target.id.startsWith('comment-input-')) {
        const articleId = e.target.id.replace('comment-input-', '');
        const text = e.target.value.trim();
        
        if (!text) return;
        
        await this.addComment(articleId, text);
        e.target.value = '';
        await this.loadComments(articleId);
      }
    });

    state.commentsListenerAttached = true;
  }

  async loadComments(articleId) {
    const container = document.getElementById(`comments-list-${articleId}`);
    if (!container) return;

    try {
      const q = query(
        collection(db, 'articles', articleId, 'comments'),
        orderBy('createdAt', 'asc')
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9em;">Aucun commentaire</div>';
        return;
      }

      container.innerHTML = '';
      snapshot.forEach((doc) => {
        const comment = doc.data();
        const commentEl = document.createElement('div');
        commentEl.className = 'comment';
        commentEl.innerHTML = `
          <div class="comment-meta">${this.escapeHtml(comment.authorName || 'Anonyme')} - ${
            comment.createdAt?.toDate?.() ? comment.createdAt.toDate().toLocaleString() : ''
          }</div>
          <div class="comment-text">${this.escapeHtml(comment.text || '')}</div>
        `;
        container.appendChild(commentEl);
      });
    } catch (error) {
      console.error('Erreur chargement commentaires:', error);
      container.innerHTML = '<div style="color: var(--accent-alt); font-size: 0.9em;">Erreur lors du chargement des commentaires</div>';
    }
  }

  async addComment(articleId, text) {
    if (!state.currentUser) {
      alert('Vous devez être connecté pour commenter.');
      return;
    }

    try {
      await addDoc(collection(db, 'articles', articleId, 'comments'), {
        text,
        userId: state.currentUser.uid,
        authorName: state.currentUser.displayName || state.currentUser.email,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Erreur ajout commentaire:', error);
      alert('Erreur lors de l\'ajout du commentaire');
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// =====================
// INITIALIZATION
// =====================
document.addEventListener('DOMContentLoaded', () => {
  const themeManager = new ThemeManager();
  const modalManager = new ModalManager();
  const authManager = new AuthManager(modalManager);
  const articleManager = new ArticleManager(modalManager);
  
  // Rendre disponibles globalement pour l'interaction entre classes
  window.themeManager = themeManager;
  window.modalManager = modalManager;
  window.authManager = authManager;
  window.articleManager = articleManager;
});