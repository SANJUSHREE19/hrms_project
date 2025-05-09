// src/api/axiosInstance.js
import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Function to get the token and add it to headers
export const getAuthenticatedInstance = async (getToken) => {
    try {
        // --- Explicitly request the template ---
        const token = await getToken({ template: 'HR-EDGE' }); // Use the name from your Clerk Dashboard
        console.log("Clerk token (HR-EDGE):", token); // Debug log
        if (token) {
            axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete axiosInstance.defaults.headers.common['Authorization'];
            console.warn("Clerk token (HR-EDGE) not available for API request.");
        }
    } catch (error) {
        console.error("Error getting Clerk token (HR-EDGE):", error);
        delete axiosInstance.defaults.headers.common['Authorization'];
    }
    return axiosInstance;
};

export default axiosInstance;
