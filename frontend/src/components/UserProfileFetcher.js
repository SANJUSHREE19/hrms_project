// src/components/UserProfileFetcher.js
import { useEffect } from 'react';
import { useUserProfile } from '../contexts/UserProfileContext';

// This component just exists to trigger the context logic when rendered within SignedIn
const UserProfileFetcher = () => {
  useUserProfile(); // Hook call triggers the fetch inside the context
  return null; // Render nothing
};

export default UserProfileFetcher;
