document.addEventListener('DOMContentLoaded', function() {
    const checkStatusButton = document.getElementById('check-status');
    const applicationIdInput = document.getElementById('application-id');
    const statusError = document.getElementById('status-error');
    const statusResult = document.getElementById('status-result');
    const resultId = document.getElementById('result-id');
    const resultDate = document.getElementById('result-date');
    const resultStatus = document.getElementById('result-status');
    
    checkStatusButton.addEventListener('click', async function() {
        const applicationId = applicationIdInput.value.trim();
        
        if (!applicationId) {
            statusError.textContent = 'Please enter an application ID';
            statusError.style.display = 'block';
            statusResult.style.display = 'none';
            return;
        }
        
        try {
            statusError.style.display = 'none';
            checkStatusButton.disabled = true;
            checkStatusButton.textContent = 'Checking...';
            
            const response = await fetch(`/api/passport/${applicationId}`);
            const data = await response.json();
            
            if (response.ok) {
                resultId.textContent = data.application_id;
                resultDate.textContent = new Date(data.submission_date).toLocaleString();
                resultStatus.textContent = data.status;
                
                // Remove any previous status classes
                statusResult.className = 'status-result';
                // Add the appropriate status class
                statusResult.classList.add(`status-${data.status.toLowerCase()}`);
                
                statusResult.style.display = 'block';
            } else {
                statusError.textContent = data.detail || 'Application not found';
                statusError.style.display = 'block';
                statusResult.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking status:', error);
            statusError.textContent = 'Network error. Please try again.';
            statusError.style.display = 'block';
            statusResult.style.display = 'none';
        } finally {
            checkStatusButton.disabled = false;
            checkStatusButton.textContent = 'Check Status';
        }
    });
    
    // Also allow pressing Enter to check status
    applicationIdInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkStatusButton.click();
        }
    });
}); 