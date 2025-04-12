document.addEventListener('DOMContentLoaded', function() {
    const passportForm = document.getElementById('passport-form');
    
    if (passportForm) {
        passportForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(passportForm);
            const formDataObject = {};
            
            // Convert FormData to JSON object
            formData.forEach((value, key) => {
                formDataObject[key] = value;
            });
            
            try {
                // Show loading state
                document.getElementById('submit-button').disabled = true;
                document.getElementById('form-status').textContent = 'Submitting...';
                
                // Send data to API
                const response = await fetch('/api/passport', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formDataObject)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    // Success
                    document.getElementById('form-status').textContent = 'Application submitted successfully!';
                    document.getElementById('form-status').className = 'success-message';
                    
                    // Optionally redirect to a confirmation page
                    setTimeout(() => {
                        window.location.href = `/confirmation.html?id=${result.application_id}`;
                    }, 2000);
                } else {
                    // Error
                    document.getElementById('form-status').textContent = `Error: ${result.detail || 'Something went wrong'}`;
                    document.getElementById('form-status').className = 'error-message';
                    document.getElementById('submit-button').disabled = false;
                }
            } catch (error) {
                console.error('Submission error:', error);
                document.getElementById('form-status').textContent = 'Network error. Please try again.';
                document.getElementById('form-status').className = 'error-message';
                document.getElementById('submit-button').disabled = false;
            }
        });
    }
}); 