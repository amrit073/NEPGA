document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutButton = document.getElementById('logout-button');
    const applicationsTableBody = document.getElementById('applications-table-body');
    const applicationModal = document.getElementById('application-modal');
    const closeModalButton = document.getElementById('close-modal');
    const applicationDetails = document.getElementById('application-details');
    const statusUpdate = document.getElementById('status-update');
    const updateStatusButton = document.getElementById('update-status');
    const prevPageButton = document.getElementById('prev-page');
    const nextPageButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    // Pagination state
    let currentPage = 1;
    let totalPages = 1;
    const pageSize = 10;
    
    // Current application being viewed
    let currentApplicationId = null;
    
    // Check if user is already logged in
    const token = localStorage.getItem('adminToken');
    if (token) {
        showDashboard();
        loadApplications(currentPage);
    }
    
    // Login form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Store token and show dashboard
                localStorage.setItem('adminToken', data.token);
                showDashboard();
                loadApplications(currentPage);
            } else {
                // Show error
                loginError.textContent = data.detail || 'Invalid credentials';
                loginError.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = 'Network error. Please try again.';
            loginError.style.display = 'block';
        }
    });
    
    // Logout button
    logoutButton.addEventListener('click', function() {
        localStorage.removeItem('adminToken');
        showLogin();
    });
    
    // Close modal button
    closeModalButton.addEventListener('click', function() {
        applicationModal.style.display = 'none';
    });
    
    // Update status button
    updateStatusButton.addEventListener('click', async function() {
        if (!currentApplicationId) return;
        
        const newStatus = statusUpdate.value;
        
        try {
            const response = await fetch(`/api/admin/applications/${currentApplicationId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (response.ok) {
                // Close modal and reload applications
                applicationModal.style.display = 'none';
                loadApplications(currentPage);
            } else {
                const data = await response.json();
                alert(`Error: ${data.detail || 'Could not update status'}`);
            }
        } catch (error) {
            console.error('Update status error:', error);
            alert('Network error. Please try again.');
        }
    });
    
    // Pagination buttons
    prevPageButton.addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            loadApplications(currentPage);
        }
    });
    
    nextPageButton.addEventListener('click', function() {
        if (currentPage < totalPages) {
            currentPage++;
            loadApplications(currentPage);
        }
    });
    
    // Function to show login section
    function showLogin() {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
    
    // Function to show dashboard section
    function showDashboard() {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
    }
    
    // Function to load applications
    async function loadApplications(page) {
        try {
            const response = await fetch(`/api/admin/applications?page=${page}&limit=${pageSize}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (response.status === 401) {
                // Unauthorized, show login
                localStorage.removeItem('adminToken');
                showLogin();
                return;
            }
            
            const data = await response.json();
            
            if (response.ok) {
                // Update pagination
                currentPage = page;
                totalPages = Math.ceil(data.total / pageSize);
                pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
                prevPageButton.disabled = currentPage === 1;
                nextPageButton.disabled = currentPage === totalPages;
                
                // Render applications
                renderApplications(data.applications);
            } else {
                applicationsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Error: ${data.detail || 'Could not load applications'}</td></tr>`;
            }
        } catch (error) {
            console.error('Load applications error:', error);
            applicationsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Network error. Please try again.</td></tr>';
        }
    }
    
    // Function to render applications
    function renderApplications(applications) {
        if (applications.length === 0) {
            applicationsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No applications found</td></tr>';
            return;
        }
        
        applicationsTableBody.innerHTML = '';
        
        applications.forEach(app => {
            const row = document.createElement('tr');
            
            // Format date
            const date = new Date(app.submission_date).toLocaleDateString();
            
            // Status class
            const statusClass = `status-${app.status.toLowerCase()}`;
            
            row.innerHTML = `
                <td>${app.application_id.substring(0, 8)}...</td>
                <td>${app.full_name}</td>
                <td>${date}</td>
                <td>${app.passport_type}</td>
                <td><span class="${statusClass}">${app.status}</span></td>
                <td>
                    <button class="view-details secondary-button" data-id="${app.application_id}">View Details</button>
                </td>
            `;
            
            applicationsTableBody.appendChild(row);
        });
        
        // Add event listeners to view details buttons
        document.querySelectorAll('.view-details').forEach(button => {
            button.addEventListener('click', function() {
                const applicationId = this.getAttribute('data-id');
                viewApplicationDetails(applicationId);
            });
        });
    }
    
    // Function to view application details
    async function viewApplicationDetails(applicationId) {
        try {
            const response = await fetch(`/api/admin/applications/${applicationId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (response.status === 401) {
                // Unauthorized, show login
                localStorage.removeItem('adminToken');
                showLogin();
                return;
            }
            
            const application = await response.json();
            
            if (response.ok) {
                // Store current application ID
                currentApplicationId = applicationId;
                
                // Set current status in dropdown
                statusUpdate.value = application.status;
                
                // Format date
                const submissionDate = new Date(application.submission_date).toLocaleString();
                
                // Render application details
                applicationDetails.innerHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <p><strong>Application ID:</strong> ${application.application_id}</p>
                            <p><strong>Full Name:</strong> ${application.full_name}</p>
                            <p><strong>Date of Birth:</strong> ${application.date_of_birth}</p>
                            <p><strong>Gender:</strong> ${application.gender}</p>
                            <p><strong>Citizenship Number:</strong> ${application.citizenship_number}</p>
                            <p><strong>Passport Type:</strong> ${application.passport_type}</p>
                        </div>
                        <div>
                            <p><strong>Address:</strong> ${application.address}</p>
                            <p><strong>Phone:</strong> ${application.phone}</p>
                            <p><strong>Email:</strong> ${application.email}</p>
                            <p><strong>Emergency Contact:</strong> ${application.emergency_contact || 'N/A'}</p>
                            <p><strong>Submission Date:</strong> ${submissionDate}</p>
                            <p><strong>Current Status:</strong> <span class="status-${application.status.toLowerCase()}">${application.status}</span></p>
                        </div>
                    </div>
                    ${application.additional_notes ? `<div style="margin-top: 1rem;"><strong>Additional Notes:</strong><p>${application.additional_notes}</p></div>` : ''}
                `;
                
                // Show modal
                applicationModal.style.display = 'block';
            } else {
                alert(`Error: ${application.detail || 'Could not load application details'}`);
            }
        } catch (error) {
            console.error('View application details error:', error);
            alert('Network error. Please try again.');
        }
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === applicationModal) {
            applicationModal.style.display = 'none';
        }
    });
}); 