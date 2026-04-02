FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable \
  && corepack prepare pnpm@10.8.1 --activate

WORKDIR /workspace

EXPOSE 8090

CMD ["bash", "-lc", "python3 -m http.server 8090 --directory /workspace"]
