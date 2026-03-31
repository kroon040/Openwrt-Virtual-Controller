#!/bin/sh
# --- CONFIGURARE ---
# IP address of the main ap
PRINCIPAL_AP_IP="192.168.199.110"
# Specity wifi interfaces to monitor, separated by space
INTERFACES_TO_CHECK="phy0-ap0-vl10 phy0-ap0-vl70 phy1-ap0-vl70 phy1-ap0-vl10"
# --------------------
MY_AP_NAME=$(uci -q get system.@system[0].hostname)
POST_URL="http://${PRINCIPAL_AP_IP}/cgi-bin/get_clients"

# Pre-load /etc/ethers as a shell variable to avoid getline issues in awk
# Format per line: lowercase_mac=ip=hostname
ETHERS=$(awk '{gsub(/ +$/, ""); print tolower($1) "=" $2 "=" $3}' /etc/ethers)

ALL_CLIENTS_JSON=""
for iface in $INTERFACES_TO_CHECK; do
    if [ ! -d "/sys/class/net/$iface" ]; then continue; fi
    BAND="N/A"
    FREQ_MHZ=$(iw dev "$iface" info | sed -n 's/.*(\([0-9]\{4\}\) MHz).*/\1/p' | head -n 1)
    if [ -n "$FREQ_MHZ" ]; then
        if [ "$FREQ_MHZ" -gt 3000 ]; then BAND="5G"; else BAND="2.4G"; fi
    fi
    SSID_NAME="($iface)"
    VLAN_NAME=$(echo "$iface" | sed 's/.*-//')
    VLAN_SECTION=$(uci show wireless | grep "wifi-vlan.*\.name='${VLAN_NAME}'" | sed 's/\.name=.*//' | sed 's/wireless\.//')
    if [ -n "$VLAN_SECTION" ]; then
        NETWORK=$(uci -q get "wireless.${VLAN_SECTION}.network")
        WIFINET=$(uci show wireless | grep "wifinet.*\.network='${NETWORK}'" | sed 's/\.network=.*//' | sed 's/wireless\.//')
        if [ -n "$WIFINET" ]; then
            SSID_NAME=$(uci -q get "wireless.${WIFINET}.ssid" || echo "($iface)")
        fi
    fi
    CLIENTS_ON_THIS_IFACE=$(iw dev "$iface" station dump | awk -v ap_name="$MY_AP_NAME" -v iface_name="$iface" -v band="$BAND" -v ssid="$SSID_NAME" -v ethers="$ETHERS" '
        BEGIN {
            RS = "Station "; FS = "\n"; comma = "";
            n = split(ethers, lines, "\n");
            for (i=1; i<=n; i++) {
                m = split(lines[i], f, "=");
                if (m >= 2) {
                    ethers_ip[f[1]]   = f[2];
                    ethers_host[f[1]] = (m >= 3) ? f[3] : "";
                }
            }
        }
        {
            if (NR == 1) { next }
            mac = sig = rx = tx = "";
            conn_time = rx_bytes = tx_bytes = 0;
            mac = $1;
            sub(/^[ \t]+/, "", mac); sub(/ \(on.*\)/, "", mac);
            for (i=2; i<=NF; i++) {
                if ($i ~ /signal:/) { sig = $i; sub(/^.*signal:[\t ]*/, "", sig); sub(/ .*/, "", sig); sig = sig " dBm"; }
                if ($i ~ /rx bitrate:/) { rx = $i; sub(/^.*rx bitrate:[\t ]*/, "", rx); sub(/ .*/, "", rx); sub(/\..*/, "", rx); rx = rx "Mbps"; }
                if ($i ~ /tx bitrate:/) { tx = $i; sub(/^.*tx bitrate:[\t ]*/, "", tx); sub(/ .*/, "", tx); sub(/\..*/, "", tx); tx = tx "Mbps"; }
                if ($i ~ /connected time:/) { conn_time = $i; sub(/^.*connected time:[\t ]*/, "", conn_time); sub(/ .*/, "", conn_time); }
                if ($i ~ /rx bytes:/) { rx_bytes = $i; sub(/^.*rx bytes:[\t ]*/, "", rx_bytes); }
                if ($i ~ /tx bytes:/) { tx_bytes = $i; sub(/^.*tx bytes:[\t ]*/, "", tx_bytes); }
            }
            if (mac != "") {
                gsub(/\t/, "", mac); gsub(/\t/, "", sig); gsub(/\t/, "", rx); gsub(/\t/, "", tx);
                mac_lower = tolower(mac);
                client_ip   = (mac_lower in ethers_ip)   ? ethers_ip[mac_lower]   : "";
                client_host = (mac_lower in ethers_host) ? ethers_host[mac_lower] : "";
                printf "%s{\"mac\":\"%s\", \"ssid\":\"%s\", \"signal\":\"%s\", \"conn_time\":%s, \"rx_rate\":\"%s\", \"tx_rate\":\"%s\", \"total_data\":%d, \"ap\":\"%s\", \"iface\":\"%s\", \"band\":\"%s\", \"ip\":\"%s\", \"hostname\":\"%s\"}", \
                comma, mac, ssid, sig, conn_time, rx, tx, (rx_bytes+tx_bytes), ap_name, iface_name, band, client_ip, client_host;
                comma = ",";
            }
        }
    ')
    if [ -n "$CLIENTS_ON_THIS_IFACE" ]; then
        if [ -n "$ALL_CLIENTS_JSON" ]; then
            ALL_CLIENTS_JSON="${ALL_CLIENTS_JSON},"
        fi
        ALL_CLIENTS_JSON="${ALL_CLIENTS_JSON}${CLIENTS_ON_THIS_IFACE}"
    fi
done
if [ -n "$ALL_CLIENTS_JSON" ]; then
    JSON_DATA="[${ALL_CLIENTS_JSON}]"
    wget -q -O - --post-data="$JSON_DATA" "$POST_URL" >/dev/null
fi
