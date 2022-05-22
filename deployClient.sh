#!/bin/bash

echo "pulling code"
git pull

echo "Building client app"
docker-compose up -d --build