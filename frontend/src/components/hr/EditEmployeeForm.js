// src/components/hr/EditEmployeeForm.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { getAuthenticatedInstance } from '../../api/axiosInstance';
import { format, parseISO } from 'date-fns'; // For handling date formats

const ONBOARDING_STATUS_CHOICES = [
    'Pending', 'Scheduled', 'InProgress', 'Completed', 'Cancelled'
];

function EditEmployeeForm() {
    const { clerkId } = useParams(); // Get clerkId from URL
    const navigate = useNavigate();
    const { getToken } = useAuth();

    const [employeeData, setEmployeeData] = useState(null); // Full data from API
    const [formData, setFormData] = useState({ // Data being edited in the form
        job_title: '',
        department: '', // Store department ID
        hire_date: '',
        phone_number: '',
        address: '',
        onboarding_status: '',
        onboarding_start_date: '',
    });
    const [departments, setDepartments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        try {
            // API might return 'YYYY-MM-DD' or ISO string. Ensure it works for input type="date"
            return format(parseISO(dateString + 'T00:00:00'), 'yyyy-MM-dd');
        } catch {
            return ''; // Return empty if date is invalid
        }
    };

    // Fetch Employee Data and Departments
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage('');
        try {
            const apiClient = await getAuthenticatedInstance(getToken);
            // Fetch in parallel
            const [employeeRes, deptRes] = await Promise.all([
                apiClient.get(`/manage/employee/${clerkId}/`),
                apiClient.get('/departments/')
            ]);

            const empData = employeeRes.data;
            setEmployeeData(empData);
            // Initialize form data with fetched data
            setFormData({
                job_title: empData.job_title || '',
                department: empData.department || '', // department PK (ID) is here
                hire_date: formatDateForInput(empData.hire_date),
                phone_number: empData.phone_number || '',
                address: empData.address || '',
                onboarding_status: empData.onboarding_status || '',
                onboarding_start_date: formatDateForInput(empData.onboarding_start_date),
            });
            setDepartments(deptRes.data || []);

        } catch (err) {
            console.error("Failed to fetch data:", err);
            setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    }, [getToken, clerkId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle Form Input Changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Handle Form Submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        setSuccessMessage('');

        // Construct payload with fields allowed to be edited
        // Ensure date fields are in YYYY-MM-DD or null if empty
        const payload = {
            job_title: formData.job_title,
            department: formData.department || null, // Send null if empty
            hire_date: formData.hire_date || null,
            phone_number: formData.phone_number,
            address: formData.address,
            onboarding_status: formData.onboarding_status,
            onboarding_start_date: formData.onboarding_start_date || null,
        };
        // Remove null values if API expects only changed fields? For PUT maybe not. For PATCH yes.
        // If using PATCH: remove keys where value hasn't changed from employeeData.

        try {
            const apiClient = await getAuthenticatedInstance(getToken);
            // Use PUT to replace/update the resource
            const response = await apiClient.put(`/manage/employee/${clerkId}/`, payload);

            setSuccessMessage('Employee profile updated successfully!');
            // Optionally update local state immediately or re-fetch
            setEmployeeData(response.data); // Update displayed data
            // Reset form data based on newly saved data (preserves unchanged fields if any)
            setFormData({
                 job_title: response.data.job_title || '',
                 department: response.data.department || '',
                 hire_date: formatDateForInput(response.data.hire_date),
                 phone_number: response.data.phone_number || '',
                 address: response.data.address || '',
                 onboarding_status: response.data.onboarding_status || '',
                 onboarding_start_date: formatDateForInput(response.data.onboarding_start_date),
            });

            // Consider navigating back after success
            // setTimeout(() => navigate('/hr-dashboard/employees'), 1500);

        } catch (err) {
            console.error("Failed to update profile:", err);
            // Extract detailed errors if backend provides them
             let detailedError = 'Failed to update profile.';
             if (err.response?.data) {
                try { // Try to format validation errors
                     detailedError = Object.entries(err.response.data)
                        .map(([field, errors]) => `${field}: ${Array.isArray(errors)? errors.join(', ') : errors}`)
                        .join('; ');
                } catch { /* Ignore formatting errors */ }
             } else if (err.message) {
                detailedError = err.message;
             }
             setError(detailedError);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div>Loading employee data...</div>;
    }
    if (error && !employeeData) { // If initial load failed completely
        return <div style={{ color: 'red' }}>Error loading data: {error}</div>;
    }
    if (!employeeData) { // Should be caught by isLoading usually
         return <div>Employee not found.</div>;
    }


    // Display Read-only user info
    const userInfo = employeeData?.user || {};

    return (
        <div>
            <h2>Edit Profile: {userInfo.first_name} {userInfo.last_name}</h2>
            <p><strong>Email:</strong> {userInfo.email}</p>
            <p><strong>Clerk ID:</strong> {userInfo.clerk_id}</p>
            <hr/>

            {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
            {successMessage && <div style={{ color: 'green', marginBottom: '10px' }}>{successMessage}</div>}

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '10px' }}>
                    <label htmlFor="job_title">Job Title:</label><br/>
                    <input
                        type="text"
                        id="job_title"
                        name="job_title"
                        value={formData.job_title}
                        onChange={handleChange}
                        style={{ width: '300px' }}
                    />
                </div>

                <div style={{ marginBottom: '10px' }}>
                     <label htmlFor="department">Department:</label><br/>
                     <select
                         id="department"
                         name="department"
                         value={formData.department || ''} // Handle null value
                         onChange={handleChange}
                         style={{ width: '310px' }}
                     >
                         <option value="">-- Select Department --</option>
                         {departments.map(dept => (
                             <option key={dept.id} value={dept.id}>{dept.name}</option>
                         ))}
                     </select>
                </div>

                <div style={{ marginBottom: '10px' }}>
                     <label htmlFor="hire_date">Hire Date:</label><br/>
                     <input
                         type="date"
                         id="hire_date"
                         name="hire_date"
                         value={formData.hire_date}
                         onChange={handleChange}
                     />
                 </div>

                 <div style={{ marginBottom: '10px' }}>
                     <label htmlFor="onboarding_status">Onboarding Status:</label><br/>
                     <select
                         id="onboarding_status"
                         name="onboarding_status"
                         value={formData.onboarding_status || ''}
                         onChange={handleChange}
                         style={{ width: '200px' }}
                     >
                         <option value="">-- Select Status --</option>
                          {ONBOARDING_STATUS_CHOICES.map(status => (
                             <option key={status} value={status}>{status}</option>
                         ))}
                     </select>
                 </div>

                 <div style={{ marginBottom: '10px' }}>
                      <label htmlFor="onboarding_start_date">Onboarding/Actual Start Date:</label><br/>
                      <input
                          type="date"
                          id="onboarding_start_date"
                          name="onboarding_start_date"
                          value={formData.onboarding_start_date}
                          onChange={handleChange}
                      />
                 </div>


                <div style={{ marginBottom: '10px' }}>
                    <label htmlFor="phone_number">Phone Number:</label><br/>
                    <input
                        type="text"
                        id="phone_number"
                        name="phone_number"
                        value={formData.phone_number}
                        onChange={handleChange}
                        style={{ width: '200px' }}
                    />
                </div>

                 <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="address">Address:</label><br/>
                    <textarea
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        rows={3}
                        style={{ width: '400px' }}
                    />
                </div>

                <button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => navigate(-1)} style={{marginLeft:'10px'}} disabled={isSaving}>
                     Cancel / Back
                </button>
            </form>
            {/* TODO: Sections to view Salary/Title History could go here */}
            {/* <SalaryHistory clerkId={clerkId} /> */}
            {/* <TitleHistoryComponent clerkId={clerkId} /> */}
        </div>
    );
}

export default EditEmployeeForm;
