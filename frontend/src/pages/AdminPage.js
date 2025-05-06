// src/pages/AdminPage.js
import React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import UserManagement from '../components/admin/UserManagement';
import DepartmentManagement from '../components/admin/DepartmentManagement';
import AdminOverview from '../components/admin/AdminOverview';



const AdminPage = () => {
     // Layout for Admin-specific routes
     return (
        <div>
            <h2>Administrator Dashboard</h2>
             <nav>
                <Link to="/admin-dashboard">Overview</Link> |{' '}
                <Link to="/admin-dashboard/users">Manage Users</Link> |{' '}
                <Link to="/admin-dashboard/departments">Manage Departments</Link> |{' '}
                <Link to="/hr-dashboard/employees">Manage Employees (HR)</Link>
             </nav>
             <hr />
             <Routes>
                {/* Use the imported components */}
                <Route index element={<AdminOverview />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="departments" element={<DepartmentManagement />} />
            </Routes>
        </div>
    );
};

export default AdminPage;
