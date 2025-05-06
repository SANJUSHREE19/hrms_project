// src/pages/EmployeeProfilePage.js
import React from 'react';
import { useUserProfile } from '../contexts/UserProfileContext';

const EmployeeProfilePage = () => {
    const { userProfile, isLoading, error } = useUserProfile();

    if (isLoading) return <div>Loading profile...</div>;
    if (error) return <div style={{ color: 'red' }}>Error loading profile: {error}</div>;
    if (!userProfile) return <div>Profile data not available.</div>;
    const userRole = userProfile?.user?.role;

    return (
        <div>
            <h2>My Profile</h2>
            <p><strong>Name:</strong> {userProfile.user?.first_name} {userProfile.user?.last_name}</p>
            <p><strong>Email:</strong> {userProfile.user?.email}</p>
            <p><strong>Role:</strong> {userRole}</p>
            <p><strong>Status:</strong> {userProfile.user?.is_active ? 'Active' : 'Inactive'}</p>
            <hr/>
            <h3>Employment Details</h3>
             <p><strong>Job Title:</strong> {userProfile.job_title}</p>
            <p><strong>Department:</strong> {userProfile.department_name || 'N/A'}</p>
            <p><strong>Hire Date:</strong> {userProfile.hire_date || 'N/A'}</p>
            <p><strong>Phone:</strong> {userProfile.phone_number || 'N/A'}</p>
            <p><strong>Address:</strong> {userProfile.address || 'N/A'}</p>

            {/* Salary Info - Display conditionally based on role if needed */}
             {/* Assuming current_salary structure */}
            <h3>Salary Information</h3>
            {userProfile.current_salary ? (
                 <p>
                     <strong>Current Salary:</strong> ${userProfile.current_salary.amount}
                     (Effective: {userProfile.current_salary.effective_date})
                 </p>
             ) : (
                 <p>Salary information not available.</p>
             )}

            {/* Title History would be fetched separately if needed */}

            {/* Allow editing? Maybe link to an edit form */}
        </div>
    );
};

export default EmployeeProfilePage;
