// src/components/admin/UserManagement.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getAuthenticatedInstance } from '../../api/axiosInstance';

function UserManagement() {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { getToken } = useAuth();

    // Function to fetch users
    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiClient = await getAuthenticatedInstance(getToken);
            const response = await apiClient.get('/admin/users/');
            setUsers(response.data || []); // Ensure it's an array
        } catch (err) {
            console.error("Failed to fetch users:", err);
            setError(err.response?.data?.error || err.message || 'Failed to load users');
            setUsers([]); // Set empty on error
        } finally {
            setIsLoading(false);
        }
    }, [getToken]);

    // Fetch users on component mount
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // --- Handler Functions for Actions (Basic Implementation) ---
    const handleRoleChange = async (clerkId, newRole) => {
        console.log(`Changing role for ${clerkId} to ${newRole}`);
        setError(null); // Clear previous errors
        try {
            const apiClient = await getAuthenticatedInstance(getToken);
            await apiClient.patch(`/admin/users/${clerkId}/`, { role: newRole });
            // Refresh user list on success
            fetchUsers();
        } catch (err) {
             console.error(`Failed to update role for ${clerkId}:`, err);
             setError(err.response?.data?.detail || err.response?.data?.error || `Failed to update role for ${clerkId}`);
        }
    };

    const handleActiveToggle = async (clerkId, currentStatus) => {
        const newStatus = !currentStatus;
        console.log(`Setting active status for ${clerkId} to ${newStatus}`);
        setError(null);
        try {
            const apiClient = await getAuthenticatedInstance(getToken);
            await apiClient.patch(`/admin/users/${clerkId}/`, { is_active: newStatus });
            // Refresh user list on success
            fetchUsers();
        } catch (err) {
             console.error(`Failed to update status for ${clerkId}:`, err);
             setError(err.response?.data?.detail || err.response?.data?.error || `Failed to update status for ${clerkId}`);
        }
    };

    // --- Render Logic ---
    if (isLoading) {
        return <div>Loading users...</div>;
    }

    return (
        <div>
            <h2>User Management</h2>
            {error && <div style={{ color: 'red', marginBottom: '10px' }}>Error: {error}</div>}
            <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Clerk ID</th>
                        <th>Role</th>
                        <th>Is Active</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.length === 0 && !error ? (
                        <tr><td colSpan="6">No users found.</td></tr>
                    ) : (
                        users.map((user) => (
                            <tr key={user.clerk_id}>
                                <td>{user.email}</td>
                                <td>{user.first_name} {user.last_name}</td>
                                <td>{user.clerk_id}</td>
                                <td>
                                    <select
                                        value={user.role}
                                        onChange={(e) => handleRoleChange(user.clerk_id, e.target.value)}
                                    >
                                        <option value="employee">Employee</option>
                                        <option value="hr_manager">HR Manager</option>
                                        <option value="admin">Administrator</option>
                                    </select>
                                </td>
                                <td>{user.is_active ? 'Yes' : 'No'}</td>
                                <td>
                                    <button onClick={() => handleActiveToggle(user.clerk_id, user.is_active)}>
                                        {user.is_active ? 'Deactivate' : 'Activate'}
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default UserManagement;
