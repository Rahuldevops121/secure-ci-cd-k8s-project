pipeline {
    agent any

    tools {
        nodejs "node"
    }

    options {
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    triggers {
        githubPush()
    }

    environment {
        BACKEND_IMAGE   = "rahuldock44/backend"
        FRONTEND_IMAGE  = "rahuldock44/frontend"
        IMAGE_TAG       = "${BUILD_NUMBER}"
        TRIVY_CACHE     = "/tmp/trivy-cache"
        DOCKER_BUILDKIT = '1'
    }

    stages {

        // ──────────────────────────────────────────
        stage('Install Dependencies & Unit Test') {
        // ──────────────────────────────────────────
            steps {
                dir('backend') {
                    sh '''
                        npm install --prefer-offline
                        npm test || true
                    '''
                }
            }
        }

        // ──────────────────────────────────────────
        stage('SonarQube Scan') {
        // ──────────────────────────────────────────
            steps {
                script {
                    def scannerHome = tool 'sonar-scanner'
                    withSonarQubeEnv('sonar-server') {
                        sh """
                            cd backend && \
                            ${scannerHome}/bin/sonar-scanner \
                              -Dsonar.projectKey=devsecops-node-app \
                              -Dsonar.sources=. \
                              -Dsonar.host.url=$SONAR_HOST_URL
                        """
                    }
                }
            }
        }

        // ──────────────────────────────────────────
        stage('Quality Gate') {
        // ──────────────────────────────────────────
            steps {
                timeout(time: 2, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // ──────────────────────────────────────────
        stage('Build Docker Images') {
        // ──────────────────────────────────────────
            parallel {
                stage('Build Backend') {
                    steps {
                        sh '''
                            docker pull $BACKEND_IMAGE:latest || true
                            docker build \
                                --cache-from $BACKEND_IMAGE:latest \
                                --build-arg BUILDKIT_INLINE_CACHE=1 \
                                -t $BACKEND_IMAGE:$IMAGE_TAG \
                                -t $BACKEND_IMAGE:latest \
                                ./backend
                        '''
                    }
                }
                stage('Build Frontend') {
                    steps {
                        sh '''
                            docker pull $FRONTEND_IMAGE:latest || true
                            docker build \
                                --cache-from $FRONTEND_IMAGE:latest \
                                --build-arg BUILDKIT_INLINE_CACHE=1 \
                                -t $FRONTEND_IMAGE:$IMAGE_TAG \
                                -t $FRONTEND_IMAGE:latest \
                                ./frontend
                        '''
                    }
                }
            }
        }

        // ──────────────────────────────────────────
        stage('Trivy Security Scan') {
        // ──────────────────────────────────────────
            parallel {
                stage('Scan Backend') {
                    steps {
                        sh '''
                            mkdir -p $TRIVY_CACHE
                            trivy image \
                                --cache-dir $TRIVY_CACHE \
                                --exit-code 0 \
                                --severity HIGH,CRITICAL \
                                $BACKEND_IMAGE:$IMAGE_TAG
                        '''
                    }
                }
                stage('Scan Frontend') {
                    steps {
                        sh '''
                            mkdir -p $TRIVY_CACHE
                            trivy image \
                                --cache-dir $TRIVY_CACHE \
                                --exit-code 0 \
                                --severity HIGH,CRITICAL \
                                $FRONTEND_IMAGE:$IMAGE_TAG
                        '''
                    }
                }
            }
        }

        // ──────────────────────────────────────────
        stage('Push Images to DockerHub') {
        // ──────────────────────────────────────────
            options {
                timeout(time: 60, unit: 'MINUTES')
            }
            parallel {
                stage('Push Backend') {
                    steps {
                        withCredentials([usernamePassword(
                            credentialsId: 'docker-cred',
                            usernameVariable: 'DOCKER_USER',
                            passwordVariable: 'DOCKER_PASS')]) {
                            sh '''
                                echo $DOCKER_PASS | docker login \
                                    -u $DOCKER_USER --password-stdin
                                docker push $BACKEND_IMAGE:$IMAGE_TAG
                                docker push $BACKEND_IMAGE:latest
                            '''
                        }
                    }
                }
                stage('Push Frontend') {
                    steps {
                        withCredentials([usernamePassword(
                            credentialsId: 'docker-cred',
                            usernameVariable: 'DOCKER_USER',
                            passwordVariable: 'DOCKER_PASS')]) {
                            sh '''
                                echo $DOCKER_PASS | docker login \
                                    -u $DOCKER_USER --password-stdin
                                docker push $FRONTEND_IMAGE:$IMAGE_TAG
                                docker push $FRONTEND_IMAGE:latest
                            '''
                        }
                    }
                }
            }
        }

        // ──────────────────────────────────────────
        stage('Update GitOps Repo (Trigger ArgoCD)') {
        // ──────────────────────────────────────────
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'github-cred',
                    usernameVariable: 'GIT_USER',
                    passwordVariable: 'GIT_PASS')]) {
                    sh '''
                        rm -rf gitops-repo

                        git clone --depth 1 \
                            https://$GIT_USER:$GIT_PASS@github.com/Rahuldevops121/gitops-repo.git

                        cd gitops-repo

                        sed -i "/^backend:/,/^[^ ]/ s|tag:.*|tag: \\"$IMAGE_TAG\\"|" \
                            app/helm/devsecops-app/values.yaml

                        sed -i "/^frontend:/,/^[^ ]/ s|tag:.*|tag: \\"$IMAGE_TAG\\"|" \
                            app/helm/devsecops-app/values.yaml

                        echo "──── Updated values.yaml ────"
                        cat app/helm/devsecops-app/values.yaml

                        git config user.email "jenkins@demo.com"
                        git config user.name  "jenkins"
                        git add .
                        git diff --cached --quiet || \
                            git commit -m "ci: update image tag to $IMAGE_TAG"

                        git push origin HEAD
                    '''
                }
            }
        }

        // ──────────────────────────────────────────
        stage('Cleanup Docker Images') {
        // ──────────────────────────────────────────
            steps {
                sh '''
                    docker rmi $BACKEND_IMAGE:$IMAGE_TAG  || true
                    docker rmi $FRONTEND_IMAGE:$IMAGE_TAG || true
                    docker image prune -f
                    docker builder prune --filter until=48h -f
                    docker container prune -f
                '''
            }
        }
    }

    post {
        always {
            echo 'Pipeline completed'
            cleanWs()
        }
        success {
            echo '✅ Build #${BUILD_NUMBER} — Images pushed & ArgoCD sync triggered 🚀'
        }
        failure {
            echo '❌ Pipeline failed — check logs above'
        }
    }
}
