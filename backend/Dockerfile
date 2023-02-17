FROM node:lts-alpine
LABEL version="3.0.0"
LABEL description="Cinzia Server"
LABEL maintainer="PineApp srl <info@pineappsrl.com>"
WORKDIR /usr/app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000

CMD npm start
