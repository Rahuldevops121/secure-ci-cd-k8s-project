pipeline {
    agent any
    
    tools {
        nodejs "node"
    }

    triggers {
        githubPush()
    }

    environment {
        DOCKER_IMAGE = "rahuldevops121/devsecops-app"
        IMAGE_TAG = "${BUILD_NUMBER}"
    }

    stages {

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
                withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                    withSonarQubeEnv('sonarqube') {
                        sh '''
                        cd backend
                        sonar-scanner \
                        -Dsonar.projectKey=node-app \
                        -Dsonar.sources=. \
                        -Dsonar.host.url=http://sonarqube:9000 \
                        -Dsonar.login=$SONAR_TOKEN
                        '''
                    }
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t $DOCKER_IMAGE:$IMAGE_TAG ./backend'
            }
        }

        stage('Trivy Security Scan') {
            steps {
                sh 'trivy image --exit-code 1 --severity HIGH,CRITICAL $DOCKER_IMAGE:$IMAGE_TAG'
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
                sh 'docker push $DOCKER_IMAGE:$IMAGE_TAG'
            }
        }

        stage('Update GitOps Repo (Trigger ArgoCD)') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'github-cred',
                    usernameVariable: 'GIT_USER',
                    passwordVariable: 'GIT_PASS')]) {

                    sh '''
                    git clone https://$GIT_USER:$GIT_PASS@github.com/Rahuldevops121/gitops-repo.git
                    cd gitops-repo

                    sed -i "s/tag:.*/tag: \\"$IMAGE_TAG\\"/" app/helm/devsecops-app/values.yaml

                    git config user.email "jenkins@demo.com"
                    git config user.name "jenkins"

                    git add .
                    git commit -m "Update image tag to $IMAGE_TAG" || true
                    git push
                    '''
                }
            }
        }

        stage('Cleanup Docker Images') {
            steps {
                sh 'docker rmi $DOCKER_IMAGE:$IMAGE_TAG || true'
            }
        }

    }   // ← THIS WAS MISSING ❗❗❗

    post {
        always {
            echo 'Pipeline completed'
        }
        success {
            echo 'Deployment triggered via ArgoCD 🚀'
        }
        failure {
            echo 'Pipeline failed ❌'
        }
    }
}
