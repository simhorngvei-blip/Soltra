#!/bin/bash
# Soltra Raspberry Pi 3 Kiosk & CV Setup Script

echo "========================================="
echo " Starting Soltra Pi Setup..."
echo "========================================="

# 1. Update and install required packages
echo "[1/4] Installing system dependencies (NGINX, Chromium, OpenCV)..."
sudo apt-get update
sudo apt-get install -y nginx chromium-browser python3-opencv python3-numpy unclutter

# 2. Deploy the HUD to NGINX
echo "[2/4] Deploying Soltra HUD to NGINX web server..."
# We assume this script is run from the folder containing the 'build' folder
sudo cp -r build/* /var/www/html/
sudo systemctl restart nginx

# 3. Configure Chromium Kiosk Mode to run on startup
echo "[3/4] Configuring Kiosk Mode..."
# For Wayland (Raspberry Pi OS Bookworm)
mkdir -p ~/.config/wayfire.ini
cat <<EOT >> ~/.config/wayfire.ini

[autostart]
chromium = chromium-browser http://localhost --kiosk --noerrdialogs --disable-infobars --no-first-run --ozone-platform=wayland --enable-features=OverlayScrollbar
unclutter = unclutter -idle 0.5 -root
EOT

# 4. Set up CV Script
echo "[4/4] Setting up Computer Vision Tracker..."
# The cv folder should be copied alongside this script
mkdir -p ~/soltra-cv
cp -r soltra-cv/* ~/soltra-cv/

echo "========================================="
echo " Setup Complete!"
echo " Restarting in 5 seconds..."
echo "========================================="
sleep 5
sudo reboot
