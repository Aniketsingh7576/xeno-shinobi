#!/bin/sh
echo "------------------------------------------"
echo "-- Installing CUDA Toolkit and CUDA DNN --"
echo "------------------------------------------"
# Install CUDA Drivers and Toolkit
if [ -x "$(command -v apt)" ]; then
    echo "Installing cuda-toolkit-10-0"
    wget https://cdn.shinobi.video/installers/cuda-repo-ubuntu1804-10-0-local-10.0.130-410.48_1.0-1_amd64.deb -O cuda.deb
    dpkg -i cuda.deb
    sudo apt-key add /var/cuda-repo-10-0-local-10.0.130-410.48/7fa2af80.pub
    sudo apt-get update -y
    # CUDA Toolkit
    sudo apt install cuda-toolkit-10-0

    # Driver
    echo "Installing nvidia-driver-515-server"
    sudo apt install nvidia-driver-515-server

    # CUDNN
    echo "Installing CUDNN"
    wget https://cdn.shinobi.video/installers/libcudnn7_7.6.5.32-1+cuda10.0_amd64.deb -O cuda-dnn.deb
    sudo dpkg -i cuda-dnn.deb
    wget https://cdn.shinobi.video/installers/libcudnn7-dev_7.6.5.32-1+cuda10.0_amd64.deb -O cuda-dnn-dev.deb
    sudo dpkg -i cuda-dnn-dev.deb
    echo "-- Cleaning Up --"
    # Cleanup
    sudo rm cuda.deb
    sudo rm cuda-dnn.deb
    sudo rm cuda-dnn-dev.deb
    echo "------------------------------"
    echo "Reboot is required. Do it now?"
    echo "------------------------------"
    echo "(y)es or (N)o. Default is No."
    read rebootTheMachineHomie
    if [ "$rebootTheMachineHomie" = "y" ] || [ "$rebootTheMachineHomie" = "Y" ]; then
        sudo reboot
    fi
fi
if [ -x "$(command -v yum)" ]; then
    echo "CentOS no longer supported by this installer."
fi
