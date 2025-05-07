// Jenkinsfile
pipeline {
    agent any // Run on the main Jenkins node (our EC2 instance)

    environment {
        AWS_REGION                 = 'us-east-1' // Your primary AWS region
        GITHUB_CREDENTIALS_ID    = 'github-pat-hrms' // Jenkins credential ID for GitHub PAT
        EC2_SSH_CREDENTIALS_ID   = 'ec2-ssh-key-hrms'  // Jenkins credential ID for EC2 SSH key
        APP_DIR                    = "/home/ec2-user/hrms_project" // App directory on EC2 (your repo)
        VENV_DIR                   = "${APP_DIR}/env"
        CLOUDFRONT_DISTRIBUTION_ID = 'E30K56N2AOR96V' // Your CloudFront Distribution ID
        S3_BUCKET_NAME             = 'hrms-frontend-s3-bucket-name' // Your S3 bucket name

        // For AWS CLI via shell (relies on EC2 Instance Role permissions).
        // If you want to use specific IAM User keys instead of EC2 Role, create
        // an 'AWS Credentials' type in Jenkins (e.g., with ID 'aws-jenkins-hrms-user')
        // and uncomment the withCredentials block in the 'Deploy Frontend' stage.
        // AWS_CREDENTIALS_ID         = 'aws-jenkins-hrms-user'
    }

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps {
                echo "Checking out code from GitHub..."
                checkout scm // Uses Git Plugin, configured in Jenkins job SCM section
            }
        }

        stage('Build Frontend') {
            steps {
                echo "Building React frontend..."
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    echo "NVM_DIR is set to: $NVM_DIR"

                    if [ -s "$NVM_DIR/nvm.sh" ]; then
                        echo "Sourcing $NVM_DIR/nvm.sh..."
                        . "$NVM_DIR/nvm.sh"  # This loads NVM. MUST be a dot, then a space, then the path.
                        echo "NVM sourced."
                    else
                        echo "ERROR: NVM script not found at $NVM_DIR/nvm.sh"
                        exit 1
                    fi
                    
                    echo "Attempting to use Node.js LTS version..."
                    nvm use --lts # THIS IS THE CRITICAL LINE to activate a version
                    # You can also try: nvm install --lts && nvm use --lts
                    # OR a specific version you installed: nvm use v18.17.0 (replace with actual installed version)
                    
                    echo "Current Node version: $(node -v)"
                    echo "Current npm version: $(npm -v)"

                    cd frontend 
                    echo "Installing frontend dependencies..."
                    npm ci 

                    echo "Building production frontend..."
                    CLERK_KEY=$(aws ssm get-parameter --name "/hrms/prod/clerk/publishable_key" --with-decryption --query "Parameter.Value" --output text --region us-east-1)
                    
                    if [ -z "$CLERK_KEY" ]; then
                        echo "ERROR: Failed to fetch VITE_CLERK_PUBLISHABLE_KEY from SSM in us-east-1."
                        exit 1 
                    fi
                    
                    echo "VITE_CLERK_PUBLISHABLE_KEY=${CLERK_KEY}" > .env.production 
                    echo "Contents of .env.production:" 
                    cat .env.production 

                    npm run build
                '''
            }
        }

        stage('Deploy Frontend') {
            steps {
                 echo "Deploying frontend build to S3 and invalidating CloudFront..."
                // This assumes EC2 Instance Role has S3 and CloudFront permissions.
                // ** IMPORTANT FOR OAI (Origin Access Identity) with S3 **
                // If your S3 bucket is private and uses OAI for CloudFront access (recommended),
                // you should REMOVE the "--acl public-read" flag.
                sh """
                    echo "Syncing build to S3 bucket: s3://${env.S3_BUCKET_NAME}/"
                    aws s3 sync frontend/build/ s3://${env.S3_BUCKET_NAME}/ --delete
                    
                    echo "Invalidating CloudFront distribution: ${env.CLOUDFRONT_DISTRIBUTION_ID}"
                    aws cloudfront create-invalidation --distribution-id ${env.CLOUDFRONT_DISTRIBUTION_ID} --paths "/*"
                """
                // --- OR If using explicit AWS IAM User credentials stored in Jenkins ---
                // Ensure 'AWS_CREDENTIALS_ID' is defined in environment and credentials exist in Jenkins.
                /*
                withCredentials([aws(credentialsId: env.AWS_CREDENTIALS_ID, region: env.AWS_REGION)]) {
                    sh '''
                       aws s3 sync frontend/build/ s3://${env.S3_BUCKET_NAME}/ --delete
                       aws cloudfront create-invalidation --distribution-id ${env.CLOUDFRONT_DISTRIBUTION_ID} --paths "/*"
                    '''
                }
                */
            }
        }

        stage('Deploy Backend') {
            steps {
                 sshagent([env.EC2_SSH_CREDENTIALS_ID]) { // Uses the Jenkins SSH credential for ec2-user
                    sh """
                        set -e # Exit immediately if a command exits with a non-zero status.
                        echo "Deploying backend on localhost as ec2-user..."
                        cd ${env.APP_DIR}

                        # Jenkins typically checks out code to its workspace.
                        # The commands below assume APP_DIR is where Jenkins checked out the code
                        # or that you've synced it there.

                        echo "Activating virtual environment..."
                        source ${env.VENV_DIR}/bin/activate

                        echo "Installing/Updating backend dependencies..."
                        pip install -r requirements.txt
                        # Ensure boto3 is available for settings.py SSM access
                        pip install boto3 mysqlclient # Assuming MySQL

                        echo "Collecting static files (for Django Admin)..."
                        python manage.py collectstatic --noinput

                        echo "Running database migrations..."
                        python manage.py migrate --noinput

                        echo "Restarting Gunicorn via Supervisor..."
                        # The Jenkins user (often 'jenkins') needs passwordless sudo permission
                        # for this specific supervisorctl command.
                        # Configure sudoers: 'jenkins ALL=(ALL) NOPASSWD: /usr/bin/supervisorctl restart hrms_gunicorn'
                        # Or, if Supervisor is managed by systemd as supervisord.service:
                        # 'jenkins ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart supervisord' (if restarting whole service)
                        # Path to supervisorctl might be /usr/local/bin/supervisorctl if installed by pip.
                        sudo /usr/bin/supervisorctl restart hrms_gunicorn

                        # Deactivate might not be strictly necessary here as the sh step will end
                        # deactivate
                        echo "Backend deployment steps completed."
                    """
                 }
            }
        }
    }

    post {
        always {
            echo 'Pipeline finished.'
        }
        success {
            echo 'Pipeline succeeded!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}
