# 1. Recreate the ConfigMap directly from your local file
kubectl delete configmap cube-schema-config --ignore-not-found
kubectl create configmap cube-schema-config --from-file=DailyB2cMetrics.yml=DailyB2cMetrics.yaml

# 2. Trigger the rolling restart so Cube updates instantly
kubectl rollout restart deployment/cubejs

# 3. Wait for the pod to become fully active and ready
Write-Host "Waiting for Cube pod to recycle..." -ForegroundColor Cyan
kubectl rollout status deployment/cubejs

# 4. Automatically relaunch your port-forward tunnel
Write-Host "Cube is ready! Launching port tunnel on http://localhost:4000" -ForegroundColor Green
kubectl port-forward svc/cubejs-service 4000:4000
