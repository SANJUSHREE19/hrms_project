# HRMS - Human Resource Management System

A full-stack web application designed to streamline Human Resource Management processes, including employee data management, role-based access, and administrative dashboards.

## Core Features

*   **Employee Data Management:** Secure access to employee profiles, salary details, department information, and employment history.
*   **Role-Based Access Control (RBAC):**
    *   **Employees:** Can view their own profiles, salary, and browse an organization-wide employee directory.
    *   **HR Managers:** Can manage employee records (view/edit profiles, salary, title histories), access onboarding and payroll dashboards (basic placeholders), and manage employee data change requests (conceptual).
    *   **Administrators:** Full user management (assign roles, block/unblock users), department structure management, and access to HR functionalities.
*   **Administrative Dashboards:** Dedicated interfaces for HR Managers and Administrators to perform their respective tasks.
*   **Secure Authentication:** Utilizes Clerk for Single Sign-On (SSO) and user authentication.
*   **Advanced Search & Filtering:** (Conceptual) Ability to search and filter employees by various criteria like department, job title.
*   **Onboarding & Payroll Dashboards:** Basic placeholder dashboards for future expansion of onboarding workflows and payroll processing.

## Technology Stack

*   **Frontend:** React (created with `create-react-app`)
    *   Authentication: `@clerk/clerk-react`
    *   Routing: `react-router-dom`
    *   API Client: `axios`
*   **Backend:** Django & Django Rest Framework
    *   API: Secure RESTful API handling data operations.
    *   Authentication: Custom JWT verification integrated with Clerk.
*   **Database:** MySQL (managed via AWS RDS in deployment)
*   **CI/CD:** Jenkins
*   **Source Control:** GitHub
*   **Deployment Platform:** AWS (EC2, RDS, S3, CloudFront, SSM Parameter Store)

## Project Goals

*   **Enhance HR Efficiency:** Simplify data management for HR teams and employees.
*   **Ensure Security & Compliance:** Protect sensitive employee data with encryption and role-based access controls.
*   **Improve Workforce Productivity:** Provide a seamless, user-friendly experience.
*   **Scalability & Performance:** Designed to ensure smooth operation under enterprise usage (conceptual for current single-instance deployment).

## Setup & Local Development

1.  **Prerequisites:**
    *   Node.js & npm
    *   Python & pip
    *   MySQL Server
    *   Clerk Account (for API keys)
2.  **Backend (`hrms_project` root):**
    *   Create a Python virtual environment: `python -m venv env`
    *   Activate: `source env/bin/activate` (Linux/macOS) or `env\Scripts\activate` (Windows)
    *   Install dependencies: `pip install -r requirements.txt`
    *   Create a `.env` file in the project root (`hrms_project/`) with database credentials and Clerk keys (refer to `.env.example` if provided, or use values from the deployment guide for structure).
    *   Run migrations: `python manage.py migrate`
    *   Create a superuser (for Django admin): `python manage.py createsuperuser`
    *   Run backend server: `python manage.py runserver` (usually on `http://localhost:8000`)
3.  **Frontend (`frontend/` directory):**
    *   Install dependencies: `npm install`
    *   Create a `.env` file in `frontend/` with `REACT_APP_CLERK_PUBLISHABLE_KEY` and `REACT_APP_API_BASE_URL=http://localhost:8000/api`.
    *   Run frontend server: `npm start` (usually on `http://localhost:3000`)

## Deployment Journey Overview (AWS, Jenkins, GitHub)

1.  **Source Control:** Code pushed to a GitHub repository.
2.  **AWS Infrastructure Setup:**
    *   **EC2 Instance (`t2.micro`):** Hosts Jenkins, Nginx (reverse proxy), and the Django/Gunicorn backend application.
    *   **RDS MySQL Instance (`db.t2.micro`):** Managed database for production data.
    *   **S3 Bucket:** Stores the static built files of the React frontend.
    *   **CloudFront Distribution:** Serves the S3 frontend content globally over HTTPS with caching.
    *   **IAM Roles & Users:** Created for EC2 instance permissions (to access SSM) and Jenkins (for AWS interactions if not using instance role).
    *   **Security Groups:** Configured to control traffic to EC2 and RDS instances.
    *   **SSM Parameter Store:** Securely stores sensitive configurations (database credentials, API keys, Django secret key).
3.  **Jenkins Setup:**
    *   Installed on the EC2 instance.
    *   Configured with necessary plugins (Git, GitHub Integration, SSH Agent, Node.js).
    *   Credentials stored securely (GitHub PAT, EC2 SSH key).
4.  **CI/CD Pipeline (`Jenkinsfile`):**
    *   **Trigger:** Automatically on push to the GitHub repository (via webhook).
    *   **Checkout:** Pulls the latest code.
    *   **Build Frontend:**
        *   Installs Node.js dependencies (`npm ci`).
        *   Injects production environment variables (like Clerk Publishable Key and the backend API URL from SSM/Jenkins environment) into the build process.
        *   Creates a production build of the React app (`npm run build`).
    *   **Deploy Frontend:**
        *   Syncs the `frontend/build` directory to the S3 bucket.
        *   Invalidates the CloudFront cache to serve the latest version.
    *   **Deploy Backend:**
        *   Uses SSH Agent to connect to `localhost` (the EC2 instance itself, but as the correct user like `ec2-user`).
        *   Updates Python dependencies (`pip install -r requirements.txt`).
        *   Collects Django static files (`python manage.py collectstatic`).
        *   Runs database migrations (`python manage.py migrate`).
        *   Restarts the Gunicorn application server (managed by Supervisor).
5.  **Nginx Configuration:**
    *   Acts as a reverse proxy, forwarding requests to Gunicorn.
    *   Serves Django's static admin files.
    *   Configured for HTTPS using a self-signed certificate (for development/testing without a custom domain) to handle API requests and resolve mixed content issues.
    *   Handles CORS preflight (`OPTIONS`) requests.

This deployment automates the process from code commit to a live update on AWS, ensuring consistency and reducing manual intervention.
