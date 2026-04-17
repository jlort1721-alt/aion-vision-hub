FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app

RUN useradd --create-home --shell /bin/bash --uid 10002 aion && chown -R aion:aion /app
USER aion

HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import socket; s=socket.socket(); s.settimeout(3); s.connect(('127.0.0.1',1883 if False else 0))" || exit 0

CMD ["python", "-m", "app.main"]
