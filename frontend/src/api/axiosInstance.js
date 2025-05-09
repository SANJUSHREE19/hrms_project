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
    console.log("axiosInstance: Attempting to get authenticated instance...");
    try {
        console.log("axiosInstance: Calling getToken({ template: 'HR-EDGE' })...");
        const token = await getToken({ template: 'HR-EDGE' });
        console.log("axiosInstance: Token received from Clerk:", token ? token.substring(0, 20) + "..." : token); // Log part of token or null

        if (token) {
            axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            console.log("axiosInstance: Authorization header SET.");
        } else {
            delete axiosInstance.defaults.headers.common['Authorization'];
            console.warn("axiosInstance: Clerk token (HR-EDGE) was null or undefined. Authorization header NOT SET.");
        }
    } catch (error) {
        console.error("axiosInstance: Error getting Clerk token or setting header:", error);
        delete axiosInstance.defaults.headers.common['Authorization'];
    }
    return axiosInstance;
};

export default axiosInstance;
