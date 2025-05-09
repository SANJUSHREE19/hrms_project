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
        const token = await getToken({ template: 'HR-EDGE' });

        if (token) {
            axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete axiosInstance.defaults.headers.common['Authorization'];
        }
    } catch (error) {
        console.error("axiosInstance: Error getting Clerk token or setting header:", error);
        delete axiosInstance.defaults.headers.common['Authorization'];
    }
    return axiosInstance;
};

export default axiosInstance;
