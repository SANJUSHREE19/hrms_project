// Jenkinsfile
pipeline {
    agent any

    environment {
        AWS_REGION                 = 'us-east-1'
        GITHUB_CREDENTIALS_ID    = 'github-pat-hrms'
        EC2_SSH_CREDENTIALS_ID   = 'ec2-ssh-key-hrms'
        APP_DIR                    = "/home/ec2-user/hrms_project"
        VENV_DIR                   = "${APP_DIR}/env"
        CLOUDFRONT_DISTRIBUTION_ID = 'E30K56N2AOR96V'
        S3_BUCKET_NAME             = 'hrms-frontend-s3-bucket-name'
        // AWS_CREDENTIALS_ID      = 'aws-jenkins-hrms-user' // Uncomment if using specific IAM User for AWS CLI
    }

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps {
                echo "Checking out code from GitHub..."
                checkout scm
            }
        }

        stage('Build Frontend') {
            steps {
                echo "Building React frontend..."
                // Navigate to frontend directory and build
                sh '''
                    set -ex # Exit on error, print commands

                    export NVM_DIR="$HOME/.nvm" # Ensure NVM is sourced if not already in Jenkins user profile
                    echo "Checking for NVM script at $NVM_DIR/nvm.sh"
                    if [ -s "$NVM_DIR/nvm.sh" ]; then
                      \. "$NVM_DIR/nvm.sh"  # Source NVM
                      echo "NVM sourced successfully."
                    else
                      echo "ERROR: NVM script not found at $NVM_DIR/nvm.sh"
                      exit 1
                    fi

                    # Explicitly install (if needed) and use the desired Node version
                    echo "Ensuring Node LTS version is installed and used..."
                    nvm install --lts # Ensures LTS is installed or updates if needed
                    nvm use --lts     # Activates the LTS version for this shell session
                    nvm current       # Verify the active version

                    echo "Changing directory to frontend..."
                    cd frontend

                    echo "Installing frontend dependencies using npm ci..."
                    npm ci # Use 'ci' for cleaner installs in CI/CD

                    echo "Building production frontend..."
                    npm run build

                    echo "Frontend build complete."
                '''
            }
        }

        stage('Deploy Frontend') {
            steps {
                echo "Deploying frontend build to S3 and invalidating CloudFront..."
                sh """
                    aws s3 sync frontend/build/ s3://${env.S3_BUCKET_NAME}/ --delete
                    aws cloudfront create-invalidation --distribution-id ${env.CLOUDFRONT_DISTRIBUTION_ID} --paths "/*"
                """
                // Optional: Use withCredentials if not relying on EC2 Instance Role
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
                 sshagent([env.EC2_SSH_CREDENTIALS_ID]) {
                    sh """
                        set -e 
                        echo "Deploying backend on localhost as ec2-user..."
                        cd ${env.APP_DIR}

                        echo "Activating virtual environment..."
                        source ${env.VENV_DIR}/bin/activate

                        echo "Installing/Updating backend dependencies..."
                        pip install -r requirements.txt
                        pip install boto3 mysqlclient 

                        echo "Collecting static files..."
                        python manage.py collectstatic --noinput

                        echo "Running database migrations..."
                        python manage.py migrate --noinput

                        echo "Restarting Gunicorn via Supervisor..."
                        sudo /usr/bin/supervisorctl restart hrms_gunicorn

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
