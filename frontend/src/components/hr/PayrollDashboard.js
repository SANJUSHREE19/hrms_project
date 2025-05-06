// src/components/hr/PayrollDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { getAuthenticatedInstance } from '../../api/axiosInstance';
import { format } from 'date-fns'; // For formatting dates

function PayrollDashboard() {
    const [payRuns, setPayRuns] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newRunStartDate, setNewRunStartDate] = useState('');
    const [newRunEndDate, setNewRunEndDate] = useState('');
    const [newRunPayDate, setNewRunPayDate] = useState('');
    const { getToken } = useAuth();

    // Removed unused formatDate function
     const formatDisplayDate = (dateString) => {
          if (!dateString) return 'N/A';
         try {
             // Assumes backend returns ISO format with time for datetime fields if applicable
             return format(new Date(dateString), 'MMM d, yyyy');
         } catch (e) {
             console.error("Display date format error:", e); return dateString;
         }
     };

    // Fetch Pay Runs
    const fetchPayRuns = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiClient = await getAuthenticatedInstance(getToken);
            const response = await apiClient.get('/payroll/runs/');
            setPayRuns(response.data || []);
        } catch (err) {
            console.error("Failed to fetch pay runs:", err);
            setError(err.response?.data?.error || 'Failed to load pay runs');
            setPayRuns([]);
        } finally {
            setIsLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        fetchPayRuns();
    }, [fetchPayRuns]);

    // Handle Creating New Pay Run
     const handleCreatePayRun = async (e) => {
         e.preventDefault();
         setError(null);
         if (!newRunStartDate || !newRunEndDate || !newRunPayDate) {
            setError("All dates (Start, End, Pay Date) are required.");
            return;
         }
         try {
             const apiClient = await getAuthenticatedInstance(getToken);
             await apiClient.post('/payroll/runs/', {
                start_date: newRunStartDate,
                end_date: newRunEndDate,
                pay_date: newRunPayDate,
             });
             setNewRunStartDate(''); setNewRunEndDate(''); setNewRunPayDate('');
             setIsAdding(false);
             fetchPayRuns(); // Refresh list
         } catch (err) {
             console.error("Failed to create pay run:", err);
              // Extract Django validation errors if possible
             let errMsg = 'Failed to create pay run.';
             if (err.response?.data) {
                 const errors = err.response.data;
                 if (typeof errors === 'string') {
                    errMsg = errors;
                 } else if (typeof errors === 'object') {
                    errMsg = Object.entries(errors)
                        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
                        .join('; ');
                 }
             }
             setError(errMsg);
         }
     };

     // Handle Processing Payroll
     const handleProcessPayroll = async (runId) => {
         setError(null);
         console.log(`Requesting processing for Pay Run ID: ${runId}`);
         // Optional: Add a confirmation dialog here
         try {
            const apiClient = await getAuthenticatedInstance(getToken);
             // Show immediate feedback? Disable button?
             // Update the specific run locally to "Processing" optimisticly?
            setPayRuns(currentRuns => currentRuns.map(run =>
                 run.id === runId ? { ...run, status: 'Processing...' } : run
            ));

             const response = await apiClient.post(`/payroll/runs/${runId}/process/`);
            alert(response.data.message || 'Payroll processing requested successfully.'); // Basic feedback
            fetchPayRuns(); // Refresh the list fully after processing
         } catch (err) {
             console.error(`Failed to process payroll run ${runId}:`, err);
             const errMsg = err.response?.data?.error || err.response?.data?.detail || `Failed processing run ${runId}`;
             setError(errMsg);
             fetchPayRuns(); // Refresh to show failed status if needed
         }
     };

    if (isLoading) return <div>Loading payroll runs...</div>;

    return (
        <div>
            <h2>Payroll Dashboard</h2>
            {error && <div style={{ color: 'red', marginBottom: '10px' }}>Error: {error}</div>}

             {/* Button/Form to add new Pay Run (Keep as is) */}
             {!isAdding && <button onClick={() => setIsAdding(true)}>Create New Pay Run</button>}
             {isAdding && <form onSubmit={handleCreatePayRun}> {/* ... form content ... */} </form>}

            {/* Pay Run List Table */}
             <table border="1" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                <thead>
                     <tr>
                         <th>ID</th>
                         <th>Period Start</th>
                         <th>Period End</th>
                         <th>Pay Date</th>
                         <th>Status</th>
                         <th>Actions</th>
                    </tr>
                 </thead>
                 <tbody>
                    {payRuns.length === 0 ? (
                        <tr><td colSpan="6">No pay runs found.</td></tr>
                    ) : (
                         payRuns.map((run) => (
                             <tr key={run.id}>
                                 <td>{run.id}</td>
                                 <td>{formatDisplayDate(run.start_date)}</td>
                                 <td>{formatDisplayDate(run.end_date)}</td>
                                 <td>{formatDisplayDate(run.pay_date)}</td>
                                 <td>{run.status}</td>
                                 <td>
                                    {run.status === 'Pending' && (
                                        <button onClick={() => handleProcessPayroll(run.id)}>
                                             Process Payroll
                                        </button>
                                    )}
                                    {(run.status === 'Processing...' || run.status === 'Processing') && (
                                         <button disabled>Processing...</button>
                                    )}

                                     {(run.status === 'Completed' || run.status === 'Failed') && (
                                        <Link to={`/hr-dashboard/payroll/runs/${run.id}/stubs`} style={{ marginLeft: '5px' }}>
                                             <button>View Stubs</button>
                                        </Link>
                                     )}
                                 </td>
                             </tr>
                        ))
                     )}
                 </tbody>
             </table>
        </div>
    );
}

export default PayrollDashboard;
