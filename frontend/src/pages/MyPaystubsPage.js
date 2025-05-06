// src/pages/MyPaystubsPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getAuthenticatedInstance } from '../api/axiosInstance';
import { format } from 'date-fns';

function MyPaystubsPage() {
    const [paystubs, setPaystubs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { getToken } = useAuth();

    const formatDisplayDate = (dateString) => {
        // ... (same formatting function as in PayrollDashboard) ...
         if (!dateString) return 'N/A';
         try {
             return format(new Date(dateString), 'MMM d, yyyy');
         } catch (e) { console.error("Date formatting err", e); return dateString; }
    };

    const fetchMyPaystubs = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiClient = await getAuthenticatedInstance(getToken);
            const response = await apiClient.get('/my/paystubs/');
            setPaystubs(response.data || []);
        } catch (err) {
            console.error("Failed to fetch my paystubs:", err);
            setError(err.response?.data?.error || 'Failed to load paystubs');
            setPaystubs([]);
        } finally {
            setIsLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        fetchMyPaystubs();
    }, [fetchMyPaystubs]);

     if (isLoading) return <div>Loading your paystubs...</div>;

    return (
        <div>
            <h2>My Paystubs</h2>
             {error && <div style={{ color: 'red', marginBottom: '10px' }}>Error: {error}</div>}
             <table border="1" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                 <thead>
                     <tr>
                         <th>Pay Date</th>
                         <th>Period Start</th>
                         <th>Period End</th>
                         <th>Gross Pay</th>
                         <th>Deductions</th>
                         <th>Net Pay</th>
                         {/* <th>Actions</th> */}
                     </tr>
                 </thead>
                 <tbody>
                    {paystubs.length === 0 && !error? (
                         <tr><td colSpan="6">No paystubs found.</td></tr>
                    ) : (
                         paystubs.map((stub) => (
                             <tr key={stub.id}>
                                 <td>{formatDisplayDate(stub.pay_date)}</td>
                                 <td>{formatDisplayDate(stub.period_start_date)}</td>
                                 <td>{formatDisplayDate(stub.period_end_date)}</td>
                                 <td>${stub.gross_pay}</td>
                                 <td>${stub.deductions}</td>
                                 <td>${stub.net_pay}</td>
                                 {/* <td><button disabled>View Details</button></td> Placeholder */}
                             </tr>
                         ))
                     )}
                 </tbody>
             </table>
        </div>
    );
}

export default MyPaystubsPage;
