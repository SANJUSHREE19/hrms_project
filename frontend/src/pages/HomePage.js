// src/pages/HomePage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useUserProfile } from '../contexts/UserProfileContext';
import { getAuthenticatedInstance } from '../api/axiosInstance';
// Import components for displaying directory etc. later

const HomePage = () => {
    const { userProfile, isLoading: profileLoading, error: profileError } = useUserProfile();
    const { getToken } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    

     // Fetch employee directory
    useEffect(() => {
        const fetchEmployees = async () => {
            setIsLoading(true);
            setError('');
            try {
                const apiClient = await getAuthenticatedInstance(getToken);
                const response = await apiClient.get('/employees/'); // Basic list endpoint
                setEmployees(response.data);
            } catch (err) {
                console.error("Failed to fetch employees:", err);
                setError(err.response?.data?.error || 'Failed to load employee directory');
            } finally {
                setIsLoading(false);
            }
        };

        if (userProfile) { // Only fetch if profile is loaded (ensures auth is ready)
           fetchEmployees();
        }
    }, [getToken, userProfile]); // Depend on profile being loaded

    
    if (profileLoading) return <div>Loading your profile...</div>;
    if (!userProfile) return <div>Error loading profile data.</div>;
    if (profileError || !userProfile || !userProfile.user) return <div>Error loading profile data. {profileError}</div>;



    return (
        <div>
            <h2>Welcome, {userProfile.user?.first_name || 'User'}!</h2>
            <p>Your Role: {userProfile.user?.role}</p>
            <p>Your Department: {userProfile.department_name || 'N/A'}</p>

            <h3>Employee Directory</h3>
            {isLoading && <div>Loading directory...</div>}
            {error && <div style={{ color: 'red' }}>{error}</div>}
             {!isLoading && !error && (
                 <ul>
                    {employees.map(emp => (
                        <li key={emp.clerk_id}>
                             {emp.first_name} {emp.last_name} ({emp.job_title}) - {emp.department_name || 'No Dept.'}
                        </li>
                    ))}
                </ul>
             )}
            {/* Add Search/Filter inputs here later */}
        </div>
    );
};

export default HomePage;
