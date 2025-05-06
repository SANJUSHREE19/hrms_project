// src/components/admin/DepartmentManagement.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getAuthenticatedInstance } from '../../api/axiosInstance';

function DepartmentManagement() {
    const [departments, setDepartments] = useState([]);
    const [users, setUsers] = useState([]); // For manager dropdown
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newDeptName, setNewDeptName] = useState('');
    const [newDeptManagerId, setNewDeptManagerId] = useState(''); // Store clerk_id
    const { getToken } = useAuth();

    // Function to fetch data (departments and users)
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiClient = await getAuthenticatedInstance(getToken);
            // Fetch departments
            const deptResponse = await apiClient.get('/departments/');
            setDepartments(deptResponse.data || []);

            // Fetch users (to populate manager dropdown - potential performance issue for large numbers)
            // Consider a dedicated search/autocomplete endpoint for managers later
            const userResponse = await apiClient.get('/admin/users/'); // Using admin endpoint for now
            setUsers(userResponse.data || []);

        } catch (err) {
            console.error("Failed to fetch data:", err);
            setError(err.response?.data?.error || err.message || 'Failed to load data');
            setDepartments([]);
            setUsers([]);
        } finally {
            setIsLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddDepartment = async (e) => {
        e.preventDefault(); // Prevent default form submission
        setError(null);
        if (!newDeptName) {
            setError("Department name cannot be empty.");
            return;
        }
        try {
            const apiClient = await getAuthenticatedInstance(getToken);
            const payload = {
                 name: newDeptName,
                 // Send manager ID (clerk_id) if selected, otherwise omit or send null? Check backend requirement.
                 // If backend allows null:
                 manager: newDeptManagerId || null
                 // If backend requires valid ID, ensure '' isn't sent if required
            };
             console.log("Sending Payload:", payload)

            await apiClient.post('/departments/', payload);

            // Reset form, hide it, and refresh list
            setNewDeptName('');
            setNewDeptManagerId('');
            setIsAdding(false);
            fetchData(); // Re-fetch data
        } catch (err) {
            console.error("Failed to add department:", err);
            setError(err.response?.data?.name?.[0] || // Handle Django validation errors
                     err.response?.data?.manager?.[0] ||
                     err.response?.data?.error ||
                     err.response?.data?.detail ||
                     'Failed to add department');
        }
    };


    if (isLoading) {
        return <div>Loading departments...</div>;
    }

    return (
        <div>
            <h2>Department Management</h2>
            {error && <div style={{ color: 'red', marginBottom: '10px' }}>Error: {error}</div>}

            {/* Button to toggle add form */}
            {!isAdding && (
                <button onClick={() => {setIsAdding(true); setError(null)}}>Add New Department</button>
            )}

            {/* Add Department Form */}
            {isAdding && (
                <form onSubmit={handleAddDepartment} style={{ margin: '15px 0', padding: '10px', border: '1px solid #ccc' }}>
                    <h3>Add New Department</h3>
                    <div>
                        <label htmlFor="deptName">Name: </label>
                        <input
                            type="text"
                            id="deptName"
                            value={newDeptName}
                            onChange={(e) => setNewDeptName(e.target.value)}
                            required
                        />
                    </div>
                    <div style={{marginTop: '10px'}}>
                         <label htmlFor="deptManager">Manager (Optional): </label>
                         <select
                             id="deptManager"
                             value={newDeptManagerId}
                             onChange={(e) => setNewDeptManagerId(e.target.value)}
                         >
                             <option value="">-- Select Manager --</option>
                             {/* Filter users maybe? Or just list all? List active only? */}
                             {users.filter(u => u.is_active).map(user => (
                                 <option key={user.clerk_id} value={user.clerk_id}>
                                     {user.first_name} {user.last_name} ({user.email})
                                 </option>
                             ))}
                         </select>
                    </div>
                    <div style={{marginTop: '10px'}}>
                         <button type="submit">Save Department</button>
                         <button type="button" onClick={() => setIsAdding(false)} style={{marginLeft: '10px'}}>Cancel</button>
                    </div>
                </form>
            )}


            {/* Department List Table */}
            <table border="1" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Manager Email</th>
                    </tr>
                </thead>
                <tbody>
                    {departments.length === 0 ? (
                        <tr><td colSpan="4">No departments found.</td></tr>
                    ) : (
                        departments.map((dept) => (
                            <tr key={dept.id}>
                                <td>{dept.id}</td>
                                <td>{dept.name}</td>
                                {/* manager_email comes directly from DepartmentSerializer */}
                                <td>{dept.manager_email || 'N/A'}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default DepartmentManagement;
