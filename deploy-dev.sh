#!/bin/sh
# 沿用宿主机 npm 构建，再部署 dev Nginx 前端。
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
npm install
npm run build
sudo docker build -t foreign-frontend-dev -f Dockerfile-dev .
sudo docker network inspect foreign-dev >/dev/null 2>&1 || sudo docker network create foreign-dev
if sudo docker container inspect foreign-frontend-dev >/dev/null 2>&1; then
  sudo docker stop foreign-frontend-dev
  sudo docker rm foreign-frontend-dev
fi
sudo docker run --name foreign-frontend-dev -d --restart=always \
  --network foreign-dev -p 8002:80 foreign-frontend-dev
