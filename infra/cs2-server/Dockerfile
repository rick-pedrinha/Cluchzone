FROM steamcmd/steamcmd:ubuntu-22@sha256:a255f0e079af5d8925d5f2e28f7763aae91c30d159b125f6fcd8611d46fb6f98

RUN useradd --create-home --shell /bin/bash steam \
    && mkdir -p /opt/cs2 /run/secrets/clutchzone \
    && chown -R steam:steam /opt/cs2 /home/steam

COPY --chown=steam:steam entrypoint.sh /usr/local/bin/clutchzone-cs2
RUN chmod 0755 /usr/local/bin/clutchzone-cs2

WORKDIR /home/steam
EXPOSE 27015/udp 27015/tcp
ENTRYPOINT ["/usr/local/bin/clutchzone-cs2"]
