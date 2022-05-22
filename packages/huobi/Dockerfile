FROM node:16

WORKDIR /data-analysis

COPY package.json tsconfig.json lerna.json jest.config.js jest.setup.js jest.transformer.js ./
COPY packages ./packages

RUN yarn install

CMD ["yarn", "start:huobi"]
