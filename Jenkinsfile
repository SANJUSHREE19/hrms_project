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
        STATIC_ROOT_DIR_GROOVY     = "${APP_DIR}/staticfiles"
        EC2_PUBLIC_DNS_OR_IP       = '54.165.184.90'
        EC2_HOST_FOR_API           = '54.165.184.90'
        // AWS_CREDENTIALS_ID      = 'aws-jenkins-hrms-user' // Uncomment if using specific IAM User for AWS CLI
    }

    tools {
        // Use the name you gave your NodeJS installation in Global Tool Configuration
        nodejs 'NodeJS_LTS' 
    }

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }
    stages {
        stage('Cleanup') {
            steps {
                echo "Cleaning workspace..."
                cleanWs() 
            }
        }
        stage('Checkout') {
            steps {
                echo "Checking out code from GitHub..."
                checkout scm
            }
        }

        stage('Build Frontend') {
            steps {
                echo "Building React frontend..."
                sh '''
                    set -ex

                    echo "Verifying Node.js (from Jenkins Tool configuration):"
                    node -v
                    npm -v

                    cd frontend
                    echo "Installing frontend dependencies..."
                    npm ci

                    echo "Preparing production environment file..."
                    CLERK_KEY=$(aws ssm get-parameter --name "/hrms/prod/clerk/publishable_key" --with-decryption --query "Parameter.Value" --output text --region ${AWS_REGION})
                    
                    if [ -z "$CLERK_KEY" ]; then
                        echo "ERROR: Failed to fetch REACT_APP_CLERK_PUBLISHABLE_KEY from SSM in ${AWS_REGION}."
                        exit 1
                    fi

                    # Create .env.production file
                    echo "REACT_APP_CLERK_PUBLISHABLE_KEY=${CLERK_KEY}" > .env.production
                    echo "REACT_APP_API_BASE_URL=https://${EC2_HOST_FOR_API}/api" >> .env.production
                    
                    echo "Contents of .env.production:"
                    cat .env.production

                    echo "Building production frontend..."
                    npm run build
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
                // Use sshagent to wrap an SSH command executed as ec2-user
                sshagent([env.EC2_SSH_CREDENTIALS_ID]) {
                    // Execute the deployment script via SSH to localhost as ec2-user
                    sh '''
                      set -ex 
                      ssh -o StrictHostKeyChecking=no ec2-user@localhost << 'DEPLOY_SCRIPT'
                      
                      echo "--- Running Deployment on localhost via SSH as: $(whoami) ---"
                      # Now we are running as ec2-user inside the remote shell
                      
                      # Define variables for clarity WITHIN this shell script
                      APP_DIR="/home/ec2-user/hrms_project" # Or read from an injected env var if preferred
                      VENV_DIR="${APP_DIR}/env"
                      SUPERVISORCTL_PATH="/usr/local/bin/supervisorctl" # Correct path
                      SUPERVISORD_PATH="/usr/local/bin/supervisord"
                      SUPERVISORD_CONF="/etc/supervisord.conf"
                      CHOWN_PATH="/usr/bin/chown" # Correct path

                      echo "Current Directory: $(pwd)"
                      echo "Changing to APP_DIR: ${APP_DIR}"
                      cd "${APP_DIR}" || { echo "Failed to cd to ${APP_DIR}"; exit 1; }

                      echo "Ensuring ownership of ${APP_DIR} for $(whoami)..."
                      # Need sudo rights configured for ec2-user (as verified previously)
                      sudo "${CHOWN_PATH}" -R $(whoami):$(whoami) "${APP_DIR}"

                      echo "Ensuring socket directory exists: ${APP_DIR}/run"
                      mkdir -p "${APP_DIR}/run"
                      # chown should not be needed here if parent is owned correctly
                      
                      echo "Activating virtual environment: ${VENV_DIR}/bin/activate"
                      source "${VENV_DIR}/bin/activate" || { echo "Failed to activate venv"; exit 1; }

                      STATIC_ROOT_DIR="${APP_DIR}/staticfiles"
                      echo "Ensuring static root directory exists: ${STATIC_ROOT_DIR}"
                      mkdir -p "${STATIC_ROOT_DIR}" 
                      # chown should not be needed here

                      echo "Installing/Updating backend dependencies..."
                      pip install -r requirements.txt
                      pip install boto3 mysqlclient 

                      echo "Collecting static files..."
                      python manage.py collectstatic --noinput

                      echo "Running database migrations..."
                      python manage.py migrate --noinput

                      echo "Ensuring supervisord is running..."
                      sudo "${SUPERVISORD_PATH}" -c "${SUPERVISORD_CONF}" || echo "Supervisord possibly already running or failed (check logs)"

                      echo "Restarting Gunicorn via Supervisor..."
                      # Need sudo rights configured for ec2-user (as verified previously)
                      sudo "${SUPERVISORCTL_PATH}" -c "${SUPERVISORD_CONF}" restart hrms_gunicorn

                      echo "--- Backend deployment script finished ---"

                      # Exiting the SSH heredoc
                      exit 0 
                      DEPLOY_SCRIPT
                    ''' // End of the main sh block wrapping the ssh command
                 } // End of sshagent block
            } // End of steps
        } // End of stage
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
