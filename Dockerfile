FROM node:12-alpine

USER root

RUN chmod -R 777 /

RUN apk update && apk upgrade && \
    apk add --no-cache git

RUN npm install pm2 -g

ADD views /app/views
ADD torrent-stream /app/torrent-stream
ADD package.json /app
ADD server.js /app

RUN cd /app; npm install

ENV NODE_ENV production
ENV PORT 8080
EXPOSE 8080

WORKDIR "/app"
CMD ["pm2-runtime", "server.js"]
