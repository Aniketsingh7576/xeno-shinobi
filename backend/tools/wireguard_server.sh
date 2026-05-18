#!/bin/bash

# Function to display usage
usage() {
  echo "Usage: $0 -p <port> -d <config_directory> -n <network_subnet>"
  echo "Example: $0 -p 51820 -d ~/wireguard-config1 -n 10.13.13.0/24"
  exit 1
}

# Function to install Docker
install_docker() {
  echo "Docker is not installed. Installing Docker..."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc

  # Add the repository to Apt sources
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  # Verify Docker installation
  if ! command -v docker &> /dev/null; then
    echo "Failed to install Docker. Please install it manually."
    exit 1
  else
    echo "Docker installed successfully."
  fi
}

# Parse command-line arguments
while getopts ":p:d:n:" opt; do
  case $opt in
    p) WG_PORT="$OPTARG" ;;
    d) WG_DIR="$OPTARG" ;;
    n) WG_NETWORK="$OPTARG" ;;
    *) usage ;;
  esac
done

# Validate inputs
if [[ -z "$WG_PORT" || -z "$WG_DIR" || -z "$WG_NETWORK" ]]; then
  echo "Error: Missing arguments."
  usage
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  install_docker
fi

# Define Docker image
WG_IMAGE="linuxserver/wireguard"

# Create WireGuard configuration directory
echo "Creating WireGuard configuration directory at $WG_DIR..."
mkdir -p "$WG_DIR"

# Check if a configuration file already exists
WG_CONF="$WG_DIR/wg0.conf"
if [[ ! -f "$WG_CONF" ]]; then
  echo "No configuration file found. Generating a new WireGuard configuration..."

  # Run the WireGuard container to generate the configuration
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=SYS_MODULE \
    -e PUID=$(id -u) \
    -e PGID=$(id -g) \
    -e TZ=UTC \
    -e SERVERURL=auto \
    -e SERVERPORT=$WG_PORT \
    -e PEERS=1 \
    -e PEERDNS=auto \
    -v "$WG_DIR:/config" \
    -v /lib/modules:/lib/modules \
    --sysctl="net.ipv4.conf.all.src_valid_mark=1" \
    "$WG_IMAGE"

  echo "Configuration generated at $WG_CONF."
else
  echo "Using existing configuration file at $WG_CONF."
fi

# Run the WireGuard container
echo "Starting WireGuard Docker container on port $WG_PORT..."
docker run -d \
  --name="wireguard_$WG_PORT" \
  --cap-add=NET_ADMIN \
  --cap-add=SYS_MODULE \
  -e PUID=$(id -u) \
  -e PGID=$(id -g) \
  -e TZ=UTC \
  -e SERVERURL=auto \
  -e SERVERPORT=$WG_PORT \
  -e PEERS=1 \
  -e PEERDNS=auto \
  -v "$WG_DIR:/config" \
  -v /lib/modules:/lib/modules \
  --sysctl="net.ipv4.conf.all.src_valid_mark=1" \
  -p $WG_PORT:$WG_PORT/udp \
  --restart unless-stopped \
  "$WG_IMAGE"

# Check if the container is running
if docker ps | grep -q "wireguard_$WG_PORT"; then
  echo "WireGuard container is running successfully on port $WG_PORT!"
  echo "Configuration files are located at: $WG_DIR"
  echo "You can find the client QR code in the 'peer1' folder."
else
  echo "Failed to start WireGuard container on port $WG_PORT. Check Docker logs for more details."
fi
