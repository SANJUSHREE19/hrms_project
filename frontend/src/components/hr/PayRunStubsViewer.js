// src/components/hr/PayRunStubsViewer.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { getAuthenticatedInstance } from '../../api/axiosInstance';
import { format } from 'date-fns'; // Optional: For formatting created_at

function PayRunStubsViewer() {
    const { runId } = useParams(); // Get runId from the URL parameter
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const [stubs, setStubs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [runInfo, setRunInfo] = useState(null); // Optional: Store PayRun info

     const formatDisplayDate = (dateString) => {
         if (!dateString) return 'N/A';
        try { return format(new Date(dateString), 'MMM d, yyyy'); } catch (e) { return dateString; }
    };

    const fetchStubs = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiClient = await getAuthenticatedInstance(getToken);
            // Fetch stubs filtered by run_id using the admin endpoint
            const response = await apiClient.get(`/payroll/stubs-admin/?run_id=${runId}`);
            setStubs(response.data || []);

            // Optional: Fetch PayRun details if needed for display context
            if (response.data && response.data.length > 0 && response.data[0].pay_run_info) {
                 // Simple approach: just use the info from the first stub if available
                 // Alternatively, fetch /payroll/runs/<runId>/ separately
                 setRunInfo({ info: response.data[0].pay_run_info }); // Example using __str__ from serializer
            } else if (response.data?.length === 0) {
                // If no stubs, still try to fetch run info for context
                try {
                     const runResponse = await apiClient.get(`/payroll/runs/${runId}/`);
                     setRunInfo({ info: `Run ID ${runId} (${formatDisplayDate(runResponse.data.start_date)} - ${formatDisplayDate(runResponse.data.end_date)}) - Status: ${runResponse.data.status}` });
                } catch (runErr) {
                    console.error("Failed to fetch run info for context:", runErr);
                     setRunInfo({ info: `Run ID ${runId}` }); // Fallback
                }
            }

        } catch (err) {
            console.error(`Failed to fetch pay stubs for run ${runId}:`, err);
            setError(err.response?.data?.error || `Failed to load pay stubs for run ${runId}`);
            setStubs([]);
        } finally {
            setIsLoading(false);
        }
    }, [getToken, runId]);

    useEffect(() => {
        fetchStubs();
    }, [fetchStubs]);

    if (isLoading) return <div>Loading pay stubs for Run ID: {runId}...</div>;


    return (
        <div>
             <button onClick={() => navigate(-1)} style={{ marginBottom: '15px' }}>
                 ← Back to Payroll Runs
             </button>
            <h2>Pay Stubs for {runInfo?.info || `Run ID ${runId}`}</h2>
            {error && <div style={{ color: 'red', marginBottom: '10px' }}>Error: {error}</div>}

             <table border="1" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                <thead>
                     <tr>
                         <th>Stub ID</th>
                         <th>Employee Name</th>
                         <th>Employee Email</th>
                         <th>Gross Pay</th>
                         <th>Deductions</th>
                         <th>Net Pay</th>
                         <th>Created At</th>
                         {/* <th>Actions</th> */}
                    </tr>
                 </thead>
                 <tbody>
                     {stubs.length === 0 && !error ? (
                        <tr><td colSpan="7">No pay stubs found for this pay run.</td></tr>
                     ) : (
                         stubs.map((stub) => (
                             <tr key={stub.id}>
                                 <td>{stub.id}</td>
                                 <td>{stub.employee_name || 'N/A'}</td>
                                 <td>{stub.employee_email || 'N/A'}</td>
                                 <td>${stub.gross_pay}</td>
                                 <td>${stub.deductions}</td>
                                 <td>${stub.net_pay}</td>
                                 <td>{formatDisplayDate(stub.created_at)}</td>
                                 {/* Add actions if needed e.g., view detail, download pdf */}
                                 {/* <td><button disabled>View Details</button></td> */}
                             </tr>
                         ))
                     )}
                </tbody>
             </table>
        </div>
    );
}

export default PayRunStubsViewer;
