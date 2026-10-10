# 🎬 CineStream — Modern Movie & TV Streaming Web Application

<div align="center">

[![Live Web App](https://img.shields.io/badge/Live%20Demo-movie--streaming--web-00e599?style=for-the-badge&logo=vercel&logoColor=white)](https://movie-streaming-web-three.vercel.app)
[![React 18](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Build-Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TMDB API](https://img.shields.io/badge/Data-TMDB%20API-01d277?style=for-the-badge&logo=themoviedatabase&logoColor=white)](https://www.themoviedb.org/)
[![Firebase](https://img.shields.io/badge/Backend-Firebase%20Auth%20%26%20DB-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

### **Cinematic Streaming Portal, Dynamic Media Catalog & Personalized Watchlist**
*Browse trending blockbusters, search millions of movies and TV series via TMDB API, manage personal watchlists with Firebase Auth, and stream seamlessly.*

### 🔗 **[Launch Live Web App: movie-streaming-web-three.vercel.app](https://movie-streaming-web-three.vercel.app)**

</div>

---

## 🌟 Overview

**CineStream (Movie-streaming-Web)** is a responsive, feature-packed streaming web portal engineered with **React 18**, **TypeScript**, and **Vite**.

Powered by the **The Movie Database (TMDB) API**, CineStream features auto-advancing hero backdrops, categorized Netflix-style content carousels, genre filtering, and full-text keyword search. With integrated **Firebase Authentication** and cloud state persistence, users can log in, curate their personal watchlists, and track their watch history across sessions.

---

## ✨ Key Features

### 🎞️ Cinematic Discovery & Browsing
* **Featured Hero Showcase**: Dynamic high-resolution billboard carousel highlighting trending releases with quick synopsis, rating pills, and one-tap playback.
* **Curated Media Rows**: Horizontal scrolling carousels for Trending Now, Top Rated, Action, Comedy, Sci-Fi, and TV Series.
* **Global Search & Filter**: Real-time debounce search across millions of movies, TV shows, cast members, and release years.
* **Comprehensive Media Details**: Synopsis, HD trailer modals, user ratings, genres, release dates, and related recommendations.

### 👤 User Account & Personalization
* **Firebase Authentication**: Secure user login and registration flows.
* **Persistent Watchlists**: Save movies and TV shows to a personal queue stored in the cloud.
* **Watch History**: Automatically remembers previously watched content so you never lose track.

### ⚡ Performance & Streaming Architecture
* **TanStack React Query**: Intelligent client-side caching and background synchronization to eliminate redundant TMDB network calls.
* **Multi-Source Embed Engine**: Clean player integration for instant buffer-free streaming.
* **Fluid Dark-Theme Interface**: Mobile-first responsive UI built with Tailwind CSS and Lucide React icons.

---

## 🏗️ Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 React 18 + Vite Web Client                  │
│       (Tailwind CSS • Lucide Icons • React Router DOM)      │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
┌──────────────────────────────┐┌──────────────────────────────┐
│       TMDB REST API          ││       Firebase Backend       │
├──────────────────────────────┤├──────────────────────────────┤
│ • Movie & TV Catalogues      ││ • User Authentication        │
│ • HD Posters & Backdrops     ││ • Cloud Watchlists           │
│ • Ratings, Cast & Trailers   ││ • User Watch History         │
└──────────────────────────────┘└──────────────────────────────┘
```

---

## 🚀 Getting Started

### 1. Prerequisites
* **Node.js**: `18.x` or higher installed.
* **TMDB API Key**: Free API key from [themoviedb.org](https://www.themoviedb.org/).
* **Firebase Project**: Setup on [Firebase Console](https://console.firebase.google.com/).

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/dilshan916/Movie-streaming-Web.git
cd Movie-streaming-Web

# Install dependencies
npm install
```

### 3. Environment Variables

Create a `.env` file in the project root:

```env
# TMDB API Configuration
VITE_TMDB_API_KEY=your_tmdb_api_key_here

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Running the Development Server

```bash
npm run dev
```

The application will be live at `http://localhost:5173`.

---

## 📦 Production Build

```bash
npm run build
npm run preview
```

---

## 📄 License & Credits

This project is licensed under the **MIT License**.

### Developed & Maintained by
* **Dilshan Chandrarathne** ([@dilshan916](https://github.com/dilshan916))
