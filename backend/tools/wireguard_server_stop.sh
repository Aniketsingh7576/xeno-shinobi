#!/bin/bash

# Function to display usage
usage() {
  echo "Usage: $0 -c <container_name>"
  echo "Example: $0 -c wireguard_51820"
  exit 1
}

# Parse command-line arguments
while getopts ":c:" opt; do
  case $opt in
    c) CONTAINER_NAME="$OPTARG" ;;
    *) usage ;;
  esac
done

# Validate inputs
if [[ -z "$CONTAINER_NAME" ]]; then
  echo "Error: Missing container name."
  usage
fi

# Check if the container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
  echo "Error: Container '$CONTAINER_NAME' does not exist."
  exit 1
fi

# Stop and remove the container
echo "Stopping and removing container '$CONTAINER_NAME'..."
docker stop "$CONTAINER_NAME" && docker rm "$CONTAINER_NAME"

# Check if the container was successfully removed
if ! docker ps -a --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
  echo "Container '$CONTAINER_NAME' has been stopped and removed."
else
  echo "Failed to stop or remove container '$CONTAINER_NAME'. Check Docker logs for more details."
fi
