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
                        echo "--- Deploy Backend Stage Start ---"
                        echo "Running as user: $(whoami)" # Verify user
                        
                        echo "Deploying backend on localhost as $(whoami)..."
                        cd ${env.APP_DIR}

                        echo "Ensuring ownership of ${env.APP_DIR} for $(whoami)..."
                        echo "Running command: sudo /usr/bin/chown -R $(whoami):$(whoami) ${env.APP_DIR}"
                        # Use -n flag for non-interactive test
                        sudo -n /usr/bin/chown -R $(whoami):$(whoami) ${env.APP_DIR} 
                        CHOWN_EXIT_CODE=$?
                        echo "chown command exit code: $CHOWN_EXIT_CODE"
                        # If -n failed, try without -n ONLY FOR DEBUG, likely to hang or fail same way
                        # if [ $CHOWN_EXIT_CODE -ne 0 ]; then
                        #    echo "sudo -n failed, trying without -n (may hang)..."
                        #    sudo /usr/bin/chown -R $(whoami):$(whoami) ${env.APP_DIR} 
                        # fi

                        # --- REST OF SCRIPT (only runs if chown succeeds) ---

                        echo "Activating virtual environment..."
                        source ${env.VENV_DIR}/bin/activate

                        STATIC_ROOT_DIR="${env.APP_DIR}/staticfiles"
                        echo "Ensuring static root directory exists: ${STATIC_ROOT_DIR}"
                        mkdir -p "${STATIC_ROOT_DIR}" 
                        chown $(whoami):$(whoami) "${STATIC_ROOT_DIR}" 

                        echo "Installing/Updating backend dependencies..."
                        pip install -r requirements.txt
                        pip install boto3 mysqlclient 

                        echo "Collecting static files..."
                        python manage.py collectstatic --noinput

                        echo "Running database migrations..."
                        python manage.py migrate --noinput

                        echo "Ensuring supervisord is running..."
                        sudo /usr/local/bin/supervisord -c /etc/supervisord.conf || echo "Supervisord running or failed (check logs)"

                        echo "Restarting Gunicorn via Supervisor..."
                        echo "Running command: sudo /usr/local/bin/supervisorctl -c /etc/supervisord.conf restart hrms_gunicorn"
                        sudo -n /usr/local/bin/supervisorctl -c /etc/supervisord.conf restart hrms_gunicorn
                        SUPERVISORCTL_EXIT_CODE=$?
                         echo "supervisorctl command exit code: $SUPERVISORCTL_EXIT_CODE"
                        if [ $SUPERVISORCTL_EXIT_CODE -ne 0 ]; then
                             echo "ERROR: supervisorctl command failed"
                             # Optionally try without -n
                             # sudo /usr/local/bin/supervisorctl -c /etc/supervisord.conf restart hrms_gunicorn
                             exit $SUPERVISORCTL_EXIT_CODE
                        fi

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
