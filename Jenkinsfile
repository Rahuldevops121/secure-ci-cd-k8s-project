pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "rahuldevops121/devsecops-app"
        IMAGE_TAG = "${BUILD_NUMBER}"
    }

    stages {

        stage('Checkout Code') {
            steps {
                git 'https://github.com/Rahuldevops121/secure-ci-cd-k8s-project.git'
            }
        }

        stage('Install Dependencies & Unit Test') {
            steps {
                dir('backend') {
                    sh 'npm install'
                    sh 'npm test || true'
                }
            }
        }

        stage('SonarQube Scan') {
            steps {
                withSonarQubeEnv('sonarqube') {
                    sh '''
                    cd backend
                    sonar-scanner \
                    -Dsonar.projectKey=node-app \
                    -Dsonar.sources=. \
                    -Dsonar.host.url=http://localhost:9000 \
                    -Dsonar.login=$sonar-token
                    '''
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t $DOCKER_IMAGE:$IMAGE_TAG ./backend'
            }
        }

        stage('Trivy Image Scan') {
            steps {
                sh '''
                export TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db
                trivy image --exit-code 1 --severity CRITICAL,HIGH $DOCKER_IMAGE:$IMAGE_TAG
                '''
            }
        }

        stage('Docker Login') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-cred',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS')]) {
                    sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                }
            }
        }

        stage('Push Image to DockerHub') {
            steps {
                sh '''
                docker push $DOCKER_IMAGE:$IMAGE_TAG
                '''
            }
        }

        stage('Update Helm Chart for ArgoCD') {
            steps {
                sh '''
                git clone https://github.com/Rahuldevops121/gitops-repo.git
                cd gitops-repo

                sed -i "s/tag:.*/tag: ${IMAGE_TAG}/" helm/values.yaml

                git config user.email "devops@demo.com"
                git config user.name "jenkins"

                git add .
                git commit -m "Updated image tag to ${IMAGE_TAG}"
                git push
                '''
            }
        }
    }
}
