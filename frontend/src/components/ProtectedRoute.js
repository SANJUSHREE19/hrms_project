// src/components/ProtectedRoute.js
import React from 'react';
import { useAuth, RedirectToSignIn } from '@clerk/clerk-react';
import { useUserProfile } from '../contexts/UserProfileContext';

const ProtectedRoute = ({ children, requiredRoles }) => {
    const { isSignedIn, isLoaded: isAuthLoaded } = useAuth();

    // 1. Get the context value first without destructuring immediately
    const profileContextValue = useUserProfile();

    // 2. Check if the context value exists before proceeding
    if (!profileContextValue) {
        // This suggests the Provider is missing above this component in the React tree.
        // This might happen during initial renders or if App structure changes.
        // You might want to render a loading state or an error message.
        console.error("ProtectedRoute: UserProfileContext value is null. Check Provider setup in App.js.");
        // Show loading until context is hopefully available or auth redirects
        // If !isAuthLoaded, Clerk might handle redirection anyway, but this prevents the crash.
         if (!isAuthLoaded) {
             return <div>Loading authentication...</div>;
         }
         // If auth IS loaded but context is missing, it's likely a setup error.
         return <div>Error: User context configuration issue.</div>;
    }

    // 3. Now that we know profileContextValue is not null, we can destructure it
    const { userProfile, isLoading: isProfileLoading, error: profileError } = profileContextValue;

    // Existing loading checks
    if (!isAuthLoaded || isProfileLoading) {
        // Wait for both Clerk auth and DB profile to load
        return <div>Loading user information...</div>;
    }

    // Handle profile fetching errors explicitly if needed
    if (profileError && !userProfile) {
         console.error("Error fetching user profile:", profileError);
         return <div>Error loading user profile data. Please try again later.</div>;
         // Optionally, allow access if profile fetch fails? Depends on requirements.
    }


    // Redirect to sign in if not authenticated
    if (!isSignedIn) {
        // Note: Clerk's <SignedIn> / <SignedOut> might handle this,
        // but this ensures protection even if structure changes.
        // However, Clerk v5 pattern usually relies on <SignedIn>/<SignedOut> more.
        // If using ONLY <ProtectedRoute>, this <RedirectToSignIn> is crucial.
        // Let's keep it for robustness, but it might be redundant depending on Clerk's setup.
        return <RedirectToSignIn />;
    }


    // Check role if requiredRoles are specified
    if (requiredRoles && requiredRoles.length > 0) {
        // Ensure user profile is loaded before checking roles
        if (!userProfile) {
             // Should ideally be caught by the loading state above, but as a failsafe:
             return <div>Verifying user role...</div>;
        }

        const userRole = userProfile?.user?.role; // Role from your DB via UserProfileContext

        if (!userRole || !requiredRoles.includes(userRole)) {
            // User is signed in but doesn't have the required role
            return (
                <div>
                    <h2>Access Denied</h2>
                    <p>You do not have permission to access this page.</p>
                    {/* You could add a link back to the homepage */}
                </div>
            );
        }
    }

    // If signed in and meets role requirements (if any), render the children components
    return children;
};

export default ProtectedRoute;
