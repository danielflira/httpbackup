FROM node:15-slim

ADD . /usr/local/httpbackup-srv

RUN cd /usr/local/httpbackup-srv \
    && npm install --production \
    && npm install -g \
    && mkdir /data

WORKDIR /data
CMD ["httpbackup-srv"]