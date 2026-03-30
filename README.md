# Openwrt-Virtual-Controller
Openwrt virtual controller


Main AP/

usr/share/luci/menu.d/luci-app-controller.json


/www/cgi-bin/get_clients

/www/luci-static/resources/view/controller/clients_dashboard.js



Remote AP's

/usr/bin/report_clients.sh




After copying the files on that specific locations you will need to:

Main AP:
* edit /www/cgi-bin/get_clients and specify the interfaces to check
* chmod +x /www/cgi-bin/get_clients

AP Slaves:
* edit /usr/bin/report_clients.sh and specify the interfaces to check and the ip address of the main ap
* chmod +x /usr/bin/report_clients.sh
* #crontab -e and add * * * * * /usr/bin/report_clients.sh

You should see on the main ap a new menu named Controller with an item named Wifi Clients.
There you should see their statistics, filter by ip, hostname ,ssid, mac, etc...

       


