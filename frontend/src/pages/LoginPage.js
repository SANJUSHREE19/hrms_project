// src/pages/LoginPage.js
import React from 'react';
import { SignIn, useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

const LoginPage = () => {
    const { isSignedIn } = useAuth();

    // If user is already signed in, redirect them away from login
    if (isSignedIn) {
        return <Navigate to="/" replace />;
    }

    return (
        <div>
            <h2>Login / Sign Up</h2>
            {/* The SignIn component handles the entire login flow */}
             <SignIn path="/login" routing="path" signUpUrl="/sign-up" /> {/* Customize appearance as needed */}
        </div>
    );
};

export default LoginPage;
