# We use the official, stable, and hardened Cube base engine image
FROM cubejs/cube:v0.35

# Copy your global environmental script straight to Cube's configuration root
COPY cube.js /cube/conf/cube.js

# Target Fix: Explicitly copy your local data models into the strict schema directory
COPY model/DailyB2cMetrics.yml /cube/conf/model/DailyB2cMetrics.yml
