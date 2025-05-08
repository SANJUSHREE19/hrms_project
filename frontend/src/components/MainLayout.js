// src/components/MainLayout.js
import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'; // Keep necessary Clerk imports
import { useUserProfile } from '../contexts/UserProfileContext'; // Import hook
import MyPaystubsPage from '../pages/MyPaystubsPage';

// Import Pages and ProtectedRoute
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import EmployeeProfilePage from '../pages/EmployeeProfilePage';
import HrManagerPage from '../pages/HrManagerPage';
import AdminPage from '../pages/AdminPage';
import ProtectedRoute from './ProtectedRoute'; // Import ProtectedRoute

function MainLayout() {
    // --- Now call the hook HERE, inside the child of the Provider ---
    const { userProfile, isLoading, error } = useUserProfile();
    const userRole = userProfile?.user?.role; // Access role correctly

    console.log("MainLayout Context:", { userProfile, isLoading, error }); // Debug log inside layout

    return (
        <div className="App">
            <header className="App-header">
                <h1>HR Management System</h1>
                <nav>
                   <SignedIn>
                        <UserButton afterSignOutUrl='/login' />
                        {/* Ensure Fetcher is within SignedIn if it relies on auth */}
                        {/* <UserProfileFetcher />  <- This might be redundant if context loads correctly */}
                        <Link to="/">Home</Link>
                        <Link to="/my-profile">My Profile</Link>

                        {/* Conditional Links - now based on correctly loaded context */}
                        {!isLoading && userRole && ['hr_manager', 'admin'].includes(userRole) && (
                            <Link to="/hr-dashboard">HR Dashboard</Link>
                        )}
                        {!isLoading && userRole && userRole === 'admin' && (
                            <Link to="/admin-dashboard">Admin Dashboard</Link>
                        )}
                   </SignedIn>
                   <SignedOut>
                       <Link to="/login">Login</Link>
                   </SignedOut>
                </nav>
            </header>

            <main>
                {/* Removed the problematic conditional rendering based on top-level context */}
                {/* Routes component now renders directly */}
                <Routes>
                    {/* Public Route */}
                   <Route path="/login" element={<LoginPage />} />

                   {/* Protected Routes - These will use context correctly */}
                   <Route path="/" element={
                       <ProtectedRoute> <HomePage /> </ProtectedRoute>
                   } />
                   <Route path="/my-profile" element={
                       <ProtectedRoute> <EmployeeProfilePage /> </ProtectedRoute>
                   } />
                   <Route path="/hr-dashboard/*" element={
                       <ProtectedRoute requiredRoles={['hr_manager', 'admin']}> <HrManagerPage /> </ProtectedRoute>
                   } />
                   <Route path="/admin-dashboard/*" element={
                       <ProtectedRoute requiredRoles={['admin']}> <AdminPage /> </ProtectedRoute>
                   } />
                   <Route path="/my-paystubs" element={
                        <ProtectedRoute> <MyPaystubsPage /> </ProtectedRoute>
                    }/>

                   {/* Fallback - Redirect any other path to home (if logged in) or login */}
                   <Route path="*" element={
                        <SignedIn><Navigate to="/" replace /></SignedIn>
                        // <SignedOut> component could redirect to login, but Clerk/ProtectedRoute often handles this
                    } />

               </Routes>
            </main>
        </div>
    );
}

export default MainLayout;
