
## Stage 11: Autostart on Boot (Systemd)
To ensure the Agri-Trust program runs automatically in the background every time the Jetson Nano turns on, we will create a systemd service.

1. Create a new service file:
   ```bash
   sudo nano /etc/systemd/system/agritrust.service
   ```
2. Paste the following configuration (update `/path/to/your/repo` with the actual path on your Jetson):
   ```ini
   [Unit]
   Description=Agri-Trust Edge AI Inference Loop
   After=network.target

   [Service]
   Type=simple
   User=root
   WorkingDirectory=/path/to/your/repo/iot/jetson_inference
   ExecStart=/bin/bash -c "source /path/to/your/repo/iot/jetson_inference/agritrust_env/bin/activate && python3 main.py"
   Restart=on-failure
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```
3. Save the file (Ctrl+O, Enter, Ctrl+X).
4. Reload systemd, enable the service, and start it:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable agritrust.service
   sudo systemctl start agritrust.service
   ```
5. You can check the logs anytime using:
   ```bash
   sudo journalctl -u agritrust.service -f
   ```






sudo docker start -i agritrust_env
cd /workspace/agritrust