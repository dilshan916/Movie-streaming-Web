# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Install dependencies and Google Chrome Stable
RUN apt-get update && apt-get install -y wget gnupg2 apt-transport-https ca-certificates curl \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory to /app
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Define environment variable
ENV ALLOWED_ORIGINS="*"
ENV CHROME_BIN=/usr/bin/google-chrome-stable

# Run VidSrc Streamer when the container launches
CMD ["uvicorn", "m3u8parser:app", "--host", "0.0.0.0", "--port", "8000"]
