Pour commencer sur linux :
sudo apt update
sudo apt install -y mpv yt-dlp ffmpeg pulseaudio-utils pipewire-pulse

vérifier que tout répond :
mpv --version
yt-dlp --version
pactl info
pactl list short sinks
pactl list short sources

Pour tester le sink virtuel :
pactl load-module module-null-sink \
  sink_name=xmbot_sink \
  sink_properties=device.description=XM-Bot-Virtual-Sink \
  rate=48000 \
  channels=2

Vérifier que le module existe :
pactl list short sinks | grep xmbot_sink
pactl list short sources | grep xmbot_sink

Pour voir ce que mpv considère comme devices audio disponibles :
mpv --audio-device=help

Pour un test complet :
mpv --no-video --audio-device=pulse/xmbot_sink "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

Pour valider que l'environnement locaux est prêt :
which mpv
which yt-dlp
which pactl
mpv --audio-device=help | grep xmbot_sink
