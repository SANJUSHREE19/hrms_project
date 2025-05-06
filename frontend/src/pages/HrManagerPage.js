// src/pages/HrManagerPage.js
import React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import EmployeeManagement from '../components/hr/EmployeeManagement';
import OnboardingDashboard from '../components/hr/OnboardingDashboard';
import PayrollDashboard from '../components/hr/PayrollDashboard';
import EditEmployeeForm from '../components/hr/EditEmployeeForm';
import HrOverview from '../components/hr/HrOverview';
import PayRunStubsViewer from '../components/hr/PayRunStubsViewer';

// We might need an EditEmployee component later
// import EditEmployeeForm from '../components/hr/EditEmployeeForm';

const HrManagerPage = () => {
    // This page can act as a layout for HR-specific routes
    return (
        <div>
            <h2>HR Manager Dashboard</h2>
            <nav>
                 {/* Use absolute paths based on the root parent route */}
                 <Link to="/hr-dashboard">Overview</Link> |{' '}
                 <Link to="/hr-dashboard/employees">Manage Employees</Link> |{' '}
                 <Link to="/hr-dashboard/onboarding">Onboarding</Link> |{' '}
                 <Link to="/hr-dashboard/payroll">Payroll</Link> |{' '}
                 <Link to="/admin-dashboard/departments">Manage Departments (Admin)</Link> 
             </nav>
             <hr />
            {/* Routes within this page are RELATIVE to /hr-dashboard */}
             <Routes>
                 {/* The 'index' route matches the base '/hr-dashboard' */}
                 <Route index element={<HrOverview />} />
                 {/* These paths match the segments AFTER '/hr-dashboard' */}
                 <Route path="employees" element={<EmployeeManagement />} />
                 <Route path="onboarding" element={<OnboardingDashboard />} />
                 <Route path="payroll" element={<PayrollDashboard />} />

                {/* --- Route for Editing an Employee --- */}
                {/* Note: This path is ALSO relative to /hr-dashboard */}
                 <Route path="employees/edit/:clerkId" element={<EditEmployeeForm />} />
                 <Route path="payroll/runs/:runId/stubs" element={<PayRunStubsViewer />} />
            </Routes>
        </div>
    );
};

export default HrManagerPage;
