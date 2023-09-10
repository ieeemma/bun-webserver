FROM docker.io/oven/bun
WORKDIR /app 
COPY . .
RUN mkdir -p content
CMD ["bun", "index.ts"]
EXPOSE 3000
