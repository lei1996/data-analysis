# 多阶段构建需要 大量的内存，微型vps 不能使用这个方案，只能客户端打包好，上传到git然后打包丢进去.
FROM node:16 as builder

WORKDIR /usr/app/client

COPY package.json tsconfig.json lerna.json jest.config.js jest.setup.js jest.transformer.js ./
COPY packages ./packages

RUN yarn install

RUN yarn build:client

FROM caddy:latest

COPY --from=builder /usr/app/client/packages/client/dist /usr/share/caddy
# COPY packages/client/dist /usr/share/caddy