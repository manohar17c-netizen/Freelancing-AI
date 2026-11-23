FROM python:3.13-slim
WORKDIR /app
COPY hrms-ai-demo /app/hrms-ai-demo
COPY nexcruit-product /app/nexcruit-product
RUN mkdir /data && chown 10001:10001 /data
USER 10001:10001
ENV HOST=0.0.0.0 PORT=8766 NEXCRUIT_DB=/data/workspace.sqlite3
VOLUME ["/data"]
EXPOSE 8766
CMD ["python", "nexcruit-product/server.py"]
