pipeline {
    agent any
    
    tools {
        nodejs "node"
    }

    options {
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
    }

    triggers {
        githubPush()
    }

    environment {
        DOCKER_IMAGE = "rahuldock44/devsecops-app"
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
                script {
                    def scannerHome = tool 'sonar-scanner'
                    withSonarQubeEnv('sonar-server') {
                        sh """
                        cd backend
                        ${scannerHome}/bin/sonar-scanner \
                          -Dsonar.projectKey=devsecops-node-app \
                          -Dsonar.sources=. \
                          -Dsonar.host.url=$SONAR_HOST_URL 
                        """
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 2, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
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
                sh 'trivy image --exit-code 0 --severity HIGH,CRITICAL $DOCKER_IMAGE:$IMAGE_TAG'
            }
        }

        stage('Push Image to DockerHub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-cred',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS')]) {
                    sh '''
                        echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin
                        docker tag $DOCKER_IMAGE:$IMAGE_TAG $DOCKER_IMAGE:latest
                        docker push $DOCKER_IMAGE:$IMAGE_TAG
                        docker push $DOCKER_IMAGE:latest
                    '''
                }
            }
        }

        stage('Update GitOps Repo (Trigger ArgoCD)') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'github-cred',
                    usernameVariable: 'GIT_USER',
                    passwordVariable: 'GIT_PASS')]) {
                    sh '''
                        rm -rf gitops-repo
                        git clone https://$GIT_USER:$GIT_PASS@github.com/Rahuldevops121/gitops-repo.git
                        cd gitops-repo
                        sed -i "s/tag:.*/tag: \\"$IMAGE_TAG\\"/" app/helm/devsecops-app/values.yaml
                        git config user.email "jenkins@demo.com"
                        git config user.name "jenkins"
                        git add .
                        git commit -m "Update image tag to $IMAGE_TAG" || true
                        git push origin HEAD
                    '''
                }
            }
        }

        stage('Cleanup Docker Images') {
            steps {
                sh '''
                    docker rmi $DOCKER_IMAGE:$IMAGE_TAG || true
                    docker rmi $DOCKER_IMAGE:latest || true
                '''
            }
        }
    }

    post {
        always {
            echo 'Pipeline completed'
            cleanWs()
        }
        success { echo '✅ Deployment triggered via ArgoCD 🚀' }
        failure { echo '❌ Pipeline failed — check logs' }
    }
}            
