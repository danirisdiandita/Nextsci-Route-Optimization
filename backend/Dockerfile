FROM python:3.12-slim-trixie
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
# GeoDjango loads GDAL, GEOS, and PROJ at runtime. libgdal36 pulls in all three.
# Its name follows the Debian release, so the base image names trixie.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends libgdal36 \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]
