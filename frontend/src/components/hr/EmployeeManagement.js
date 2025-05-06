// src/components/hr/EmployeeManagement.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom'; // Use Link to navigate to edit page
import { getAuthenticatedInstance } from '../../api/axiosInstance';

function EmployeeManagement() {
    const [employees, setEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [deptFilter, setDeptFilter] = useState(''); // Add filters later if needed
    const { getToken } = useAuth();

    // Function to fetch employees
    const fetchEmployees = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiClient = await getAuthenticatedInstance(getToken);
            // Add query params for searching/filtering
            const params = new URLSearchParams();
            if (searchTerm) {
                params.append('search', searchTerm);
            }
            if (deptFilter) {
                params.append('department', deptFilter);
            }
            const response = await apiClient.get(`/employees/?${params.toString()}`);
            setEmployees(response.data || []);
        } catch (err) {
            console.error("Failed to fetch employees:", err);
            setError(err.response?.data?.error || err.message || 'Failed to load employees');
            setEmployees([]);
        } finally {
            setIsLoading(false);
        }
    // Trigger fetch when searchTerm changes (debounce this in real app)
    }, [getToken, searchTerm, deptFilter]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    const handleSearchSubmit = (e) => {
         e.preventDefault();
         fetchEmployees(); // Trigger fetch manually on submit if desired
    }


    if (isLoading) {
        return <div>Loading employees...</div>;
    }

    return (
        <div>
            <h2>Employee Management</h2>
            {error && <div style={{ color: 'red', marginBottom: '10px' }}>Error: {error}</div>}

            {/* Basic Search Form */}
            <form onSubmit={handleSearchSubmit} style={{ margin: '10px 0' }}>
                <input
                    type="text"
                    placeholder="Search name, email, title..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ marginRight: '10px' }}
                />
                {/* Add department filter dropdown later */}
                <button type="submit">Search</button>
            </form>

            <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Job Title</th>
                        <th>Department</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                     {employees.length === 0 && !error ? (
                        <tr><td colSpan="5">No employees found matching criteria.</td></tr>
                    ) : (
                        employees.map((emp) => (
                            <tr key={emp.clerk_id}>
                                <td>{emp.first_name} {emp.last_name}</td>
                                <td>{emp.email}</td>
                                <td>{emp.job_title}</td>
                                <td>{emp.department_name || 'N/A'}</td>
                                <td>
                                    {/* Link to a future Edit Employee page */}
                                    <Link to={`/hr-dashboard/employees/edit/${emp.clerk_id}`}>
                                         <button>Edit</button>
                                    </Link>
                                     {/* Add other actions like view details later */}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default EmployeeManagement;
