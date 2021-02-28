FROM node:12-alpine

RUN apk update && apk upgrade && \
    apk add --no-cache git

ADD views /app/views
ADD torrent-stream /app/torrent-stream
ADD package.json /app
ADD server.js /app

RUN cd /app; npm install

ENV NODE_ENV production
ENV PORT 8080
EXPOSE 8080

WORKDIR "/app"
CMD [ "npm", "start" ]
