FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM alpine:3.20 AS export
COPY --from=build /app/dist /dist
CMD ["sh", "-c", "rm -fr /output/* && cp -a /dist/. /output/ && echo 'frontend bundle exported'"]