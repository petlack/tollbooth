Run redis locally

```bash
docker run -d --name local-redis redis -p 6379:6379

docker run -d --name redis-stack-server -p 6379:6379 redis/redis-stack-server:latest

docker run -d --name redis-stack -p 6379:6379 -p 8001:8001 redis/redis-stack:latest
```
