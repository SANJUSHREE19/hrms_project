// src/components/hr/OnboardingDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { getAuthenticatedInstance } from '../../api/axiosInstance';
import { format } from 'date-fns'; // For formatting dates

function OnboardingDashboard() {
    const [pendingEmployees, setPendingEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { getToken } = useAuth();

    const fetchPendingOnboarding = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiClient = await getAuthenticatedInstance(getToken);
            const response = await apiClient.get('/hr/onboarding/pending/');
            setPendingEmployees(response.data || []);
        } catch (err) {
            console.error("Failed to fetch pending onboarding:", err);
            setError(err.response?.data?.error || 'Failed to load onboarding data');
            setPendingEmployees([]);
        } finally {
            setIsLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        fetchPendingOnboarding();
    }, [fetchPendingOnboarding]);

    const formatDate = (dateString) => {
         if (!dateString) return 'N/A';
         try {
            // Assuming dateString is YYYY-MM-DD
            return format(new Date(dateString + 'T00:00:00'), 'MMM d, yyyy'); // Add time part for safety
         } catch (e) {
            console.error("Error formatting date:", e);
            return dateString; // Return original if formatting fails
         }
    };


    if (isLoading) return <div>Loading onboarding status...</div>;

    return (
        <div>
            <h2>Onboarding Dashboard</h2>
            <p>Employees with Pending, Scheduled, or In Progress onboarding status.</p>
            {error && <div style={{ color: 'red', marginBottom: '10px' }}>Error: {error}</div>}

            <table border="1" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                 <thead>
                     <tr>
                         <th>Name</th>
                         <th>Email</th>
                         <th>Job Title</th>
                         <th>Department</th>
                         <th>Onboarding Status</th>
                         <th>Start Date</th>
                         <th>Actions</th>
                     </tr>
                 </thead>
                 <tbody>
                     {pendingEmployees.length === 0 && !error? (
                        <tr><td colSpan="7">No employees currently pending onboarding.</td></tr>
                     ) : (
                        pendingEmployees.map((emp) => (
                            <tr key={emp.user?.clerk_id || emp.id}> {/* Ensure a unique key */}
                                <td>{emp.user?.first_name} {emp.user?.last_name}</td>
                                <td>{emp.user?.email}</td>
                                <td>{emp.job_title}</td>
                                <td>{emp.department_name || 'N/A'}</td>
                                <td>{emp.onboarding_status}</td>
                                <td>{formatDate(emp.onboarding_start_date)}</td>
                                <td>
                                    {/* Link to the main edit page where status can be changed */}
                                    <Link to={`/hr-dashboard/employees/edit/${emp.user?.clerk_id}`}>
                                         <button>Manage Profile</button>
                                    </Link>
                                </td>
                            </tr>
                        ))
                     )}
                </tbody>
            </table>
        </div>
    );
}

export default OnboardingDashboard;
