

## Stage 7: Export to TensorRT (`best.engine`)
TensorRT will optimize the model to run at maximum FPS on the Jetson Nano's GPU.
1. SSH into your Jetson Nano or open a terminal on it.
2. Ensure you have the `ultralytics` package installed on the Jetson.
3. Run the export script (you can copy `python/export_tensorrt.py` to the Jetson, or run this Python command):
   ```bash
   yolo export model=best.pt format=engine half=True device=0
   ```
4. This will generate `best.engine`. Update your inference script to use this `.engine` file instead of `.pt` for a massive speed boost.

## Stage 10: Run the Jetson Nano Inference Loop (Docker Method)
The Jetson Nano's default operating system uses Python 3.6, but YOLOv8 (`ultralytics`) strictly requires **Python 3.8 or newer**. Attempting to upgrade Python natively will break your GPU drivers. Because of this, you **must** use NVIDIA's Docker containers to run this project.

1. Open a terminal on your Jetson Nano.
2. Pull and run the official NVIDIA/Ultralytics container designed for the Jetson Nano:
   ```bash
   sudo docker run -it --rm --net=host --ipc=host --runtime nvidia -v /home/mokonano/Documents/iot/jetson_inference:/workspace/agritrust ultralytics/ultralytics:latest-jetson-jetpack4
   ```
   *(This downloads a fully isolated environment with Python 3.8, PyTorch, TensorRT, and YOLOv8 already installed and configured for your GPU).*
3. Once inside the Docker container, navigate to the mounted folder:
   ```bash
   cd /workspace/agritrust
   ```
4. Before installing packages, upgrade `setuptools` and `packaging` to fix build errors:
   ```bash
   pip3 install --upgrade pip setuptools wheel packaging
   ```
5. Install the remaining hardware dependencies:
   ```bash
   pip3 install pyserial requests mfrc522 Jetson.GPIO luma.oled luma.core pillow
   ```
5. Update `main.py` with your Supabase URL and Anon Key.
6. Run the script:
   ```bash
   python3 main.py
   ```
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
