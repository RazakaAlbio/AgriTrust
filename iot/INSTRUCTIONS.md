

## Stage 10: Run the Jetson Nano Inference Loop (Docker Method)
The Jetson Nano's default operating system uses Python 3.6, but YOLOv8 (`ultralytics`) strictly requires **Python 3.8 or newer**. Attempting to upgrade Python natively will break your GPU drivers. Because of this, you **must** use NVIDIA's Docker containers to run this project.

1. Open a terminal on your Jetson Nano.
2. Pull and run the official NVIDIA/Ultralytics container designed for the Jetson Nano. 
   *(Catatan: Kita menghapus `--rm` dan menambahkan `--name agritrust_env` agar instalasi library kamu **TIDAK HILANG** saat keluar dari Docker. Kita juga menambahkan `--privileged -v /dev:/dev` agar Docker bisa mengakses hardware GPIO, I2C, SPI, dan Kamera).*
   ```bash
   sudo docker run -it --privileged -v /dev:/dev --net=host --ipc=host --runtime nvidia -v /home/mokonano/Documents/iot/jetson_inference:/workspace/agritrust --name agritrust_env ultralytics/ultralytics:latest-jetson-jetpack4
   ```
   *(Jika di masa depan kamu keluar dari docker dan ingin masuk lagi tanpa install ulang, cukup jalankan: `sudo docker start -i agritrust_env`)*

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
   pip3 install pyserial requests mfrc522 Jetson.GPIO luma.oled luma.core pillow qrcode[pil]
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

## Stage 12: Hardware Testing & RFID Registration
Kartu RFID yang baru dibeli semuanya kosong dan belum terdaftar. Kamu harus menetapkan 1 kartu sebagai **Admin** terlebih dahulu, baru kemudian kartu-kartu petani bisa didaftarkan.

**Langkah 1: Mengetahui UID Kartu (Untuk Admin)**
1. Jalankan script tester:
   ```bash
   python3 test_hardware.py
   ```
2. Saat layar menampilkan "SCAN RFID NOW", tempelkan 1 kartu yang ingin kamu jadikan Admin.
3. Terminal akan menampilkan tulisan `[+] RFID Scanned! ID: 123456789012`. Catat angka ID tersebut.

**Langkah 2: Menetapkan Kartu Admin**
1. Buka file `accounts.json` di Jetson Nano.
2. Ubah tulisan `"ADMIN_CARD_UID"` menjadi angka ID yang kamu catat tadi.
   ```json
   {
     "123456789012": {
       "role": "admin",
       "name": "System Admin"
     }
   }
   ```
3. Simpan file tersebut. Kartu Admin kamu sudah aktif!

**Langkah 3: Cara Mendaftarkan Kartu Petani (Farmer)**
1. Jalankan sistem utama: `python3 main.py`
2. Di layar Login, scan **Kartu Admin**.
3. Sistem akan masuk ke mode registrasi (OLED akan menampilkan "Scan NEW Card").
4. Tempelkan kartu baru yang masih kosong. Kartu tersebut akan otomatis terdaftar sebagai "Farmer" dan tersimpan di `accounts.json`.
5. Kartu tersebut sekarang bisa digunakan untuk login ke menu utama.

## Stage 13: Sinkronisasi RFID dengan Web (Supabase)
Bagaimana cara web mengetahui bahwa kartu RFID ini milik petani A atau petani B?

1. Ketika Jetson Nano mengirim data hasil scan kamera ke Supabase (ke tabel `scans`), ia akan menyertakan **UID kartu RFID** tersebut di dalam kolom `farmer_id`.
2. Di aplikasi Web (pada halaman Admin Dashboard), saat Admin membuatkan akun untuk seorang Petani, Admin harus memasukkan **UID kartu RFID** yang sama ke dalam profil petani tersebut (misalnya ada field input khusus bernama "RFID UID").
3. Dengan begitu, data scan dari Jetson Nano (yang membawa UID) akan otomatis terhubung dengan profil Petani di Web!


sudo docker start -i agritrust_env
cd /workspace/agritrust