rm -rf dist
rm -rf node_modules
npm install
npm run build
docker build -t foreign-frontend ./ -f Dockerfile
docker rm -f foreign-frontend
docker run --name=foreign-frontend -itd  -p 80:80 foreign-frontend
