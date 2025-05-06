// src/App.js
import React from 'react';
// Remove imports that are now in MainLayout:
// Routes, Route, Link, useNavigate, SignedIn, SignedOut, etc.
// Pages, ProtectedRoute, UserProfileFetcher, useUserProfile

// Keep only necessary imports:
import { UserProfileProvider } from './contexts/UserProfileContext';
import MainLayout from './components/MainLayout'; // Import the new layout component
import './App.css';

function App() {
    // Remove the faulty hook call and related variables from here

    return (
      // Provide the context
      <UserProfileProvider>
         {/* Render the component that will actually use the context */}
         <MainLayout />
      </UserProfileProvider>
    );
}

export default App;
