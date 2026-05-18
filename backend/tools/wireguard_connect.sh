#!/bin/bash

# Function to display usage
usage() {
  echo "Usage: $0 -c <client_config_file>"
  echo "Example: $0 -c peer1.conf"
  exit 1
}

# Parse command-line arguments
while getopts ":c:" opt; do
  case $opt in
    c) CLIENT_CONF="$OPTARG" ;;
    *) usage ;;
  esac
done

# Validate inputs
if [[ -z "$CLIENT_CONF" ]]; then
  echo "Error: Missing client configuration file."
  usage
fi

# Check if WireGuard is installed
if ! command -v wg &> /dev/null; then
  echo "WireGuard is not installed. Installing WireGuard..."
  # Install WireGuard based on the Linux distribution
  if command -v apt &> /dev/null; then
    sudo apt update
    sudo apt install -y wireguard resolvconf
  elif command -v yum &> /dev/null; then
    sudo yum install -y wireguard-tools
  elif command -v dnf &> /dev/null; then
    sudo dnf install -y wireguard-tools
  elif command -v pacman &> /dev/null; then
    sudo pacman -S --noconfirm wireguard-tools
  else
    echo "Unsupported package manager. Please install WireGuard manually."
    exit 1
  fi
fi

# Check if resolvconf is installed (required for DNS configuration)
if grep -q "DNS" "$CLIENT_CONF" && ! command -v resolvconf &> /dev/null; then
  echo "Error: 'resolvconf' is not installed, but DNS is configured in $CLIENT_CONF."
  echo "To fix this, either:"
  echo "1. Install resolvconf: sudo apt install resolvconf"
  echo "2. Remove the 'DNS' line from $CLIENT_CONF"
  exit 1
fi

# Create the WireGuard configuration directory if it doesn't exist
WG_CLIENT_DIR="/etc/wireguard"
sudo mkdir -p "$WG_CLIENT_DIR"

# Copy the client configuration file to the WireGuard directory
CLIENT_CONF_NAME=$(basename "$CLIENT_CONF")
sudo cp "$CLIENT_CONF" "$WG_CLIENT_DIR/$CLIENT_CONF_NAME"

# Start the WireGuard interface
INTERFACE_NAME="${CLIENT_CONF_NAME%.conf}"
echo "Starting WireGuard interface $INTERFACE_NAME..."
sudo wg-quick up "$INTERFACE_NAME"

# Check if the interface is up
if ip a show "$INTERFACE_NAME" &> /dev/null; then
  echo "WireGuard interface $INTERFACE_NAME is up and running!"
  echo "You are now connected to the WireGuard server."
else
  echo "Failed to start WireGuard interface $INTERFACE_NAME. Check logs for details."
fi
