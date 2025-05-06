// src/components/hr/HrOverview.js
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { getAuthenticatedInstance } from '../../api/axiosInstance';

// Basic Card component for display
const StatCard = ({ title, value, linkTo }) => (
    <div style={{
        border: '1px solid #ddd',
        padding: '15px',
        margin: '10px',
        borderRadius: '5px',
        textAlign: 'center',
        minWidth: '150px'
    }}>
        <h3>{title}</h3>
        <p style={{ fontSize: '1.5em', fontWeight: 'bold' }}>{value}</p>
        {linkTo && <Link to={linkTo}>View Details</Link>}
    </div>
);


function HrOverview() {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { getToken } = useAuth();

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiClient = await getAuthenticatedInstance(getToken);
            const response = await apiClient.get('/hr/stats/');
            setStats(response.data);
        } catch (err) {
            console.error("Failed to fetch HR stats:", err);
            setError(err.response?.data?.error || 'Failed to load overview statistics');
            setStats(null); // Clear stats on error
        } finally {
            setIsLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    if (isLoading) {
        return <div>Loading HR Overview...</div>;
    }

    if (error) {
        return <div style={{ color: 'red' }}>Error loading overview: {error}</div>;
    }

    if (!stats) {
        return <div>No statistics available.</div>; // Or another fallback
    }

    return (
        <div>
            <h2>HR Overview</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', marginTop: '20px' }}>
                {/* Display fetched stats */}
                <StatCard
                    title="Active Employees"
                    value={stats.active_employees_count ?? 'N/A'}
                    linkTo="/hr-dashboard/employees"
                 />
                 <StatCard
                    title="Pending Onboarding"
                    value={stats.pending_onboarding_count ?? 'N/A'}
                    linkTo="/hr-dashboard/onboarding"
                 />
                 <StatCard
                     title="Pending Pay Runs"
                     value={stats.pending_payruns_count ?? 'N/A'}
                     linkTo="/hr-dashboard/payroll"
                 />
                 {/* Add more StatCards as needed */}
            </div>

            <hr style={{ margin: '30px 0' }}/>
        </div>
    );
}

export default HrOverview;
