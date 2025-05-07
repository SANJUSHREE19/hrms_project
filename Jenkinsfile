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
                sh '''
                    set -ex # Ensure we see commands and exit on error

                    export NVM_DIR="$HOME/.nvm"
                    echo "NVM_DIR is set to: $NVM_DIR"

                    if [ -s "$NVM_DIR/nvm.sh" ]; then
                        echo "Sourcing $NVM_DIR/nvm.sh..."
                        . "$NVM_DIR/nvm.sh"  # Load NVM
                        NVM_SOURCED_CODE=$?
                        echo "NVM sourced, exit code: $NVM_SOURCED_CODE"
                        if [ $NVM_SOURCED_CODE -ne 0 ]; then
                            echo "ERROR: Failed to source NVM script."
                            exit $NVM_SOURCED_CODE
                        fi
                    else
                        echo "ERROR: NVM script not found at $NVM_DIR/nvm.sh"
                        exit 1
                    fi
                    
                    echo "Ensuring Node.js LTS version is installed..."
                    nvm install --lts
                    NVM_INSTALL_CODE=$?
                    echo "nvm install --lts exit code: $NVM_INSTALL_CODE"
                    if [ $NVM_INSTALL_CODE -ne 0 ]; then
                        echo "ERROR: nvm install --lts failed with exit code $NVM_INSTALL_CODE"
                        # Try to show more NVM debug info if possible
                        nvm debug
                        exit $NVM_INSTALL_CODE
                    fi

                    echo "Activating Node.js LTS version..."
                    nvm use --lts     
                    NVM_USE_CODE=$?
                    echo "nvm use --lts exit code: $NVM_USE_CODE"
                     if [ $NVM_USE_CODE -ne 0 ]; then
                        echo "ERROR: nvm use --lts failed with exit code $NVM_USE_CODE"
                        nvm debug
                        exit $NVM_USE_CODE
                    fi
                    
                    echo "VERIFYING PATH and Node versions after nvm use:"
                    echo "PATH is: $PATH"
                    command -v node
                    command -v npm
                    
                    echo "Current Node version: $(node -v || echo 'node not found')"
                    echo "Current npm version: $(npm -v || echo 'npm not found')"

                    cd frontend 
                    echo "Installing frontend dependencies..."
                    npm ci 

                    echo "Building production frontend..."
                    CLERK_KEY=$(aws ssm get-parameter --name "/hrms/prod/clerk/publishable_key" --with-decryption --query "Parameter.Value" --output text --region us-east-1)
                    
                    if [ -z "$CLERK_KEY" ]; then
                        echo "ERROR: Failed to fetch VITE_CLERK_PUBLISHABLE_KEY from SSM in us-east-1."
                        exit 1 
                    fi
                    
                    echo "VITE_CLERK_PBLISHABLE_KEY=${CLERK_KEY}" > .env.production 
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
