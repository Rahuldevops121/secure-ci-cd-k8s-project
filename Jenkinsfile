pipeline {
    agent any

    tools {
        nodejs "node"
    }

    options {
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))  // ✅ Keep only last 10 builds
    }

    triggers {
        githubPush()
    }

    environment {
        DOCKER_IMAGE   = "rahuldock44/devsecops-app"
        IMAGE_TAG      = "${BUILD_NUMBER}"
        TRIVY_CACHE    = "/tmp/trivy-cache"             // ✅ Persistent Trivy cache
        DOCKER_BUILDKIT = '1'                           // ✅ Moved to global env
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
                    // ✅ --prefer-offline uses local cache first — faster
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
                        // ✅ Chained with && — fails fast if cd fails
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
        stage('Build Docker Image') {
        // ──────────────────────────────────────────
            steps {
                sh '''
                    # ✅ Pull latest for cache reuse — speeds up layer builds
                    docker pull $DOCKER_IMAGE:latest || true

                    # ✅ Build with cache-from + tag both in one build
                    docker build \
                        --cache-from $DOCKER_IMAGE:latest \
                        -t $DOCKER_IMAGE:$IMAGE_TAG \
                        -t $DOCKER_IMAGE:latest \
                        ./backend
                '''
            }
        }

        // ──────────────────────────────────────────
        stage('Trivy Security Scan') {
        // ──────────────────────────────────────────
            steps {
                sh '''
                    # ✅ Cache Trivy DB — skips re-download on every run
                    mkdir -p $TRIVY_CACHE
                    trivy image \
                        --cache-dir $TRIVY_CACHE \
                        --exit-code 0 \
                        --severity HIGH,CRITICAL \
                        $DOCKER_IMAGE:$IMAGE_TAG
                '''
            }
        }

        // ──────────────────────────────────────────
        stage('Push Image to DockerHub') {
        // ──────────────────────────────────────────
            options {
                timeout(time: 20, unit: 'MINUTES')  // ✅ Stage-level timeout for push
            }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-cred',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS')]) {
                    sh '''
                        echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin

                        # ✅ Both tags already built — layers upload only once
                        docker push $DOCKER_IMAGE:$IMAGE_TAG
                        docker push $DOCKER_IMAGE:latest
                    '''
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

                        # ✅ Shallow clone — downloads only latest commit, not full history
                        git clone --depth 1 \
                            https://$GIT_USER:$GIT_PASS@github.com/Rahuldevops121/gitops-repo.git

                        cd gitops-repo
                        sed -i "s/tag:.*/tag: \\"$IMAGE_TAG\\"/" \
                            app/helm/devsecops-app/values.yaml

                        git config user.email "jenkins@demo.com"
                        git config user.name  "jenkins"
                        git add .
                        git diff --cached --quiet || \
                            git commit -m "Update image tag to $IMAGE_TAG"
                        # ✅ Only commits if there are actual changes

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
                    # Remove build-specific tag
                    docker rmi $DOCKER_IMAGE:$IMAGE_TAG || true

                    # Remove dangling images left from build
                    docker image prune -f

                    # Remove stale build cache older than 48h
                    docker builder prune --filter until=48h -f

                    # Remove stopped containers
                    docker container prune -f
                '''
            }
        }
    }

    post {
        always {
            echo 'Pipeline completed'
            cleanWs()   // ✅ Cleans Jenkins workspace
        }
        success {
            echo '✅ Deployment triggered via ArgoCD 🚀'
        }
        failure {
            echo '❌ Pipeline failed — check logs above'
        }
    }
}
