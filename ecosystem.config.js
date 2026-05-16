module.exports = {
  apps: [
    {
      name: 'uretim-bot',
      script: 'index.js',
      args: '--zamanli',

      // Çökünce otomatik yeniden başlat
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,        // 5 saniye bekleyip yeniden başlat

      // Bellek 500 MB'ı aşarsa yeniden başlat
      max_memory_restart: '500M',

      // Log ayarları
      log_date_format: 'DD.MM.YYYY HH:mm:ss',
      out_file: './logs/bot-out.log',
      error_file: './logs/bot-err.log',
      merge_logs: true,

      // Ortam değişkenleri
      env: {
        NODE_ENV: 'production',
        TZ: 'Europe/Istanbul',
      },
    },
  ],
};
