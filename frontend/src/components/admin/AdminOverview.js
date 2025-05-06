// src/components/admin/AdminOverview.js
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { getAuthenticatedInstance } from '../../api/axiosInstance';

// Reuse StatCard component or define inline
const StatCard = ({ title, value, linkTo }) => (
    <div style={{ border: '1px solid #ddd', padding: '15px', margin: '10px', borderRadius: '5px', textAlign: 'center', minWidth: '150px' }}>
        <h3>{title}</h3>
        <p style={{ fontSize: '1.5em', fontWeight: 'bold' }}>{value}</p>
        {linkTo && <Link to={linkTo}>View Details</Link>}
    </div>
);

function AdminOverview() {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { getToken } = useAuth();

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiClient = await getAuthenticatedInstance(getToken);
            const response = await apiClient.get('/admin/stats/'); // Fetch from the admin stats endpoint
            setStats(response.data);
        } catch (err) {
            console.error("Failed to fetch Admin stats:", err);
            setError(err.response?.data?.error || 'Failed to load overview statistics');
            setStats(null);
        } finally {
            setIsLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    if (isLoading) {
        return <div>Loading Admin Overview...</div>;
    }

    if (error) {
        return <div style={{ color: 'red' }}>Error loading overview: {error}</div>;
    }

    if (!stats) {
        return <div>No statistics available.</div>;
    }

    return (
        <div>
            <h2>Admin Overview</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', marginTop: '20px' }}>
                <StatCard
                    title="Total Users"
                    value={stats.total_users_count ?? 'N/A'}
                    linkTo="/admin-dashboard/users"
                 />
                 <StatCard
                    title="Active Users"
                    value={stats.active_users_count ?? 'N/A'}
                    linkTo="/admin-dashboard/users" // Link to user management page
                 />
                 <StatCard
                     title="Departments"
                     value={stats.department_count ?? 'N/A'}
                     linkTo="/admin-dashboard/departments"
                 />
                 {/* Add more Admin-specific StatCards if needed */}
            </div>
             <hr style={{ margin: '30px 0' }}/>
        </div>
    );
}

export default AdminOverview;
