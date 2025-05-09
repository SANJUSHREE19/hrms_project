// src/contexts/UserProfileContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getAuthenticatedInstance } from '../api/axiosInstance';

const UserProfileContext = createContext(null);

export const UserProfileProvider = ({ children }) => {
    const { isSignedIn, getToken, userId } = useAuth(); // Use userId from Clerk
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (isSignedIn && userId) { // Check if signed in and userId is available
                setIsLoading(true);
                setError(null);
                setUserProfile(null); // Reset profile while fetching

                try {
                    const apiClient = await getAuthenticatedInstance(getToken);
                    const response = await apiClient.get('/me/'); // Your backend endpoint
                    
                    setUserProfile(response.data);
                } catch (err) {
                    console.error("Failed to fetch user profile:", err);
                    setError(err.response?.data?.error || err.message || 'Failed to load profile');
                     // Don't clear profile on error if there was a previous one maybe?
                     // setUserProfile(null);
                } finally {
                    setIsLoading(false);
                }
            } else {
                 // Not signed in or userId not yet available, clear profile
                 setUserProfile(null);
                 setIsLoading(false);
                 setError(null);
            }
        };

        fetchUserProfile();

    }, [isSignedIn, getToken, userId]); // Rerun when auth state or userId changes

    return (
        <UserProfileContext.Provider value={{ userProfile, isLoading, error, refetchProfile: () => {} /* Add refetch logic if needed */ }}>
            {children}
        </UserProfileContext.Provider>
    );
};

export const useUserProfile = () => useContext(UserProfileContext);
