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

# Extract the interface name from the configuration file name
INTERFACE_NAME=$(basename "$CLIENT_CONF" .conf)

# Check if the interface exists
if ! ip a show "$INTERFACE_NAME" &> /dev/null; then
  echo "Error: Interface '$INTERFACE_NAME' does not exist."
  exit 1
fi

# Bring down the WireGuard interface
echo "Disconnecting WireGuard interface '$INTERFACE_NAME'..."
sudo wg-quick down "$INTERFACE_NAME"

# Check if the interface was successfully brought down
if ! ip a show "$INTERFACE_NAME" &> /dev/null; then
  echo "WireGuard interface '$INTERFACE_NAME' has been disconnected."
else
  echo "Failed to disconnect WireGuard interface '$INTERFACE_NAME'. Check logs for details."
fi
